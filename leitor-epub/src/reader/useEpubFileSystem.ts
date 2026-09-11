import { useCallback, useState } from 'react';
import * as LegacyFileSystem from 'expo-file-system/legacy';

/**
 * Compatibility layer for @epubjs-react-native/core.
 * The upstream Expo adapter still imports removed root-level legacy APIs in SDK 57.
 */
export function useEpubFileSystem() {
  const [file, setFile] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [size, setSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const downloadFile = useCallback(async (fromUrl: string, toFile: string) => {
    setDownloading(true);
    setError(null);
    try {
      const destination = `${LegacyFileSystem.documentDirectory ?? ''}${toFile}`;
      const task = LegacyFileSystem.createDownloadResumable(
        fromUrl,
        destination,
        { cache: true },
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          setProgress(
            totalBytesExpectedToWrite > 0
              ? Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)
              : 0,
          );
        },
      );
      const result = await task.downloadAsync();
      if (!result) throw new Error('Falha ao baixar o arquivo.');
      setSize(Number(result.headers['Content-Length'] ?? 0));
      setFile(result.uri);
      setSuccess(true);
      return { uri: result.uri, mimeType: result.mimeType ?? null };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Falha ao baixar o arquivo.';
      setError(message);
      setSuccess(false);
      return { uri: null, mimeType: null };
    } finally {
      setDownloading(false);
    }
  }, []);

  const getFileInfo = useCallback(async (fileUri: string) => {
    const info = await LegacyFileSystem.getInfoAsync(fileUri);
    return {
      uri: info.uri,
      exists: info.exists,
      isDirectory: info.exists ? info.isDirectory : false,
      size: info.exists ? info.size : undefined,
    };
  }, []);

  return {
    file,
    progress,
    downloading,
    size,
    error,
    success,
    documentDirectory: LegacyFileSystem.documentDirectory,
    cacheDirectory: LegacyFileSystem.cacheDirectory,
    bundleDirectory: LegacyFileSystem.bundleDirectory ?? undefined,
    readAsStringAsync: LegacyFileSystem.readAsStringAsync,
    writeAsStringAsync: LegacyFileSystem.writeAsStringAsync,
    deleteAsync: LegacyFileSystem.deleteAsync,
    downloadFile,
    getFileInfo,
  };
}
