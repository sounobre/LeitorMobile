import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import JSZip from 'jszip';
import { z } from 'zod';
import { exportSnapshot, replaceSnapshot } from '@/db/repository';
import { assertSafeBackupPath, assertSnapshotReferences } from '@/services/backupValidation';
import type { Book, LibrarySnapshot } from '@/types/domain';

const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 700 * 1024 * 1024;
const MAX_BACKUP_EXPANDED_BYTES = 1_500 * 1024 * 1024;
const MAX_BACKUP_ENTRIES = 20_000;

const bookSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/),
  fileUri: z.string().min(1),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/),
  originalName: z.string(),
  title: z.string(),
  author: z.string(),
  language: z.string(),
  coverUri: z.string().nullable(),
  description: z.string(),
  publisher: z.string(),
  importedAt: z.string(),
  lastOpenedAt: z.string().nullable(),
  lastCfi: z.string().nullable(),
  progress: z.number().min(0).max(1),
  locationsJson: z.string().nullable(),
});

const annotationSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  cfiRange: z.string(),
  selectedText: z.string(),
  color: z.string(),
  note: z.string().nullable(),
  sectionIndex: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const bookmarkSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  cfi: z.string(),
  chapterTitle: z.string(),
  excerpt: z.string(),
  createdAt: z.string(),
});

const cardSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  cfiRange: z.string(),
  selectedText: z.string(),
  translation: z.string(),
  pronunciation: z.string().default(''),
  partOfSpeech: z.string().default(''),
  definition: z.string().default(''),
  background: z.string().default(''),
  examples: z.array(z.string()).default([]),
  relatedWords: z.array(z.string()).default([]),
  chapterTitle: z.string(),
  queueOrder: z.number().int().default(0),
  archived: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const preferencesSchema = z.object({
  bookId: z.string(),
  flow: z.enum(['paginated', 'scrolled-doc']),
  theme: z.enum(['light', 'sepia', 'dark']),
  fontFamily: z.string(),
  fontSize: z.number(),
  lineHeight: z.number(),
  margin: z.number(),
  textAlign: z.enum(['left', 'justify']),
});

const lookupSchema = z.object({
  language: z.string(),
  term: z.string(),
  definition: z.string(),
  expiresAt: z.string(),
});

const lexiconSchema = z.object({
  id: z.string(), bookId: z.string(), lemma: z.string(), partOfSpeech: z.string(),
  wordForms: z.array(z.string()).default([]), definition: z.string().default(''), translationPtBr: z.string().default(''),
  ipa: z.string().default(''), cefr: z.string().default(''), bookFrequency: z.number().int().default(0), firstSentenceId: z.string().nullable(),
  resolutionStatus: z.string(), pedagogicalRelevance: z.string(),
  senses: z.array(z.object({ id: z.string(), senseKey: z.string(), definition: z.string(), translationPtBr: z.string() })).default([]),
  updatedAt: z.string(),
});
const snapshotSchema = z.object({
  books: z.array(bookSchema),
  annotations: z.array(annotationSchema),
  bookmarks: z.array(bookmarkSchema),
  cards: z.array(cardSchema).default([]),
  preferences: z.array(preferencesSchema),
  lookupCache: z.array(lookupSchema),
  lexicon: z.array(lexiconSchema).default([]),
});

const manifestSchema = z.object({
  format: z.literal('leitor-epub-backup'),
  version: z.literal(BACKUP_VERSION),
  createdAt: z.string(),
  files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
});

type BackupManifest = z.infer<typeof manifestSchema>;

export type PreparedBackupRestore = {
  bookCount: number;
  restore(): Promise<LibrarySnapshot>;
};

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, '0')).join('');
}

function uncompressedSize(entry: JSZip.JSZipObject): number {
  const internal = entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } };
  return internal._data?.uncompressedSize ?? 0;
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
  const ownedBytes = new Uint8Array(bytes.byteLength);
  ownedBytes.set(bytes);
  return bytesToHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, ownedBytes));
}

function portableCoverPath(book: Book): string | null {
  if (!book.coverUri) return null;
  const extension = book.coverUri.match(/\.(png|jpe?g|webp|gif)$/i)?.[0]?.toLowerCase() ?? '.jpg';
  return `covers/${book.id}${extension === '.jpeg' ? '.jpg' : extension}`;
}

export async function createAndShareBackup(db: SQLiteDatabase): Promise<string> {
  const snapshot = await exportSnapshot(db);
  const zip = new JSZip();
  const files: Record<string, string> = {};
  const portableBooks: Book[] = [];

  for (const book of snapshot.books) {
    const source = new File(book.fileUri);
    if (!source.exists) throw new Error(`O arquivo do livro “${book.title}” não foi encontrado.`);
    const bytes = await source.bytes();
    const bookPath = `books/${book.id}.epub`;
    zip.file(bookPath, bytes, { binary: true });
    files[bookPath] = await hashBytes(bytes);

    let portableCoverUri: string | null = null;
    const coverPath = portableCoverPath(book);
    if (coverPath && book.coverUri) {
      const cover = new File(book.coverUri);
      if (cover.exists) {
        const coverBytes = await cover.bytes();
        zip.file(coverPath, coverBytes, { binary: true });
        files[coverPath] = await hashBytes(coverBytes);
        portableCoverUri = coverPath;
      }
    }
    portableBooks.push({ ...book, fileUri: bookPath, coverUri: portableCoverUri });
  }

  const portableSnapshot: LibrarySnapshot = { ...snapshot, books: portableBooks };
  const snapshotBytes = new TextEncoder().encode(JSON.stringify(portableSnapshot));
  zip.file('library.json', snapshotBytes);
  files['library.json'] = await hashBytes(snapshotBytes);

  const manifest: BackupManifest = {
    format: 'leitor-epub-backup',
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    files,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const backups = new Directory(Paths.cache, 'backups');
  backups.create({ idempotent: true, intermediates: true });
  const timestamp = manifest.createdAt.replace(/[:.]/g, '-');
  const destination = new File(backups, `leitor-epub-${timestamp}.zip`);
  destination.write(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('O compartilhamento de arquivos não está disponível neste aparelho.');
  }
  await Sharing.shareAsync(destination.uri, {
    dialogTitle: 'Salvar backup do Leitor EPUB',
    mimeType: 'application/zip',
  });
  return destination.uri;
}

export async function pickAndValidateBackup(
  db: SQLiteDatabase,
): Promise<PreparedBackupRestore | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) throw new Error('Nenhum backup foi selecionado.');
  if (asset.size && asset.size > MAX_BACKUP_BYTES) throw new Error('O backup excede 700 MB.');

  const backupFile = new File(asset.uri);
  if (!backupFile.exists || backupFile.size > MAX_BACKUP_BYTES) {
    throw new Error('O backup não pode ser acessado ou excede 700 MB.');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await backupFile.bytes(), { checkCRC32: true, createFolders: false });
  } catch {
    throw new Error('O arquivo de backup está corrompido.');
  }

  const entries = Object.values(zip.files);
  if (entries.length > MAX_BACKUP_ENTRIES) throw new Error('O backup contém arquivos demais.');
  let expandedBytes = 0;
  for (const entry of entries) {
    assertSafeBackupPath(entry.name);
    expandedBytes += uncompressedSize(entry);
    if (expandedBytes > MAX_BACKUP_EXPANDED_BYTES) {
      throw new Error('O backup é grande demais depois de descompactado.');
    }
  }
  const manifestEntry = zip.file('manifest.json');
  const libraryEntry = zip.file('library.json');
  if (!manifestEntry || !libraryEntry) throw new Error('O arquivo não é um backup do Leitor EPUB.');

  const manifest = manifestSchema.parse(JSON.parse(await manifestEntry.async('text')));
  for (const [path, expectedHash] of Object.entries(manifest.files)) {
    assertSafeBackupPath(path);
    const entry = zip.file(path);
    if (!entry) throw new Error(`O backup está incompleto: ${path}.`);
    const actualHash = await hashBytes(await entry.async('uint8array'));
    if (actualHash !== expectedHash) throw new Error(`A verificação de integridade falhou: ${path}.`);
  }

  const snapshot = snapshotSchema.parse(JSON.parse(await libraryEntry.async('text'))) as LibrarySnapshot;
  assertSnapshotReferences(snapshot);
  if (!manifest.files['library.json']) {
    throw new Error('O manifesto não protege os dados da biblioteca com checksum.');
  }
  for (const book of snapshot.books) {
    if (!manifest.files[book.fileUri] || (book.coverUri && !manifest.files[book.coverUri])) {
      throw new Error(`O manifesto não protege todos os arquivos do livro “${book.title}”.`);
    }
  }

  return {
    bookCount: snapshot.books.length,
    restore: () => restoreValidatedBackup(db, zip, snapshot),
  };
}

async function restoreValidatedBackup(
  db: SQLiteDatabase,
  zip: JSZip,
  snapshot: LibrarySnapshot,
): Promise<LibrarySnapshot> {
  const previous = await exportSnapshot(db);
  const booksDirectory = new Directory(Paths.document, 'books');
  const coversDirectory = new Directory(Paths.document, 'covers');
  booksDirectory.create({ idempotent: true, intermediates: true });
  coversDirectory.create({ idempotent: true, intermediates: true });
  const restoreId = Crypto.randomUUID();
  const writtenFiles: File[] = [];
  let restoredSnapshot: LibrarySnapshot;

  try {
    const restoredBooks: Book[] = [];
    for (const book of snapshot.books) {
      assertSafeBackupPath(book.fileUri);
      const bookEntry = zip.file(book.fileUri);
      if (!bookEntry) throw new Error(`O livro “${book.title}” não está no backup.`);
      const destination = new File(booksDirectory, `${restoreId}-${book.id}.epub`);
      destination.write(await bookEntry.async('uint8array'));
      writtenFiles.push(destination);

      let coverUri: string | null = null;
      if (book.coverUri) {
        assertSafeBackupPath(book.coverUri);
        const coverEntry = zip.file(book.coverUri);
        if (coverEntry) {
          const extension = book.coverUri.match(/\.[a-z0-9]+$/i)?.[0] ?? '.jpg';
          const coverDestination = new File(coversDirectory, `${restoreId}-${book.id}${extension}`);
          coverDestination.write(await coverEntry.async('uint8array'));
          writtenFiles.push(coverDestination);
          coverUri = coverDestination.uri;
        }
      }
      restoredBooks.push({ ...book, fileUri: destination.uri, coverUri });
    }

    restoredSnapshot = { ...snapshot, books: restoredBooks };
    await replaceSnapshot(db, restoredSnapshot);
  } catch (error) {
    for (const written of writtenFiles) if (written.exists) written.delete();
    throw error;
  }

  // The database already points to the restored files. Cleanup is best-effort so
  // a storage error can never roll back by deleting the newly active library.
  for (const oldBook of previous.books) {
    try {
      const oldFile = new File(oldBook.fileUri);
      if (oldFile.exists) oldFile.delete();
      if (oldBook.coverUri) {
        const oldCover = new File(oldBook.coverUri);
        if (oldCover.exists) oldCover.delete();
      }
    } catch {
      // Orphaned private files are harmless and can be cleaned on a later run.
    }
  }
  return restoredSnapshot;
}
