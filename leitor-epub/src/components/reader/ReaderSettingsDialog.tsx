import { StyleSheet, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Button, Dialog, Portal, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import type { ReaderPreferences } from '@/types/domain';

type Props = {
  visible: boolean;
  preferences: ReaderPreferences;
  onChange(preferences: ReaderPreferences): void;
  onDismiss(): void;
};

export function ReaderSettingsDialog({ visible, preferences, onChange, onDismiss }: Props) {
  const theme = useTheme();
  const patch = (value: Partial<ReaderPreferences>) => onChange({ ...preferences, ...value });

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Configurações de leitura</Dialog.Title>
        <Dialog.ScrollArea>
          <View style={styles.content}>
            <Text variant="labelLarge">Modo de leitura</Text>
            <SegmentedButtons
              value={preferences.flow}
              onValueChange={(flow) => patch({ flow: flow as ReaderPreferences['flow'] })}
              buttons={[
                { value: 'paginated', label: 'Páginas', icon: 'book-open-page-variant' },
                { value: 'scrolled-doc', label: 'Rolagem', icon: 'format-align-justify' },
              ]}
            />
            <Text variant="labelLarge">Tema</Text>
            <SegmentedButtons
              value={preferences.theme}
              onValueChange={(themeName) => patch({ theme: themeName as ReaderPreferences['theme'] })}
              buttons={[
                { value: 'light', label: 'Claro' },
                { value: 'sepia', label: 'Sépia' },
                { value: 'dark', label: 'Escuro' },
              ]}
            />
            <View style={styles.rowBetween}>
              <Text variant="labelLarge">Tamanho da fonte</Text>
              <View style={styles.buttonRow}>
                <Button compact mode="outlined" onPress={() => patch({ fontSize: Math.max(70, preferences.fontSize - 10) })}>A−</Button>
                <Text>{preferences.fontSize}%</Text>
                <Button compact mode="outlined" onPress={() => patch({ fontSize: Math.min(180, preferences.fontSize + 10) })}>A+</Button>
              </View>
            </View>
            <Text variant="labelLarge">Espaçamento entre linhas: {preferences.lineHeight.toFixed(1)}</Text>
            <Slider
              minimumValue={1.1}
              maximumValue={2.2}
              step={0.1}
              value={preferences.lineHeight}
              minimumTrackTintColor={theme.colors.primary}
              onSlidingComplete={(lineHeight) => patch({ lineHeight })}
            />
            <Text variant="labelLarge">Margens: {preferences.margin}px</Text>
            <Slider
              minimumValue={4}
              maximumValue={48}
              step={4}
              value={preferences.margin}
              minimumTrackTintColor={theme.colors.primary}
              onSlidingComplete={(margin) => patch({ margin })}
            />
            <Text variant="labelLarge">Alinhamento</Text>
            <SegmentedButtons
              value={preferences.textAlign}
              onValueChange={(textAlign) => patch({ textAlign: textAlign as ReaderPreferences['textAlign'] })}
              buttons={[
                { value: 'left', label: 'Esquerda', icon: 'format-align-left' },
                { value: 'justify', label: 'Justificado', icon: 'format-align-justify' },
              ]}
            />
            <Text variant="labelLarge">Fonte</Text>
            <SegmentedButtons
              value={preferences.fontFamily}
              onValueChange={(fontFamily) => patch({ fontFamily })}
              buttons={[
                { value: 'serif', label: 'Serifada' },
                { value: 'sans-serif', label: 'Sem serifa' },
              ]}
            />
          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions><Button onPress={onDismiss}>Concluir</Button></Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, gap: 13 },
  rowBetween: { gap: 8 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
