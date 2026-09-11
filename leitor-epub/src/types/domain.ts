import type { LexiconEntry } from './lexicon';
export type { LexiconEntry } from './lexicon';

export type ReaderFlow = 'paginated' | 'scrolled-doc';
export type ReaderThemeName = 'light' | 'sepia' | 'dark';

export interface Book {
  id: string;
  fileUri: string;
  fileHash: string;
  originalName: string;
  title: string;
  author: string;
  language: string;
  coverUri: string | null;
  description: string;
  publisher: string;
  importedAt: string;
  lastOpenedAt: string | null;
  lastCfi: string | null;
  progress: number;
  locationsJson: string | null;
}

export interface AnnotationRecord {
  id: string;
  bookId: string;
  cfiRange: string;
  selectedText: string;
  color: string;
  note: string | null;
  sectionIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkRecord {
  id: string;
  bookId: string;
  cfi: string;
  chapterTitle: string;
  excerpt: string;
  createdAt: string;
}

export interface CardRecord {
  id: string;
  bookId: string;
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
}

export type CardDraft = Pick<
  CardRecord,
  'selectedText' | 'translation' | 'pronunciation' | 'partOfSpeech' | 'definition' | 'background' | 'examples' | 'relatedWords'
>;

export interface ReaderPreferences {
  bookId: string;
  flow: ReaderFlow;
  theme: ReaderThemeName;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  margin: number;
  textAlign: 'left' | 'justify';
}

export interface LookupCacheRecord {
  language: string;
  term: string;
  definition: string;
  expiresAt: string;
}

export interface LibrarySnapshot {
  books: Book[];
  annotations: AnnotationRecord[];
  bookmarks: BookmarkRecord[];
  cards: CardRecord[];
  preferences: ReaderPreferences[];
  lookupCache: LookupCacheRecord[];
  lexicon?: LexiconEntry[];
}

export interface SelectionPayload {
  text: string;
  cfiRange: string;
}

export const DEFAULT_READER_PREFERENCES: Omit<ReaderPreferences, 'bookId'> = {
  flow: 'paginated',
  theme: 'light',
  fontFamily: 'serif',
  fontSize: 100,
  lineHeight: 1.55,
  margin: 20,
  textAlign: 'justify',
};

export const HIGHLIGHT_COLORS = [
  '#FFE082',
  '#A5D6A7',
  '#90CAF9',
  '#CE93D8',
  '#FFAB91',
] as const;
