import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Appbar,
  FAB,
  Searchbar,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';
import { BookCard } from '@/components/BookCard';
import { BookProcessingDetailsDialog } from '@/components/BookProcessingDetailsDialog';
import { EmptyLibrary } from '@/components/EmptyLibrary';
import { MainMenu } from '@/components/MainMenu';
import { listBooks, removeBook } from '@/db/repository';
import { deleteBookFiles, importEpub } from '@/services/epubImport';
import { lookupPreparedLexicon } from '@/services/lexicon';
import { getBookLexiconJob, getSession, reprocessBookLexicon, syncLibrary } from '@/services/sync';
import type { Book } from '@/types/domain';
import type { LexiconEntry, LexiconJob } from '@/types/lexicon';

export default function LibraryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [reprocessingBookId, setReprocessingBookId] = useState<string | null>(null);
  const [lexiconJobs, setLexiconJobs] = useState<Record<string, LexiconJob>>({});
  const [detailsBook, setDetailsBook] = useState<Book | null>(null);
  const [detailsLookupTerm, setDetailsLookupTerm] = useState('');
  const [detailsLookupEntry, setDetailsLookupEntry] = useState<LexiconEntry | null>(null);
  const [detailsLookupLoading, setDetailsLookupLoading] = useState(false);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      setBooks(await listBooks(db, search));
    } finally {
      setLoading(false);
    }
  }, [db, search]);

  useFocusEffect(useCallback(() => { void loadBooks(); }, [loadBooks]));
  useEffect(() => {
    const timer = setTimeout(() => { void loadBooks(); }, 200);
    return () => clearTimeout(timer);
  }, [loadBooks]);

  useEffect(() => {
    let cancelled = false;
    async function pollLexiconJobs() {
      const session = await getSession(db);
      if (!session || !books.length) {
        if (!cancelled) setLexiconJobs({});
        return;
      }
      const results = await Promise.all(books.map(async (book) => {
        try {
          return [book.id, await getBookLexiconJob(db, book.id)] as const;
        } catch {
          return [book.id, null] as const;
        }
      }));
      if (cancelled) return;
      setLexiconJobs((current) => {
        const next = { ...current };
        for (const [bookId, job] of results) {
          if (job) next[bookId] = job;
          else delete next[bookId];
        }
        return next;
      });
    }
    void pollLexiconJobs();
    const timer = setInterval(() => { void pollLexiconJobs(); }, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [db, books]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const result = await importEpub(db);
      if (!result) return;
      await loadBooks();
      setMessage(result.duplicate ? 'Este livro já está na biblioteca.' : 'Livro importado com sucesso.');
      router.push({ pathname: '/reader/[id]', params: { id: result.book.id } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar o livro.');
    } finally {
      setImporting(false);
    }
  }, [db, loadBooks, router]);

  const handleSync = useCallback(async () => {
    try {
      const result = await syncLibrary(db);
      setMessage('Sincronizados ' + result.books + ' livros e ' + result.cards + ' cards.');
      await loadBooks();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível sincronizar.');
    }
  }, [db, loadBooks]);

  const handleReprocess = useCallback(async (book: Book) => {
    setReprocessingBookId(book.id);
    try {
      const job = await reprocessBookLexicon(db, book.id);
      setLexiconJobs((current) => ({ ...current, [book.id]: job }));
      setMessage('Reprocessamento do lexico iniciado. Acompanhe o progresso nesta tela.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel reprocessar o lexico.');
    } finally {
      setReprocessingBookId(null);
    }
  }, [db]);

  const confirmDelete = useCallback((book: Book) => {
    Alert.alert(
      'Remover livro?',
      `“${book.title}” e todas as suas anotações serão excluídos deste aparelho.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const removed = await removeBook(db, book.id);
              if (removed) deleteBookFiles(removed);
              await loadBooks();
            })();
          },
        },
      ],
    );
  }, [db, loadBooks]);

  const openDetails = useCallback((book: Book) => {
    setDetailsBook(book);
    setDetailsLookupTerm('');
    setDetailsLookupEntry(null);
  }, []);

  const closeDetails = useCallback(() => {
    setDetailsBook(null);
    setDetailsLookupTerm('');
    setDetailsLookupEntry(null);
  }, []);

  const lookupDetailsTerm = useCallback(async () => {
    if (!detailsBook || !detailsLookupTerm.trim()) return;
    setDetailsLookupLoading(true);
    try {
      setDetailsLookupEntry(await lookupPreparedLexicon(db, detailsBook.id, detailsLookupTerm));
    } catch (error) {
      setDetailsLookupEntry(null);
      setMessage(error instanceof Error ? error.message : 'Não foi possível consultar o termo.');
    } finally {
      setDetailsLookupLoading(false);
    }
  }, [db, detailsBook, detailsLookupTerm]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.Content title="Leitor EPUB" subtitle={`${books.length} ${books.length === 1 ? 'livro' : 'livros'}`} />
        <MainMenu current="books" onSync={handleSync} />
      </Appbar.Header>

      <Searchbar
        placeholder="Buscar por título ou autor"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
        accessibilityLabel="Buscar na biblioteca"
      />

      {loading && books.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : books.length === 0 && !search ? (
        <EmptyLibrary onImport={handleImport} />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <BookCard
              book={item}
              onPress={() => router.push({ pathname: '/reader/[id]', params: { id: item.id } })}
              onLongPress={() => confirmDelete(item)}
              onDetails={() => openDetails(item)}
              onReprocess={() => void handleReprocess(item)}
              reprocessing={reprocessingBookId === item.id || lexiconJobs[item.id]?.status === 'QUEUED' || lexiconJobs[item.id]?.status === 'RUNNING'}
              lexiconJob={lexiconJobs[item.id]}
            />
          )}
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Text variant="titleMedium">Nenhum livro encontrado</Text>
              <Text variant="bodyMedium">Tente outro título ou autor.</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadBooks} />}
        />
      )}

      <BookProcessingDetailsDialog
        visible={Boolean(detailsBook)}
        book={detailsBook}
        lexiconJob={detailsBook ? lexiconJobs[detailsBook.id] : undefined}
        lookupTerm={detailsLookupTerm}
        lookupEntry={detailsLookupEntry}
        lookupLoading={detailsLookupLoading}
        onLookupTermChange={setDetailsLookupTerm}
        onLookup={() => void lookupDetailsTerm()}
        onDismiss={closeDetails}
      />

      <FAB
        icon="plus"
        label="Importar"
        loading={importing}
        disabled={importing}
        onPress={handleImport}
        style={[styles.fab, { bottom: 22 + insets.bottom }]}
        accessibilityLabel="Importar livro EPUB"
      />
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={4500}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: { marginHorizontal: 14, marginVertical: 10 },
  list: { paddingHorizontal: 7, paddingBottom: 104 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noResults: { flex: 1, padding: 48, alignItems: 'center', gap: 8 },
  fab: { position: 'absolute', right: 18, bottom: 22 },
});
