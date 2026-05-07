# Nokta Hoop TTS Server

Local Chatterbox Multilingual text-to-speech service for Mascot responses.
The mobile app does not talk to this service directly. The token server proxies
requests so the app can keep using the same public token-server URL.

## Setup

```powershell
cd services\tts-server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python src\main.py
```

The first synthesis downloads and loads Chatterbox model weights, so it can take
time. GPU is strongly recommended. CPU can work for testing but may be slow.

Optional voice cloning:

```env
CHATTERBOX_AUDIO_PROMPT_PATH=D:\path\to\voice.wav
```

Use a clean short voice sample in the same language as the requested speech.
