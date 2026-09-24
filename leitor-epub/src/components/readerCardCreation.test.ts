import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useReader } from '@epubjs-react-native/core';
import * as Crypto from 'expo-crypto';
import { appendCard, getBook, getReaderPreferences, listAnnotations, listBookmarks } from '@/db/repository';
import { lookupPreparedLexicon } from '@/services/lexicon';
import { DEFAULT_READER_PREFERENCES, type Book, type CardRecord, type SelectionPayload } from '@/types/domain';
import type { LexiconEntry } from '@/types/lexicon';
import ReaderRoute from '../../app/reader/[id]';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));
jest.mock('@epubjs-react-native/core', () => ({ useReader: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@react-native-community/slider', () => () => null);
jest.mock('@/native/googleTranslate', () => ({ openGoogleTranslate: jest.fn() }));
jest.mock('@/native/mlkit', () => ({ normalizeLanguage: (value: string) => value, translateLocally: jest.fn() }));
jest.mock('@/native/immersiveMode', () => ({ setNavigationBarHidden: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/components/reader/MoreActionsDialog', () => ({ MoreActionsDialog: () => null }));
jest.mock('@/components/reader/LookupDialog', () => ({ LookupDialog: () => null }));
jest.mock('@/components/reader/NavigationDialog', () => ({ NavigationDialog: () => null }));
jest.mock('@/components/reader/QuoteDialog', () => ({ QuoteDialog: () => null }));
jest.mock('@/components/reader/ReaderSettingsDialog', () => ({ ReaderSettingsDialog: () => null }));
jest.mock('react-native-paper', () => {
  const ReactModule = require('react');
  const host = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) =>
    ReactModule.createElement(name, props, children);
  return {
    ActivityIndicator: host('MockActivityIndicator'),
    Appbar: {
      Header: host('MockAppbarHeader'),
      BackAction: host('MockBackAction'),
      Content: host('MockAppbarContent'),
      Action: host('MockAppbarAction'),
    },
    IconButton: host('MockIconButton'),
    Snackbar: host('MockSnackbar'),
    Surface: host('MockSurface'),
    Text: host('MockText'),
    useTheme: () => ({ colors: { primary: '#516A4B' } }),
    MD3DarkTheme: { colors: {} },
    MD3LightTheme: { colors: {} },
  };
});
jest.mock('@/reader/EpubReaderSurface', () => {
  const ReactModule = require('react');
  return {
    EpubReaderSurface: ReactModule.forwardRef((props: object, ref: React.Ref<unknown>) => {
      ReactModule.useImperativeHandle(ref, () => ({ clearSelection: jest.fn() }));
      return ReactModule.createElement('MockEpubReaderSurface', props);
    }),
  };
});
jest.mock('@/db/repository', () => ({
  getBook: jest.fn(),
  getReaderPreferences: jest.fn(),
  listAnnotations: jest.fn(),
  listBookmarks: jest.fn(),
  appendCard: jest.fn(),
}));
jest.mock('@/services/lexicon', () => ({
  ...jest.requireActual('@/services/lexicon'),
  lookupPreparedLexicon: jest.fn(),
}));

const db = {} as SQLiteDatabase;
const now = '2026-09-24T12:00:00.000Z';
const selection: SelectionPayload = { text: 'dragon', cfiRange: 'epubcfi(/6/2!/4/2/2:0)' };
const book: Book = {
  id: 'book-035',
  title: 'Wave 4D Card Book',
  fileUri: 'mock://book.epub',
  fileHash: 'synthetic-hash',
  originalName: 'book.epub',
  author: 'Fixture Author',
  language: 'en',
  coverUri: null,
  description: '',
  publisher: '',
  importedAt: now,
  lastOpenedAt: null,
  lastCfi: null,
  progress: 0,
  locationsJson: null,
};
const lexiconEntry: LexiconEntry = {
  id: 'lexicon-035',
  bookId: book.id,
  lemma: 'dragon',
  translationPtBr: 'dragão',
  ipa: 'ˈdræɡən',
  partOfSpeech: 'noun',
  definition: 'a mythical creature',
  wordForms: [],
  cefr: '',
  bookFrequency: 1,
  firstSentenceId: null,
  resolutionStatus: 'RESOLVED',
  pedagogicalRelevance: '',
  senses: [],
  updatedAt: now,
};

const appendCardMock = jest.mocked(appendCard);
const lookupMock = jest.mocked(lookupPreparedLexicon);
let renderer: ReactTestRenderer | null = null;

async function renderReader(): Promise<ReactTestRenderer> {
  await act(async () => {
    renderer = create(React.createElement(ReaderRoute));
    await Promise.resolve();
  });
  return renderer!;
}

async function chooseCard(payload: SelectionPayload): Promise<void> {
  const surface = renderer!.root.find((node) => String(node.type) === 'MockEpubReaderSurface');
  await act(async () => {
    surface.props.onSelectionAction('card', payload);
    await Promise.resolve();
  });
}

function snackbar() {
  return renderer!.root.find((node) => String(node.type) === 'MockSnackbar');
}

function insertedCard(): CardRecord {
  expect(appendCardMock).toHaveBeenCalledTimes(1);
  expect(appendCardMock).toHaveBeenCalledWith(db, expect.any(Object));
  return appendCardMock.mock.calls[0]![1];
}

describe('TEST-035 — contrato de criação de card mobile', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(now));
    jest.clearAllMocks();
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id });
    jest.mocked(useRouter).mockReturnValue({ back: jest.fn() } as never);
    jest.mocked(useSQLiteContext).mockReturnValue(db);
    jest.mocked(useReader).mockReturnValue({
      getCurrentLocation: () => null,
      locations: [],
      progress: 0,
      searchResults: { results: [] },
      section: { label: 'Chapter One' },
      toc: [],
    } as never);
    jest.mocked(Crypto.randomUUID).mockReturnValue('card-035');
    jest.mocked(getBook).mockResolvedValue(book);
    jest.mocked(getReaderPreferences).mockResolvedValue({ bookId: book.id, ...DEFAULT_READER_PREFERENCES });
    jest.mocked(listAnnotations).mockResolvedValue([]);
    jest.mocked(listBookmarks).mockResolvedValue([]);
    lookupMock.mockResolvedValue(lexiconEntry);
    appendCardMock.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (renderer) {
      await act(async () => renderer!.unmount());
      renderer = null;
    }
    jest.useRealTimers();
  });

  it('Wave 5F — não renderiza texto direto no View raiz de ReaderExperience', async () => {
    const root = (await renderReader()).toJSON();
    if (!root || Array.isArray(root)) {
      throw new Error('ReaderExperience deve renderizar um único View raiz.');
    }

    expect(root.type).toBe('View');
    const children = root.children ?? [];
    expect(children).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'MockEpubReaderSurface' }),
    ]));
    // Whitespace-only strings are also invalid children of a native View.
    expect(children.filter((child) => typeof child === 'string' && child.length > 0)).toEqual([]);
  });

  it('cria card válido com campos lexicais e confirma sucesso', async () => {
    await renderReader();
    await chooseCard(selection);

    expect(lookupMock).toHaveBeenCalledWith(db, book.id, 'dragon');
    expect(insertedCard()).toMatchObject({
      id: 'card-035',
      bookId: book.id,
      cfiRange: selection.cfiRange,
      selectedText: 'dragon',
      translation: 'dragão',
      pronunciation: 'ˈdræɡən',
      partOfSpeech: 'noun',
      definition: 'a mythical creature',
      background: '',
      examples: [],
      relatedWords: [],
      chapterTitle: 'Chapter One',
      createdAt: now,
      updatedAt: now,
    });
    expect(snackbar().props).toMatchObject({ visible: true, children: 'Card salvo com os dados do dicionário local.' });
  });

  it('preserva espaços de uma seleção válida no lookup e no card', async () => {
    await renderReader();
    await chooseCard({ ...selection, text: ' dragon ' });

    expect(lookupMock).toHaveBeenCalledWith(db, book.id, ' dragon ');
    expect(insertedCard().selectedText).toBe(' dragon ');
  });

  it('cria card com campos lexicais vazios quando o léxico não encontra o termo', async () => {
    lookupMock.mockResolvedValue(null);
    await renderReader();
    await chooseCard({ ...selection, text: 'moonspire' });

    expect(lookupMock).toHaveBeenCalledWith(db, book.id, 'moonspire');
    expect(insertedCard()).toMatchObject({
      selectedText: 'moonspire',
      translation: '',
      pronunciation: '',
      partOfSpeech: '',
      definition: '',
    });
    expect(snackbar().props).toMatchObject({
      visible: true,
      children: 'Card salvo. O dicionário local não encontrou tradução ou definição para este trecho.',
    });
  });

  it('mantém a criação do card quando o lookup lexical falha', async () => {
    lookupMock.mockRejectedValue(new Error('synthetic lexicon failure'));
    await renderReader();
    await chooseCard(selection);

    expect(insertedCard()).toMatchObject({
      translation: '',
      pronunciation: '',
      partOfSpeech: '',
      definition: '',
    });
    expect(snackbar().props.visible).toBe(true);
  });

  it('não monta ReaderExperience nem persiste quando o livro não existe', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'missing-book' });
    jest.mocked(getBook).mockResolvedValue(null);
    await renderReader();

    expect(jest.mocked(getBook)).toHaveBeenCalledWith(db, 'missing-book');
    expect(renderer!.root.findAll((node) => String(node.type) === 'MockEpubReaderSurface')).toHaveLength(0);
    expect(lookupMock).not.toHaveBeenCalled();
    expect(appendCardMock).not.toHaveBeenCalled();
    expect(renderer!.root.findAll((node) => String(node.type) === 'MockText').some((node) =>
      node.children.includes('Livro não encontrado na biblioteca.'))).toBe(true);
  });

  it('não confirma sucesso nem tenta novamente quando o insert falha por FK', async () => {
    appendCardMock.mockRejectedValue(new Error('FOREIGN KEY constraint failed'));
    await renderReader();
    await chooseCard(selection);

    expect(appendCardMock).toHaveBeenCalledTimes(1);
    expect(snackbar().props).toMatchObject({
      visible: true,
      children: 'Não foi possível salvar o card.',
    });
  });

  it('rejeita seleção sem termo antes da persistência', async () => {
    lookupMock.mockResolvedValue(null);
    await renderReader();
    await chooseCard({ text: '   ', cfiRange: selection.cfiRange });

    expect(appendCardMock).not.toHaveBeenCalled();
    expect(lookupMock).not.toHaveBeenCalled();
    expect(snackbar().props.visible).toBe(false);
  });
});
