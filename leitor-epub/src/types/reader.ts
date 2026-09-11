import type {
  AnnotationRecord,
  ReaderFlow,
  ReaderPreferences,
  SelectionPayload,
} from './domain';

export type ReaderBridgeEvent =
  | { type: 'ReaderReady'; totalLocations: number }
  | { type: 'Relocated'; cfi: string; progress: number; chapterTitle?: string }
  | ({ type: 'SelectionChanged' } & SelectionPayload)
  | { type: 'SearchResults'; query: string; results: ReaderSearchResult[] }
  | { type: 'ExternalLinkRequested'; url: string }
  | { type: 'ReaderError'; code: string; message: string };

export interface ReaderSearchResult {
  cfi: string;
  excerpt: string;
  chapterTitle: string;
}

export interface ReaderEngine {
  open(sourceUri: string, initialCfi?: string): Promise<void>;
  close(): Promise<void>;
  goTo(cfiOrHref: string): void;
  next(): void;
  previous(): void;
  search(query: string): void;
  setFlow(flow: ReaderFlow): void;
  applyPreferences(preferences: ReaderPreferences): void;
  addAnnotation(annotation: AnnotationRecord): void;
  updateAnnotation(annotation: AnnotationRecord): void;
  removeAnnotation(cfiRange: string): void;
  clearSelection(): void;
}
