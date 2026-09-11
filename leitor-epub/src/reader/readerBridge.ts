import { z } from 'zod';
import type { ReaderBridgeEvent } from '@/types/reader';

const searchResultSchema = z.object({
  cfi: z.string().min(1),
  excerpt: z.string(),
  chapterTitle: z.string(),
});

const readerBridgeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ReaderReady'), totalLocations: z.number().int().nonnegative() }),
  z.object({
    type: z.literal('Relocated'),
    cfi: z.string().min(1),
    progress: z.number().min(0).max(1),
    chapterTitle: z.string().optional(),
  }),
  z.object({
    type: z.literal('SelectionChanged'),
    cfiRange: z.string().min(1),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal('SearchResults'),
    query: z.string(),
    results: z.array(searchResultSchema),
  }),
  z.object({ type: z.literal('ExternalLinkRequested'), url: z.string().url() }),
  z.object({
    type: z.literal('ReaderError'),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
]);

export function parseReaderBridgeEvent(value: unknown): ReaderBridgeEvent {
  const input = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  return readerBridgeEventSchema.parse(input) as ReaderBridgeEvent;
}
