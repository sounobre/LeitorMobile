import { requireOptionalNativeModule } from 'expo-modules-core';

export type ExpoImmersiveModeNativeModule = {
  setNavigationBarHidden(hidden: boolean): Promise<void>;
};

export default requireOptionalNativeModule<ExpoImmersiveModeNativeModule>('ExpoImmersiveMode');
