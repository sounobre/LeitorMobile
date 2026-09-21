import type { APIRequestContext } from '@playwright/test';
import type { TestAccount } from './auth';

const apiUrl = (process.env.VITE_API_URL ?? 'http://127.0.0.1:8080/api').replace(/\/$/, '');

export type ApiSession = {
  token: string;
  user: { id: string; email: string };
};

export type ApiBook = {
  id: string;
  fileHash: string;
  originalName: string;
  title: string;
  author: string;
  language?: string;
  lastCfi?: string | null;
  progress?: number;
  fileAvailable?: boolean;
  coverAvailable?: boolean;
};

export type CreateBookInput = {
  originalName: string;
  fileHash: string;
  title: string;
  author: string;
  language: string;
};

export type UploadBookContentInput = {
  epub: { name: string; mimeType: string; buffer: Buffer };
  cover?: { name: string; mimeType: string; buffer: Buffer };
};

export type ApiLexiconJob = {
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

export type ApiLexiconEntry = {
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

export function createApiClient(request: APIRequestContext) {
  async function readJson<T>(response: { ok(): boolean; status(): number; text(): Promise<string> }): Promise<T> {
    const body = await response.text();
    if (!response.ok()) throw new Error(`API request failed with status ${response.status()}: ${body}`);
    return JSON.parse(body) as T;
  }

  return {
    async login(account: TestAccount): Promise<ApiSession> {
      return readJson<ApiSession>(await request.post(`${apiUrl}/auth/login`, {
        data: { email: account.email, password: account.password },
      }));
    },

    async listBooks(token: string): Promise<ApiBook[]> {
      return readJson<ApiBook[]>(await request.get(`${apiUrl}/books`, {
        headers: { Authorization: `Bearer ${token}` },
      }));
    },

    async createBook(token: string, input: CreateBookInput): Promise<ApiBook> {
      return readJson<ApiBook>(await request.post(`${apiUrl}/books`, {
        headers: { Authorization: `Bearer ${token}` },
        data: input,
      }));
    },

    async getLexiconJob(token: string, bookId: string): Promise<ApiLexiconJob | null> {
      return readJson<ApiLexiconJob | null>(await request.get(`${apiUrl}/books/${bookId}/lexicon/jobs/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      }));
    },

    async lookupBookLexicon(token: string, bookId: string, term: string): Promise<{ status: number; body: ApiLexiconEntry | null }> {
      const response = await request.get(`${apiUrl}/books/${bookId}/lexicon/lookup?term=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: response.status(), body: await readJson<ApiLexiconEntry | null>(response) };
    },

    async uploadBookContent(token: string, bookId: string, input: UploadBookContentInput): Promise<ApiBook> {
      return readJson<ApiBook>(await request.post(`${apiUrl}/books/${bookId}/content`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: input,
      }));
    },

    async getBookFileStatus(token: string, id: string): Promise<number> {
      const response = await request.get(`${apiUrl}/books/${id}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.status();
    },
    async deleteBook(token: string, id: string): Promise<void> {
      const response = await request.delete(`${apiUrl}/books/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok()) throw new Error(`Book cleanup failed with status ${response.status()}`);
    },

    async deleteBooksWithPrefix(token: string, prefix: string): Promise<void> {
      const books = await this.listBooks(token);
      for (const book of books.filter((item) => (item.fileHash.startsWith(prefix) || item.originalName.startsWith(prefix)))) {
        await this.deleteBook(token, book.id);
      }
      const remaining = (await this.listBooks(token)).filter((item) => (item.fileHash.startsWith(prefix) || item.originalName.startsWith(prefix)));
      if (remaining.length > 0) throw new Error(`Book cleanup left ${remaining.length} fixture book(s)`);
    },
  };
}
