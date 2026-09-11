import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  Reader,
  type Annotation,
  type Location,
  type SearchResult,
  type Section,
  type Toc,
  useReader,
} from '@epubjs-react-native/core';
import { ActivityIndicator, Text } from 'react-native-paper';
import { StyleSheet, View } from 'react-native';
import { useEpubFileSystem } from './useEpubFileSystem';
import { readerPalette } from '@/theme';
import type {
  AnnotationRecord,
  Book,
  ReaderPreferences,
  SelectionPayload,
} from '@/types/domain';
import type { ReaderEngine } from '@/types/reader';

export type SelectionAction = 'card' | 'copy' | 'quote' | 'translate' | 'dictionary' | 'more';

type Props = {
  book: Book;
  preferences: ReaderPreferences;
  annotations: AnnotationRecord[];
  onSelectionAction(action: SelectionAction, selection: SelectionPayload): void;
  onLocationChange(location: Location, progress: number, section: Section | null): void;
  onLocationsReady(locations: string[]): void;
  onNavigationLoaded(toc: Toc): void;
  onSearch(results: SearchResult[]): void;
  onAnnotationAdded(annotation: Annotation): void;
  onAnnotationPressed(annotation: Annotation): void;
  onExternalLink(url: string): void;
  onTouchStart(): void;
  onSingleTap(): void;
  onError(message: string): void;
};

export function buildReaderTheme(preferences: ReaderPreferences) {
  const palette = readerPalette[preferences.theme];
  return {
    body: {
      color: `${palette.text} !important`,
      background: `${palette.background} !important`,
      'font-family': `${preferences.fontFamily} !important`,
      'font-size': `${preferences.fontSize}% !important`,
      'line-height': `${preferences.lineHeight} !important`,
      'text-align': `${preferences.textAlign} !important`,
      'padding-left': `${preferences.margin}px !important`,
      'padding-right': `${preferences.margin}px !important`,
    },
    p: {
      color: `${palette.text} !important`,
      'line-height': `${preferences.lineHeight} !important`,
      'text-align': `${preferences.textAlign} !important`,
    },
    a: { color: preferences.theme === 'dark' ? '#B7CCAF' : '#3E6537' },
    '::selection': { background: 'rgba(82, 105, 75, 0.28)' },
  };
}

export const EpubReaderSurface = forwardRef<ReaderEngine, Props>(function EpubReaderSurface({
  book,
  preferences,
  annotations,
  onSelectionAction,
  onLocationChange,
  onLocationsReady,
  onNavigationLoaded,
  onSearch,
  onAnnotationAdded,
  onAnnotationPressed,
  onExternalLink,
  onTouchStart,
  onSingleTap,
  onError,
}, ref) {
  const core = useReader();
  const [source, setSource] = useState({ uri: book.fileUri, initialCfi: book.lastCfi });

  useEffect(() => {
    setSource({ uri: book.fileUri, initialCfi: book.lastCfi });
  }, [book.fileUri, book.lastCfi]);

  useImperativeHandle(ref, () => ({
    async open(sourceUri, initialCfi) {
      setSource({ uri: sourceUri, initialCfi: initialCfi ?? null });
    },
    async close() {
      core.removeSelection();
      core.clearSearchResults();
      setSource({ uri: '', initialCfi: null });
    },
    goTo: core.goToLocation,
    next: () => core.goNext(),
    previous: () => core.goPrevious(),
    search(query) {
      const normalized = query.trim();
      if (normalized) core.search(normalized);
      else core.clearSearchResults();
    },
    setFlow: core.changeFlow,
    applyPreferences(next) {
      core.changeFontFamily(next.fontFamily);
      core.changeFontSize(`${next.fontSize}%`);
      core.changeTheme(buildReaderTheme(next));
    },
    addAnnotation(annotation) {
      core.addAnnotation(
        'highlight',
        annotation.cfiRange,
        { id: annotation.id },
        { color: annotation.color, opacity: 0.38 },
      );
    },
    updateAnnotation(annotation) {
      const rendered = core.annotations.find((item) =>
        (item.data as { id?: string } | undefined)?.id === annotation.id ||
        item.cfiRange === annotation.cfiRange,
      );
      if (rendered) {
        core.updateAnnotation(
          rendered,
          { id: annotation.id },
          { color: annotation.color, opacity: 0.38 },
        );
      }
    },
    removeAnnotation: core.removeAnnotationByCfi,
    clearSelection: core.removeSelection,
  }), [core]);

  const menuItems = useMemo(
    () => [
      {
        key: 'card',
        label: 'Card',
        action: (cfiRange: string, text: string) => {
          onSelectionAction('card', { cfiRange, text });
          return true;
        },
      },
      {
        key: 'dictionary',
        label: 'Dicionário',
        action: (cfiRange: string, text: string) => {
          onSelectionAction('dictionary', { cfiRange, text });
          return false;
        },
      },
      {
        key: 'translate',
        label: 'Traduzir',
        action: (cfiRange: string, text: string) => {
          onSelectionAction('translate', { cfiRange, text });
          return false;
        },
      },
      {
        key: 'quote',
        label: 'Citação',
        action: (cfiRange: string, text: string) => {
          onSelectionAction('quote', { cfiRange, text });
          return false;
        },
      },
      {
        key: 'more',
        label: 'Mais',
        action: (cfiRange: string, text: string) => {
          onSelectionAction('more', { cfiRange, text });
          return false;
        },
      },
    ],
    [onSelectionAction],
  );

  const initialAnnotations = useMemo<Annotation[]>(
    () => annotations.map((annotation) => ({
      type: 'highlight',
      data: { id: annotation.id },
      cfiRange: annotation.cfiRange,
      cfiRangeText: annotation.selectedText,
      sectionIndex: annotation.sectionIndex,
      styles: { color: annotation.color, opacity: 0.38 },
    })),
    [annotations],
  );

  const initialLocations = useMemo(() => {
    if (!book.locationsJson) return undefined;
    try {
      const parsed = JSON.parse(book.locationsJson) as unknown;
      return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [book.locationsJson]);

  // Reader uses this object while creating the WebView template. Keep it
  // stable for visual changes, which are applied imperatively below, and
  // recreate it only when the reader itself must be rebuilt.
  const readerTheme = useMemo(
    () => buildReaderTheme(preferences),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preferences.flow, source.uri],
  );
  const currentLocation = core.currentLocation?.start?.cfi;
  const readerInteractionProps = { onTouchStart };

  if (!source.uri) return null;

  return (
    <Reader
      key={`${source.uri}:${preferences.flow}`}
      src={source.uri}
      fileSystem={useEpubFileSystem}
      initialLocation={currentLocation ?? source.initialCfi ?? undefined}
      initialLocations={initialLocations}
      initialAnnotations={initialAnnotations}
      defaultTheme={readerTheme}
      flow={preferences.flow}
      manager={preferences.flow === 'paginated' ? 'default' : 'continuous'}
      spread="none"
      snap={preferences.flow === 'paginated'}
      enableSwipe={preferences.flow === 'paginated'}
      enableSelection
      allowScriptedContent={false}
      allowPopups={false}
      {...readerInteractionProps}
      onPressExternalLink={onExternalLink}
      menuItems={menuItems}
      charactersPerLocation={1_200}
      onLocationChange={(_total, location, progress, section) =>
        onLocationChange(location, progress, section)
      }
      onLocationsReady={(_key, locations) => onLocationsReady(locations)}
      onNavigationLoaded={({ toc }) => onNavigationLoaded(toc)}
      onSearch={(results) => onSearch(results)}
      onAddAnnotation={onAnnotationAdded}
      onPressAnnotation={onAnnotationPressed}
      onSingleTap={onSingleTap}
      onDisplayError={onError}
      renderLoadingFileComponent={({ downloadProgress }) => (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
          <Text>Preparando arquivo… {downloadProgress}%</Text>
        </View>
      )}
      renderOpeningBookComponent={() => (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
          <Text>Formatando o livro…</Text>
        </View>
      )}
    />
  );
});

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
});
