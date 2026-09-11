import {
  assertSafeArchivePath,
  hasExternalResourceReference,
  hasUnsupportedEncryption,
  resolveArchivePath,
} from './epubSecurity';

describe('segurança do EPUB', () => {
  test.each(['../secret', '/etc/passwd', 'C:\\secret', 'OPS/../../secret'])(
    'rejeita caminho inseguro %s',
    (path) => expect(() => assertSafeArchivePath(path)).toThrow(),
  );

  test('normaliza caminhos internos relativos ao OPF', () => {
    expect(resolveArchivePath('OPS/package.opf', '../images/cover.jpg')).toBe('images/cover.jpg');
    expect(resolveArchivePath('package.opf', 'images/cover.jpg')).toBe('images/cover.jpg');
  });

  test('permite somente ofuscação conhecida de fontes', () => {
    expect(hasUnsupportedEncryption('<EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/>')).toBe(false);
    expect(hasUnsupportedEncryption('<EncryptionMethod Algorithm="http://example.com/drm"/>')).toBe(true);
    expect(hasUnsupportedEncryption('<EncryptedData />')).toBe(true);
  });

  test.each([
    '<img src="https://tracker.example/pixel.png">',
    '<image href="//cdn.example/capa.svg" />',
    '<img src="file:///data/data/app/databases/leitor-epub.db" />',
    'body { background: url(https://cdn.example/papel.png) }',
    '@import "//cdn.example/theme.css";',
  ])('detecta recursos remotos no conteúdo: %s', (content) => {
    expect(hasExternalResourceReference(content)).toBe(true);
  });

  test('não confunde links externos comuns com carregamento automático', () => {
    expect(hasExternalResourceReference('<a href="https://example.org">Referência</a>')).toBe(false);
  });
});
