import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import JSZip from 'jszip';

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksumInput = Buffer.concat([name, data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(checksumInput), 0);
  return Buffer.concat([length, name, data, checksum]);
}

function syntheticCoverPng() {
  const width = 64;
  const height = 96;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      let color = [239, 225, 194];
      if (x < 3 || x >= width - 3 || y < 3 || y >= height - 3) color = [74, 48, 39];
      else if (y >= 16 && y <= 39) color = [39, 97, 102];
      else if ((y === 48 || y === 51 || y === 54) && x > 12 && x < 52) color = [91, 58, 45];
      else if (y > 70 && y < 78 && x > 12 && x < 52) color = [167, 113, 62];
      const offset = 1 + x * 3;
      row[offset] = color[0];
      row[offset + 1] = color[1];
      row[offset + 2] = color[2];
    }
    rows.push(row);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function epubDocuments(book, version) {
  const title = escapeXml(book.title);
  const author = escapeXml(book.author);
  const bookId = escapeXml(book.id);
  const chapter = '<?xml version="1.0" encoding="utf-8"?>' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">' +
    '<head><title>' + title + '</title></head><body><h1>' + title + '</h1>' +
    '<p>This short synthetic chapter exists only for Wave 5 mobile testing.</p></body></html>';
  const container = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
    '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>' +
    '</rootfiles></container>';
  let opf;
  if (version === '2.0') {
    opf = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0" unique-identifier="pub-id">' +
      '<metadata><dc:identifier id="pub-id">' + bookId + '</dc:identifier><dc:title>' + title +
      '</dc:title><dc:creator>' + author + '</dc:creator><dc:language>en</dc:language></metadata>' +
      '<manifest><item id="chapter1" href="chapter.xhtml" media-type="application/xhtml+xml"/>' +
      '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest>' +
      '<spine toc="ncx"><itemref idref="chapter1"/></spine></package>';
  } else {
    opf = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="pub-id">' +
      '<metadata><dc:identifier id="pub-id">' + bookId + '</dc:identifier><dc:title>' + title +
      '</dc:title><dc:creator>' + author + '</dc:creator><dc:language>en</dc:language>' +
      '<meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata>' +
      '<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' +
      '<item id="chapter1" href="chapter.xhtml" media-type="application/xhtml+xml"/>' +
      '<item id="cover" href="images/cover.png" media-type="image/png" properties="cover-image"/></manifest>' +
      '<spine><itemref idref="chapter1"/></spine></package>';
  }
  return { chapter, container, opf };
}

async function createEpub(book, version, withCover, outputPath) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE', createFolders: false });
  zip.file('META-INF/container.xml', epubDocuments(book, version).container);
  zip.file('OEBPS/content.opf', epubDocuments(book, version).opf);
  zip.file('OEBPS/chapter.xhtml', epubDocuments(book, version).chapter);
  if (version === '2.0') {
    zip.file('OEBPS/toc.ncx',
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">' +
      '<head><meta name="dtb:uid" content="' + escapeXml(book.id) + '"/></head>' +
      '<docTitle><text>' + escapeXml(book.title) + '</text></docTitle>' +
      '<navMap><navPoint id="chapter1" playOrder="1"><navLabel><text>' +
      escapeXml(book.title) + '</text></navLabel><content src="chapter.xhtml"/></navPoint></navMap></ncx>');
  } else {
    zip.file('OEBPS/nav.xhtml',
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">' +
      '<head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1>' +
      '<ol><li><a href="chapter.xhtml">' + escapeXml(book.title) + '</a></li></ol></nav></body></html>');
  }
  if (withCover) zip.file('OEBPS/images/cover.png', syntheticCoverPng());
  const bytes = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  await writeFile(outputPath, bytes);
  return {
    path: outputPath,
    length: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export async function generateEpubFixtures(outputDir) {
  const target = outputDir || process.env.WAVE5_FIXTURE_DIR ||
    join(process.env.TEMP || tmpdir(), 'wave-5e-group-a', 'fixtures');
  await mkdir(target, { recursive: true });
  const books = [
    {
      name: 'wave5-epub2.epub',
      id: 'urn:wave5:group-a:epub2',
      version: '2.0',
      withCover: false,
      title: 'Wave Five EPUB Two',
      author: 'Author Two',
    },
    {
      name: 'wave5-epub3.epub',
      id: 'urn:wave5:group-a:epub3',
      version: '3.0',
      withCover: true,
      title: 'Wave Five EPUB Three',
      author: 'Author Three',
    },
    {
      name: 'wave5-insert-failure.epub',
      id: 'urn:wave5:group-a:insert-failure',
      version: '3.0',
      withCover: true,
      title: 'Wave Five Insert Failure',
      author: 'Author Failure',
    },
  ];
  const results = [];
  for (const book of books) {
    const outputPath = join(target, book.name);
    results.push(await createEpub(book, book.version, book.withCover, outputPath));
  }
  return { outputDir: target, fixtures: results };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const result = await generateEpubFixtures();
  console.log(JSON.stringify(result, null, 2));
}
