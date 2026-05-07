import { getTokenServerUrl } from './transcript';

type MascotSpeechResponse = {
  audioPath?: string;
  audioUrl?: string;
  provider?: string;
};

const MASCOT_TTS_PROVIDER =
  process.env.EXPO_PUBLIC_MASCOT_TTS_PROVIDER ?? 'chatterbox';
const MASCOT_TTS_LANGUAGE =
  process.env.EXPO_PUBLIC_MASCOT_TTS_LANGUAGE ?? 'tr';
const MASCOT_TTS_TIMEOUT_MS = Number.parseInt(
  process.env.EXPO_PUBLIC_MASCOT_TTS_TIMEOUT_MS ?? '20000',
  10,
);

export async function requestMascotSpeechAudioUrl(input: {
  text: string;
}): Promise<string | null> {
  if (MASCOT_TTS_PROVIDER === 'device') {
    return null;
  }

  const tokenServerUrl = getTokenServerUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MASCOT_TTS_TIMEOUT_MS);

  try {
    const response = await fetch(`${tokenServerUrl}/tts/mascot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input.text,
        language_id: MASCOT_TTS_LANGUAGE,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await getResponseMessage(response));
    }

    const body = (await response.json()) as MascotSpeechResponse;
    const audioUrl = body.audioUrl ?? body.audioPath;
    if (!audioUrl) {
      throw new Error('Mascot TTS response is invalid.');
    }

    return audioUrl.startsWith('http')
      ? audioUrl
      : `${tokenServerUrl}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function getResponseMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: string;
      detail?: string;
      provider?: string;
    };
    return body.error ?? body.detail ?? `Mascot TTS failed: ${response.status}`;
  } catch {
    return `Mascot TTS failed: ${response.status}`;
  }
}
