import type { Book, Card, CreateBookInput, CreateCardInput, UpdateCardInput } from './types';

export type User = {
  id: string;
  email: string;
};

type LoginResponse = {
  token: string;
  user: User;
};

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api').replace(/\/$/, '');
const TOKEN_KEY = 'leitor.auth.token';
const USER_KEY = 'leitor.auth.user';
let authToken = typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);

export function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(USER_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as User;
  } catch {
    return null;
  }
}

function clearSession() {
  authToken = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  }
}

function authorizationHeaders(): HeadersInit {
  return authToken ? { Authorization: 'Bearer ' + authToken } : {};
}

export function logout() {
  clearSession();
}

async function requestResponse(path: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', 'Bearer ' + authToken);

  const response = await fetch(API_URL + path, { ...options, headers });
  if (response.status === 401) clearSession();
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || ('Falha na comunicação com o servidor (' + response.status + ').'));
  }
  return response;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await requestResponse(path, options);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function requestNullable<T>(path: string, options?: RequestInit): Promise<T | null> {
  const response = await requestResponse(path, options);
  const body = await response.text();
  if (!body.trim()) return null;
  return JSON.parse(body) as T;
}

async function requestBinary(path: string): Promise<ArrayBuffer> {
  const response = await fetch(API_URL + path, { headers: authorizationHeaders() });
  if (response.status === 401) clearSession();
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || ('Falha ao carregar o conteúdo (' + response.status + ').'));
  }
  return response.arrayBuffer();
}

export async function fetchBookFile(id: string): Promise<ArrayBuffer> {
  return requestBinary('/books/' + id + '/file');
}

export async function fetchBookCover(id: string): Promise<Blob> {
  const response = await fetch(API_URL + '/books/' + id + '/cover', { headers: authorizationHeaders() });
  if (response.status === 401) clearSession();
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || ('Falha ao carregar a capa (' + response.status + ').'));
  }
  return response.blob();
}

export function updateBookProgress(id: string, lastCfi: string | null, progress: number): Promise<Book> {
  return request<Book>('/books/' + id + '/progress', {
    method: 'PATCH',
    body: JSON.stringify({ lastCfi, progress }),
  });
}

export async function login(email: string, password: string): Promise<User> {
  const result = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  authToken = result.token;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_KEY, result.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  }
  return result.user;
}

export function getMe(): Promise<User> {
  return request<User>('/auth/me');
}

export function listBooks(search = ''): Promise<Book[]> {
  return request<Book[]>('/books' + (search ? '?search=' + encodeURIComponent(search) : ''));
}

export function createBook(input: CreateBookInput): Promise<Book> {
  return request<Book>('/books', { method: 'POST', body: JSON.stringify(input) });
}

export async function uploadBookContent(id: string, epub: File): Promise<Book> {
  const formData = new FormData();
  formData.append('epub', epub, epub.name);
  const response = await fetch(API_URL + '/books/' + id + '/content', {
    method: 'POST',
    headers: authorizationHeaders(),
    body: formData,
  });
  if (response.status === 401) clearSession();
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || ('Falha ao enviar o livro (' + response.status + ').'));
  }
  return response.json() as Promise<Book>;
}

export function deleteBook(id: string): Promise<void> {
  return request('/books/' + id, { method: 'DELETE' });
}

export function listCards(includeArchived = false): Promise<Card[]> {
  return request<Card[]>('/cards?includeArchived=' + includeArchived);
}

export function createCard(input: CreateCardInput): Promise<Card> {
  return request<Card>('/cards', { method: 'POST', body: JSON.stringify(input) });
}

export function updateCard(id: string, input: UpdateCardInput): Promise<Card> {
  return request<Card>('/cards/' + id, { method: 'PATCH', body: JSON.stringify(input) });
}

export function archiveCard(id: string): Promise<Card> {
  return request<Card>('/cards/' + id + '/archive', { method: 'POST' });
}

export function moveCardToEnd(id: string): Promise<Card> {
  return request<Card>('/cards/' + id + '/move-to-end', { method: 'POST' });
}

export type LexiconEntry = {
  lemma: string;
  partOfSpeech: string | null;
  wordForms: string[];
  definition: string;
  translationPtBr: string;
  ipa: string;
  cefr: string;
  bookFrequency: number;
  firstSentenceId: string | null;
  resolutionStatus: string;
  pedagogicalRelevance: string | null;
  senses: Array<{ id: string; senseKey: string; definition: string; translationPtBr: string }>;
};

export type LexiconJob = {
  id: string;
  bookId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  processedUnits: number;
  totalUnits: number;
  processedTokens: number;
  totalLexemes: number;
  phase: string;
  message: string | null;
  errorMessage: string | null;
};

export function startBookLexicon(bookId: string, force = false): Promise<LexiconJob> {
  return request<LexiconJob>('/books/' + bookId + '/lexicon/jobs' + (force ? '?force=true' : ''), { method: 'POST' });
}

export function getBookLexiconJob(bookId: string): Promise<LexiconJob | null> {
  return requestNullable<LexiconJob>('/books/' + bookId + '/lexicon/jobs/latest');
}

export function lookupBookLexicon(bookId: string, term: string): Promise<LexiconEntry | null> {
  return requestNullable<LexiconEntry>('/books/' + bookId + '/lexicon/lookup?term=' + encodeURIComponent(term));
}
