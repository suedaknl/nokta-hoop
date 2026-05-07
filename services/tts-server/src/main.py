from __future__ import annotations

import hashlib
import os
from pathlib import Path
from threading import Lock
from typing import Any

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


class TtsRequest(BaseModel):
    text: str = Field(min_length=1)
    language_id: str | None = None
    audio_prompt_path: str | None = None


app = FastAPI(title="Nokta Hoop TTS Server")

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8790"))
DEVICE = os.getenv("CHATTERBOX_DEVICE", "auto")
DEFAULT_LANGUAGE_ID = os.getenv("CHATTERBOX_LANGUAGE_ID", "tr")
DEFAULT_AUDIO_PROMPT_PATH = os.getenv("CHATTERBOX_AUDIO_PROMPT_PATH", "").strip()
MAX_TEXT_LENGTH = int(os.getenv("TTS_MAX_TEXT_LENGTH", "1000"))
CACHE_DIR = Path(os.getenv("TTS_CACHE_DIR", "cache")).resolve()

_model: Any | None = None
_model_lock = Lock()
_generation_lock = Lock()


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "nokta-hoop-tts-server",
        "provider": "chatterbox-multilingual",
        "languageId": DEFAULT_LANGUAGE_ID,
    }


@app.post("/tts")
def create_tts_audio(request: TtsRequest) -> dict[str, str]:
    text = request.text.strip()
    if len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Text is too long. Max length is {MAX_TEXT_LENGTH}.",
        )

    language_id = (request.language_id or DEFAULT_LANGUAGE_ID).strip() or "tr"
    audio_prompt_path = get_audio_prompt_path(request.audio_prompt_path)
    cache_key = build_cache_key(text, language_id, audio_prompt_path)
    filename = f"{cache_key}.wav"
    output_path = CACHE_DIR / filename

    if not output_path.exists():
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        model = get_model()
        kwargs: dict[str, str] = {"language_id": language_id}
        if audio_prompt_path:
            kwargs["audio_prompt_path"] = audio_prompt_path

        with _generation_lock:
            wav = model.generate(text, **kwargs)
        samples = to_mono_float32(wav)
        sf.write(output_path, samples, model.sr)

    return {
        "audioPath": f"/audio/{filename}",
        "filename": filename,
        "languageId": language_id,
        "provider": "chatterbox-multilingual",
    }


@app.get("/audio/{filename}")
def get_audio(filename: str) -> FileResponse:
    if not is_safe_audio_filename(filename):
        raise HTTPException(status_code=400, detail="Invalid audio filename.")

    audio_path = CACHE_DIR / filename
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found.")

    return FileResponse(
        audio_path,
        media_type="audio/wav",
        filename=filename,
        headers={"Cache-Control": "public, max-age=86400"},
    )


def get_model() -> Any:
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:
            return _model

        import torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        device = DEVICE
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"

        _model = ChatterboxMultilingualTTS.from_pretrained(device=device)
        return _model


def get_audio_prompt_path(value: str | None) -> str | None:
    raw_value = (value or DEFAULT_AUDIO_PROMPT_PATH).strip()
    if not raw_value:
        return None

    prompt_path = Path(raw_value).expanduser().resolve()
    if not prompt_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Audio prompt file does not exist: {prompt_path}",
        )

    return str(prompt_path)


def build_cache_key(
    text: str,
    language_id: str,
    audio_prompt_path: str | None,
) -> str:
    payload = "\n".join(
        [
            "chatterbox-multilingual",
            language_id,
            audio_prompt_path or "default-voice",
            text,
        ],
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]


def to_mono_float32(wav: Any) -> np.ndarray:
    if hasattr(wav, "detach"):
        wav = wav.detach().cpu().numpy()

    samples = np.asarray(wav, dtype=np.float32).squeeze()
    if samples.ndim == 0:
        samples = np.asarray([float(samples)], dtype=np.float32)
    if samples.ndim > 1:
        samples = samples.reshape(-1)

    return np.clip(samples, -1.0, 1.0)


def is_safe_audio_filename(filename: str) -> bool:
    return (
        filename.endswith(".wav")
        and len(filename) == 36
        and all(char in "0123456789abcdef.wav" for char in filename)
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
