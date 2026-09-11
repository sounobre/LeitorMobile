import { requireOptionalNativeModule } from 'expo-modules-core';

export type ExpoMlkitLanguageNativeModule = {
  identifyLanguage(text: string): Promise<string>;
  translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    wifiOnly: boolean,
  ): Promise<string>;
  getDownloadedModels(): Promise<string[]>;
  deleteModel(language: string): Promise<void>;
};

export default requireOptionalNativeModule<ExpoMlkitLanguageNativeModule>('ExpoMlkitLanguage');
