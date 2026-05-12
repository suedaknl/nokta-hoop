import React from 'react';
import { type StyleProp, type ViewStyle, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-native-sdk';

type VideoCallControlsProps = {
  onHangupCallHandler: () => Promise<void> | void;
  style?: StyleProp<ViewStyle>;
};

export function VideoCallControls({
  onHangupCallHandler,
  style,
}: VideoCallControlsProps) {
  const call = useCall();
  const { useMicrophoneState, useCameraState } = useCallStateHooks();
  // isMuted yerine isMute kullanıyoruz (Hata mesajında doğrusu yazıyor)
  const { isMute: isMicMuted } = useMicrophoneState();
  const { isMute: isCamMuted } = useCameraState();

  // Mikrofonu Aç/Kapat
  const toggleMic = async () => {
    if (!call) return;
    try {
      if (isMicMuted) {
        await call.microphone.enable();
      } else {
        await call.microphone.disable();
      }
    } catch (e) {
      console.warn('Mikrofon hatası:', e);
    }
  };

  // Kamerayı Aç/Kapat
  const toggleCam = async () => {
    if (!call) return;
    try {
      if (isCamMuted) {
        await call.camera.enable();
      } else {
        await call.camera.disable();
      }
    } catch (e) {
      console.warn('Kamera hatası:', e);
    }
  };

  const flipCam = async () => {
    if (!call) return;
    try {
      await call.camera.flip();
    } catch (e) {
      console.warn('Kamera çevirme hatası:', e);
    }
  };

  return (
    <View pointerEvents="box-none" style={[styles.container, style]}>
      <View style={styles.controlsRow}>
        <Pressable
          onPress={toggleCam}
          style={[styles.controlBtn, isCamMuted ? styles.mutedBtn : styles.activeBtn]}
        >
          <Text style={styles.btnText}>{isCamMuted ? '📷 Kapalı' : '📷 Açık'}</Text>
        </Pressable>

        <Pressable
          onPress={toggleMic}
          style={[styles.controlBtn, isMicMuted ? styles.mutedBtn : styles.activeBtn]}
        >
          <Text style={styles.btnText}>{isMicMuted ? '🎤 Kapalı' : '🎤 Açık'}</Text>
        </Pressable>

        <Pressable onPress={flipCam} style={styles.controlBtn}>
          <Text style={styles.btnText}>🔄</Text>
        </Pressable>

        <Pressable
          onPress={() => onHangupCallHandler()}
          style={({ pressed }) => [
            styles.endButton,
            pressed && styles.endButtonPressed,
          ]}
        >
          <Text style={styles.endButtonText}>Bitir</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  controlsRow: {
    flexDirection: 'row',
    backgroundColor: '#075985',
    borderRadius: 30,
    padding: 12,
    alignItems: 'center',
    gap: 12,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  controlBtn: {
    width: 55,
    height: 55,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  activeBtn: {
    backgroundColor: '#0c4a6e',
  },
  mutedBtn: {
    backgroundColor: '#dc2626',
    borderColor: '#ef4444',
  },
  btnText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  endButton: {
    backgroundColor: '#ffffff',
    borderRadius: 25,
    height: 50,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endButtonPressed: {
    opacity: 0.7,
  },
  endButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: 'bold',
  },
});