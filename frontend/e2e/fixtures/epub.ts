import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

function crc32(data: Buffer): number {
  let value = 0xffffffff;
  for (const byte of data) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

type ZipEntry = { name: string; data: Buffer };

function buildStoredZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export type SyntheticEpub = {
  path: string;
  size: number;
  sha256: string;
  cleanup: () => Promise<void>;
};

export async function createSyntheticEpub(prefix = 'wave-3b-test-013-'): Promise<SyntheticEpub> {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const filePath = path.join(temporaryDirectory, prefix + 'synthetic-dragon.epub');
  const entries: ZipEntry[] = [
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf8') },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', 'utf8'),
    },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">urn:uuid:wave-3b-test-013</dc:identifier><dc:title>Synthetic Dragon Reader</dc:title><dc:language>en</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>', 'utf8'),
    },
    {
      name: 'OEBPS/chapter.xhtml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Synthetic Dragon Reader</title></head><body><h1>Synthetic Dragon Reader</h1><p>The dragon can read a book.</p><p>The dragon will read the book.</p></body></html>', 'utf8'),
    },
  ];
  const bytes = buildStoredZip(entries);
  await fs.writeFile(filePath, bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return {
    path: filePath,
    size: bytes.length,
    sha256,
    cleanup: async () => fs.rm(temporaryDirectory, { recursive: true, force: true }),
  };
}

export async function createSyntheticReaderEpub(prefix = 'wave-3d-test-023-'): Promise<SyntheticEpub> {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const filePath = path.join(temporaryDirectory, prefix + 'synthetic-reader.epub');
  const entries: ZipEntry[] = [
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf8') },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', 'utf8'),
    },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">urn:uuid:wave-3d-test-023</dc:identifier><dc:title>Wave 3D Synthetic Reader</dc:title><dc:language>en</dc:language></metadata><manifest><item id="chapter1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/><item id="chapter2" href="chapter-2.xhtml" media-type="application/xhtml+xml"/><item id="chapter3" href="chapter-3.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter1"/><itemref idref="chapter2"/><itemref idref="chapter3"/></spine></package>', 'utf8'),
    },
    {
      name: 'OEBPS/chapter-1.xhtml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Wave 3D Chapter One</title></head><body><h1>Chapter One</h1><p>WAVE3D_CHAPTER_ONE_SENTINEL</p></body></html>', 'utf8'),
    },
    {
      name: 'OEBPS/chapter-2.xhtml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Wave 3D Chapter Two</title></head><body><h1>Chapter Two</h1><p>WAVE3D_CHAPTER_TWO_SENTINEL</p></body></html>', 'utf8'),
    },
    {
      name: 'OEBPS/chapter-3.xhtml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Wave 3D Chapter Three</title></head><body><h1>Chapter Three</h1><p>WAVE3D_CHAPTER_THREE_SENTINEL</p></body></html>', 'utf8'),
    },
  ];
  const bytes = buildStoredZip(entries);
  await fs.writeFile(filePath, bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return {
    path: filePath,
    size: bytes.length,
    sha256,
    cleanup: async () => fs.rm(temporaryDirectory, { recursive: true, force: true }),
  };
}

export async function createSyntheticLexicalEpub(prefix = 'wave-3f-test-'): Promise<SyntheticEpub> {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const filePath = path.join(temporaryDirectory, prefix + 'synthetic-lexical.epub');
  const entries: ZipEntry[] = [
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf8') },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', 'utf8'),
    },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">urn:uuid:wave-3f-test-027</dc:identifier><dc:title>Wave 3F Synthetic Lexical Reader</dc:title><dc:language>en</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>', 'utf8'),
    },
    {
      name: 'OEBPS/chapter.xhtml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Wave 3F Lexical Chapter</title></head><body><h1>Wave 3F Lexical Chapter</h1><p>The dragon crossed the silver moonspire.</p><p>The dragon can read a book.</p></body></html>', 'utf8'),
    },
  ];
  const bytes = buildStoredZip(entries);
  await fs.writeFile(filePath, bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return {
    path: filePath,
    size: bytes.length,
    sha256,
    cleanup: async () => fs.rm(temporaryDirectory, { recursive: true, force: true }),
  };
}
