export const EPUB_LIMITS = {
  archiveBytes: 100 * 1024 * 1024,
  uncompressedBytes: 500 * 1024 * 1024,
  textEntryBytes: 10 * 1024 * 1024,
  entries: 10_000,
} as const;

export class UnsafeArchivePathError extends Error {}

export function assertSafeArchivePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.split('/').some((part) => part === '..')
  ) {
    throw new UnsafeArchivePathError('O EPUB contém caminhos de arquivo inseguros.');
  }
  return normalized;
}

export function resolveArchivePath(baseFile: string, relativePath: string): string {
  const baseDirectory = baseFile.includes('/') ? baseFile.slice(0, baseFile.lastIndexOf('/') + 1) : '';
  const segments = `${baseDirectory}${relativePath}`.replace(/\\/g, '/').split('/');
  const result: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!result.length) throw new UnsafeArchivePathError('O EPUB referencia um arquivo fora do pacote.');
      result.pop();
    } else {
      result.push(segment);
    }
  }
  return assertSafeArchivePath(result.join('/'));
}

export function hasUnsupportedEncryption(xml: string): boolean {
  const algorithms = [...xml.matchAll(/Algorithm\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  if (algorithms.length === 0) return /<\s*(?:\w+:)?EncryptedData\b/i.test(xml);
  return algorithms.some(
    (algorithm) => {
      const normalized = algorithm?.toLowerCase() ?? '';
      return Boolean(normalized) &&
        !normalized.includes('idpf.org/2008/embedding') &&
        !normalized.includes('ns.adobe.com/pdf/enc#rc');
    },
  );
}

export function hasExternalResourceReference(content: string): boolean {
  const external = String.raw`(?:(?:https?:)?\/\/|file:|content:)`;
  const resourceAttribute = new RegExp(
    String.raw`\b(?:src|srcset|poster|data|xlink:href)\s*=\s*["']\s*${external}`,
    'i',
  );
  const resourceHref = new RegExp(
    String.raw`<(?:link|image|use)\b[^>]*\bhref\s*=\s*["']\s*${external}`,
    'i',
  );
  const cssResource = new RegExp(
    String.raw`(?:url\(\s*["']?\s*${external}|@import\s+(?:url\()?\s*["']?\s*${external})`,
    'i',
  );
  return resourceAttribute.test(content) || resourceHref.test(content) || cssResource.test(content);
}
