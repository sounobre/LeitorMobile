import JSZip from 'jszip';
import { validateEpubArchive } from './epubImport';

async function fixture(options: {
  version?: '2.0' | '3.0';
  fixed?: boolean;
  chapter?: string;
} = {}): Promise<JSZip> {
  const version = options.version ?? '3.0';
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
    <container><rootfiles><rootfile full-path="OPS/package.opf" /></rootfiles></container>`);
  zip.file('OPS/package.opf', `<?xml version="1.0"?>
    <package version="${version}">
      <metadata>
        <title>Fixture EPUB ${version}</title>
        <creator>Autoria de teste</creator>
        <language>pt-BR</language>
        ${options.fixed ? '<meta property="rendition:layout">pre-paginated</meta>' : ''}
      </metadata>
      <manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" /></manifest>
      <spine><itemref idref="chapter" /></spine>
    </package>`);
  zip.file('OPS/chapter.xhtml', options.chapter ?? '<html><body><p>Capítulo local.</p></body></html>');
  return JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
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

  it('rejeita um ZIP que não tem a estrutura EPUB', async () => {
    const zip = new JSZip();
    zip.file('arquivo.txt', 'não é um livro');
    const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
    await expect(validateEpubArchive(loaded)).rejects.toThrow(/identificador EPUB/);
  });
});
