import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { SearchResult, Toc } from '@epubjs-react-native/core';
import {
  Dialog,
  Divider,
  IconButton,
  List,
  Portal,
  Searchbar,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import type { AnnotationRecord, BookmarkRecord } from '@/types/domain';

type Tab = 'toc' | 'bookmarks' | 'quotes' | 'search';

type Props = {
  visible: boolean;
  initialTab?: Tab;
  toc: Toc;
  bookmarks: BookmarkRecord[];
  annotations: AnnotationRecord[];
  searchResults: SearchResult[];
  onSearch(query: string): void;
  onGoTo(cfiOrHref: string): void;
  onDismiss(): void;
};

type NavigationItem = { key: string; title: string; description?: string; target: string; icon: string };

function flattenToc(items: Toc, depth = 0): NavigationItem[] {
  return items.flatMap((item) => [
    {
      key: `toc-${item.id || item.href}`,
      title: `${'  '.repeat(depth)}${item.label.trim()}`,
      target: item.href,
      icon: depth === 0 ? 'file-document-outline' : 'subdirectory-arrow-right',
    },
    ...flattenToc((item.subitems ?? []) as Toc, depth + 1),
  ]);
}

export function NavigationDialog({
  visible,
  initialTab = 'toc',
  toc,
  bookmarks,
  annotations,
  searchResults,
  onSearch,
  onGoTo,
  onDismiss,
}: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const items = useMemo<NavigationItem[]>(() => {
    if (tab === 'toc') return flattenToc(toc);
    if (tab === 'bookmarks') {
      return bookmarks.map((item) => ({
        key: item.id,
        title: item.chapterTitle || 'Marcador',
        description: item.excerpt,
        target: item.cfi,
        icon: 'bookmark-outline',
      }));
    }
    if (tab === 'quotes') {
      return annotations.map((item) => ({
        key: item.id,
        title: item.selectedText,
        description: item.note ?? undefined,
        target: item.cfiRange,
        icon: 'format-quote-close',
      }));
    }
    return searchResults.map((item, index) => ({
      key: `search-${index}-${item.cfi}`,
      title: item.section?.label || 'Resultado',
      description: item.excerpt,
      target: item.cfi,
      icon: 'text-search',
    }));
  }, [annotations, bookmarks, searchResults, tab, toc]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <View style={styles.header}>
          <Text variant="titleLarge">Navegação</Text>
          <IconButton icon="close" onPress={onDismiss} accessibilityLabel="Fechar" />
        </View>
        <SegmentedButtons
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          density="small"
          style={styles.tabs}
          buttons={[
            { value: 'toc', label: 'Sumário' },
            { value: 'bookmarks', label: 'Marc.' },
            { value: 'quotes', label: 'Citações' },
            { value: 'search', label: 'Busca' },
          ]}
        />
        {tab === 'search' ? (
          <Searchbar
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => onSearch(query.trim())}
            onIconPress={() => onSearch(query.trim())}
            placeholder="Pesquisar no livro"
            style={styles.search}
          />
        ) : null}
        <Divider />
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerStyle={items.length ? undefined : styles.emptyContainer}
          ListEmptyComponent={
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {tab === 'search' ? 'Digite uma palavra para pesquisar.' : 'Nenhum item salvo.'}
            </Text>
          }
          renderItem={({ item }) => (
            <List.Item
              title={item.title}
              description={item.description}
              titleNumberOfLines={2}
              descriptionNumberOfLines={3}
              left={(props) => <List.Icon {...props} icon={item.icon} />}
              onPress={() => { onGoTo(item.target); onDismiss(); }}
            />
          )}
        />
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { height: '86%', marginHorizontal: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 8, paddingTop: 8 },
  tabs: { marginHorizontal: 12, marginBottom: 10 },
  search: { marginHorizontal: 12, marginBottom: 10 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
