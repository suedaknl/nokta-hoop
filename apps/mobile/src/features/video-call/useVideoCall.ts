import { useRef, useState } from 'react';
import type { Call } from '@stream-io/video-client';
import { StreamVideoClient } from '@stream-io/video-react-native-sdk';
import {
  DEFAULT_CALL_ID,
  DEFAULT_USER_NAME,
  createGuestId,
  normalizeCallId,
  normalizeUserId,
  type CallTranscript,
} from '@nokta-hoop/hoop-call';

import {
  CALL_JOIN_TIMEOUT_MS,
  CALL_TYPE,
  TOKEN_TIMEOUT_MS,
  TRANSCRIPT_POLL_ATTEMPTS,
  TRANSCRIPT_POLL_INTERVAL_MS,
} from './constants';
import { requestStreamToken } from './services/token';
import type {
  DemoUser,
  JoinMediaMode,
  JoinStatus,
  LeaveOptions,
  LeaveResult,
  TranscriptFetchStatus,
} from './types';
import {
  isTranscriptNotReadyError,
  requestCallTranscript,
} from '../../services/transcript';
import { requestEndCall } from '../../services/calls';

const API_KEY = process.env.EXPO_PUBLIC_STREAM_API_KEY;
const ENABLE_TRANSCRIPTION =
  process.env.EXPO_PUBLIC_STREAM_ENABLE_TRANSCRIPTION !== 'false';
const TRANSCRIPTION_LANGUAGE =
  process.env.EXPO_PUBLIC_STREAM_TRANSCRIPTION_LANGUAGE || 'tr';

type TranscriptionCall = Call & {
  startTranscription: (options?: { language?: string }) => Promise<unknown>;
  stopTranscription: () => Promise<unknown>;
};

export function useVideoCall() {
  const [joinStatus, setJoinStatus] = useState<JoinStatus>('idle');
  const [userName, setUserName] = useState<string>(DEFAULT_USER_NAME);
  const [userId, setUserId] = useState<string>(() => createGuestId());
  const [callId, setCallId] = useState<string>(DEFAULT_CALL_ID);
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<CallTranscript | null>(null);
  const [transcriptStatus, setTranscriptStatus] =
    useState<TranscriptFetchStatus>('idle');
  const [transcriptMessage, setTranscriptMessage] = useState<string | null>(
    null,
  );
  const transcriptionStartedRef = useRef(false);

  const cleanupConnection = async (
    currentCall: Call | null = call,
    currentClient: StreamVideoClient | null = client,
  ) => {
    try {
      await currentCall?.leave();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!message.includes('already been left')) {
        console.warn('call leave failed:', e);
      }
    }
    try {
      await currentClient?.disconnectUser(5_000);
    } catch (e) {
      console.warn('disconnectUser failed:', e);
    }

    setCall(null);
    setClient(null);
    setJoinStatus('idle');
    setStatusText(null);
  };

  const join = async (
    input: { callId?: string; mediaMode?: JoinMediaMode } = {},
  ) => {
    if (joinStatus !== 'idle' || (client && call)) {
      return false;
    }
    if (!API_KEY) {
      setError('EXPO_PUBLIC_STREAM_API_KEY is not configured');
      return false;
    }

    setError(null);
    setTranscript(null);
    setTranscriptStatus('idle');
    setTranscriptMessage(null);
    setStatusText('Getting token...');
    setJoinStatus('joining');

    const nextUserName = userName.trim();
    const nextUserId = normalizeUserId(userId);
    if (nextUserName.length < 2) {
      setError('Enter a display name with at least 2 characters.');
      setJoinStatus('idle');
      setStatusText(null);
      return false;
    }
    if (nextUserId.length < 3) {
      setError(
        'Enter a user ID with at least 3 letters, numbers, underscores, or hyphens.',
      );
      setJoinStatus('idle');
      setStatusText(null);
      return false;
    }

    const user: DemoUser = { id: nextUserId, name: nextUserName };
    const targetCallId = normalizeCallId(input.callId ?? callId) || DEFAULT_CALL_ID;
    const tokenProvider = async () =>
      withTimeout(
        requestStreamToken(user.id, user.name),
        TOKEN_TIMEOUT_MS,
        'Token request timed out. Check token server URL and phone network access.',
      );
    let nextClient: StreamVideoClient | null = null;
    let nextCall: Call | null = null;

    try {
      nextClient = StreamVideoClient.getOrCreateInstance({
        apiKey: API_KEY,
        user,
        tokenProvider,
      });

      setStatusText('Joining call...');
      nextCall = nextClient.call(CALL_TYPE, targetCallId);
      await withTimeout(
        nextCall.join({
          create: true,
          video: input.mediaMode === 'mentor',
        }),
        CALL_JOIN_TIMEOUT_MS,
        'Stream call join timed out. Check internet access, Stream app settings, and Metro logs.',
      );

      await configureCallMedia(nextCall, input.mediaMode ?? 'default');
      await startCallTranscription(nextCall);

      setClient(nextClient);
      setCall(nextCall);
      setUserName(nextUserName);
      setUserId(nextUserId);
      setCallId(targetCallId);
      setStatusText(null);
      setJoinStatus('idle');
      return true;
    } catch (joinError) {
      const message =
        joinError instanceof Error ? joinError.message : 'Failed to join call';
      setError(message);
      await cleanupConnection(nextCall, nextClient);
      return false;
    }
  };

  const leave = async (options: LeaveOptions = {}): Promise<LeaveResult> => {
    if (!call || !client) {
      return {
        transcript,
        status: transcriptStatus,
        message: transcriptMessage,
      };
    }

    const targetCall = call;
    const targetClient = client;
    const targetCallId = callId;
    setJoinStatus('leaving');
    setStatusText('Stopping transcription...');
    setTranscriptStatus('processing');
    setTranscriptMessage('Transcript is being prepared.');

    try {
      await stopCallTranscription(targetCall);
      if (options.endCall !== false) {
        setStatusText('Ending call for everyone...');
        await endCallForEveryone(targetCall, targetCallId);
      }
    } finally {
      await cleanupConnection(targetCall, targetClient);
    }

    setStatusText('Waiting for transcript...');
    const result = await pollTranscript(
      targetCallId,
      options.transcriptPollAttempts,
    );
    setStatusText(null);
    return result;
  };

  const refreshTranscript = async (): Promise<LeaveResult> => {
    setTranscriptStatus('processing');
    setTranscriptMessage('Checking transcript status...');
    return pollTranscript(callId, 1);
  };

  const newCallId = () => {
    setCallId(`room-${Math.floor(100000 + Math.random() * 900000)}`);
    setTranscript(null);
    setTranscriptStatus('idle');
    setTranscriptMessage(null);
  };

  const updateUserName = (value: string) => {
    setUserName(value);
    if (!userId) {
      setUserId(createGuestId());
    }
  };

  const clearMessages = () => {
    setError(null);
    setStatusText(null);
  };

  const startCallTranscription = async (targetCall: Call) => {
    if (!ENABLE_TRANSCRIPTION) {
      return;
    }

    try {
      await (targetCall as TranscriptionCall).startTranscription({
        language: TRANSCRIPTION_LANGUAGE,
      });
      transcriptionStartedRef.current = true;
    } catch (transcriptionError) {
      transcriptionStartedRef.current = false;
      console.warn('startTranscription failed:', transcriptionError);
      setTranscriptStatus('failed');
      setTranscriptMessage(
        'Transcription could not be started. Check Stream transcription settings.',
      );
    }
  };

  const configureCallMedia = async (
    targetCall: Call,
    mediaMode: JoinMediaMode,
  ) => {
    try {
      if (mediaMode === 'requester') {
        await targetCall.camera.disable(true);
        await targetCall.microphone.disable(true);
        return;
      }

      if (mediaMode === 'mentor') {
        await targetCall.microphone.enable();
        await targetCall.camera.enable();
      }
    } catch (mediaError) {
      console.warn('configure call media failed:', mediaError);
    }
  };

  const stopCallTranscription = async (targetCall: Call) => {
    if (!transcriptionStartedRef.current) {
      return;
    }

    try {
      await (targetCall as TranscriptionCall).stopTranscription();
    } catch (transcriptionError) {
      console.warn('stopTranscription failed:', transcriptionError);
    } finally {
      transcriptionStartedRef.current = false;
    }
  };

  const endCallForEveryone = async (
    targetCall: Call,
    targetCallId: string,
  ) => {
    try {
      await requestEndCall({
        callId: targetCallId,
        callType: CALL_TYPE,
      });
      return;
    } catch (serverError) {
      console.warn('server end call failed:', serverError);
    }

    try {
      await targetCall.endCall();
    } catch (clientError) {
      console.warn('client end call failed:', clientError);
      setError(
        'Call could not be ended for everyone. You may need to leave from the other device too.',
      );
    }
  };

  const pollTranscript = async (
    targetCallId: string,
    attempts = TRANSCRIPT_POLL_ATTEMPTS,
  ): Promise<LeaveResult> => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const readyTranscript = await requestCallTranscript({
          callType: CALL_TYPE,
          callId: targetCallId,
          language: TRANSCRIPTION_LANGUAGE,
        });
        setTranscript(readyTranscript);
        setTranscriptStatus('ready');
        setTranscriptMessage(null);
        return {
          transcript: readyTranscript,
          status: 'ready',
          message: null,
        };
      } catch (pollError) {
        if (isTranscriptNotReadyError(pollError)) {
          if (attempt < attempts) {
            await delay(TRANSCRIPT_POLL_INTERVAL_MS);
            continue;
          }

          const message =
            'Transcript is still processing. Use refresh in a few moments.';
          setTranscriptStatus('not_ready');
          setTranscriptMessage(message);
          return {
            transcript: null,
            status: 'not_ready',
            message,
          };
        }

        const message =
          pollError instanceof Error
            ? pollError.message
            : 'Transcript request failed.';
        setTranscriptStatus('failed');
        setTranscriptMessage(message);
        return {
          transcript: null,
          status: 'failed',
          message,
        };
      }
    }

    const message = 'Transcript is still processing.';
    setTranscriptStatus('not_ready');
    setTranscriptMessage(message);
    return {
      transcript: null,
      status: 'not_ready',
      message,
    };
  };

  return {
    call,
    callId,
    client,
    error,
    joining: joinStatus === 'joining',
    leaving: joinStatus === 'leaving',
    statusText,
    transcript,
    transcriptMessage,
    transcriptStatus,
    transcriptionLanguage: TRANSCRIPTION_LANGUAGE,
    userId,
    userName,
    clearMessages,
    join,
    leave,
    newCallId,
    refreshTranscript,
    setCallId,
    setUserId,
    updateUserName,
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
