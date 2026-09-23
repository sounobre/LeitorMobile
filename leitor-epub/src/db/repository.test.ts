import type { AnnotationRecord } from '@/types/domain';
import {
  deleteAnnotation,
  listAnnotations,
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

describe('contrato de leitura e remoção de annotations', () => {
  const annotation: AnnotationRecord = { id: 'a1', bookId: 'book-1', cfiRange: 'cfi-1', selectedText: "texto com ' apóstrofo", color: '#FFE082', note: 'nota', sectionIndex: 2, createdAt: '2026-09-05T12:00:00.000Z', updatedAt: '2026-09-05T12:00:00.000Z' };

  it('lista e mapeia annotations por book_id e retorna lista vazia sem correspondências', async () => {
    const row = { id: 'a1', book_id: 'book-1', cfi_range: 'cfi-1', selected_text: "texto com ' apóstrofo", color: '#FFE082', note: 'nota', section_index: 2, created_at: '2026-09-05T12:00:00.000Z', updated_at: '2026-09-05T12:00:00.000Z' };
    const db = { getAllAsync: jest.fn().mockResolvedValue([row]) };

    await expect(listAnnotations(db as never, 'book-1')).resolves.toEqual([{
      id: 'a1',
      bookId: 'book-1',
      cfiRange: 'cfi-1',
      selectedText: "texto com ' apóstrofo",
      color: '#FFE082',
      note: 'nota',
      sectionIndex: 2,
      createdAt: '2026-09-05T12:00:00.000Z',
      updatedAt: '2026-09-05T12:00:00.000Z',
    }]);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM annotations WHERE book_id = ? ORDER BY created_at DESC',
      'book-1',
    );

    db.getAllAsync.mockResolvedValue([]);
    await expect(listAnnotations(db as never, 'book-1')).resolves.toEqual([]);
  });

  it('atualiza annotation por id com parâmetros e não insere outra linha', async () => {
    const db = { runAsync: jest.fn().mockResolvedValue({ changes: 1 }) };
    await updateAnnotation(db as never, annotation);

    expect(db.runAsync).toHaveBeenCalledWith(
      'UPDATE annotations SET color = ?, note = ?, section_index = ?, updated_at = ? WHERE id = ?',
      annotation.color,
      annotation.note,
      annotation.sectionIndex,
      annotation.updatedAt,
      annotation.id,
    );
    expect(String(db.runAsync.mock.calls[0][0])).not.toContain('INSERT');
  });

  it('remove annotation por id com statement parametrizado', async () => {
    const db = { runAsync: jest.fn().mockResolvedValue({ changes: 1 }) };
    await deleteAnnotation(db as never, annotation.id);

    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM annotations WHERE id = ?', annotation.id);
  });

  it('aceita update e delete de id inexistente sem criar dados espúrios', async () => {
    const db = { runAsync: jest.fn().mockResolvedValue({ changes: 0 }) };

    await expect(updateAnnotation(db as never, annotation)).resolves.toBeUndefined();
    await expect(deleteAnnotation(db as never, 'missing-id')).resolves.toBeUndefined();

    expect(db.runAsync).toHaveBeenCalledTimes(2);
    expect(db.runAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
  });
});
