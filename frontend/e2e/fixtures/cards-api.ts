import type { APIRequestContext } from '@playwright/test';
import type { ApiCard } from './api';

const apiUrl = (process.env.VITE_API_URL ?? 'http://127.0.0.1:8080/api').replace(/\/$/, '');

export type CreateCardInput = {
  bookId: string;
  cfiRange: string;
  selectedText: string;
  chapterTitle?: string;
  translation?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  definition?: string;
  background?: string;
  examples?: string[];
  relatedWords?: string[];
};

export type UpdateCardInput = {
  selectedText: string;
  translation?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  definition?: string;
  background?: string;
  examples?: string[];
  relatedWords?: string[];
};

export type RawCardMutation = {
  status: number;
  body: string;
};

async function readJson<T>(response: { ok(): boolean; status(): number; text(): Promise<string> }): Promise<T> {
  const body = await response.text();
  if (!response.ok()) throw new Error(`API request failed with status ${response.status()}: ${body}`);
  if (!body.trim()) return null as T;
  return JSON.parse(body) as T;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function createCardsApi(request: APIRequestContext) {
  return {
    async listCards(token: string, includeArchived = false): Promise<ApiCard[]> {
      return readJson<ApiCard[]>(await request.get(`${apiUrl}/cards?includeArchived=${includeArchived}`, { headers: auth(token) }));
    },
    async listCardsRaw(token: string, includeArchived = false): Promise<{ status: number; body: ApiCard[] | null }> {
      const response = await request.get(`${apiUrl}/cards?includeArchived=${includeArchived}`, { headers: auth(token) });
      const body = await response.text();
      return { status: response.status(), body: body.trim() ? JSON.parse(body) as ApiCard[] : null };
    },
    async createCard(token: string, input: CreateCardInput): Promise<ApiCard> {
      return readJson<ApiCard>(await request.post(`${apiUrl}/cards`, { headers: auth(token), data: input }));
    },
    async patchCardRaw(token: string, id: string, input: UpdateCardInput): Promise<RawCardMutation> {
      const response = await request.patch(`${apiUrl}/cards/${id}`, { headers: auth(token), data: input });
      return { status: response.status(), body: await response.text() };
    },
    async archiveCard(token: string, id: string): Promise<ApiCard> {
      return readJson<ApiCard>(await request.post(`${apiUrl}/cards/${id}/archive`, { headers: auth(token) }));
    },
    async moveCardToEnd(token: string, id: string): Promise<ApiCard> {
      return readJson<ApiCard>(await request.post(`${apiUrl}/cards/${id}/move-to-end`, { headers: auth(token) }));
    },
  };
}
