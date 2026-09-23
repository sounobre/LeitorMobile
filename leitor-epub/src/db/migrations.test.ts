import { migrateDatabase } from './migrations';

describe('migrações SQLite', () => {
  it('ativa WAL e chaves estrangeiras e cria o esquema atualizado atomicamente', async () => {
    const transaction = { execAsync: jest.fn().mockResolvedValue(undefined) };
    const db = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 0 }),
      withExclusiveTransactionAsync: jest.fn(async (callback: (value: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };

    await migrateDatabase(db as never);

    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    expect(transaction.execAsync.mock.calls[0]?.[0]).toContain('CREATE TABLE books');
    expect(transaction.execAsync.mock.calls[0]?.[0]).toContain('ON DELETE CASCADE');
    expect(transaction.execAsync).toHaveBeenLastCalledWith('PRAGMA user_version = 6;');
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(6);
  });

  it('não recria um esquema atual e recusa versões futuras', async () => {
    const current = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 6 }),
      withExclusiveTransactionAsync: jest.fn(),
    };
    await migrateDatabase(current as never);
    expect(current.withExclusiveTransactionAsync).not.toHaveBeenCalled();

    const future = {
      ...current,
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 7 }),
    };
    await expect(migrateDatabase(future as never)).rejects.toThrow(/versão mais recente/);
  });
});

describe('retomada de migrações SQLite', () => {
  it('executa somente a migration seguinte a partir de uma versão parcial', async () => {
    const transaction = { execAsync: jest.fn().mockResolvedValue(undefined) };
    const db = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 5 }),
      withExclusiveTransactionAsync: jest.fn(async (callback: (value: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };

    await migrateDatabase(db as never);

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(transaction.execAsync).toHaveBeenNthCalledWith(1, expect.stringContaining('CREATE TABLE lexicon_entries'));
    expect(transaction.execAsync).toHaveBeenNthCalledWith(2, 'PRAGMA user_version = 6;');
  });

  it('mantém schema e user_version na mesma transação exclusiva em todas as versões', async () => {
    const transaction = { execAsync: jest.fn().mockResolvedValue(undefined) };
    const db = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 0 }),
      withExclusiveTransactionAsync: jest.fn(async (callback: (value: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };

    await migrateDatabase(db as never);

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(6);
    expect(transaction.execAsync.mock.calls.filter(([sql]) => String(sql).includes('PRAGMA user_version')))
      .toEqual([
        ['PRAGMA user_version = 1;'],
        ['PRAGMA user_version = 2;'],
        ['PRAGMA user_version = 3;'],
        ['PRAGMA user_version = 4;'],
        ['PRAGMA user_version = 5;'],
        ['PRAGMA user_version = 6;'],
      ]);
  });
});



