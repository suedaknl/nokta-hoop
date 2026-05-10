import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type MascotVisualState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'waiting'
  | 'sweat'
  | 'error';

type MascotReaction = 'idle' | 'sleep' | 'love';

type NoktaAvatarProps = {
  state: MascotVisualState;
};

export function NoktaAvatar({ state }: NoktaAvatarProps) {
  const lottieRef = useRef<LottieView>(null);
  const [reaction, setReaction] = useState<MascotReaction>('idle');

  useEffect(() => {
    if (state !== 'idle' && reaction === 'sleep') {
      setReaction('idle');
    }
  }, [reaction, state]);

  useEffect(() => {
    if (reaction === 'idle' && state === 'idle') {
      const sleepTimer = setTimeout(() => setReaction('sleep'), 10000);
      return () => clearTimeout(sleepTimer);
    }

    if (reaction === 'love') {
      const timer = setTimeout(() => setReaction('idle'), 2600);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [reaction, state]);

  const interact = () => {
    setReaction('love');
  };

  const visual = reaction !== 'idle' ? reaction : state;

  const isSweating = visual === 'sweat';
  const isSleeping = visual === 'sleep';
  const isLoving = visual === 'love';

  const badge = getBadge(visual);

  return (
    <View style={styles.container}>
      <Pressable onPress={interact} style={styles.animationWrapper}>
        <LottieView
          ref={lottieRef}
          source={require('../assets/star-creature.json')}
          autoPlay
          loop
          style={[
            styles.lottie,
            isSweating ? styles.sweatStyle : null,
            isSleeping ? styles.sleepStyle : null,
            isLoving ? styles.loveStyle : null,
          ]}
          speed={isSleeping ? 0.5 : isSweating ? 2 : 1}
        />
      </Pressable>

      {badge ? (
        <View style={styles.badge}>
          <Text style={[styles.badgeText, badge.kind === 'error' ? styles.errorBadgeText : null]}>
            {badge.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function getBadge(
  visual: string,
): { kind: 'default' | 'error'; label: string } | null {
  if (visual === 'error') return { kind: 'error', label: '!' };
  if (visual === 'sleep') return { kind: 'default', label: 'Zzz' };
  if (visual === 'love') return { kind: 'default', label: '❤️' };
  if (visual === 'sweat') return { kind: 'default', label: '💦' };
  if (visual === 'listening') return { kind: 'default', label: '🎤' };
  if (visual === 'speaking') return { kind: 'default', label: '💬' };
  if (visual === 'thinking') return { kind: 'default', label: '...' };

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 250,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  animationWrapper: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 200,
    height: 200,
  },
  sweatStyle: {
    transform: [{ scale: 1.1 }],
    opacity: 0.9,
  },
  sleepStyle: {
    transform: [{ scale: 0.9 }],
    opacity: 0.7,
  },
  loveStyle: {
    transform: [{ scale: 1.2 }],
  },
  badge: {
    position: 'absolute',
    right: '20%',
    top: '15%',
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeText: {
    color: '#60a5fa',
    fontSize: 22,
    fontWeight: '700',
  },
  errorBadgeText: {
    color: '#ef4444',
  },
});
