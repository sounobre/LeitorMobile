import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  applyRemoteReadingPosition,
  clearSyncSession,
  getRemoteId,
  getSyncSession,
  listBooks,
  listCards,
  replaceCard,
  saveRemoteId,
  saveSyncSession,
  insertCard,
  type SyncSession,
} from '@/db/repository';
import type { Book, CardRecord } from '@/types/domain';
import { cacheRemoteLexicon } from '@/services/lexicon';
import type { LexiconEntry, LexiconJob } from '@/types/lexicon';

export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080/api';

type RemoteBook = {
  id: string;
  fileHash: string;
  originalName: string;
  title: string;
  author: string;
  language: string;
  progress: number;
  lastCfi: string | null;
  lastOpenedAt: string | null;
  fileAvailable?: boolean;
  coverAvailable?: boolean;
};

type RemoteCard = {
  id: string;
  bookId: string;
  bookTitle: string;
  cfiRange: string;
  selectedText: string;
  translation: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  background: string;
  examples: string[];
  relatedWords: string[];
  chapterTitle: string;
  queueOrder: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SyncResult = {
  books: number;
  cards: number;
  lexicon: number;
};

export class SyncApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function apiBaseUrl(value = DEFAULT_API_BASE_URL): string {
  return value.replace(/\/$/, '');
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.text();
  if (!body) return fallback + ' (HTTP ' + response.status + ').';
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    // Algumas respostas do servidor não são JSON.
  }
  return body;
}

async function request<T>(session: SyncSession, path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiBaseUrl(session.apiBaseUrl) + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.token,
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new SyncApiError(response.status, await errorMessage(response, 'A API recusou a operação'));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasReadingPosition(book: { lastCfi: string | null; progress: number }): boolean {
  return Boolean(book.lastCfi) || book.progress > 0;
}

function sameReadingPosition(local: Book, remote: RemoteBook): boolean {
  return local.lastCfi === remote.lastCfi
    && Math.abs(local.progress - remote.progress) < 0.0001;
}

function mimeTypeFor(uri: string, fallback: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return fallback;
}

async function uploadBookContent(session: SyncSession, remote: RemoteBook, book: Book): Promise<RemoteBook> {
  const form = new FormData();
  let hasPart = false;

  if (!remote.fileAvailable) {
    const epubFile = new File(book.fileUri);
    if (!epubFile.exists) throw new SyncApiError(400, 'O arquivo EPUB não está disponível no aparelho.');
    form.append('epub', epubFile, book.originalName);
    hasPart = true;
  }

  if (!remote.coverAvailable && book.coverUri) {
    const coverFile = new File(book.coverUri);
    if (!coverFile.exists) throw new SyncApiError(400, 'A capa deste livro não está disponível no aparelho.');
    form.append(
      'cover',
      coverFile,
      book.id + '-cover' + mimeTypeFor(book.coverUri, 'image/jpeg').replace('image/', '.'),
    );
    hasPart = true;
  }

  if (!hasPart) return remote;

  const response = await fetch(apiBaseUrl(session.apiBaseUrl) + '/books/' + remote.id + '/content', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.token },
    body: form,
  });
  if (!response.ok) {
    throw new SyncApiError(response.status, await errorMessage(response, 'Não foi possível enviar o EPUB para o web'));
  }
  return response.json() as Promise<RemoteBook>;
}

async function mergeBookProgress(
  db: SQLiteDatabase,
  session: SyncSession,
  local: Book,
  remote: RemoteBook,
): Promise<RemoteBook> {
  const localTime = timestamp(local.lastOpenedAt);
  const remoteTime = timestamp(remote.lastOpenedAt);
  const localHasPosition = hasReadingPosition(local);
  const remoteHasPosition = hasReadingPosition(remote);

  const remoteWins = remoteTime > localTime
    || (remoteTime === localTime && remoteHasPosition && !localHasPosition);
  if (remoteWins) {
    await applyRemoteReadingPosition(db, local.id, remote.lastCfi, remote.progress, remote.lastOpenedAt);
    return remote;
  }

  const localWins = localTime > remoteTime
    || (localTime === remoteTime && localHasPosition && (!remoteHasPosition || !sameReadingPosition(local, remote)));
  if (localWins && !sameReadingPosition(local, remote)) {
    const saved = await request<RemoteBook>(session, '/books/' + remote.id + '/progress', {
      method: 'PATCH',
      body: JSON.stringify({ lastCfi: local.lastCfi, progress: local.progress }),
    });
    await applyRemoteReadingPosition(db, local.id, saved.lastCfi, saved.progress, saved.lastOpenedAt);
    return saved;
  }

  return remote;
}

function cardIdentity(bookId: string, cfiRange: string, selectedText: string): string {
  return bookId + '|' + cfiRange + '|' + selectedText;
}

function cardContentEquals(local: CardRecord, remote: RemoteCard): boolean {
  return local.selectedText === remote.selectedText
    && local.translation === remote.translation
    && local.pronunciation === remote.pronunciation
    && local.partOfSpeech === remote.partOfSpeech
    && local.definition === remote.definition
    && local.background === remote.background
    && JSON.stringify(local.examples) === JSON.stringify(remote.examples)
    && JSON.stringify(local.relatedWords) === JSON.stringify(remote.relatedWords);
}

function toLocalCard(remote: RemoteCard, bookId: string, localId = Crypto.randomUUID()): CardRecord {
  return {
    id: localId,
    bookId,
    cfiRange: remote.cfiRange,
    selectedText: remote.selectedText,
    translation: remote.translation,
    pronunciation: remote.pronunciation,
    partOfSpeech: remote.partOfSpeech,
    definition: remote.definition,
    background: remote.background,
    examples: remote.examples ?? [],
    relatedWords: remote.relatedWords ?? [],
    chapterTitle: remote.chapterTitle ?? '',
    queueOrder: remote.queueOrder,
    archived: remote.archived,
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
  };
}

function cardPayload(card: CardRecord) {
  return {
    selectedText: card.selectedText,
    translation: card.translation,
    pronunciation: card.pronunciation,
    partOfSpeech: card.partOfSpeech,
    definition: card.definition,
    background: card.background,
    examples: card.examples,
    relatedWords: card.relatedWords,
  };
}

export async function login(
  db: SQLiteDatabase,
  email: string,
  password: string,
  baseUrl = DEFAULT_API_BASE_URL,
): Promise<SyncSession> {
  const response = await fetch(apiBaseUrl(baseUrl) + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new SyncApiError(response.status, await errorMessage(response, 'E-mail ou senha inválidos'));
  }
  const body = await response.json() as { token: string; user: { email: string } };
  const session: SyncSession = {
    token: body.token,
    email: body.user.email,
    apiBaseUrl: apiBaseUrl(baseUrl),
    updatedAt: new Date().toISOString(),
  };
  await saveSyncSession(db, session);
  return session;
}

export function getSession(db: SQLiteDatabase): Promise<SyncSession | null> {
  return getSyncSession(db);
}

export function logout(db: SQLiteDatabase): Promise<void> {
  return clearSyncSession(db);
}

export async function getBookLexiconJob(db: SQLiteDatabase, localBookId: string): Promise<LexiconJob | null> {
  const session = await getSyncSession(db);
  if (!session) return null;
  const remoteBookId = await getRemoteId(db, 'book', localBookId);
  if (!remoteBookId) return null;
  return request<LexiconJob | null>(session, '/books/' + remoteBookId + '/lexicon/jobs/latest');
}

export async function reprocessBookLexicon(db: SQLiteDatabase, localBookId: string): Promise<LexiconJob> {
  const session = await getSyncSession(db);
  if (!session) throw new SyncApiError(401, 'Faca login para reprocessar o lexico.');

  let remoteBookId = await getRemoteId(db, 'book', localBookId);
  if (!remoteBookId) {
    await syncLibrary(db);
    remoteBookId = await getRemoteId(db, 'book', localBookId);
  }
  if (!remoteBookId) throw new SyncApiError(409, 'Sincronize este livro antes de reprocessar o lexico.');

  return request<LexiconJob>(session, '/books/' + remoteBookId + '/lexicon/jobs', { method: 'POST' });
}
export async function syncLibrary(db: SQLiteDatabase): Promise<SyncResult> {
  const session = await getSyncSession(db);
  if (!session) throw new SyncApiError(401, 'Faça login para sincronizar a biblioteca.');

  let remoteBooks = await request<RemoteBook[]>(session, '/books');
  const localBooks = await listBooks(db);
  const localBooksById = new Map(localBooks.map((book) => [book.id, book]));
  const localBookByRemoteId = new Map<string, Book>();
  let syncedBooks = 0;

  for (const localBook of localBooks) {
    let remote = remoteBooks.find((item) => item.fileHash === localBook.fileHash);

    if (!remote) {
      remote = await request<RemoteBook>(session, '/books', {
        method: 'POST',
        body: JSON.stringify({
          originalName: localBook.originalName,
          fileHash: localBook.fileHash,
          title: localBook.title,
          author: localBook.author,
          language: localBook.language,
          description: localBook.description,
          publisher: localBook.publisher,
        }),
      });
      remoteBooks = [...remoteBooks, remote];
    }

    await saveRemoteId(db, 'book', localBook.id, remote.id);
    localBookByRemoteId.set(remote.id, localBook);

    remote = await mergeBookProgress(db, session, localBook, remote);
    const contentNeedsUpload = !remote.fileAvailable || (!remote.coverAvailable && Boolean(localBook.coverUri));
    if (contentNeedsUpload) {
      remote = await uploadBookContent(session, remote, localBook);
      await request(session, '/books/' + remote.id + '/lexicon/jobs', { method: 'POST' }).catch(() => undefined);
    }
    remoteBooks = remoteBooks.map((item) => item.id === remote?.id ? remote : item);
    syncedBooks += 1;
  }

  for (const remoteBook of remoteBooks) {
    const localBook = localBooks.find((book) => book.fileHash === remoteBook.fileHash);
    if (localBook) {
      localBookByRemoteId.set(remoteBook.id, localBook);
      await saveRemoteId(db, 'book', localBook.id, remoteBook.id);
    }
  }

  let syncedLexicon = 0;
  for (const [remoteBookId, localBook] of localBookByRemoteId) {
    try {
      const entries = await request<LexiconEntry[]>(session, '/books/' + remoteBookId + '/lexicon?limit=5000');
      await cacheRemoteLexicon(db, localBook.id, entries);
      syncedLexicon += entries.length;
    } catch {
      // A preparacao pode ainda estar em andamento; a proxima sincronizacao tentara novamente.
    }
  }
  const remoteCards = await request<RemoteCard[]>(session, '/cards?includeArchived=true');
  const localCards = await listCards(db, true);
  const localCardsByRemoteId = new Map<string, CardRecord>();
  const localCardsByIdentity = new Map<string, CardRecord>();
  const syncedRemoteCardIds = new Set<string>();

  for (const localCard of localCards) {
    const remoteId = await getRemoteId(db, 'card', localCard.id);
    if (remoteId) localCardsByRemoteId.set(remoteId, localCard);
    localCardsByIdentity.set(cardIdentity(localCard.bookId, localCard.cfiRange, localCard.selectedText), localCard);
  }

  for (const remoteCard of remoteCards) {
    const localBook = localBookByRemoteId.get(remoteCard.bookId);
    if (!localBook) continue;

    let localCard = localCardsByRemoteId.get(remoteCard.id)
      ?? localCardsByIdentity.get(cardIdentity(localBook.id, remoteCard.cfiRange, remoteCard.selectedText));

    if (!localCard) {
      localCard = toLocalCard(remoteCard, localBook.id);
      await insertCard(db, localCard);
      await saveRemoteId(db, 'card', localCard.id, remoteCard.id);
      localCardsByRemoteId.set(remoteCard.id, localCard);
      localCardsByIdentity.set(cardIdentity(localCard.bookId, localCard.cfiRange, localCard.selectedText), localCard);
      syncedRemoteCardIds.add(remoteCard.id);
      continue;
    }

    await saveRemoteId(db, 'card', localCard.id, remoteCard.id);
    const localTime = timestamp(localCard.updatedAt);
    const remoteTime = timestamp(remoteCard.updatedAt);
    const remoteWins = remoteTime > localTime;
    const localWins = localTime > remoteTime || (localTime === remoteTime && !cardContentEquals(localCard, remoteCard));

    if (remoteWins) {
      const merged = toLocalCard(remoteCard, localCard.bookId, localCard.id);
      await replaceCard(db, merged);
      localCardsByRemoteId.set(remoteCard.id, merged);
    } else if (localWins) {
      const saved = await pushLocalCardWithBook(session, localCard, remoteCard);
      const merged = toLocalCard(saved, localCard.bookId, localCard.id);
      await replaceCard(db, merged);
      localCardsByRemoteId.set(saved.id, merged);
    }
    syncedRemoteCardIds.add(remoteCard.id);
  }

  for (const localCard of localCards) {
    let remoteId = await getRemoteId(db, 'card', localCard.id);
    let remoteCard = remoteId ? remoteCards.find((item) => item.id === remoteId) ?? null : null;
    const remoteBookId = await getRemoteId(db, 'book', localCard.bookId);
    if (!remoteBookId) continue;

    if (!remoteId || !remoteCard) {
      const saved = await request<RemoteCard>(session, '/cards', {
        method: 'POST',
        body: JSON.stringify({
          ...cardPayload(localCard),
          bookId: remoteBookId,
          cfiRange: localCard.cfiRange,
          chapterTitle: localCard.chapterTitle,
        }),
      });
      await saveRemoteId(db, 'card', localCard.id, saved.id);
      const merged = toLocalCard(saved, localCard.bookId, localCard.id);
      await replaceCard(db, merged);
      syncedRemoteCardIds.add(saved.id);
      continue;
    }

    // O card já foi reconciliado no loop remoto.
    remoteId = remoteCard.id;
  }

  return { books: syncedBooks, cards: syncedRemoteCardIds.size, lexicon: syncedLexicon };
}

async function pushLocalCardWithBook(
  session: SyncSession,
  local: CardRecord,
  remote: RemoteCard,
): Promise<RemoteCard> {
  let saved = await request<RemoteCard>(session, '/cards/' + remote.id, {
    method: 'PATCH',
    body: JSON.stringify(cardPayload(local)),
  });

  if (local.archived !== saved.archived) {
    saved = await request<RemoteCard>(
      session,
      '/cards/' + saved.id + (local.archived ? '/archive' : '/unarchive'),
      { method: 'POST' },
    );
  }

  if (!local.archived && local.queueOrder !== saved.queueOrder) {
    saved = await request<RemoteCard>(
      session,
      '/cards/' + saved.id + '/move-to-end',
      { method: 'POST' },
    );
  }

  return saved;
}


