import JSZip from 'jszip';
import { validateEpubArchive } from './epubImport';

type FixtureOptions = {
  version?: '2.0' | '3.0';
  fixed?: boolean;
  chapter?: string;
  mimetype?: string | null;
  container?: string | null;
  packagePath?: string;
  includePackage?: boolean;
  includeManifest?: boolean;
  manifestItems?: string;
  spineItems?: string | null;
  encryption?: string;
  extraEntries?: Array<[string, string | Uint8Array]>;
};

const defaultChapter = '<html><body><p>Capítulo local.</p></body></html>';

async function fixture(options: FixtureOptions = {}): Promise<JSZip> {
  const version = options.version ?? '3.0';
  const packagePath = options.packagePath ?? 'OPS/package.opf';
  const zip = new JSZip();
  if (options.mimetype !== null) zip.file('mimetype', options.mimetype ?? 'application/epub+zip');
  if (options.container !== null) {
    zip.file(
      'META-INF/container.xml',
      options.container ?? `<?xml version="1.0"?>
        <container><rootfiles><rootfile full-path="${packagePath}" /></rootfiles></container>`,
    );
  }
  if (options.encryption) zip.file('META-INF/encryption.xml', options.encryption);
  if (options.includePackage !== false) {
    const manifestItems = options.manifestItems ??
      '<item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" />';
    const spine = options.spineItems === null
      ? ''
      : `<spine><itemref idref="chapter" />${options.spineItems ?? ''}</spine>`;
    zip.file(packagePath, `<?xml version="1.0"?>
      <package version="${version}">
        <metadata>
          <title>Fixture EPUB ${version}</title>
          <creator>Autoria de teste</creator>
          <language>pt-BR</language>
          ${options.fixed ? '<meta property="rendition:layout">pre-paginated</meta>' : ''}
        </metadata>
        ${options.includeManifest === false ? '' : `<manifest>${manifestItems}</manifest>`}
        ${spine}
      </package>`);
  }
  zip.file('OPS/chapter.xhtml', options.chapter ?? defaultChapter);
  for (const [path, content] of options.extraEntries ?? []) zip.file(path, content);
  return JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
}

type ZipEntryWithData = JSZip.JSZipObject & { _data?: { uncompressedSize?: number } };

function overrideUncompressedSize(zip: JSZip, path: string, size: number): void {
  const entry = zip.file(path) as ZipEntryWithData | null;
  if (!entry?._data) throw new Error(`Fixture entry not loaded: ${path}`);
  entry._data.uncompressedSize = size;
}

describe('fixtures EPUB 2 e 3', () => {
  it.each(['2.0', '3.0'] as const)('aceita um EPUB %s fluido', async (version) => {
    await expect(validateEpubArchive(await fixture({ version }))).resolves.toMatchObject({
      title: `Fixture EPUB ${version}`,
      author: 'Autoria de teste',
      language: 'pt-BR',
    });
  });

  it('rejeita layout fixo', async () => {
    await expect(validateEpubArchive(await fixture({ fixed: true }))).rejects.toThrow(/layout fixo/);
  });

  it('rejeita carregamento automático de conteúdo remoto', async () => {
    const chapter = '<html><body><img src="https://tracker.example/pixel.png" /></body></html>';
    await expect(validateEpubArchive(await fixture({ chapter }))).rejects.toThrow(/conteúdo remoto/);
  });

  it.each([
    ['ausente', { mimetype: null }],
    ['incorreto', { mimetype: 'text/plain' }],
  ])('rejeita mimetype %s', async (_label, options) => {
    await expect(validateEpubArchive(await fixture(options))).rejects.toThrow(/identificador EPUB/);
  });

  it('rejeita container.xml ausente', async () => {
    await expect(validateEpubArchive(await fixture({ container: null }))).rejects.toThrow(/container.xml/);
  });

  it('rejeita container sem full-path válido', async () => {
    const container = '<container><rootfiles><rootfile /></rootfiles></container>';
    await expect(validateEpubArchive(await fixture({ container }))).rejects.toThrow(/caminhos de arquivo inseguros/);
  });

  it('rejeita full-path inseguro no container', async () => {
    await expect(validateEpubArchive(await fixture({ packagePath: '../outside.opf', includePackage: false })))
      .rejects.toThrow(/caminhos de arquivo inseguros/);
  });

  it('rejeita OPF informado mas inexistente', async () => {
    await expect(validateEpubArchive(await fixture({ packagePath: 'OPS/missing.opf', includePackage: false })))
      .rejects.toThrow(/OPF informado não existe/);
  });

  it('rejeita manifesto vazio', async () => {
    await expect(validateEpubArchive(await fixture({ manifestItems: '' }))).rejects.toThrow(/manifesto/);
  });

  it('rejeita manifesto ausente', async () => {
    await expect(validateEpubArchive(await fixture({ includeManifest: false }))).rejects.toThrow(/manifesto/);
  });

  it('rejeita spine ausente', async () => {
    await expect(validateEpubArchive(await fixture({ spineItems: null }))).rejects.toThrow(/sequência de leitura/);
  });

  it('rejeita DRM não suportado na validação integrada', async () => {
    const encryption = '<encryption><EncryptedData><EncryptionMethod Algorithm="http://example.com/drm" /></EncryptedData></encryption>';
    await expect(validateEpubArchive(await fixture({ encryption }))).rejects.toThrow(/DRM/);
  });

  it('rejeita uma entrada insegura do ZIP antes de aceitar o EPUB', async () => {
    const loaded = await fixture();
    const entry = loaded.file('OPS/chapter.xhtml');
    if (!entry) throw new Error('Fixture chapter entry not loaded');
    Object.defineProperty(entry, 'name', { configurable: true, value: '../escape.xhtml' });
    await expect(validateEpubArchive(loaded)).rejects.toThrow(/caminhos de arquivo inseguros/);
  });

  it('rejeita mais de 10.000 entries', async () => {
    const entries: Array<[string, string]> = Array.from({ length: 10_001 }, (_, index) => [`OPS/extra-${index}.bin`, 'x']);
    await expect(validateEpubArchive(await fixture({ extraEntries: entries }))).rejects.toThrow(/arquivos demais/);
  });

  it('rejeita documento textual acima do limite individual sem alocar 10 MB', async () => {
    const loaded = await fixture();
    overrideUncompressedSize(loaded, 'OPS/chapter.xhtml', 10 * 1024 * 1024 + 1);
    await expect(validateEpubArchive(loaded)).rejects.toThrow(/documento de texto excessivamente grande/);
  });

  it('rejeita tamanho expandido acima do limite usando metadata sintética', async () => {
    const loaded = await fixture({ extraEntries: [['OPS/content.bin', new Uint8Array([0])]] });
    overrideUncompressedSize(loaded, 'OPS/content.bin', 500 * 1024 * 1024 + 1);
    await expect(validateEpubArchive(loaded)).rejects.toThrow(/grande demais depois de descompactado/);
  });

  it('rejeita um ZIP que não tem a estrutura EPUB', async () => {
    const zip = new JSZip();
    zip.file('arquivo.txt', 'não é um livro');
    const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
    await expect(validateEpubArchive(loaded)).rejects.toThrow(/identificador EPUB/);
  });
});

async function corruptStoredZipEntry(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('payload.txt', 'CRC boundary fixture');
  const bytes = new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x04034b50) throw new Error('Unexpected ZIP fixture header');
  const fileNameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const payloadOffset = 30 + fileNameLength + extraLength;
  bytes[payloadOffset] = (bytes[payloadOffset] ?? 0) ^ 0xff;
  return bytes;
}

describe('fronteira CRC da importação EPUB', () => {
  it('rejeita ZIP com CRC corrompido através de importEpub', async () => {
    const bytes = await corruptStoredZipEntry();
    let importPromise: Promise<unknown> | undefined;
    jest.isolateModules(() => {
      jest.doMock('expo-document-picker', () => ({
        getDocumentAsync: jest.fn().mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'mock://corrupt.epub', name: 'corrupt.epub', size: bytes.byteLength }],
        }),
      }));
      jest.doMock('expo-file-system', () => {
        class MockFile {
          constructor(public readonly uri: string) {}
          get exists(): boolean { return true; }
          get size(): number { return bytes.byteLength; }
          async bytes(): Promise<Uint8Array> { return bytes; }
        }
        class MockDirectory {}
        return { File: MockFile, Directory: MockDirectory, Paths: { document: {}, cache: {} } };
      });
      jest.doMock('expo-crypto', () => ({
        CryptoDigestAlgorithm: { SHA256: 'SHA256' },
        digest: jest.fn(async (_algorithm: string, input: Uint8Array) => {
          const { createHash } = require('node:crypto');
          const hash = createHash('sha256').update(Buffer.from(input)).digest();
          return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
        }),
        randomUUID: jest.fn(() => 'mock-import-id'),
      }));
      jest.doMock('@/db/repository', () => ({
        findBookByHash: jest.fn().mockResolvedValue(null),
        insertBook: jest.fn(),
      }));

      const { importEpub } = require('./epubImport') as typeof import('./epubImport');
      importPromise = importEpub({} as never);
    });
    if (!importPromise) throw new Error('CRC import promise was not created');
    await expect(importPromise).rejects.toThrow(/corrompido ou incompleto/);
  });
});
