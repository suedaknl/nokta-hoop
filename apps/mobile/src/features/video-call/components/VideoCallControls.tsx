import { StyleSheet, View } from 'react-native';
import {
  HangUpCallButton,
  ReactionsButton,
  ToggleAudioPublishingButton,
  ToggleCameraFaceButton,
  ToggleVideoPublishingButton,
  type CallControlProps,
} from '@stream-io/video-react-native-sdk';

export function VideoCallControls({
  onHangupCallHandler,
}: CallControlProps) {
  return (
    <View style={styles.container}>
      <ToggleVideoPublishingButton />
      <ToggleAudioPublishingButton />
      <ToggleCameraFaceButton />
      <ReactionsButton />
      <HangUpCallButton onHangupCallHandler={onHangupCallHandler} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 24,
    minHeight: 68,
    borderRadius: 16,
    backgroundColor: '#075985',
    borderWidth: 1,
    borderColor: '#38bdf8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
});
