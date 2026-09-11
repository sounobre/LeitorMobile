import { Platform } from 'react-native';
import ExpoImmersiveMode from '../../modules/expo-immersive-mode/src/ExpoImmersiveModeModule';

export async function setNavigationBarHidden(hidden: boolean): Promise<void> {
  if (Platform.OS !== 'android' || !ExpoImmersiveMode) return;
  await ExpoImmersiveMode.setNavigationBarHidden(hidden);
}
