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

describe('TEST-049 — pacote exportado com cover referenciada ausente', () => {
  it('reproduz PRODUCT_BUG_CANDIDATE: biblioteca aponta para cover fora do ZIP e o próprio validator rejeita o pacote', async () => {
    const db = {} as never;
    const sourceBytes = new TextEncoder().encode('SYNTHETIC EPUB TEST-049');
    const snapshot = {
      books: [{
        id: 'book-049',
        fileUri: 'mock://books/source.epub',
        fileHash: 'a'.repeat(64),
        originalName: 'wave-4c.epub',
        title: 'Wave 4C Backup Book',
        author: 'Synthetic Author',
        language: 'en',
        coverUri: 'mock://covers/missing.jpg',
        description: 'Synthetic description',
        publisher: 'Synthetic publisher',
        importedAt: '2026-09-23T00:00:00.000Z',
        lastOpenedAt: null,
        lastCfi: null,
        progress: 0.42,
        locationsJson: null,
      }],
      annotations: [],
      bookmarks: [],
      cards: [],
      preferences: [],
      lookupCache: [],
      lexicon: [],
    };
    fileSystemMocks.__setMockBytes('mock://books/source.epub', sourceBytes);
    exportSnapshotMock.mockResolvedValue(snapshot);
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

    const destinationUri = await createAndShareBackup(db);
    const exportedBytes = fileSystemMocks.__getMockBytes(destinationUri);
    expect(exportedBytes).toBeDefined();
    if (!exportedBytes) throw new Error('Exported ZIP bytes were not captured.');

    const zip = await JSZip.loadAsync(exportedBytes);
    const portableLibrary = JSON.parse(await zip.file('library.json')!.async('text'));
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('text'));
    expect(portableLibrary.books[0].coverUri).toBe('covers/book-049.jpg');
    expect(zip.file('covers/book-049.jpg')).toBeNull();
    expect(manifest.files['covers/book-049.jpg']).toBeUndefined();
    expect(destinationUri).toMatch(/^mock:\/\/cache\/backups\/leitor-epub-.*\.zip$/);
    expect(exportSnapshotMock).toHaveBeenCalledTimes(1);
    expect(exportSnapshotMock).toHaveBeenCalledWith(db);
    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(destinationUri, expect.objectContaining({
      mimeType: 'application/zip',
      dialogTitle: 'Salvar backup do Leitor EPUB',
    }));

    selectBackup(exportedBytes);
    await expect(pickAndValidateBackup(db)).resolves.toEqual(expect.objectContaining({ bookCount: 1 }));
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
