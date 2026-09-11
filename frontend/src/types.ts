export type Book = {
  id: string;
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
  fileAvailable: boolean;
  coverAvailable: boolean;
};

export type Card = {
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

export type CreateBookInput = {
  originalName: string;
  fileHash?: string;
  title: string;
  author: string;
  language: string;
};

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

export type UpdateCardInput = Pick<
  Card,
  'selectedText' | 'translation' | 'pronunciation' | 'partOfSpeech' | 'definition' | 'background' | 'examples' | 'relatedWords'
>;
