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
  title: string;
  author: string;
};

export type CreateBookInput = {
  originalName: string;
  fileHash: string;
  title: string;
  author: string;
  language: string;
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

    async deleteBook(token: string, id: string): Promise<void> {
      const response = await request.delete(`${apiUrl}/books/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok()) throw new Error(`Book cleanup failed with status ${response.status()}`);
    },

    async deleteBooksWithPrefix(token: string, prefix: string): Promise<void> {
      const books = await this.listBooks(token);
      for (const book of books.filter((item) => item.fileHash.startsWith(prefix))) {
        await this.deleteBook(token, book.id);
      }
    },
  };
}
