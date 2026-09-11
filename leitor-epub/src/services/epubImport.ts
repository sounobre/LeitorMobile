import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { XMLParser } from 'fast-xml-parser';
import JSZip, { type JSZipObject } from 'jszip';
import { findBookByHash, insertBook } from '@/db/repository';
import {
  assertSafeArchivePath,
  EPUB_LIMITS,
  hasExternalResourceReference,
  hasUnsupportedEncryption,
  resolveArchivePath,
  UnsafeArchivePathError,
} from '@/services/epubSecurity';
import type { Book } from '@/types/domain';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  trimValues: true,
});

export type ParsedMetadata = {
  title: string;
  author: string;
  language: string;
  description: string;
  publisher: string;
  coverPath: string | null;
  coverMediaType: string | null;
};

export class EpubImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EpubImportError';
  }
}

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

function textValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return textValue(value[0]);
  if (value && typeof value === 'object' && '#text' in value) {
    return textValue((value as { '#text': unknown })['#text']);
  }
  return '';
}

function byteSize(entry: JSZipObject): number {
  const internal = entry as JSZipObject & { _data?: { uncompressedSize?: number } };
  return internal._data?.uncompressedSize ?? 0;
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, '0')).join('');
}

function extensionForCover(path: string, mediaType: string | null): string {
  const pathExtension = path.match(/\.(jpe?g|png|webp|gif)$/i)?.[0]?.toLowerCase();
  if (pathExtension) return pathExtension === '.jpeg' ? '.jpg' : pathExtension;
  if (mediaType === 'image/png') return '.png';
  if (mediaType === 'image/webp') return '.webp';
  if (mediaType === 'image/gif') return '.gif';
  return '.jpg';
}

export async function validateEpubArchive(zip: JSZip): Promise<ParsedMetadata> {
  const entries = Object.values(zip.files);
  if (entries.length > EPUB_LIMITS.entries) {
    throw new EpubImportError('O EPUB contém arquivos demais para ser aberto com segurança.');
  }

  let expandedSize = 0;
  for (const entry of entries) {
    assertSafeArchivePath(entry.name);
    expandedSize += byteSize(entry);
    if (expandedSize > EPUB_LIMITS.uncompressedBytes) {
      throw new EpubImportError('O EPUB é grande demais depois de descompactado.');
    }
  }

  const textExtensions = /\.(?:xhtml?|html?|css|svg|ncx)$/i;
  for (const entry of entries) {
    if (entry.dir || !textExtensions.test(entry.name)) continue;
    if (byteSize(entry) > EPUB_LIMITS.textEntryBytes) {
      throw new EpubImportError('O EPUB contém um documento de texto excessivamente grande.');
    }
    if (hasExternalResourceReference(await entry.async('text'))) {
      throw new EpubImportError('O EPUB referencia conteúdo remoto e foi bloqueado por segurança.');
    }
  }

  const mimetypeEntry = zip.file('mimetype');
  const mimetype = mimetypeEntry ? (await mimetypeEntry.async('text')).trim() : '';
  if (mimetype !== 'application/epub+zip') {
    throw new EpubImportError('O arquivo não possui um identificador EPUB válido.');
  }

  const encryptionEntry = zip.file('META-INF/encryption.xml');
  if (encryptionEntry && hasUnsupportedEncryption(await encryptionEntry.async('text'))) {
    throw new EpubImportError('EPUBs protegidos por DRM não são compatíveis.');
  }

  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) throw new EpubImportError('O EPUB não contém META-INF/container.xml.');
  const container = parser.parse(await containerEntry.async('text')) as Record<string, any>;
  const rootfiles = asArray(container?.container?.rootfiles?.rootfile);
  let packagePath: string;
  try {
    packagePath = assertSafeArchivePath(rootfiles[0]?.['@_full-path'] ?? '');
  } catch (error) {
    if (error instanceof UnsafeArchivePathError) {
      throw new EpubImportError(error.message);
    }
    throw error;
  }
  if (!packagePath) throw new EpubImportError('O EPUB não informa o arquivo de pacote OPF.');

  const packageEntry = zip.file(packagePath);
  if (!packageEntry) throw new EpubImportError('O arquivo OPF informado não existe no EPUB.');
  const opf = parser.parse(await packageEntry.async('text')) as Record<string, any>;
  const packageNode = opf.package;
  const metadata = packageNode?.metadata ?? {};
  const manifestItems = asArray<Record<string, any>>(packageNode?.manifest?.item);
  if (!packageNode?.spine || manifestItems.length === 0) {
    throw new EpubImportError('O EPUB não possui manifesto ou sequência de leitura.');
  }

  const metadataEntries = asArray<Record<string, any>>(metadata.meta);
  const layoutMeta = metadataEntries.find((entry) => entry?.['@_property'] === 'rendition:layout');
  const legacyFixedLayout = metadataEntries.some((entry) =>
    ['fixed-layout', 'book-type'].includes(String(entry?.['@_name'] ?? '').toLowerCase()) &&
    ['true', 'fixed-layout', 'comic'].includes(String(entry?.['@_content'] ?? '').toLowerCase()),
  );
  const manifestFixedLayout = manifestItems.some((item) =>
    String(item?.['@_properties'] ?? '').split(/\s+/).includes('rendition:layout-pre-paginated'),
  );
  if (textValue(layoutMeta).toLowerCase() === 'pre-paginated' || legacyFixedLayout || manifestFixedLayout) {
    throw new EpubImportError('EPUB de layout fixo ainda não é compatível.');
  }

  const coverPropertyItem = manifestItems.find((item) =>
    String(item?.['@_properties'] ?? '').split(/\s+/).includes('cover-image'),
  );
  const legacyCoverId = metadataEntries.find((entry) => entry?.['@_name'] === 'cover')?.['@_content'];
  const legacyCoverItem = manifestItems.find((item) => item?.['@_id'] === legacyCoverId);
  const coverItem = coverPropertyItem ?? legacyCoverItem;
  const coverPath = coverItem?.['@_href']
    ? resolveArchivePath(packagePath, String(coverItem['@_href']))
    : null;

  return {
    title: textValue(metadata.title) || 'Livro sem título',
    author: textValue(metadata.creator),
    language: textValue(metadata.language) || 'und',
    description: textValue(metadata.description),
    publisher: textValue(metadata.publisher),
    coverPath,
    coverMediaType: coverItem?.['@_media-type'] ? String(coverItem['@_media-type']) : null,
  };
}

function ensureStorageDirectories(): { books: Directory; covers: Directory } {
  const books = new Directory(Paths.document, 'books');
  const covers = new Directory(Paths.document, 'covers');
  books.create({ idempotent: true, intermediates: true });
  covers.create({ idempotent: true, intermediates: true });
  return { books, covers };
}

export async function importEpub(db: SQLiteDatabase): Promise<{ book: Book; duplicate: boolean } | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/epub+zip', 'application/octet-stream'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled) return null;

  const asset = picked.assets[0];
  if (!asset) throw new EpubImportError('Nenhum arquivo foi selecionado.');
  if (!asset.name.toLowerCase().endsWith('.epub')) {
    throw new EpubImportError('Selecione um arquivo com extensão .epub.');
  }
  if (asset.size && asset.size > EPUB_LIMITS.archiveBytes) {
    throw new EpubImportError('O EPUB excede o limite de 100 MB desta versão.');
  }

  const source = new File(asset.uri);
  if (!source.exists || source.size > EPUB_LIMITS.archiveBytes) {
    throw new EpubImportError('Não foi possível acessar o arquivo ou ele excede 100 MB.');
  }

  const bytes = await source.bytes();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  const fileHash = bytesToHex(digest);
  const existing = await findBookByHash(db, fileHash);
  if (existing) return { book: existing, duplicate: true };

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false });
  } catch {
    throw new EpubImportError('O arquivo EPUB está corrompido ou incompleto.');
  }
  const metadata = await validateEpubArchive(zip);
  const id = Crypto.randomUUID();
  const { books, covers } = ensureStorageDirectories();
  const destination = new File(books, `${id}.epub`);
  let coverFile: File | null = null;

  try {
    await source.copy(destination);
    if (metadata.coverPath) {
      const entry = zip.file(metadata.coverPath);
      if (entry) {
        coverFile = new File(
          covers,
          `${id}${extensionForCover(metadata.coverPath, metadata.coverMediaType)}`,
        );
        coverFile.write(await entry.async('uint8array'));
      }
    }

    const importedAt = new Date().toISOString();
    const book: Book = {
      id,
      fileUri: destination.uri,
      fileHash,
      originalName: asset.name,
      title: metadata.title,
      author: metadata.author,
      language: metadata.language,
      coverUri: coverFile?.uri ?? null,
      description: metadata.description,
      publisher: metadata.publisher,
      importedAt,
      lastOpenedAt: null,
      lastCfi: null,
      progress: 0,
      locationsJson: null,
    };
    await insertBook(db, book);
    return { book, duplicate: false };
  } catch (error) {
    if (destination.exists) destination.delete();
    if (coverFile?.exists) coverFile.delete();
    if (error instanceof EpubImportError) throw error;
    throw new EpubImportError(error instanceof Error ? error.message : 'Não foi possível importar o EPUB.');
  }
}

export function deleteBookFiles(book: Book): void {
  const file = new File(book.fileUri);
  if (file.exists) file.delete();
  if (book.coverUri) {
    const cover = new File(book.coverUri);
    if (cover.exists) cover.delete();
  }
}
