import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Appbar, Button, Card, Icon, Snackbar, Text, useTheme } from 'react-native-paper';
import { createAndShareBackup, pickAndValidateBackup } from '@/services/backup';

export default function BackupScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
  const [message, setMessage] = useState('');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const exportBackup = async () => {
    setBusy('export');
    try {
      await createAndShareBackup(db);
      setMessage('Backup criado. Escolha onde deseja salvá-lo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar o backup.');
    } finally {
      setBusy(null);
    }
  };

  const selectAndConfirmRestore = async () => {
    setBusy('restore');
    try {
      const prepared = await pickAndValidateBackup(db);
      if (!prepared) return;
      setBusy(null);
      Alert.alert(
        'Substituir biblioteca?',
        `O backup foi validado e contém ${prepared.bookCount} livro(s). Agora a biblioteca atual pode ser substituída.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setBusy('restore');
                try {
                  const restored = await prepared.restore();
                  setMessage(`${restored.books.length} livro(s) restaurado(s) com sucesso.`);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar o backup.');
                } finally {
                  setBusy(null);
                }
              })();
            },
          },
        ],
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível validar o backup.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={handleBack} />
        <Appbar.Content title="Backup e restauração" />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        <Card mode="contained">
          <Card.Content style={styles.cardContent}>
            <Icon source="archive-arrow-up-outline" size={44} color={theme.colors.primary} />
            <Text variant="titleLarge">Criar backup completo</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Inclui EPUBs, capas, progresso, marcadores, citações, cards, notas e preferências. O arquivo não é criptografado.
            </Text>
            <Button mode="contained" icon="share-variant" loading={busy === 'export'} disabled={busy !== null} onPress={exportBackup}>
              Criar e compartilhar
            </Button>
          </Card.Content>
        </Card>
        <Card mode="contained">
          <Card.Content style={styles.cardContent}>
            <Icon source="archive-arrow-down-outline" size={44} color={theme.colors.primary} />
            <Text variant="titleLarge">Restaurar backup</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              O arquivo é verificado integralmente antes que a biblioteca atual seja substituída.
            </Text>
            <Button mode="outlined" icon="backup-restore" loading={busy === 'restore'} disabled={busy !== null} onPress={() => void selectAndConfirmRestore()}>
              Selecionar backup
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={5000}>{message}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 18, gap: 16 },
  cardContent: { paddingVertical: 12, gap: 14 },
});
