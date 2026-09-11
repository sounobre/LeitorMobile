import { Platform } from 'react-native';
import ExpoMlkitLanguage from '../../modules/expo-mlkit-language/src/ExpoMlkitLanguageModule';

export function isLocalTranslationAvailable(): boolean {
  return Platform.OS === 'android' && ExpoMlkitLanguage !== null;
}

export async function identifyLanguage(text: string, fallback = 'und'): Promise<string> {
  if (!isLocalTranslationAvailable() || !ExpoMlkitLanguage) return normalizeLanguage(fallback);
  try {
    const identified = await ExpoMlkitLanguage.identifyLanguage(text.slice(0, 1_000));
    return normalizeLanguage(identified === 'und' ? fallback : identified);
  } catch {
    return normalizeLanguage(fallback);
  }
}

export async function translateLocally(
  text: string,
  sourceLanguage: string,
  targetLanguage = 'pt',
  wifiOnly = true,
): Promise<string> {
  if (!ExpoMlkitLanguage || Platform.OS !== 'android') {
    throw new Error('A tradução local requer o aplicativo Android de desenvolvimento.');
  }
  return ExpoMlkitLanguage.translate(
    text,
    normalizeLanguage(sourceLanguage),
    normalizeLanguage(targetLanguage),
    wifiOnly,
  );
}

export async function listDownloadedTranslationModels(): Promise<string[]> {
  return ExpoMlkitLanguage?.getDownloadedModels() ?? [];
}

export async function deleteTranslationModel(language: string): Promise<void> {
  if (!ExpoMlkitLanguage) return;
  await ExpoMlkitLanguage.deleteModel(normalizeLanguage(language));
}

export function normalizeLanguage(language: string | null | undefined): string {
  const normalized = language?.trim().toLowerCase().split(/[-_]/)[0];
  return normalized && /^[a-z]{2,3}$/.test(normalized) ? normalized : 'und';
}
