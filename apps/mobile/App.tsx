import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import {
  JoinCallScreen,
  TranscriptScreen,
  useVideoCall,
  VideoCallScreen,
} from './src/features/video-call';
import type { AppScreen } from './src/types';
import { rootStyles } from './src/styles/rootStyles';

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
  const [screen, setScreen] = useState<AppScreen>('home');
  const videoCall = useVideoCall();

  const startCall = () => {
    videoCall.clearMessages();
    setScreen('join');
  };

  const join = async () => {
    const joined = await videoCall.join();
    setScreen(joined ? 'call' : 'join');
  };

  const leave = async () => {
    const leaveResult = videoCall.leave();
    setScreen('transcript');
    await leaveResult;
  };

  const refreshTranscript = async () => {
    await videoCall.refreshTranscript();
  };

  if (screen === 'call' && videoCall.client && videoCall.call) {
    return (
      <VideoCallScreen
        call={videoCall.call}
        client={videoCall.client}
        leaving={videoCall.leaving}
        onLeave={leave}
        statusText={videoCall.statusText}
      />
    );
  }

  if (screen === 'join') {
    return (
      <JoinCallScreen
        callId={videoCall.callId}
        error={videoCall.error}
        joining={videoCall.joining}
        onBack={() => {
          videoCall.clearMessages();
          setScreen('home');
        }}
        onCallIdChange={videoCall.setCallId}
        onJoin={join}
        onNewCallId={videoCall.newCallId}
        onUserIdChange={videoCall.setUserId}
        onUserNameChange={videoCall.updateUserName}
        statusText={videoCall.statusText}
        transcriptionLanguage={videoCall.transcriptionLanguage}
        userId={videoCall.userId}
        userName={videoCall.userName}
      />
    );
  }

  if (screen === 'transcript') {
    return (
      <TranscriptScreen
        callId={videoCall.callId}
        message={videoCall.transcriptMessage}
        onBack={() => setScreen('home')}
        onNewCall={() => {
          videoCall.newCallId();
          setScreen('join');
        }}
        onRefresh={refreshTranscript}
        refreshing={videoCall.transcriptStatus === 'processing'}
        status={videoCall.transcriptStatus}
        transcript={videoCall.transcript}
      />
    );
  }

  return (
    <HomeScreen
      hasTranscript={Boolean(videoCall.transcript)}
      onOpenTranscript={() => setScreen('transcript')}
      onStartCall={startCall}
    />
  );
}
