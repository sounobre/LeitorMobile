import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text, useTheme } from 'react-native-paper';

export function EmptyLibrary({ onImport }: { onImport(): void }) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.icon, { backgroundColor: theme.colors.primaryContainer }]}>
        <Icon source="bookshelf" size={64} color={theme.colors.primary} />
      </View>
      <Text variant="headlineSmall" style={styles.title}>Sua biblioteca está vazia</Text>
      <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
        Importe um EPUB sem DRM para começar. Seus livros e anotações ficam somente neste aparelho.
      </Text>
      <Button mode="contained" icon="plus" onPress={onImport} contentStyle={styles.button}>
        Importar EPUB
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 24, textAlign: 'center', fontWeight: '700' },
  body: { marginTop: 10, textAlign: 'center', lineHeight: 22, maxWidth: 360 },
  button: { minHeight: 48 },
});
