import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

type HomeScreenProps = {
  onStartCall: () => void;
  onOpenTranscript?: () => void;
  hasTranscript?: boolean;
};

export function HomeScreen({
  onStartCall,
  onOpenTranscript,
  hasTranscript = false,
}: HomeScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>nokta-hoop</Text>
        <Text style={styles.title}>Video room</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onStartCall}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.primaryButtonText}>Start or join call</Text>
        </Pressable>

        {hasTranscript && onOpenTranscript ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenTranscript}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Open transcript</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#07111f',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: 26,
    gap: 8,
  },
  eyebrow: {
    color: '#67e8f9',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '900',
  },
  actions: {
    gap: 12,
    paddingBottom: 24,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#13243a',
    borderWidth: 1,
    borderColor: '#295071',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.82,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButtonText: {
    color: '#bae6fd',
    fontSize: 16,
    fontWeight: '800',
  },
});
