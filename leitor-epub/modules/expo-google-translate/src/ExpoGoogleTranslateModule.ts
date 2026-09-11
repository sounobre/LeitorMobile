import { requireOptionalNativeModule } from 'expo-modules-core';

export type ExpoGoogleTranslateNativeModule = {
  openTranslation(text: string, targetLanguage: string): Promise<boolean>;
};

export default requireOptionalNativeModule<ExpoGoogleTranslateNativeModule>('ExpoGoogleTranslate');
