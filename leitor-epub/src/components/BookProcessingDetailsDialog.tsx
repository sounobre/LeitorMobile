import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  Divider,
  Portal,
  ProgressBar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { Book } from '@/types/domain';
import type { LexiconEntry, LexiconJob } from '@/types/lexicon';
import { describeLexiconJob } from './bookProcessingDetails';

type Props = {
  visible: boolean;
  book: Book | null;
  lexiconJob?: LexiconJob;
  lookupTerm: string;
  lookupEntry: LexiconEntry | null;
  lookupLoading: boolean;
  onLookupTermChange(term: string): void;
  onLookup(): void;
  onDismiss(): void;
};

export function BookProcessingDetailsDialog({
  visible,
  book,
  lexiconJob,
  lookupTerm,
  lookupEntry,
  lookupLoading,
  onLookupTermChange,
  onLookup,
  onDismiss,
}: Props) {
  const theme = useTheme();
  const details = describeLexiconJob(lexiconJob);
  const progress = lexiconJob
    ? Math.max(0, Math.min(1, lexiconJob.progress || (lexiconJob.totalUnits ? lexiconJob.processedUnits / lexiconJob.totalUnits : 0)))
    : 0;
  const statusColor = lexiconJob?.status === 'FAILED'
    ? theme.colors.error
    : lexiconJob?.status === 'COMPLETED'
      ? theme.colors.primary
      : theme.colors.tertiary;

  return (
    <Portal>
      <Dialog visible={visible && Boolean(book)} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{book?.title || 'Detalhes do livro'}</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {book?.author || 'Autor desconhecido'}
            </Text>

            <View style={styles.statusRow}>
              <Chip icon={lexiconJob?.status === 'FAILED' ? 'alert-circle-outline' : 'check-circle-outline'} textStyle={{ color: statusColor }}>
                {details.statusLabel}
              </Chip>
              <Text variant="labelLarge" style={{ color: statusColor }}>{details.phaseLabel}</Text>
            </View>

            <Surface elevation={0} style={[styles.panel, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="titleMedium">Resumo do processamento</Text>
              <ProgressBar progress={progress} color={statusColor} style={styles.progress} />
              <View style={styles.metricGrid}>
                <Metric label="Unidades" value={details.progressLabel} />
                <Metric label="Tokens" value={details.tokensLabel} />
                <Metric label="Léxicos" value={details.lexemesLabel} />
                <Metric label="Fase" value={details.phaseLabel} />
              </View>
              <Text variant="bodySmall">{details.message}</Text>
              <Text variant="bodySmall" style={{ color: lexiconJob?.errorMessage ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                {details.errorMessage}
              </Text>
            </Surface>

            <Surface elevation={0} style={[styles.panel, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="titleMedium">Status da API</Text>
              <Text variant="bodySmall" style={styles.code} selectable>
                {`status: ${lexiconJob?.status || '—'}\nphase: ${lexiconJob?.phase || '—'}\nprocessedUnits: ${lexiconJob?.processedUnits ?? '—'}\ntotalUnits: ${lexiconJob?.totalUnits ?? '—'}\nerrorMessage: ${lexiconJob?.errorMessage || 'null'}`}
              </Text>
            </Surface>

            <Divider />
            <Text variant="titleMedium">Consultar termo do léxico</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Consulte o resultado sincronizado para conferir definição, tradução e resolução. Exemplo: kelsier.
            </Text>
            <TextInput
              mode="outlined"
              label="Termo"
              placeholder="Ex.: kelsier"
              value={lookupTerm}
              onChangeText={onLookupTermChange}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={onLookup}
            />
            <Button
              mode="contained-tonal"
              icon="magnify"
              onPress={onLookup}
              disabled={!lookupTerm.trim() || lookupLoading}
            >
              Consultar termo
            </Button>

            {lookupLoading ? <ActivityIndicator style={styles.lookupLoading} /> : lookupEntry ? (
              <Surface elevation={0} style={[styles.lookupCard, { borderColor: theme.colors.outlineVariant }]}>
                <View style={styles.lookupHeader}>
                  <View style={styles.lookupHeading}>
                    <Text variant="titleMedium">{lookupEntry.lemma}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {lookupEntry.partOfSpeech} · {lookupEntry.bookFrequency} ocorrências
                    </Text>
                  </View>
                  <Chip compact>{lookupEntry.resolutionStatus}</Chip>
                </View>
                <DetailRow label="Definição" value={lookupEntry.definition || 'Sem definição disponível.'} />
                <DetailRow label="Tradução" value={lookupEntry.translationPtBr || 'Sem tradução disponível.'} />
                <DetailRow label="IPA" value={lookupEntry.ipa || '—'} />
                <DetailRow label="CEFR" value={lookupEntry.cefr || '—'} />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {lookupEntry.senses.length} sentido(s) catalogado(s)
                </Text>
              </Surface>
            ) : lookupTerm.trim() ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Nenhum resultado encontrado para “{lookupTerm.trim()}”.
              </Text>
            ) : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Fechar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text variant="labelSmall">{label}</Text>
      <Text variant="bodyMedium">{value}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="labelMedium">{label}</Text>
      <Text variant="bodyMedium">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '92%' },
  content: { gap: 14, paddingHorizontal: 24, paddingBottom: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panel: { gap: 8, padding: 14, borderRadius: 12 },
  progress: { height: 6, borderRadius: 3 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { minWidth: '44%', flexGrow: 1, gap: 2 },
  code: { fontFamily: 'monospace', lineHeight: 20 },
  lookupLoading: { marginVertical: 8 },
  lookupCard: { gap: 10, padding: 14, borderWidth: 1, borderRadius: 12 },
  lookupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lookupHeading: { flex: 1, gap: 2 },
  detailRow: { gap: 2 },
});
