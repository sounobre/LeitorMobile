import type { AnnotationRecord } from '@/types/domain';
import {
  findBookByHash,
  insertAnnotation,
  updateAnnotation,
  updateReadingPosition,
} from './repository';

describe('repositórios SQLite', () => {
  afterEach(() => jest.useRealTimers());

  it('deduplica por hash usando consulta parametrizada', async () => {
    const db = { getFirstAsync: jest.fn().mockResolvedValue(null) };
    await expect(findBookByHash(db as never, "hash' suspeito")).resolves.toBeNull();
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      'SELECT * FROM books WHERE file_hash = ?',
      "hash' suspeito",
    );
  });

  it('limita o progresso antes de persistir o CFI', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-05T12:00:00.000Z'));
    const db = { runAsync: jest.fn().mockResolvedValue(undefined) };
    await updateReadingPosition(db as never, 'livro-1', 'epubcfi(/6/2)', 4.2);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE books SET last_cfi'),
      'epubcfi(/6/2)',
      1,
      '2026-09-05T12:00:00.000Z',
      'livro-1',
    );
  });

  it('cria e atualiza anotações somente com parâmetros', async () => {
    const db = { runAsync: jest.fn().mockResolvedValue(undefined) };
    const annotation: AnnotationRecord = {
      id: 'a1',
      bookId: 'b1',
      cfiRange: "epubcfi(/6/2['])",
      selectedText: "texto ' selecionado",
      color: '#FFE082',
      note: 'nota',
      sectionIndex: 3,
      createdAt: '2026-09-05T12:00:00.000Z',
      updatedAt: '2026-09-05T12:00:00.000Z',
    };
    await insertAnnotation(db as never, annotation);
    await updateAnnotation(db as never, { ...annotation, note: 'editada' });

    expect(db.runAsync.mock.calls[0]).toContain(annotation.cfiRange);
    expect(db.runAsync.mock.calls[0]).toContain(annotation.selectedText);
    expect(db.runAsync.mock.calls[1]).toContain('editada');
  });
});
