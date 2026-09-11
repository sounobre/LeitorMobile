import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { HIGHLIGHT_COLORS, type AnnotationRecord, type SelectionPayload } from '@/types/domain';

type Props = {
  visible: boolean;
  selection: SelectionPayload | null;
  annotation: AnnotationRecord | null;
  onDismiss(): void;
  onSave(color: string, note: string): void;
  onDelete?(): void;
};

export function QuoteDialog({ visible, selection, annotation, onDismiss, onSave, onDelete }: Props) {
  const theme = useTheme();
  const [color, setColor] = useState<string>(annotation?.color ?? HIGHLIGHT_COLORS[0]);
  const [note, setNote] = useState(annotation?.note ?? '');

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{annotation ? 'Editar citação' : 'Salvar citação'}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <Text variant="bodyMedium" numberOfLines={4} style={styles.quote}>
            “{annotation?.selectedText ?? selection?.text ?? ''}”
          </Text>
          <Text variant="labelLarge">Cor do destaque</Text>
          <View style={styles.colors}>
            {HIGHLIGHT_COLORS.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="radio"
                accessibilityState={{ checked: color === item }}
                accessibilityLabel={`Cor ${item}`}
                onPress={() => setColor(item)}
                style={[
                  styles.color,
                  { backgroundColor: item },
                  color === item && { borderColor: theme.colors.primary, borderWidth: 3 },
                ]}
              />
            ))}
          </View>
          <TextInput
            label="Nota opcional"
            value={note}
            onChangeText={setNote}
            mode="outlined"
            multiline
            maxLength={4_000}
          />
        </Dialog.Content>
        <Dialog.Actions>
          {annotation && onDelete ? <Button textColor={theme.colors.error} onPress={onDelete}>Excluir</Button> : null}
          <Button onPress={onDismiss}>Cancelar</Button>
          <Button onPress={() => onSave(color, note.trim())}>Salvar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  quote: { fontStyle: 'italic', lineHeight: 21 },
  colors: { flexDirection: 'row', gap: 12 },
  color: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#777' },
});
