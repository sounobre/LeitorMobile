import { useEffect, useRef, useState } from 'react';
import { createCard, fetchBookFile, lookupBookLexicon, startBookLexicon, updateBookProgress } from './api';
import type { LexiconEntry } from './api';
import type { Book, Card } from './types';
import epubjsCode from './vendor/epubjsBundle';
import jszipCode from './vendor/jszipBundle';

type EpubRendition = {
  display: (target?: string) => Promise<unknown>;
  next: () => Promise<unknown>;
  prev: () => Promise<unknown>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  destroy?: () => void;
};

type EpubBook = {
  ready: Promise<unknown>;
  renderTo: (element: HTMLElement, options: Record<string, unknown>) => EpubRendition;
  destroy?: () => void;
};

type EpubFactory = (data: ArrayBuffer) => EpubBook;

type EpubContents = {
  window?: Window;
  section?: {
    label?: string;
    href?: string;
  };
};

type ReaderSelection = {
  text: string;
  cfiRange: string;
  chapterTitle: string;
  left: number;
  top: number;
};

function getEpubFactory(): EpubFactory {
  const scope = window as Window & { ePub?: EpubFactory };
  if (!scope.ePub) {
    const load = new Function('window', jszipCode + '\n' + epubjsCode + '\nreturn window.ePub;');
    scope.ePub = load(window) as EpubFactory;
  }
  if (!scope.ePub) throw new Error('O renderer EPUB não pôde ser carregado.');
  return scope.ePub;
}

function selectionPosition(contents: EpubContents, viewer: HTMLElement) {
  const selectedWindow = contents.window;
  const selection = selectedWindow?.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const rangeRect = selection.getRangeAt(0).getBoundingClientRect();
  const iframe = viewer.querySelector('iframe');
  const contentRect = iframe?.getBoundingClientRect() ?? viewer.getBoundingClientRect();
  const stageRect = viewer.parentElement?.getBoundingClientRect() ?? viewer.getBoundingClientRect();
  const rawLeft = contentRect.left + rangeRect.left + (rangeRect.width / 2) - stageRect.left;
  const rawTop = contentRect.top + rangeRect.top - stageRect.top - 58;

  return {
    left: Math.min(Math.max(rawLeft, 96), Math.max(96, stageRect.width - 96)),
    top: Math.max(12, rawTop),
    selectedWindow,
  };
}

function firstNonBlank(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value?.trim()))?.trim() ?? '';
}

function lexiconLookupTerm(selectedText: string) {
  const normalized = selectedText.trim();
  return normalized;
}

function lexiconTranslation(entry: LexiconEntry | null) {
  return firstNonBlank(entry?.translationPtBr, ...(entry?.senses ?? []).map((sense) => sense.translationPtBr));
}

function lexiconDefinition(entry: LexiconEntry | null) {
  return firstNonBlank(entry?.definition, ...(entry?.senses ?? []).map((sense) => sense.definition));
}

export default function EpubReader({
  book,
  onClose,
  onCardCreated,
}: {
  book: Book;
  onClose: () => void;
  onCardCreated?: (card: Card) => void;
}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const selectionWindowRef = useRef<Window | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(Math.round(book.progress * 100));
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [cardMessage, setCardMessage] = useState('');
  const [lexiconMessage, setLexiconMessage] = useState('');
  const [lexiconLoading, setLexiconLoading] = useState(false);
  const [lexiconEntry, setLexiconEntry] = useState<LexiconEntry | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function open() {
      if (!viewerRef.current) return;
      try {
        setLoading(true);
        setError('');
        const bytes = await fetchBookFile(book.id);
        if (cancelled || !viewerRef.current) return;
        const epubBook = getEpubFactory()(bytes);
        bookRef.current = epubBook;
        await epubBook.ready;
        if (cancelled || !viewerRef.current) return;

        const rendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          manager: 'default',
          spread: 'auto',
        });
        renditionRef.current = rendition;
        rendition.on('relocated', (location: any) => {
          const cfi = location?.start?.cfi ?? null;
          const percentage = typeof location?.start?.percentage === 'number'
            ? location.start.percentage
            : progress / 100;
          const nextProgress = Math.max(0, Math.min(100, Math.round(percentage * 100)));
          setProgress(nextProgress);
          void updateBookProgress(book.id, cfi, nextProgress / 100).catch(() => undefined);
        });
        rendition.on('selected', (cfiRange: string, contents: EpubContents) => {
          const text = contents.window?.getSelection()?.toString().trim() ?? '';
          const position = selectionPosition(contents, viewerRef.current!);
          if (!text || !cfiRange || !position) return;

          selectionWindowRef.current = position.selectedWindow ?? null;
          setCardMessage('');
          setLexiconMessage('');
          setLexiconEntry(null);
          setSelection({
            text,
            cfiRange,
            chapterTitle: contents.section?.label || contents.section?.href || 'Trecho selecionado',
            left: position.left,
            top: position.top,
          });
        });
        await rendition.display(book.lastCfi ?? undefined);
        if (!cancelled) setLoading(false);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível abrir este EPUB.');
          setLoading(false);
        }
      }
    }

    void open();
    return () => {
      cancelled = true;
      selectionWindowRef.current?.getSelection()?.removeAllRanges();
      renditionRef.current?.destroy?.();
      bookRef.current?.destroy?.();
      renditionRef.current = null;
      bookRef.current = null;
      selectionWindowRef.current = null;
    };
  }, [book.id]);

  function clearSelection() {
    selectionWindowRef.current?.getSelection()?.removeAllRanges();
    selectionWindowRef.current = null;
    setSelection(null);
    setLexiconEntry(null);
    setLexiconMessage('');
  }

  async function handleLookup() {
    if (!selection || lexiconLoading) return;
    setLexiconLoading(true);
    setLexiconMessage('');
    try {
      const entry = await lookupBookLexicon(book.id, lexiconLookupTerm(selection.text));
      setLexiconEntry(entry);
      if (!entry) {
        setLexiconMessage('No definition is prepared for this selection yet.');
        void startBookLexicon(book.id).catch(() => undefined);
      } else {
        const translation = lexiconTranslation(entry);
        const definition = lexiconDefinition(entry);
        setLexiconMessage(translation ? `${entry.lemma}: ${translation}` : definition ? `${entry.lemma}: ${definition}` : `${entry.lemma}: no definition available.`);
      }
    } catch (cause) {
      setLexiconEntry(null);
      setLexiconMessage(cause instanceof Error ? cause.message : 'Could not query the local dictionary.');
    } finally {
      setLexiconLoading(false);
    }
  }

  async function handleCreateCard() {
    if (!selection || savingCard) return;
    setSavingCard(true);
    setCardMessage('');
    try {
      const entry = lexiconEntry ?? await lookupBookLexicon(book.id, lexiconLookupTerm(selection.text)).catch(() => null);
      const lexiconTranslation = firstNonBlank(entry?.translationPtBr, ...(entry?.senses ?? []).map((sense) => sense.translationPtBr));
      const lexiconDefinition = firstNonBlank(entry?.definition, ...(entry?.senses ?? []).map((sense) => sense.definition));
      const created = await createCard({
        bookId: book.id,
        cfiRange: selection.cfiRange,
        selectedText: selection.text,
        chapterTitle: selection.chapterTitle,
        translation: lexiconTranslation,
        pronunciation: entry?.ipa ?? '',
        partOfSpeech: entry?.partOfSpeech ?? '',
        definition: lexiconDefinition,
        background: '',
        examples: [],
        relatedWords: [],
      });
      onCardCreated?.(created);
      clearSelection();
      setCardMessage(lexiconTranslation || lexiconDefinition
        ? 'Card criado com os dados do dicionário local.'
        : 'Card criado. O dicionário local não encontrou tradução ou definição para esta seleção.');
    } catch (cause) {
      setCardMessage(cause instanceof Error ? cause.message : 'Não foi possível criar o card.');
    } finally {
      setSavingCard(false);
    }
  }

  return (
    <div className="reader-overlay">
      <header className="reader-toolbar">
        <button className="ghost-button" onClick={onClose}>← Biblioteca</button>
        <div className="reader-title"><strong>{book.title}</strong><span>{progress}% lido</span></div>
        <div className="reader-navigation">
          <button className="secondary-button" onClick={() => void renditionRef.current?.prev()}>Anterior</button>
          <button className="secondary-button" onClick={() => void renditionRef.current?.next()}>Próxima</button>
        </div>
      </header>
      <main className="reader-stage">
        {loading ? <div className="reader-message">Carregando EPUB…</div> : null}
        {error ? <div className="reader-message reader-error"><strong>Não foi possível abrir o livro.</strong><span>{error}</span><button className="secondary-button" onClick={onClose}>Voltar à biblioteca</button></div> : null}
        <div ref={viewerRef} className="reader-viewer" />
        {selection ? (
          <div
            className="selection-toolbar"
            style={{ left: selection.left, top: selection.top }}
            onMouseDown={(event) => event.preventDefault()}
            role="toolbar"
            aria-label="Ações para o texto selecionado"
          >
            <span className="selection-preview">{selection.text}</span>
            <button className="secondary-button" onClick={() => void handleLookup()} disabled={lexiconLoading}>
              {lexiconLoading ? 'Consulting...' : 'Local dictionary'}
            </button>
            <button className="primary-button" onClick={() => void handleCreateCard()} disabled={savingCard}>
              {savingCard ? 'Salvando…' : 'Criar card'}
            </button>
            <button className="selection-dismiss" onClick={clearSelection} aria-label="Fechar ações">×</button>
          </div>
        ) : null}
        {cardMessage ? <div className="reader-toast" role="status">{cardMessage}</div> : null}
        {lexiconMessage ? <div className="reader-toast" role="status">{lexiconMessage}</div> : null}
      </main>
    </div>
  );
}
