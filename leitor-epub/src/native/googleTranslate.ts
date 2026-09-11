import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type GoogleTranslateNativeModule = {
  openTranslation(text: string, targetLanguage: string): Promise<boolean>;
};

const nativeModule = requireOptionalNativeModule<GoogleTranslateNativeModule>('ExpoGoogleTranslate');

export async function openGoogleTranslate(text: string, targetLanguage = 'pt'): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeModule) return false;
  return nativeModule.openTranslation(text, targetLanguage);
}
