import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const databasePassword = process.env.TEST_DATABASE_PASSWORD?.trim();
const otherOwnerEmailPrefix = 'wave-3h-test-039-other-';

export type OtherOwnerFixture = {
  ownerId: string;
  bookId: string;
  cardId: string;
  email: string;
};

export type OtherOwnerCard = {
  id: string;
  selectedText: string;
};

function requireDatabasePassword() {
  if (!databasePassword) throw new Error('TEST_DATABASE_PASSWORD must be set for the test-only PostgreSQL fixture.');
  return databasePassword;
}

function sqlLiteral(value: string) {
  return "'" + value.replaceAll("'", "''") + "'";
}

async function runSql(sql: string) {
  const args = [
    '--no-psqlrc',
    '--host', '127.0.0.1',
    '--dbname', 'leitor_test',
    '--username', 'leitor_test_user',
    '--tuples-only',
    '--no-align',
    '--set', 'ON_ERROR_STOP=1',
    '--command', sql,
  ];
  const result = await execFileAsync('psql', args, {
    env: { ...process.env, PGPASSWORD: requireDatabasePassword() },
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  return result.stdout.trim();
}

export async function createOtherOwnerFixture(): Promise<OtherOwnerFixture> {
  const ownerId = randomUUID();
  const bookId = randomUUID();
  const cardId = randomUUID();
  const email = `${otherOwnerEmailPrefix}${ownerId}@example.test`;
  const fileHash = `${otherOwnerEmailPrefix}${bookId}`;
  const sql = `
    BEGIN;
    INSERT INTO app_users (id, email, password_hash)
    VALUES (:owner_id::uuid, :email, NULL);
    INSERT INTO books (id, user_id, file_hash, original_name, title, author, language, description, publisher, progress)
    VALUES (:book_id::uuid, :owner_id::uuid, :file_hash, 'wave-3h-test-039-other-owner.epub', 'Wave 3H Other Owner Book', '', 'en', '', '', 0);
    INSERT INTO cards (id, book_id, cfi_range, selected_text, translation, pronunciation, part_of_speech, definition, background, examples_json, related_words_json, chapter_title, queue_order, archived)
    VALUES (:card_id::uuid, :book_id::uuid, 'epubcfi(/6/2)', 'wave-3h-other-owner-card', '', '', '', '', '', '[]'::jsonb, '[]'::jsonb, '', 0, false);
    COMMIT;
  `
    .replaceAll(':owner_id', sqlLiteral(ownerId))
    .replaceAll(':book_id', sqlLiteral(bookId))
    .replaceAll(':card_id', sqlLiteral(cardId))
    .replaceAll(':email', sqlLiteral(email))
    .replaceAll(':file_hash', sqlLiteral(fileHash));
  await runSql(sql);
  return { ownerId, bookId, cardId, email };
}

export async function readOtherOwnerCard(cardId: string): Promise<OtherOwnerCard | null> {
  const sql = `
    SELECT row_to_json(card_row)::text
    FROM (
      SELECT id::text, selected_text AS "selectedText"
      FROM cards
      WHERE id = :card_id::uuid
    ) card_row;
  `.replaceAll(':card_id', sqlLiteral(cardId));
  const output = await runSql(sql);
  return output ? JSON.parse(output) as OtherOwnerCard : null;
}

export async function deleteOtherOwnerFixture(ownerId: string): Promise<void> {
  const sql = `
    BEGIN;
    DELETE FROM app_users WHERE id = :owner_id::uuid;
    COMMIT;
  `.replaceAll(':owner_id', sqlLiteral(ownerId));
  await runSql(sql);
}

export async function cleanupOtherOwnerFixturesByEmailPrefix(): Promise<void> {
  const sql = `
    SELECT id::text
    FROM app_users
    WHERE email LIKE (:email_prefix || '%@example.test');
  `.replaceAll(':email_prefix', sqlLiteral(otherOwnerEmailPrefix));
  const output = await runSql(sql);
  for (const ownerId of output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    await deleteOtherOwnerFixture(ownerId);
  }
}
