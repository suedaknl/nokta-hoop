import {
  buildTranscriptReturnMessage,
  normalizeEscalationTopic,
  type EscalationRequest,
  type MascotDecision,
  type MascotChatMessage,
  type MascotChatRole,
} from '@nokta-hoop/hoop-core';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MascotScreen, MentorQueueScreen } from './src/features/mascot';
import {
  TranscriptScreen,
  useVideoCall,
  VideoCallScreen,
} from './src/features/video-call';
import {
  acceptEscalation,
  createEscalation,
  getEscalation,
  listEscalations,
  resolveEscalation,
} from './src/services/escalations';
import { requestMascotDecision } from './src/services/mascotDecision';
import { rootStyles } from './src/styles/rootStyles';
import type { LeaveOptions, LeaveResult } from './src/features/video-call/types';
import type { AppScreen } from './src/types';

type PendingTranscriptContext = {
  escalationId: string;
  expertName?: string;
};

type PendingExpertOffer = {
  question: string;
  topic: string;
};

const MASCOT_WELCOME_MESSAGE =
  'Merhaba, ben Nokta Mascot. Fikrini birlikte netleştirebiliriz; uzman gerektiğinde seni mentora bağlarım.';

export default function App() {
  return (
    <GestureHandlerRootView style={rootStyles.root}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const [screen, setScreen] = useState<AppScreen>('mascot');
  const [messages, setMessages] = useState<MascotChatMessage[]>(() => [
    createMascotChatMessage('assistant', MASCOT_WELCOME_MESSAGE),
  ]);
  const [activeEscalation, setActiveEscalation] =
    useState<EscalationRequest | null>(null);
  const [escalationBusy, setEscalationBusy] = useState(false);
  const [escalationError, setEscalationError] = useState<string | null>(null);
  const [mentorRequests, setMentorRequests] = useState<EscalationRequest[]>([]);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [acceptingEscalationId, setAcceptingEscalationId] = useState<
    string | null
  >(null);
  const [mascotSpeaking, setMascotSpeaking] = useState(false);
  const [pendingExpertOffer, setPendingExpertOffer] =
    useState<PendingExpertOffer | null>(null);
  const [pendingTranscriptContext, setPendingTranscriptContext] =
    useState<PendingTranscriptContext | null>(null);
  const acceptedEscalationIdRef = useRef<string | null>(null);
  const completedTranscriptEscalationRef = useRef<string | null>(null);
  const speechRunRef = useRef(0);
  const videoCall = useVideoCall();

  useEffect(() => {
    if (!activeEscalation || activeEscalation.status !== 'pending') {
      return;
    }

    let cancelled = false;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const nextEscalation = await getEscalation(activeEscalation.id);
          if (cancelled) {
            return;
          }

          setActiveEscalation(nextEscalation);
          if (
            nextEscalation.status === 'accepted' &&
            acceptedEscalationIdRef.current !== nextEscalation.id
          ) {
            acceptedEscalationIdRef.current = nextEscalation.id;
            appendMascotMessage(
              'system',
              `${nextEscalation.expert?.name ?? 'Mentor'} isteği kabul etti. Video görüşme açılıyor.`,
              nextEscalation.id,
            );
            await beginEscalationCall(nextEscalation);
          }
        } catch (error) {
          if (!cancelled) {
            setEscalationError(
              error instanceof Error
                ? error.message
                : 'Escalation status could not be checked.',
            );
          }
        }
      })();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeEscalation]);

  useEffect(() => {
    if (screen === 'mentorQueue') {
      void refreshMentorQueue();
    }
  }, [screen]);

  useEffect(() => {
    if (!pendingTranscriptContext) {
      return;
    }

    let cancelled = false;
    const checkTranscript = async () => {
      const result = await videoCall.refreshTranscript();
      if (!cancelled) {
        handlePendingTranscriptResult(pendingTranscriptContext, result);
      }
    };

    const interval = setInterval(() => {
      void checkTranscript();
    }, 5000);

    void checkTranscript();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingTranscriptContext]);

  function speakMascotMessage(text: string) {
    const runId = speechRunRef.current + 1;
    speechRunRef.current = runId;
    setMascotSpeaking(true);

    const finishSpeech = () => {
      if (speechRunRef.current === runId) {
        setMascotSpeaking(false);
      }
    };

    Speech.speak(text, {
      language: 'tr-TR',
      onDone: finishSpeech,
      onError: finishSpeech,
      onStopped: finishSpeech,
      pitch: 1,
      rate: 1.2,
    });
  }

  function stopMascotSpeech() {
    speechRunRef.current += 1;
    setMascotSpeaking(false);
    void Speech.stop();
  }

  async function leave(options: LeaveOptions = {}) {
    const currentEscalation = activeEscalation;
    const transcriptContext = currentEscalation
      ? {
          escalationId: currentEscalation.id,
          expertName: currentEscalation.expert?.name,
        }
      : null;
    const leaveResult = videoCall.leave({
      endCall: options.endCall,
      transcriptPollAttempts: currentEscalation ? 1 : undefined,
    });

    if (currentEscalation && transcriptContext) {
      completedTranscriptEscalationRef.current = null;
      setPendingTranscriptContext(transcriptContext);
      appendMascotMessage(
        'assistant',
        'Mentor görüşmesi bitti. Transcript hazırlanıyor; hazır olana kadar maskot konuşmasını bekletiyorum.',
        currentEscalation.id,
      );
      setActiveEscalation(null);
      acceptedEscalationIdRef.current = null;
      setScreen('mascot');

      const result = await leaveResult;
      handlePendingTranscriptResult(transcriptContext, result);
      return;
    }

    setScreen('transcript');
    const result = await leaveResult;

    if (result.status === 'failed') {
      setEscalationError(result.message);
    }
  }

  function handlePendingTranscriptResult(
    context: PendingTranscriptContext,
    result: LeaveResult,
  ) {
    if (result.status === 'ready' && result.transcript) {
      finishPendingTranscript(context, result);
      return;
    }

    if (result.status === 'failed') {
      if (completedTranscriptEscalationRef.current === context.escalationId) {
        return;
      }

      completedTranscriptEscalationRef.current = context.escalationId;
      appendMascotMessage(
        'system',
        result.message ??
          'Transcript alınamadı. Maskot konuşması tekrar açıldı.',
        context.escalationId,
      );
      void resolveEscalation(context.escalationId).catch(() => undefined);
      setPendingTranscriptContext(null);
    }
  }

  function finishPendingTranscript(
    context: PendingTranscriptContext,
    result: LeaveResult,
  ) {
    if (
      !result.transcript ||
      completedTranscriptEscalationRef.current === context.escalationId
    ) {
      return;
    }

    completedTranscriptEscalationRef.current = context.escalationId;
    const transcriptLines = result.transcript.items.map((item) => item.text);
    const returnMessage = buildTranscriptReturnMessage({
      expertName: context.expertName,
      transcriptLines,
    });

    appendMascotMessage('assistant', returnMessage, context.escalationId);
    speakMascotMessage(returnMessage);
    void resolveEscalation(context.escalationId).catch(() => undefined);
    setPendingTranscriptContext(null);
  }

  async function refreshTranscript() {
    await videoCall.refreshTranscript();
  }

  function resetMascotChat() {
    if (escalationBusy || pendingTranscriptContext || activeEscalation) {
      return;
    }

    stopMascotSpeech();
    setPendingExpertOffer(null);
    setEscalationError(null);
    setMessages([createMascotChatMessage('assistant', MASCOT_WELCOME_MESSAGE)]);
  }

  async function sendMascotMessage(message: string) {
    if (pendingTranscriptContext) {
      return;
    }

    appendMascotMessage('user', message);
    stopMascotSpeech();
    setPendingExpertOffer(null);
    setEscalationBusy(true);
    setEscalationError(null);

    try {
      const decision = await requestMascotDecision({
        history: messages,
        message,
      });

      appendMascotMessage('assistant', decision.answer);
      speakMascotMessage(decision.answer);

      if (decision.action === 'escalate') {
        if (shouldCreateExpertRequestImmediately(decision)) {
          await requestExpertSupport(
            decision.question ?? message,
            decision.topic ?? message,
          );
        } else {
          setPendingExpertOffer({
            question: decision.question ?? message,
            topic: decision.topic ?? message,
          });
        }
      }
    } catch (error) {
      setEscalationError(
        error instanceof Error
          ? error.message
          : 'Mascot decision could not be created.',
      );
    } finally {
      setEscalationBusy(false);
    }
  }

  async function confirmPendingExpertOffer() {
    const offer = pendingExpertOffer;
    if (!offer) {
      return;
    }

    setPendingExpertOffer(null);
    await requestExpertSupport(offer.question, offer.topic);
  }

  async function requestExpertSupport(message?: string, topic?: string) {
    if (pendingTranscriptContext) {
      return;
    }

    const question =
      message?.trim() ||
      [...messages].reverse().find((item) => item.role === 'user')?.text ||
      'Kullanıcı mentor desteği istiyor.';
    const requestTopic = normalizeEscalationTopic(topic ?? question);

    setEscalationBusy(true);
    setEscalationError(null);
    try {
      const request = await createEscalation({
        question,
        requesterId: videoCall.userId,
        requesterName: videoCall.userName,
        topic: requestTopic,
      });
      const mascotMessage = `"${request.topic}" için mentor desteği istedim. Bir uzman kabul ederse video görüşmeye geçeceğiz.`;

      setActiveEscalation(request);
      setPendingExpertOffer(null);
      appendMascotMessage('assistant', mascotMessage, request.id);
      speakMascotMessage(mascotMessage);
    } catch (error) {
      setEscalationError(
        error instanceof Error
          ? error.message
          : 'Mentor request could not be created.',
      );
    } finally {
      setEscalationBusy(false);
    }
  }

  async function refreshMentorQueue() {
    setMentorLoading(true);
    setEscalationError(null);
    try {
      setMentorRequests(await listEscalations({ status: 'pending' }));
    } catch (error) {
      setEscalationError(
        error instanceof Error
          ? error.message
          : 'Mentor queue could not be loaded.',
      );
    } finally {
      setMentorLoading(false);
    }
  }

  async function acceptMentorRequest(request: EscalationRequest) {
    setAcceptingEscalationId(request.id);
    setEscalationError(null);
    try {
      const accepted = await acceptEscalation({
        escalationId: request.id,
        expertId: videoCall.userId,
        expertName: videoCall.userName,
      });
      setActiveEscalation(accepted);
      acceptedEscalationIdRef.current = accepted.id;
      appendMascotMessage(
        'system',
        `Mentor isteği kabul edildi. ${accepted.requester.name} ile görüşmeye geçiliyor.`,
        accepted.id,
      );
      await beginEscalationCall(accepted);
    } catch (error) {
      setEscalationError(
        error instanceof Error
          ? error.message
          : 'Mentor request could not be accepted.',
      );
    } finally {
      setAcceptingEscalationId(null);
    }
  }

  async function beginEscalationCall(request: EscalationRequest) {
    stopMascotSpeech();
    videoCall.clearMessages();
    videoCall.setCallId(request.callId);
    const joined = await videoCall.join({ callId: request.callId });
    setScreen(joined ? 'call' : 'mascot');
  }

  function appendMascotMessage(
    role: MascotChatRole,
    text: string,
    escalationId?: string,
  ) {
    setMessages((current) => [
      ...current,
      createMascotChatMessage(role, text, escalationId),
    ]);
  }

  if (screen === 'call' && videoCall.client && videoCall.call) {
    return (
      <VideoCallScreen
        call={videoCall.call}
        client={videoCall.client}
        leaving={videoCall.leaving}
        onCallEnded={() => leave({ endCall: false })}
        onLeave={leave}
        statusText={videoCall.statusText}
      />
    );
  }

  if (screen === 'transcript') {
    return (
      <TranscriptScreen
        callId={videoCall.callId}
        message={videoCall.transcriptMessage}
        onBack={() => setScreen('mascot')}
        onNewCall={() => {
          setScreen('mascot');
        }}
        onRefresh={refreshTranscript}
        refreshing={videoCall.transcriptStatus === 'processing'}
        status={videoCall.transcriptStatus}
        transcript={videoCall.transcript}
      />
    );
  }

  if (screen === 'mentorQueue') {
    return (
      <MentorQueueScreen
        acceptingId={acceptingEscalationId}
        error={escalationError}
        loading={mentorLoading}
        onAccept={acceptMentorRequest}
        onBack={() => setScreen('mascot')}
        onRefresh={refreshMentorQueue}
        requests={mentorRequests}
      />
    );
  }

  if (screen === 'mascot') {
    return (
      <MascotScreen
        activeEscalation={activeEscalation}
        busy={escalationBusy}
        conversationLocked={Boolean(pendingTranscriptContext)}
        error={escalationError}
        hasTranscript={Boolean(videoCall.transcript)}
        lockMessage={
          pendingTranscriptContext
            ? 'Transcript hazırlanıyor. Hazır olunca görüşme notları konuşmaya eklenecek.'
            : null
        }
        messages={messages}
        onOpenMentorQueue={() => setScreen('mentorQueue')}
        onOpenTranscript={() => setScreen('transcript')}
        onConfirmExpertOffer={confirmPendingExpertOffer}
        onRequestExpert={requestExpertSupport}
        onResetChat={resetMascotChat}
        onSendMessage={sendMascotMessage}
        pendingExpertOffer={pendingExpertOffer}
        speaking={mascotSpeaking}
      />
    );
  }

  return null;
}

function shouldCreateExpertRequestImmediately(decision: MascotDecision): boolean {
  return decision.reason.toLowerCase().includes('expert-help keyword');
}

function createMascotChatMessage(
  role: MascotChatRole,
  text: string,
  escalationId?: string,
): MascotChatMessage {
  const random = Math.random().toString(36).slice(2, 8);
  return {
    createdAt: new Date().toISOString(),
    escalationId,
    id: `msg-${Date.now()}-${random}`,
    role,
    text,
  };
}
