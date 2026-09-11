import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Card, Icon, IconButton, Menu, ProgressBar, Text, useTheme } from 'react-native-paper';
import type { Book } from '@/types/domain';
import type { LexiconJob } from '@/types/lexicon';

type Props = {
  book: Book;
  onPress(): void;
  onLongPress(): void;
  onDetails(): void;
  onReprocess(): void;
  reprocessing?: boolean;
  lexiconJob?: LexiconJob;
};

export function BookCard({ book, onPress, onLongPress, onDetails, onReprocess, reprocessing = false, lexiconJob }: Props) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const percent = Math.round(book.progress * 100);
  const jobActive = lexiconJob?.status === 'QUEUED' || lexiconJob?.status === 'RUNNING';
  const lexiconPercent = Math.max(0, Math.min(1, lexiconJob?.progress ?? 0));

  return (
    <Card
      mode="elevated"
      style={styles.card}
      onPress={() => { if (menuVisible) setMenuVisible(false); else onPress(); }}
      onLongPress={onLongPress}
      accessibilityLabel={`${book.title}, ${book.author || 'autor desconhecido'}, ${percent}% lido`}
    >
      <View style={[styles.cover, { backgroundColor: theme.colors.surfaceVariant }]}>
        {book.coverUri ? (
          <Image source={{ uri: book.coverUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <Icon source="book-open-page-variant-outline" size={54} color={theme.colors.primary} />
        )}
        <View style={styles.menuAnchor} onStartShouldSetResponder={() => true}>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={(
              <IconButton
                icon={reprocessing ? 'progress-clock' : 'dots-vertical'}
                iconColor="#fff"
                style={styles.menuButton}
                disabled={reprocessing}
                onPress={() => setMenuVisible(true)}
                accessibilityLabel="Opcoes do livro"
              />
            )}
          >
            <Menu.Item
              leadingIcon="information-outline"
              title="Detalhes do processamento"
              onPress={() => { setMenuVisible(false); onDetails(); }}
            />
            <Menu.Item
              leadingIcon="refresh"
              title={'Reprocessar \u00E9xico'}
              onPress={() => { setMenuVisible(false); onReprocess(); }}
            />
            <Menu.Item
              leadingIcon="delete-outline"
              title="Excluir livro"
              onPress={() => { setMenuVisible(false); onLongPress(); }}
            />
          </Menu>
        </View>
      </View>
      <Card.Content style={styles.content}>
        <Text variant="titleSmall" numberOfLines={2} style={styles.title}>
          {book.title}
        </Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
          {book.author || 'Autor desconhecido'}
        </Text>
        <View style={styles.progressRow}>
          <ProgressBar progress={book.progress} style={styles.progress} />
          <Text variant="labelSmall">{percent}%</Text>
        </View>
        {jobActive ? (
          <View style={styles.lexiconStatus} accessibilityLiveRegion="polite">
            <View style={styles.lexiconStatusRow}>
              <Text variant="labelSmall">{lexiconPhaseLabel(lexiconJob?.phase)}</Text>
              <Text variant="labelSmall">{Math.round(lexiconPercent * 100)}%</Text>
            </View>
            <ProgressBar progress={lexiconPercent} style={styles.lexiconProgress} />
            <Text variant="labelSmall">{lexiconJob?.processedUnits ?? 0}/{lexiconJob?.totalUnits ?? 0} unidades · {lexiconJob?.processedTokens ?? 0} tokens</Text>
          </View>
        ) : lexiconJob?.status === 'FAILED' ? (
          <Text variant="labelSmall" style={styles.lexiconError}>Falha: {lexiconJob.errorMessage || lexiconJob.message || 'processamento interrompido'}</Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

function lexiconPhaseLabel(phase?: string) {
  switch (phase) {
    case 'EXTRACTING': return 'Extraindo EPUB';
    case 'ANALYZING': return 'Analisando';
    case 'ENRICHING': return 'Enriquecendo';
    default: return 'Preparando léxico';
  }
}

const styles = StyleSheet.create({
  card: { flex: 1, margin: 7, overflow: 'hidden' },
  cover: { aspectRatio: 0.72, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  menuAnchor: { position: 'absolute', top: 3, right: 3, zIndex: 4 },
  menuButton: { margin: 0, borderRadius: 18, backgroundColor: 'rgba(27,39,24,0.58)' },
  content: { paddingTop: 12, paddingBottom: 12 },
  title: { minHeight: 38, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  progress: { flex: 1, height: 4, borderRadius: 2 },
  lexiconStatus: { gap: 4, marginTop: 10 },
  lexiconStatusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lexiconProgress: { height: 4, borderRadius: 2 },
  lexiconError: { marginTop: 10, color: '#a44737' },
});
