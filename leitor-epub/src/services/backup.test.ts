import JSZip from 'jszip';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => {
  const bytesByUri = new Map<string, Uint8Array>();
  class MockFile {
    readonly uri: string;

    constructor(uriOrDirectory: string | MockDirectory, name?: string) {
      this.uri = typeof uriOrDirectory === 'string'
        ? uriOrDirectory
        : uriOrDirectory.uri + '/' + (name ?? '');
    }

    get exists(): boolean {
      return bytesByUri.has(this.uri);
    }

    get size(): number {
      return bytesByUri.get(this.uri)?.byteLength ?? 0;
    }

    async bytes(): Promise<Uint8Array> {
      const bytes = bytesByUri.get(this.uri);
      if (!bytes) throw new Error(`Missing fixture file: ${this.uri}`);
      return new Uint8Array(bytes);
    }

    write(bytes: Uint8Array): void {
      bytesByUri.set(this.uri, new Uint8Array(bytes));
    }
  }
  class MockDirectory {
    readonly uri: string;

    constructor(parent?: { uri?: string }, name?: string) {
      const parentUri = parent?.uri ?? 'mock://directory';
      this.uri = name ? parentUri + '/' + name : parentUri;
    }

    create(_options?: { idempotent?: boolean; intermediates?: boolean }): void {}
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { document: { uri: 'mock://document' }, cache: { uri: 'mock://cache' } },
    __setMockBytes: (uri: string, bytes: Uint8Array) => bytesByUri.set(uri, new Uint8Array(bytes)),
    __getMockBytes: (uri: string) => {
      const bytes = bytesByUri.get(uri);
      return bytes ? new Uint8Array(bytes) : undefined;
    },
    __clearMockBytes: () => bytesByUri.clear(),
  };
});

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digest: jest.fn(async (_algorithm: string, input: Uint8Array) => {
    const { createHash } = require('node:crypto');
    const hash = createHash('sha256').update(Buffer.from(input)).digest();
    return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
  }),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('@/db/repository', () => ({
  exportSnapshot: jest.fn(),
  replaceSnapshot: jest.fn(),
}));

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportSnapshot, replaceSnapshot } from '@/db/repository';
import { createAndShareBackup, pickAndValidateBackup } from './backup';
import type { LibrarySnapshot } from '@/types/domain';

type BackupFileSystemMocks = {
  __setMockBytes: (uri: string, bytes: Uint8Array) => void;
  __getMockBytes: (uri: string) => Uint8Array | undefined;
  __clearMockBytes: () => void;
};

const documentPickerMock = DocumentPicker.getDocumentAsync as jest.Mock;
const fileSystemMocks = FileSystem as unknown as BackupFileSystemMocks;
const exportSnapshotMock = exportSnapshot as jest.Mock;
const replaceSnapshotMock = replaceSnapshot as jest.Mock;
const backupUri = 'mock://backup.zip';

const emptySnapshot = () => ({
  books: [],
  annotations: [],
  bookmarks: [],
  cards: [],
  preferences: [],
  lookupCache: [],
});

const testDb = {} as never;
const sourceBookUri = 'mock://books/source.epub';
const sourceCoverUri = 'mock://covers/source.jpg';
const missingCoverUri = 'mock://covers/missing.jpg';
const sourceEpubBytes = new TextEncoder().encode('SYNTHETIC EPUB TEST-049');
const sourceCoverBytes = new TextEncoder().encode('SYNTHETIC COVER TEST-049');

function syntheticSnapshot(coverUri: string | null = sourceCoverUri): LibrarySnapshot {
  const timestamp = '2026-09-23T12:00:00.000Z';
  return {
    books: [{
      id: 'book-049',
      fileUri: sourceBookUri,
      fileHash: 'a'.repeat(64),
      originalName: 'wave-4c.epub',
      title: 'Wave 4C Backup Book',
      author: 'Synthetic Author',
      language: 'en',
      coverUri,
      description: 'Synthetic description',
      publisher: 'Synthetic publisher',
      importedAt: timestamp,
      lastOpenedAt: null,
      lastCfi: null,
      progress: 0.42,
      locationsJson: null,
    }],
    annotations: [{
      id: 'annotation-049',
      bookId: 'book-049',
      cfiRange: 'epubcfi(/6/2)',
      selectedText: 'Synthetic annotation',
      color: '#FFE082',
      note: 'Synthetic note',
      sectionIndex: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    bookmarks: [{
      id: 'bookmark-049',
      bookId: 'book-049',
      cfi: 'epubcfi(/6/4)',
      chapterTitle: 'Synthetic chapter',
      excerpt: 'Synthetic bookmark',
      createdAt: timestamp,
    }],
    cards: [{
      id: 'card-049',
      bookId: 'book-049',
      cfiRange: 'epubcfi(/6/6)',
      selectedText: 'synthetic',
      translation: 'sintético',
      pronunciation: '/sɪnˈθɛtɪk/',
      partOfSpeech: 'adjective',
      definition: 'Made for this test.',
      background: 'Synthetic background',
      examples: ['Synthetic example'],
      relatedWords: ['synthetically'],
      chapterTitle: 'Synthetic chapter',
      queueOrder: 0,
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    preferences: [{
      bookId: 'book-049',
      flow: 'paginated',
      theme: 'sepia',
      fontFamily: 'serif',
      fontSize: 18,
      lineHeight: 1.5,
      margin: 20,
      textAlign: 'justify',
    }],
    lookupCache: [{
      language: 'en',
      term: 'synthetic',
      definition: 'Made for this test.',
      expiresAt: timestamp,
    }],
    lexicon: [{
      id: 'lexicon-049',
      bookId: 'book-049',
      lemma: 'synthetic',
      partOfSpeech: 'adjective',
      wordForms: ['synthetics'],
      definition: 'Made for this test.',
      translationPtBr: 'sintético',
      ipa: '/sɪnˈθɛtɪk/',
      cefr: 'B2',
      bookFrequency: 1,
      firstSentenceId: null,
      resolutionStatus: 'RESOLVED',
      pedagogicalRelevance: 'HIGH',
      senses: [{
        id: 'sense-049',
        senseKey: 'synthetic-adjective-1',
        definition: 'Made for this test.',
        translationPtBr: 'sintético',
      }],
      updatedAt: timestamp,
    }],
  };
}

async function exportSyntheticBackup(options: {
  coverUri?: string | null;
  includeCoverFile?: boolean;
} = {}): Promise<{ db: typeof testDb; snapshot: LibrarySnapshot; destinationUri: string; bytes: Uint8Array }> {
  const coverUri = options.coverUri === undefined ? sourceCoverUri : options.coverUri;
  const snapshot = syntheticSnapshot(coverUri);
  fileSystemMocks.__setMockBytes(sourceBookUri, sourceEpubBytes);
  if (options.includeCoverFile ?? (coverUri === sourceCoverUri)) {
    fileSystemMocks.__setMockBytes(sourceCoverUri, sourceCoverBytes);
  }
  exportSnapshotMock.mockResolvedValue(snapshot);
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

  const destinationUri = await createAndShareBackup(testDb);
  const bytes = fileSystemMocks.__getMockBytes(destinationUri);
  if (!bytes) throw new Error('Exported ZIP bytes were not captured.');
  return { db: testDb, snapshot, destinationUri, bytes };
}

async function expectExportToValidate(bytes: Uint8Array, db: typeof testDb): Promise<void> {
  selectBackup(bytes);
  const prepared = await pickAndValidateBackup(db);
  expect(prepared).toEqual(expect.objectContaining({
    bookCount: 1,
    restore: expect.any(Function),
  }));
  expect(replaceSnapshotMock).not.toHaveBeenCalled();
  if (!prepared) throw new Error('Expected a prepared backup after validation.');
}

function sha256(bytes: Uint8Array): string {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

async function buildBackup(options: {
  libraryContent?: string;
  manifest?: Record<string, unknown>;
  manifestContent?: string;
  omitManifest?: boolean;
  omitLibrary?: boolean;
} = {}): Promise<Uint8Array> {
  const libraryContent = options.libraryContent ?? JSON.stringify(emptySnapshot());
  const libraryBytes = new TextEncoder().encode(libraryContent);
  const manifest = options.manifest ?? {
    format: 'leitor-epub-backup',
    version: 1,
    createdAt: '2026-09-23T00:00:00.000Z',
    files: { 'library.json': sha256(libraryBytes) },
  };
  const zip = new JSZip();
  if (!options.omitLibrary) zip.file('library.json', libraryBytes);
  if (!options.omitManifest) {
    zip.file('manifest.json', options.manifestContent ?? JSON.stringify(manifest));
  }
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }));
}

async function corruptFirstStoredEntry(bytes: Uint8Array): Promise<Uint8Array> {
  const corrupted = new Uint8Array(bytes);
  const view = new DataView(corrupted.buffer, corrupted.byteOffset, corrupted.byteLength);
  if (view.getUint32(0, true) !== 0x04034b50) throw new Error('Unexpected ZIP fixture header');
  const fileNameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const payloadOffset = 30 + fileNameLength + extraLength;
  corrupted[payloadOffset] = (corrupted[payloadOffset] ?? 0) ^ 0xff;
  return corrupted;
}

function selectBackup(bytes: Uint8Array): void {
  fileSystemMocks.__setMockBytes(backupUri, bytes);
  documentPickerMock.mockResolvedValue({
    canceled: false,
    assets: [{ uri: backupUri, name: 'fixture-backup.zip', size: bytes.byteLength }],
  });
}

async function expectValidationRejection(bytes: Uint8Array): Promise<void> {
  selectBackup(bytes);
  await expect(pickAndValidateBackup({} as never)).rejects.toBeDefined();
  expect(replaceSnapshotMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  fileSystemMocks.__clearMockBytes();
});

describe('TEST-049 — pacote exportado auto-validável', () => {
  it('empacota EPUB, cover, manifest e snapshot completo, e aceita o próprio ZIP', async () => {
    const fixture = await exportSyntheticBackup();
    const zip = await JSZip.loadAsync(fixture.bytes);
    const epubEntry = zip.file('books/book-049.epub');
    const coverEntry = zip.file('covers/book-049.jpg');
    const libraryEntry = zip.file('library.json');
    const manifestEntry = zip.file('manifest.json');

    expect(epubEntry).not.toBeNull();
    expect(coverEntry).not.toBeNull();
    expect(libraryEntry).not.toBeNull();
    expect(manifestEntry).not.toBeNull();
    const packagedEpub = await epubEntry!.async('uint8array');
    const packagedCover = await coverEntry!.async('uint8array');
    const libraryBytes = await libraryEntry!.async('uint8array');
    expect(packagedEpub).toEqual(sourceEpubBytes);
    expect(packagedCover).toEqual(sourceCoverBytes);

    const portableSnapshot = JSON.parse(new TextDecoder().decode(libraryBytes)) as LibrarySnapshot;
    const portableBook = portableSnapshot.books[0]!;
    expect(portableBook).toEqual(expect.objectContaining({
      id: 'book-049',
      title: 'Wave 4C Backup Book',
      author: 'Synthetic Author',
      progress: 0.42,
      fileUri: 'books/book-049.epub',
      coverUri: 'covers/book-049.jpg',
    }));
    expect(portableSnapshot.annotations).toHaveLength(1);
    expect(portableSnapshot.annotations[0]?.id).toBe('annotation-049');
    expect(portableSnapshot.bookmarks).toHaveLength(1);
    expect(portableSnapshot.bookmarks[0]?.id).toBe('bookmark-049');
    expect(portableSnapshot.cards).toHaveLength(1);
    expect(portableSnapshot.cards[0]?.id).toBe('card-049');
    expect(portableSnapshot.preferences).toHaveLength(1);
    expect(portableSnapshot.preferences[0]?.bookId).toBe('book-049');
    expect(portableSnapshot.lookupCache).toHaveLength(1);
    expect(portableSnapshot.lookupCache[0]?.term).toBe('synthetic');
    expect(portableSnapshot.lexicon).toHaveLength(1);
    expect(portableSnapshot.lexicon?.[0]?.id).toBe('lexicon-049');

    const manifest = JSON.parse(await manifestEntry!.async('text')) as {
      format: string;
      version: number;
      createdAt: string;
      files: Record<string, string>;
    };
    expect(manifest.format).toBe('leitor-epub-backup');
    expect(manifest.version).toBe(1);
    expect(Number.isNaN(Date.parse(manifest.createdAt))).toBe(false);
    expect(new Date(manifest.createdAt).toISOString()).toBe(manifest.createdAt);
    expect(Object.keys(manifest.files).sort()).toEqual([
      'books/book-049.epub',
      'covers/book-049.jpg',
      'library.json',
    ]);
    expect(manifest.files['books/book-049.epub']).toBe(sha256(packagedEpub));
    expect(manifest.files['covers/book-049.jpg']).toBe(sha256(packagedCover));
    expect(manifest.files['library.json']).toBe(sha256(libraryBytes));
    expect(manifest.files['books/book-049.epub']).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.files['covers/book-049.jpg']).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.files['library.json']).toMatch(/^[a-f0-9]{64}$/);

    expect(fixture.destinationUri).toMatch(/^mock:\/\/cache\/backups\/leitor-epub-.*\.zip$/);
    expect(exportSnapshotMock).toHaveBeenCalledTimes(1);
    expect(exportSnapshotMock).toHaveBeenCalledWith(fixture.db);
    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(fixture.destinationUri, expect.objectContaining({
      mimeType: 'application/zip',
      dialogTitle: 'Salvar backup do Leitor EPUB',
    }));
    await expectExportToValidate(fixture.bytes, fixture.db);
  });

  it('preserva coverUri null e valida o backup sem entry ou checksum de cover', async () => {
    const fixture = await exportSyntheticBackup({ coverUri: null });
    const zip = await JSZip.loadAsync(fixture.bytes);
    const portableSnapshot = JSON.parse(await zip.file('library.json')!.async('text')) as LibrarySnapshot;
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('text')) as { files: Record<string, string> };

    expect(zip.file('covers/book-049.jpg')).toBeNull();
    expect(Object.keys(manifest.files).some((path) => path.startsWith('covers/'))).toBe(false);
    expect(portableSnapshot.books[0]?.coverUri).toBeNull();
    expect(Object.keys(manifest.files).sort()).toEqual(['books/book-049.epub', 'library.json']);
    await expectExportToValidate(fixture.bytes, fixture.db);
  });

  it('usa null e valida o backup quando a cover referenciada não existe fisicamente', async () => {
    const fixture = await exportSyntheticBackup({ coverUri: missingCoverUri, includeCoverFile: false });
    const zip = await JSZip.loadAsync(fixture.bytes);
    const portableSnapshot = JSON.parse(await zip.file('library.json')!.async('text')) as LibrarySnapshot;
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('text')) as { files: Record<string, string> };

    expect(fileSystemMocks.__getMockBytes(missingCoverUri)).toBeUndefined();
    expect(zip.file('covers/book-049.jpg')).toBeNull();
    expect(Object.keys(manifest.files).some((path) => path.startsWith('covers/'))).toBe(false);
    expect(portableSnapshot.books[0]?.coverUri).toBeNull();
    expect(Object.keys(manifest.files).sort()).toEqual(['books/book-049.epub', 'library.json']);
    await expectExportToValidate(fixture.bytes, fixture.db);
  });

  it('rejeita export sem EPUB e não inicia compartilhamento', async () => {
    exportSnapshotMock.mockResolvedValue(syntheticSnapshot());
    await expect(createAndShareBackup(testDb)).rejects.toThrow(
      'O arquivo do livro “Wave 4C Backup Book” não foi encontrado.',
    );
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('detecta alteração de library.json sem atualizar o manifest', async () => {
    const fixture = await exportSyntheticBackup();
    const zip = await JSZip.loadAsync(fixture.bytes);
    const originalManifest = JSON.parse(await zip.file('manifest.json')!.async('text')) as {
      files: Record<string, string>;
    };
    const portableSnapshot = JSON.parse(await zip.file('library.json')!.async('text')) as LibrarySnapshot;
    portableSnapshot.annotations[0]!.selectedText = 'Tampered annotation';
    zip.file('library.json', JSON.stringify(portableSnapshot));

    const tamperedBytes = new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
    const tamperedZip = await JSZip.loadAsync(tamperedBytes);
    const manifestAfterTamper = JSON.parse(await tamperedZip.file('manifest.json')!.async('text'));
    const alteredLibraryBytes = await tamperedZip.file('library.json')!.async('uint8array');
    expect(manifestAfterTamper).toEqual(originalManifest);
    expect(sha256(alteredLibraryBytes)).not.toBe(originalManifest.files['library.json']);

    selectBackup(tamperedBytes);
    await expect(pickAndValidateBackup(fixture.db)).rejects.toThrow(
      'A verificação de integridade falhou: library.json.',
    );
    expect(replaceSnapshotMock).not.toHaveBeenCalled();
  });
});

describe('TEST-050 — validação de backup antes do restore', () => {
  it('aceita o backup mínimo válido e retorna PreparedBackupRestore sem iniciar restore', async () => {
    const bytes = await buildBackup();
    selectBackup(bytes);

    const prepared = await pickAndValidateBackup({} as never);

    expect(prepared).toEqual(expect.objectContaining({
      bookCount: 0,
      restore: expect.any(Function),
    }));
    expect(replaceSnapshotMock).not.toHaveBeenCalled();
  });

  it('rejeita bytes que não formam ZIP', async () => {
    await expectValidationRejection(new TextEncoder().encode('not a ZIP backup'));
  });

  it('rejeita ZIP sem manifest.json', async () => {
    await expectValidationRejection(await buildBackup({ omitManifest: true }));
  });

  it('rejeita ZIP sem library.json', async () => {
    await expectValidationRejection(await buildBackup({ omitLibrary: true }));
  });

  it('rejeita manifest.json inválido ou truncado', async () => {
    await expectValidationRejection(await buildBackup({ manifestContent: '{"format":' }));
  });

  it('rejeita library.json inválido ou truncado', async () => {
    await expectValidationRejection(await buildBackup({ libraryContent: '{"books":' }));
  });

  it('rejeita format de manifesto inválido', async () => {
    await expectValidationRejection(await buildBackup({
      manifest: { format: 'other-format', version: 1, createdAt: '2026-09-23', files: {} },
    }));
  });

  it('rejeita versão de manifesto não suportada', async () => {
    await expectValidationRejection(await buildBackup({
      manifest: { format: 'leitor-epub-backup', version: 99, createdAt: '2026-09-23', files: {} },
    }));
  });

  it('rejeita snapshot que não atende ao schema', async () => {
    await expectValidationRejection(await buildBackup({ libraryContent: JSON.stringify({ books: [] }) }));
  });

  it('rejeita referência de annotation para livro ausente', async () => {
    await expectValidationRejection(await buildBackup({
      libraryContent: JSON.stringify({
        ...emptySnapshot(),
        annotations: [{
          id: 'annotation-1',
          bookId: 'missing-book',
          cfiRange: 'epubcfi(/6/2)',
          selectedText: 'texto',
          color: '#fff',
          note: null,
          sectionIndex: 0,
          createdAt: '2026-09-23',
          updatedAt: '2026-09-23',
        }],
      }),
    }));
  });

  it('rejeita checksum divergente do library.json', async () => {
    await expectValidationRejection(await buildBackup({
      manifest: {
        format: 'leitor-epub-backup',
        version: 1,
        createdAt: '2026-09-23',
        files: { 'library.json': '0'.repeat(64) },
      },
    }));
  });

  it('rejeita CRC corrompido antes de retornar o prepared restore', async () => {
    const valid = await buildBackup();
    await expectValidationRejection(await corruptFirstStoredEntry(valid));
  });
});
