import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

type JoinCallScreenProps = {
  userName: string;
  userId: string;
  onUserNameChange: (value: string) => void;
  onUserIdChange: (value: string) => void;
  callId: string;
  onCallIdChange: (value: string) => void;
  onNewCallId: () => void;
  joining: boolean;
  statusText: string | null;
  transcriptionLanguage: string;
  onJoin: () => Promise<void>;
  onBack: () => void;
  error: string | null;
};

export function JoinCallScreen({
  userName,
  userId,
  onUserNameChange,
  onUserIdChange,
  callId,
  onCallIdChange,
  onNewCallId,
  joining,
  statusText,
  transcriptionLanguage,
  onJoin,
  onBack,
  error,
}: JoinCallScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <Pressable onPress={onBack} disabled={joining} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.panel}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Join room</Text>
        <Text style={styles.subtitle}>
          Everyone using the same room ID joins the same Stream Video call.
        </Text>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          value={userName}
          onChangeText={onUserNameChange}
          editable={!joining}
          style={styles.textInput}
          placeholder="Emirhan"
          placeholderTextColor="#8ca3b8"
          autoCapitalize="words"
        />

        <Text style={styles.label}>User ID</Text>
        <TextInput
          value={userId}
          onChangeText={onUserIdChange}
          editable={!joining}
          style={styles.textInput}
          placeholder="emirhan-1"
          placeholderTextColor="#8ca3b8"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.helperText}>
          Use a different user ID on each active device.
        </Text>

        <View style={styles.labelRow}>
          <Text style={styles.label}>Room ID</Text>
          <Pressable
            disabled={joining}
            onPress={onNewCallId}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>New room</Text>
          </Pressable>
        </View>
        <TextInput
          value={callId}
          onChangeText={onCallIdChange}
          editable={!joining}
          style={styles.textInput}
          placeholder="nokta-hoop-demo"
          placeholderTextColor="#8ca3b8"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.metaBox}>
          <Text style={styles.metaText}>
            Transcript language: {transcriptionLanguage.toUpperCase()}
          </Text>
        </View>

        {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={onJoin}
          disabled={joining}
          style={({ pressed }) => [
            styles.joinButton,
            joining && styles.joinButtonDisabled,
            pressed && !joining ? styles.joinButtonPressed : null,
          ]}
        >
          {joining ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.joinButtonText}>Join call</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#07111f',
    paddingHorizontal: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#7dd3fc',
    fontSize: 15,
    fontWeight: '800',
  },
  panel: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 14,
    paddingBottom: 24,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#c6d3df',
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 12,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '800',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#295071',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#0e1c2e',
  },
  helperText: {
    color: '#8ca3b8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: -6,
  },
  secondaryButton: {
    borderRadius: 10,
    backgroundColor: '#13243a',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  secondaryButtonText: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '900',
  },
  metaBox: {
    borderRadius: 10,
    backgroundColor: '#102235',
    borderWidth: 1,
    borderColor: '#1f4768',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaText: {
    color: '#bae6fd',
    fontSize: 13,
    fontWeight: '800',
  },
  joinButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  joinButtonDisabled: {
    backgroundColor: '#38bdf8',
    opacity: 0.65,
  },
  joinButtonPressed: {
    opacity: 0.85,
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
  statusText: {
    color: '#7dd3fc',
    fontSize: 14,
  },
});
