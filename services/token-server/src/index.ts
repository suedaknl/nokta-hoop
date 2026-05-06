import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import { StreamClient } from '@stream-io/node-sdk';
import {
  extractTranscriptionAssets,
  fetchTranscriptFromAsset,
  formatTranscriptAsJson,
  formatTranscriptAsMarkdown,
  formatTranscriptAsText,
  normalizeCallId,
  normalizeCallType,
  pickLatestTranscription,
  type CallTranscript,
} from '@nokta-hoop/hoop-call';

import { DEMO_USERS, getDemoUser } from './demoUsers.ts';

type HealthResponse = {
  status: 'ok';
  service: 'nokta-hoop-token-server';
};

type TokenRequest = {
  user_id?: string;
  user_name?: string;
};

type TokenResponse = {
  token: string;
  user: {
    id: string;
    name: string;
  };
  expiresIn: number;
};

type StreamVideoCall = {
  listTranscriptions: () => Promise<unknown>;
};

type StreamVideoFacade = {
  call: (callType: string, callId: string) => StreamVideoCall;
};

type TranscriptExportFormat = 'json' | 'md' | 'txt';

class TranscriptPendingError extends Error {
  constructor(message = 'Transcript is not ready yet.') {
    super(message);
    this.name = 'TranscriptPendingError';
  }
}

const app = express();
const port = Number.parseInt(process.env.PORT ?? '8787', 10);
const host = process.env.HOST ?? '0.0.0.0';
const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;
const allowedOrigins = process.env.ALLOWED_ORIGINS ?? '*';
const transcriptionLanguage = process.env.STREAM_TRANSCRIPTION_LANGUAGE ?? 'tr';

const streamClient =
  apiKey && apiSecret ? new StreamClient(apiKey, apiSecret) : null;

const corsOrigins =
  allowedOrigins === '*' || allowedOrigins.trim() === ''
    ? true
    : allowedOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

app.use(cors({ origin: corsOrigins, methods: ['GET', 'POST'], maxAge: 86400 }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    service: 'nokta-hoop-token-server',
    health: '/health',
    token: '/token',
    users: '/users',
    transcript: '/calls/default/{callId}/transcript',
    export: '/calls/default/{callId}/export?format=md',
  });
});

app.get('/health', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'nokta-hoop-token-server',
  };
  res.json(body);
});

app.get('/users', (_req, res) => {
  res.json({
    users: DEMO_USERS,
    dynamicUsers: {
      enabled: true,
      idPattern: '^[a-z0-9_-]{3,64}$',
      nameLength: '2-80',
    },
  });
});

app.post('/token', async (req, res): Promise<void> => {
  const { user_id: userId, user_name: userName } = req.body as TokenRequest;
  if (typeof userId !== 'string') {
    res.status(400).json({ error: 'Invalid request. Send { user_id }.' });
    return;
  }

  if (!streamClient) {
    res
      .status(500)
      .json({ error: 'STREAM_API_KEY/STREAM_API_SECRET not configured' });
    return;
  }

  const user = getDemoUser(
    userId,
    typeof userName === 'string' ? userName : undefined,
  );
  if (!user) {
    res.status(400).json({
      error:
        'Invalid demo user. Use id 3-64 chars with lowercase letters, numbers, underscores, or hyphens. Name must be 2-80 chars.',
    });
    return;
  }

  try {
    await streamClient.upsertUsers([{ id: user.id, name: user.name }]);
    const token = streamClient.generateUserToken({
      user_id: user.id,
      validity_in_seconds: 3600,
    });

    const body: TokenResponse = {
      token,
      user,
      expiresIn: 3600,
    };
    res.json(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Token generation failed';
    res.status(500).json({ error: message });
  }
});

app.get('/calls/:callType/:callId/transcriptions', async (req, res) => {
  const callType = normalizeCallType(req.params.callType ?? '');
  const callId = normalizeCallId(req.params.callId ?? '');

  if (!callType || !callId) {
    res.status(400).json({ error: 'Invalid call type or call ID.' });
    return;
  }

  try {
    const call = getStreamVideoCall(callType, callId);
    const response = await call.listTranscriptions();
    res.json({
      callType,
      callId,
      transcriptions: extractTranscriptionAssets(response),
      raw: response,
    });
  } catch (err) {
    const { status, message } = normalizeStreamError(err);
    res.status(status).json({ error: message });
  }
});

app.get('/calls/:callType/:callId/transcript', async (req, res) => {
  const callType = normalizeCallType(req.params.callType ?? '');
  const callId = normalizeCallId(req.params.callId ?? '');
  const language =
    typeof req.query.language === 'string'
      ? req.query.language
      : transcriptionLanguage;

  if (!callType || !callId) {
    res.status(400).json({ error: 'Invalid call type or call ID.' });
    return;
  }

  try {
    const transcript = await getReadyTranscript({
      callId,
      callType,
      language,
    });
    res.json(transcript);
  } catch (err) {
    if (err instanceof TranscriptPendingError) {
      res.status(404).json({
        error: err.message,
        status: 'processing',
      });
      return;
    }

    const { status, message } = normalizeStreamError(err);
    res.status(status).json({ error: message });
  }
});

app.get('/calls/:callType/:callId/export', async (req, res) => {
  const callType = normalizeCallType(req.params.callType ?? '');
  const callId = normalizeCallId(req.params.callId ?? '');
  const language =
    typeof req.query.language === 'string'
      ? req.query.language
      : transcriptionLanguage;
  const format = getExportFormat(req.query.format);

  if (!callType || !callId) {
    res.status(400).json({ error: 'Invalid call type or call ID.' });
    return;
  }

  if (!format) {
    res.status(400).json({ error: 'Invalid export format. Use md, txt, or json.' });
    return;
  }

  try {
    const transcript = await getReadyTranscript({
      callId,
      callType,
      language,
    });
    const body = formatTranscriptExport(transcript, format);
    const filename = `${sanitizeFilenamePart(callType)}-${sanitizeFilenamePart(
      callId,
    )}-transcript.${format}`;

    res.setHeader('Content-Type', getExportContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (err) {
    if (err instanceof TranscriptPendingError) {
      res.status(404).json({
        error: err.message,
        status: 'processing',
      });
      return;
    }

    const { status, message } = normalizeStreamError(err);
    res.status(status).json({ error: message });
  }
});

app.listen(port, host, () => {
  console.log(`nokta-hoop token server running at http://${host}:${port}`);
  if (!apiKey || !apiSecret) {
    console.error(
      'Missing STREAM_API_KEY and/or STREAM_API_SECRET in environment. Set in .env.',
    );
  }
});

function getStreamVideoCall(callType: string, callId: string): StreamVideoCall {
  if (!streamClient) {
    throw new Error('STREAM_API_KEY/STREAM_API_SECRET not configured');
  }

  const video = (streamClient as unknown as { video?: StreamVideoFacade }).video;
  if (!video?.call) {
    throw new Error('Stream video client is not available in this SDK version.');
  }

  return video.call(callType, callId);
}

async function getReadyTranscript(input: {
  callId: string;
  callType: string;
  language: string;
}): Promise<CallTranscript> {
  const call = getStreamVideoCall(input.callType, input.callId);
  const response = await call.listTranscriptions();
  const asset = pickLatestTranscription(extractTranscriptionAssets(response));

  if (!asset) {
    throw new TranscriptPendingError('Transcript is not ready yet.');
  }

  const transcript = await fetchTranscriptFromAsset(asset, input);

  if (transcript.items.length === 0) {
    console.warn(
      `Transcript asset for ${input.callType}:${input.callId} is available but contains no speech fragments yet.`,
    );
    throw new TranscriptPendingError(
      'Transcript is still processing or no speech has been detected yet.',
    );
  }

  return transcript;
}

function getExportFormat(value: unknown): TranscriptExportFormat | null {
  if (value === undefined || value === null) {
    return 'md';
  }
  if (value === 'json' || value === 'md' || value === 'txt') {
    return value;
  }
  return null;
}

function formatTranscriptExport(
  transcript: CallTranscript,
  format: TranscriptExportFormat,
): string {
  if (format === 'json') {
    return formatTranscriptAsJson(transcript);
  }
  if (format === 'txt') {
    return formatTranscriptAsText(transcript);
  }
  return formatTranscriptAsMarkdown(transcript);
}

function getExportContentType(format: TranscriptExportFormat): string {
  if (format === 'json') {
    return 'application/json; charset=utf-8';
  }
  if (format === 'txt') {
    return 'text/plain; charset=utf-8';
  }
  return 'text/markdown; charset=utf-8';
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'call';
}

function normalizeStreamError(err: unknown): {
  status: number;
  message: string;
} {
  const message = err instanceof Error ? err.message : 'Stream request failed';
  if (message.includes('not configured')) {
    return { status: 500, message };
  }
  if (message.includes('not available')) {
    return { status: 502, message };
  }
  return { status: 502, message };
}
