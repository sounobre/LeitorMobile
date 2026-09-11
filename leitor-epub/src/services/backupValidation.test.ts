import type { LibrarySnapshot } from '@/types/domain';
import { assertSafeBackupPath, assertSnapshotReferences } from './backupValidation';

const emptySnapshot = (): LibrarySnapshot => ({
  books: [],
  annotations: [],
  bookmarks: [],
  cards: [],
  preferences: [],
  lookupCache: [],
});

describe('validação de backup', () => {
  it.each(['../livro.epub', '/livro.epub', 'C:\\livro.epub', 'books/../../livro.epub', ''])(
    'rejeita o caminho %s',
    (path) => expect(() => assertSafeBackupPath(path)).toThrow(),
  );

  it('rejeita entidades que apontam para livros ausentes', () => {
    const snapshot = emptySnapshot();
    snapshot.annotations.push({
      id: 'a1', bookId: 'ausente', cfiRange: 'cfi', selectedText: 'texto', color: '#fff',
      note: null, sectionIndex: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    });
    expect(() => assertSnapshotReferences(snapshot)).toThrow(/referências inválidas/);
  });

  it('aceita um snapshot vazio consistente', () => {
    expect(() => assertSnapshotReferences(emptySnapshot())).not.toThrow();
  });
});
