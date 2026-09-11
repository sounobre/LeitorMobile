import type { LibrarySnapshot } from '@/types/domain';

export function assertSafeBackupPath(path: string): void {
  if (
    !path ||
    path.startsWith('/') ||
    /^[a-zA-Z]:/.test(path) ||
    path.replace(/\\/g, '/').split('/').some((part) => part === '..')
  ) {
    throw new Error('O backup contém um caminho de arquivo inseguro.');
  }
}

export function assertSnapshotReferences(snapshot: LibrarySnapshot): void {
  const bookIds = new Set(snapshot.books.map((book) => book.id));
  if (
    snapshot.annotations.some((item) => !bookIds.has(item.bookId)) ||
    snapshot.bookmarks.some((item) => !bookIds.has(item.bookId)) ||
    snapshot.cards.some((item) => !bookIds.has(item.bookId)) ||
    snapshot.preferences.some((item) => !bookIds.has(item.bookId))
  ) {
    throw new Error('O backup contém referências inválidas entre livros e anotações.');
  }
}
