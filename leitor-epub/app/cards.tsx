import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Appbar, Button, Card as PaperCard, IconButton, Snackbar, Text, useTheme } from 'react-native-paper';
import { CardEditorDialog } from '@/components/CardEditorDialog';
import { MainMenu } from '@/components/MainMenu';
import { archiveCard, listBooks, listCards, moveCardToEnd, updateCard } from '@/db/repository';
import type { Book, CardDraft, CardRecord } from '@/types/domain';

const SWIPE_THRESHOLD = 0.25;

function createActionLock() {
  let active = false;
  return {
    acquire() {
      if (active) return false;
      active = true;
      return true;
    },
    release() {
      active = false;
    },
  };
}

export default function CardsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<CardRecord | null>(null);
  const [message, setMessage] = useState('');
  const [cardPosition] = useState(() => new Animated.ValueXY());
  const [actionInProgress] = useState(() => createActionLock());

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedCards, loadedBooks] = await Promise.all([listCards(db), listBooks(db)]);
      setCards(loadedCards);
      setBooks(loadedBooks);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os cards.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    void loadCards();
  }, [loadCards]));

  const booksById = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const currentCard = cards[0];

  const finishSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (!currentCard || !actionInProgress.acquire()) return;
    const cardId = currentCard.id;

    try {
      await new Promise<void>((resolve) => {
        Animated.timing(cardPosition, {
          toValue: { x: direction === 'left' ? -width * 1.25 : width * 1.25, y: 0 },
          duration: 220,
          useNativeDriver: true,
        }).start(() => resolve());
      });

      if (direction === 'left') {
        await archiveCard(db, cardId);
        setCards((items) => items.filter((item) => item.id !== cardId));
        setMessage('Card arquivado.');
      } else {
        await moveCardToEnd(db, cardId);
        setCards((items) => {
          const card = items.find((item) => item.id === cardId);
          if (!card) return items;
          return [...items.filter((item) => item.id !== cardId), card];
        });
      }
      setFlippedId(null);
      setDetailsId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a fila.');
    } finally {
      cardPosition.setValue({ x: 0, y: 0 });
      actionInProgress.release();
    }
  }, [actionInProgress, cardPosition, currentCard, db, width]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => (
      Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1
    ),
    onPanResponderMove: (_event, gesture) => {
      cardPosition.setValue({ x: gesture.dx, y: gesture.dy * 0.12 });
    },
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) >= width * SWIPE_THRESHOLD) {
        void finishSwipe(gesture.dx < 0 ? 'left' : 'right');
        return;
      }
      Animated.spring(cardPosition, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        bounciness: 6,
      }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(cardPosition, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        bounciness: 6,
      }).start();
    },
  }), [cardPosition, finishSwipe, width]);

  const handleSave = useCallback(async (draft: CardDraft) => {
    if (!editingCard) return;
    const updated: CardRecord = {
      ...editingCard,
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    try {
      await updateCard(db, updated);
      setCards((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditingCard(null);
      setMessage('Card atualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o card.');
    }
  }, [db, editingCard]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.Content title="Cards" subtitle={`${cards.length} ${cards.length === 1 ? 'card' : 'cards'} na fila`} />
        <MainMenu current="cards" />
      </Appbar.Header>

      {loading && cards.length === 0 ? (
        <View style={styles.center}><Text>Carregando cards…</Text></View>
      ) : currentCard ? (
        <View style={styles.queue}>
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.swipeCard, {
              transform: [
                ...cardPosition.getTranslateTransform(),
                {
                  rotate: cardPosition.x.interpolate({
                    inputRange: [-width, 0, width],
                    outputRange: ['-7deg', '0deg', '7deg'],
                  }),
                },
              ],
            }]}
          >
            <LearningCard
              card={currentCard}
              book={booksById.get(currentCard.bookId)}
              showingBack={flippedId === currentCard.id}
              detailsVisible={detailsId === currentCard.id}
              onToggle={() => setFlippedId((value) => value === currentCard.id ? null : currentCard.id)}
              onDetails={() => setDetailsId((value) => value === currentCard.id ? null : currentCard.id)}
              onEdit={() => setEditingCard(currentCard)}
            />
          </Animated.View>
          <Text variant="bodySmall" style={styles.swipeHint}>
            Deslize para a esquerda para arquivar · para a direita para rever depois
          </Text>
        </View>
      ) : (
        <View style={styles.empty}>
          <Text variant="titleMedium">Fila vazia</Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Selecione uma palavra ou frase em um livro e toque em Card.
          </Text>
        </View>
      )}

      <CardEditorDialog
        key={editingCard ? `${editingCard.id}:${editingCard.updatedAt}` : 'empty'}
        visible={Boolean(editingCard)}
        card={editingCard}
        onDismiss={() => setEditingCard(null)}
        onSave={(draft) => void handleSave(draft)}
      />
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={4500}>
        {message}
      </Snackbar>
    </View>
  );
}

type LearningCardProps = {
  card: CardRecord;
  book: Book | undefined;
  showingBack: boolean;
  detailsVisible: boolean;
  onToggle(): void;
  onDetails(): void;
  onEdit(): void;
};

function LearningCard({
  card,
  book,
  showingBack,
  detailsVisible,
  onToggle,
  onDetails,
  onEdit,
}: LearningCardProps) {
  const value = showingBack ? card.translation || 'Tradução ainda não preenchida.' : card.selectedText;
  const label = showingBack ? 'VERSO' : 'FRENTE';
  const date = new Date(card.createdAt).toLocaleDateString('pt-BR');

  return (
    <PaperCard mode="elevated" style={styles.card}>
      <PaperCard.Title
        title={label}
        right={() => <IconButton icon="swap-vertical" onPress={onToggle} accessibilityLabel="Virar card" />}
      />
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel="Virar card">
        <PaperCard.Content style={styles.hero}>
          <Text variant="displaySmall" style={styles.cardValue}>{value}</Text>
          {!showingBack && card.pronunciation ? (
            <Text variant="bodyLarge" style={styles.pronunciation}>/{card.pronunciation}/</Text>
          ) : null}
          {!showingBack && card.partOfSpeech ? (
            <Text variant="bodyLarge" style={styles.metadata}>{card.partOfSpeech}</Text>
          ) : null}
          {showingBack && card.definition ? (
            <Text variant="bodyLarge" style={styles.definition}>{card.definition}</Text>
          ) : null}
          <Text variant="labelMedium" style={styles.tapHint}>
            Toque para ver o {showingBack ? 'texto original' : 'verso'}
          </Text>
        </PaperCard.Content>
      </Pressable>
      {card.background ? <CardSection title="Contexto"><Text variant="bodyLarge">{card.background}</Text></CardSection> : null}
      {card.examples.length > 0 ? (
        <CardSection title="Exemplos">
          {card.examples.map((example, index) => (
            <View key={`${card.id}-example-${index}`} style={styles.bulletRow}>
              <Text variant="bodyLarge" style={styles.bullet}>•</Text>
              <Text variant="bodyLarge" style={styles.example}>{example}</Text>
            </View>
          ))}
        </CardSection>
      ) : null}
      {card.relatedWords.length > 0 ? (
        <CardSection title="Relacionadas">
          {card.relatedWords.map((word, index) => (
            <View key={`${card.id}-related-${index}`} style={styles.bulletRow}>
              <Text variant="bodyLarge" style={styles.bullet}>•</Text>
              <Text variant="bodyLarge" style={styles.related}>{word}</Text>
            </View>
          ))}
        </CardSection>
      ) : null}
      {detailsVisible ? (
        <PaperCard.Content style={styles.details}>
          <Text variant="bodyMedium">Livro: {book?.title ?? 'Livro não encontrado'}</Text>
          <Text variant="bodyMedium">Capítulo: {card.chapterTitle || 'Não identificado'}</Text>
          <Text variant="bodyMedium">Data: {date}</Text>
        </PaperCard.Content>
      ) : null}
      <PaperCard.Actions>
        <Button compact icon="information-outline" onPress={onDetails}>Detalhes</Button>
        <Button compact icon="pencil-outline" onPress={onEdit}>Editar</Button>
      </PaperCard.Actions>
    </PaperCard>
  );
}

function CardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PaperCard.Content style={styles.section}>
      <Text variant="titleMedium" style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </PaperCard.Content>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  queue: { flex: 1, justifyContent: 'center', padding: 16 },
  swipeCard: { width: '100%' },
  card: { width: '100%' },
  hero: { alignItems: 'center', paddingTop: 18, paddingBottom: 16 },
  cardValue: { minHeight: 64, lineHeight: 40, textAlign: 'center' },
  pronunciation: { marginTop: 8, fontStyle: 'italic', opacity: 0.78 },
  metadata: { marginTop: 8, opacity: 0.78 },
  definition: { marginTop: 16, textAlign: 'center', lineHeight: 25 },
  tapHint: { marginTop: 10, opacity: 0.65 },
  section: { marginTop: 4, paddingTop: 12, paddingBottom: 8 },
  sectionTitle: { marginBottom: 8 },
  sectionBody: { gap: 8 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { lineHeight: 26 },
  example: { flex: 1, fontStyle: 'italic', lineHeight: 26 },
  related: { flex: 1, fontWeight: '700', lineHeight: 26 },
  details: { gap: 3, marginTop: 16 },
  swipeHint: { textAlign: 'center', opacity: 0.65, marginTop: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyText: { marginTop: 8, textAlign: 'center' },
});
