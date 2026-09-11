import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  type AppStateStatus,
  Easing,
  Linking,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {
  type Annotation as CoreAnnotation,
  type Location,
  useReader,
} from '@epubjs-react-native/core';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Appbar,
  IconButton,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { MoreActionsDialog } from '@/components/reader/MoreActionsDialog';
import { LookupDialog } from '@/components/reader/LookupDialog';
import { NavigationDialog } from '@/components/reader/NavigationDialog';
import { QuoteDialog } from '@/components/reader/QuoteDialog';
import { ReaderSettingsDialog } from '@/components/reader/ReaderSettingsDialog';
import {
  deleteAnnotation as deleteAnnotationRecord,
  deleteBookmarkByCfi,
  getBook,
  getReaderPreferences,
  appendCard,
  insertAnnotation,
  insertBookmark,
  listAnnotations,
  listBookmarks,
  saveLocations,
  saveReaderPreferences,
  updateAnnotation as updateAnnotationRecord,
  updateAnnotationSection,
  updateReadingPosition,
} from '@/db/repository';
import { openGoogleTranslate } from '@/native/googleTranslate';
import { translateLocally, normalizeLanguage } from '@/native/mlkit';
import { EpubReaderSurface, type SelectionAction } from '@/reader/EpubReaderSurface';
import { locationForProgress, normalizeReaderProgress } from '@/reader/progress';
import { setNavigationBarHidden } from '@/native/immersiveMode';
import {
  dictionaryWebUrl,
  lookupDictionary,
  searchWebUrl,
  translateWebUrl,
} from '@/services/lookup';
import { readerPalette } from '@/theme';
import { cardFieldsFromLexicon, lookupPreparedLexicon } from '@/services/lexicon';
import type {
  AnnotationRecord,
  Book,
  BookmarkRecord,
  CardRecord,
  ReaderPreferences,
  SelectionPayload,
} from '@/types/domain';
import type { ReaderEngine } from '@/types/reader';

type NavigationTab = 'toc' | 'bookmarks' | 'quotes' | 'search';

const CHROME_AUTO_HIDE_DELAY = 2_000;

type LookupState = {
  kind: 'translation' | 'dictionary';
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  result: string;
  error: string;
  loading: boolean;
  cached: boolean;
};

export default function ReaderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [preferences, setPreferences] = useState<ReaderPreferences | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [loadedBook, loadedPreferences, loadedAnnotations, loadedBookmarks] = await Promise.all([
          getBook(db, id),
          getReaderPreferences(db, id),
          listAnnotations(db, id),
          listBookmarks(db, id),
        ]);
        if (!loadedBook) {
          setError('Livro não encontrado na biblioteca.');
          return;
        }
        setBook(loadedBook);
        setPreferences(loadedPreferences);
        setAnnotations(loadedAnnotations);
        setBookmarks(loadedBookmarks);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Não foi possível abrir o livro.');
      }
    })();
  }, [db, id]);

  if (!book || !preferences) {
    return (
      <View style={styles.loadingScreen}>
        {error ? (
          <>
            <Text variant="titleMedium">{error}</Text>
            <Appbar.BackAction onPress={() => router.back()} />
          </>
        ) : (
          <ActivityIndicator size="large" />
        )}
      </View>
    );
  }

  return (
    <ReaderExperience
      key={book.id}
      book={book}
      initialPreferences={preferences}
      initialAnnotations={annotations}
      initialBookmarks={bookmarks}
    />
  );
}

type ExperienceProps = {
  book: Book;
  initialPreferences: ReaderPreferences;
  initialAnnotations: AnnotationRecord[];
  initialBookmarks: BookmarkRecord[];
};

function ReaderExperience({
  book,
  initialPreferences,
  initialAnnotations,
  initialBookmarks,
}: ExperienceProps) {
  const db = useSQLiteContext();
  const router = useRouter();
  const appTheme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    getCurrentLocation,
    locations,
    progress,
    searchResults,
    section,
    toc,
  } = useReader();
  const readerEngine = useRef<ReaderEngine>(null);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [quoteVisible, setQuoteVisible] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<AnnotationRecord | null>(null);
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [navigationVisible, setNavigationVisible] = useState(false);
  const [navigationTab, setNavigationTab] = useState<NavigationTab>('toc');
  const [moreVisible, setMoreVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const chromeAnimation = useRef(new Animated.Value(1)).current;
  const pendingPosition = useRef<{ cfi: string; progress: number } | null>(null);
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchDismissedChrome = useRef(false);

  const flushPosition = useCallback(async () => {
    if (positionTimer.current) clearTimeout(positionTimer.current);
    const pending = pendingPosition.current;
    pendingPosition.current = null;
    if (pending) await updateReadingPosition(db, book.id, pending.cfi, pending.progress);
  }, [book.id, db]);

  useEffect(() => {
    const listener = (state: AppStateStatus) => {
      if (state !== 'active') void flushPosition();
    };
    const subscription = AppState.addEventListener('change', listener);
    return () => {
      subscription.remove();
      void flushPosition();
    };
  }, [flushPosition]);

  useEffect(() => {
    if (!chromeVisible) return;

    chromeTimer.current = setTimeout(() => {
      setChromeVisible(false);
    }, CHROME_AUTO_HIDE_DELAY);

    return () => {
      if (chromeTimer.current) clearTimeout(chromeTimer.current);
      chromeTimer.current = null;
    };
  }, [chromeVisible]);

  useEffect(() => {
    const animation = Animated.timing(chromeAnimation, {
      toValue: chromeVisible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [chromeAnimation, chromeVisible]);

  useEffect(() => {
    void setNavigationBarHidden(!chromeVisible);
  }, [chromeVisible]);

  useEffect(() => () => {
    void setNavigationBarHidden(false);
  }, []);

  const handleReaderTouchStart = useCallback(() => {
    if (chromeVisible) {
      touchDismissedChrome.current = true;
      setChromeVisible(false);
      return;
    }
    touchDismissedChrome.current = false;
  }, [chromeVisible]);

  const handleReaderSingleTap = useCallback(() => {
    // Android WebView can leave a collapsed/one-word selection after a tap.
    // Clear it so text selection remains an intentional long-press action.
    readerEngine.current?.clearSelection();
    if (touchDismissedChrome.current) {
      touchDismissedChrome.current = false;
      return;
    }
    setChromeVisible(true);
  }, []);

  const handleLocationChange = useCallback((location: Location, currentProgress: number) => {
    const cfi = location?.start?.cfi;
    if (!cfi) return;
    pendingPosition.current = { cfi, progress: normalizeReaderProgress(currentProgress) };
    if (positionTimer.current) clearTimeout(positionTimer.current);
    positionTimer.current = setTimeout(() => { void flushPosition(); }, 500);
  }, [flushPosition]);

  const handlePreferencesChange = useCallback((next: ReaderPreferences) => {
    readerEngine.current?.applyPreferences(next);
    setPreferences(next);
    void saveReaderPreferences(db, next).catch(() => setMessage('Não foi possível salvar as preferências.'));
  }, [db]);

  const handleGoogleTranslate = useCallback(async (text: string) => {
    const opened = await openGoogleTranslate(text, 'pt');
    if (!opened) {
      await WebBrowser.openBrowserAsync(translateWebUrl(text, 'auto', 'pt'));
    }
  }, []);

  const runDictionaryLookup = useCallback(async (text: string) => {
    const sourceText = text.trim();
    setLookup({ kind: 'dictionary', sourceText, sourceLanguage: normalizeLanguage(book.language), targetLanguage: 'pt', result: '', error: '', loading: true, cached: false });
    try {
      const prepared = await lookupPreparedLexicon(db, book.id, sourceText);
      if (prepared && (prepared.definition || prepared.translationPtBr)) {
        const result = [prepared.lemma, prepared.partOfSpeech, prepared.definition, prepared.translationPtBr ? `PT-BR: ${prepared.translationPtBr}` : '', prepared.ipa ? `IPA: ${prepared.ipa}` : '', prepared.cefr ? `CEFR: ${prepared.cefr}` : ''].filter(Boolean).join('\n');
        setLookup((current) => current ? { ...current, result, loading: false, cached: true } : current);
        return;
      }
      const remote = await lookupDictionary(db, sourceText, book.language);
      setLookup((current) => current ? { ...current, result: remote.definition, loading: false, cached: remote.cached } : current);
    } catch (caught) {
      setLookup((current) => current ? { ...current, error: caught instanceof Error ? caught.message : 'N\u00E3o foi poss\u00EDvel consultar o dicion\u00E1rio.', loading: false } : current);
    }
  }, [book.id, book.language, db]);

  const runLocalTranslation = useCallback(async (text: string, sourceLanguage = normalizeLanguage(book.language), targetLanguage = 'pt') => {
    const sourceText = text.trim();
    setLookup({ kind: 'translation', sourceText, sourceLanguage, targetLanguage, result: '', error: '', loading: true, cached: false });
    try {
      const result = await translateLocally(sourceText, sourceLanguage, targetLanguage, true);
      setLookup((current) => current ? { ...current, result, loading: false } : current);
    } catch (caught) {
      setLookup((current) => current ? { ...current, error: caught instanceof Error ? caught.message : 'A tradu\u00E7\u00E3o local n\u00E3o est\u00E1 dispon\u00EDvel.', loading: false } : current);
    }
  }, [book.language]);
  const saveCard = useCallback(async (selected: SelectionPayload) => {
    const prepared = await lookupPreparedLexicon(db, book.id, selected.text).catch(() => null);
    const lexicalFields = cardFieldsFromLexicon(prepared);
    const now = new Date().toISOString();
    const card: CardRecord = {
      id: Crypto.randomUUID(),
      bookId: book.id,
      cfiRange: selected.cfiRange,
      selectedText: selected.text,
      ...lexicalFields,
      background: '',
      examples: [],
      relatedWords: [],
      chapterTitle: section?.label ?? 'Capítulo não identificado',
      queueOrder: 0,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await appendCard(db, card);
    setMessage(lexicalFields.translation || lexicalFields.definition
      ? 'Card salvo com os dados do dicionário local.'
      : 'Card salvo. O dicionário local não encontrou tradução ou definição para este trecho.');
  }, [book.id, db, section?.label]);

  const handleSelectionAction = useCallback((action: SelectionAction, selected: SelectionPayload) => {
    setSelection(selected);
    readerEngine.current?.clearSelection();
    if (action === 'card') {
      void saveCard(selected).catch(() => setMessage('Não foi possível salvar o card.'));
    } else if (action === 'copy') {
      void Clipboard.setStringAsync(selected.text).then(() => setMessage('Texto copiado.'));
    } else if (action === 'quote') {
      setEditingAnnotation(null);
      setQuoteVisible(true);
    } else if (action === 'translate') {
      void handleGoogleTranslate(selected.text);
    } else if (action === 'dictionary') {
      void runDictionaryLookup(selected.text);
    } else {
      setMoreVisible(true);
    }
  }, [handleGoogleTranslate, runDictionaryLookup, saveCard]);

  const saveQuote = useCallback(async (color: string, note: string) => {
    if (editingAnnotation) {
      const updated = { ...editingAnnotation, color, note: note || null, updatedAt: new Date().toISOString() };
      await updateAnnotationRecord(db, updated);
      readerEngine.current?.updateAnnotation(updated);
      setAnnotations((items) => items.map((item) => item.id === updated.id ? updated : item));
    } else if (selection) {
      const now = new Date().toISOString();
      const created: AnnotationRecord = {
        id: Crypto.randomUUID(),
        bookId: book.id,
        cfiRange: selection.cfiRange,
        selectedText: selection.text,
        color,
        note: note || null,
        sectionIndex: 0,
        createdAt: now,
        updatedAt: now,
      };
      await insertAnnotation(db, created);
      setAnnotations((items) => [created, ...items]);
      readerEngine.current?.addAnnotation(created);
    }
    setQuoteVisible(false);
    setEditingAnnotation(null);
    readerEngine.current?.clearSelection();
    setMessage('Citação salva.');
  }, [book.id, db, editingAnnotation, selection]);

  const deleteQuote = useCallback(() => {
    if (!editingAnnotation) return;
    Alert.alert('Excluir citação?', 'O destaque e a nota serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteAnnotationRecord(db, editingAnnotation.id);
            readerEngine.current?.removeAnnotation(editingAnnotation.cfiRange);
            setAnnotations((items) => items.filter((item) => item.id !== editingAnnotation.id));
            setQuoteVisible(false);
            setEditingAnnotation(null);
          })();
        },
      },
    ]);
  }, [db, editingAnnotation]);

  const handleAnnotationAdded = useCallback((annotation: CoreAnnotation) => {
    const id = (annotation.data as { id?: string } | undefined)?.id;
    if (!id) return;
    void updateAnnotationSection(db, id, annotation.sectionIndex);
    setAnnotations((items) => items.map((item) => item.id === id ? { ...item, sectionIndex: annotation.sectionIndex } : item));
  }, [db]);

  const handleAnnotationPressed = useCallback((annotation: CoreAnnotation) => {
    const id = (annotation.data as { id?: string } | undefined)?.id;
    const record = annotations.find((item) => item.id === id || item.cfiRange === annotation.cfiRange);
    if (!record) return;
    setEditingAnnotation(record);
    setSelection({ text: record.selectedText, cfiRange: record.cfiRange });
    setQuoteVisible(true);
  }, [annotations]);

  const toggleBookmark = useCallback(async () => {
    const location = getCurrentLocation();
    const cfi = location?.start?.cfi;
    if (!cfi) return;
    const existing = bookmarks.find((item) => item.cfi === cfi);
    if (existing) {
      await deleteBookmarkByCfi(db, book.id, cfi);
      setBookmarks((items) => items.filter((item) => item.cfi !== cfi));
      setMessage('Marcador removido.');
      return;
    }
    const bookmark: BookmarkRecord = {
      id: Crypto.randomUUID(),
      bookId: book.id,
      cfi,
      chapterTitle: section?.label ?? 'Marcador',
      excerpt: '',
      createdAt: new Date().toISOString(),
    };
    await insertBookmark(db, bookmark);
    setBookmarks((items) => [bookmark, ...items]);
    setMessage('Marcador adicionado.');
  }, [book.id, bookmarks, db, getCurrentLocation, section?.label]);

  const currentCfi = getCurrentLocation()?.start?.cfi;
  const isBookmarked = Boolean(currentCfi && bookmarks.some((item) => item.cfi === currentCfi));
  const palette = readerPalette[preferences.theme];
  const displayProgress = normalizeReaderProgress(progress || book.progress);

  const closeMore = useCallback(() => setMoreVisible(false), []);

  const handleExternalLink = useCallback((url: string) => {
    if (!/^(https?:|mailto:|tel:)/i.test(url)) {
      setMessage('O livro tentou abrir um endereço não permitido.');
      return;
    }
    Alert.alert(
      'Abrir link externo?',
      url,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abrir',
          onPress: () => {
            const action = /^https?:/i.test(url)
              ? WebBrowser.openBrowserAsync(url)
              : Linking.openURL(url);
            void action.catch(() => setMessage('Não foi possível abrir o link externo.'));
          },
        },
      ],
    );
  }, []);

  return (
    <View style={[styles.readerScreen, { backgroundColor: palette.background }]}>
      <EpubReaderSurface
        ref={readerEngine}
        book={book}
        preferences={preferences}
        annotations={initialAnnotations}
        onSelectionAction={handleSelectionAction}
        onLocationChange={handleLocationChange}
        onLocationsReady={(generated) => void saveLocations(db, book.id, generated)}
        onNavigationLoaded={() => undefined}
        onSearch={() => undefined}
        onAnnotationAdded={handleAnnotationAdded}
        onAnnotationPressed={handleAnnotationPressed}
        onExternalLink={handleExternalLink}
        onTouchStart={handleReaderTouchStart}
        onSingleTap={handleReaderSingleTap}
        onError={setMessage}
      />

      <Animated.View
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        style={[styles.chromeTop, {
          opacity: chromeAnimation,
          transform: [{
            translateY: chromeAnimation.interpolate({ inputRange: [0, 1], outputRange: [-88, 0] }),
          }],
        }]}
      >
        <Appbar.Header elevated style={styles.topBar}>
            <Appbar.BackAction onPress={() => { void flushPosition(); router.back(); }} />
            <Appbar.Content title={book.title} subtitle={section?.label} />
            <Appbar.Action icon={isBookmarked ? 'bookmark' : 'bookmark-outline'} onPress={() => void toggleBookmark()} accessibilityLabel="Alternar marcador" />
            <Appbar.Action icon="magnify" onPress={() => { setNavigationTab('search'); setNavigationVisible(true); }} accessibilityLabel="Pesquisar no livro" />
        </Appbar.Header>
      </Animated.View>
      <Animated.View
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        style={[styles.chromeBottom, {
          opacity: chromeAnimation,
          transform: [{
            translateY: chromeAnimation.interpolate({ inputRange: [0, 1], outputRange: [96 + insets.bottom, 0] }),
          }],
        }]}
      >
        <Surface
          elevation={3}
          style={[styles.bottomBar, { minHeight: 72 + insets.bottom, paddingBottom: insets.bottom }]}
        >
            <IconButton icon="format-list-bulleted" onPress={() => { setNavigationTab('toc'); setNavigationVisible(true); }} accessibilityLabel="Abrir sumário e anotações" />
            <IconButton icon="chevron-left" onPress={() => readerEngine.current?.previous()} accessibilityLabel="Página anterior" />
            <View style={styles.progressArea}>
              <Slider
                value={displayProgress}
                minimumValue={0}
                maximumValue={1}
                minimumTrackTintColor={appTheme.colors.primary}
                disabled={locations.length < 2}
                onSlidingComplete={(value) => {
                  const target = locationForProgress(locations, value);
                  if (target) readerEngine.current?.goTo(target);
                }}
              />
              <Text variant="labelSmall" style={styles.progressLabel}>{Math.round(displayProgress * 100)}%</Text>
            </View>
            <IconButton icon="chevron-right" onPress={() => readerEngine.current?.next()} accessibilityLabel="Próxima página" />
            <IconButton icon="format-font" onPress={() => setSettingsVisible(true)} accessibilityLabel="Configurações de leitura" />
        </Surface>
      </Animated.View>

      {quoteVisible ? (
        <QuoteDialog
          visible
          selection={selection}
          annotation={editingAnnotation}
          onDismiss={() => { setQuoteVisible(false); setEditingAnnotation(null); readerEngine.current?.clearSelection(); }}
          onSave={(color, note) => void saveQuote(color, note).catch((caught) => setMessage(caught instanceof Error ? caught.message : 'Não foi possível salvar.'))}
          onDelete={editingAnnotation ? deleteQuote : undefined}
        />
      ) : null}
      <ReaderSettingsDialog
        visible={settingsVisible}
        preferences={preferences}
        onChange={handlePreferencesChange}
        onDismiss={() => setSettingsVisible(false)}
      />
      <NavigationDialog
        key={`${navigationVisible}-${navigationTab}`}
        visible={navigationVisible}
        initialTab={navigationTab}
        toc={toc}
        bookmarks={bookmarks}
        annotations={annotations}
        searchResults={searchResults.results}
        onSearch={(query) => readerEngine.current?.search(query)}
        onGoTo={(target) => readerEngine.current?.goTo(target)}
        onDismiss={() => setNavigationVisible(false)}
      />
      <MoreActionsDialog
        visible={moreVisible}
        selection={selection}
        onDismiss={closeMore}
        onCopy={() => {
          closeMore();
          if (selection) void Clipboard.setStringAsync(selection.text)
            .then(() => setMessage('Texto copiado.'))
            .finally(() => readerEngine.current?.clearSelection());
        }}
        onShare={() => {
          closeMore();
          if (selection) void Share.share({ message: selection.text }).finally(() => readerEngine.current?.clearSelection());
        }}
        onSearchBook={() => {
          closeMore();
          if (selection) readerEngine.current?.search(selection.text);
          setNavigationTab('search');
          setNavigationVisible(true);
        }}
        onSearchWeb={() => {
          closeMore();
          if (selection) void WebBrowser.openBrowserAsync(searchWebUrl(selection.text)).finally(() => readerEngine.current?.clearSelection());
        }}
        onTranslateExternal={() => {
          closeMore();
          if (selection) void handleGoogleTranslate(selection.text).finally(() => readerEngine.current?.clearSelection());
        }}
        onDictionaryExternal={() => {
          closeMore();
          if (selection) void WebBrowser.openBrowserAsync(dictionaryWebUrl(selection.text, book.language)).finally(() => readerEngine.current?.clearSelection());
        }}
      />
      {lookup ? (
        <LookupDialog
          visible
          kind={lookup.kind}
          sourceText={lookup.sourceText}
          sourceLanguage={lookup.sourceLanguage}
          targetLanguage={lookup.targetLanguage}
          result={lookup.result}
          loading={lookup.loading}
          error={lookup.error}
          cached={lookup.cached}
          onSourceLanguageChange={(value) => setLookup((current) => current ? { ...current, sourceLanguage: value } : current)}
          onTargetLanguageChange={(value) => setLookup((current) => current ? { ...current, targetLanguage: value } : current)}
          onRetry={() => void (lookup.kind === 'dictionary' ? runDictionaryLookup(lookup.sourceText) : runLocalTranslation(lookup.sourceText, lookup.sourceLanguage, lookup.targetLanguage))}
          onCopy={() => { void Clipboard.setStringAsync(lookup.result); }}
          onShare={() => { void Share.share({ message: lookup.result }); }}
          onSwapLanguages={() => setLookup((current) => current ? { ...current, sourceLanguage: current.targetLanguage, targetLanguage: current.sourceLanguage } : current)}
          onOpenExternal={() => {
            void WebBrowser.openBrowserAsync(lookup.kind === 'dictionary' ? dictionaryWebUrl(lookup.sourceText, book.language) : translateWebUrl(lookup.sourceText, lookup.sourceLanguage, lookup.targetLanguage));
          }}
          onDismiss={() => setLookup(null)}
        />
      ) : null}      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={4500}>{message}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  readerScreen: { flex: 1 },
  chromeTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  topBar: { width: '100%' },
  chromeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 },
  bottomBar: {
    width: '100%',
    minHeight: 72,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  progressArea: { flex: 1 },
  progressLabel: { textAlign: 'center', marginTop: -7 },
});
