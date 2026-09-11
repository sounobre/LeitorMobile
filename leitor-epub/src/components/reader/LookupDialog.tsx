import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  IconButton,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';

type Props = {
  visible: boolean;
  kind: 'translation' | 'dictionary';
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  result: string;
  loading: boolean;
  error: string;
  cached?: boolean;
  onSourceLanguageChange(value: string): void;
  onTargetLanguageChange(value: string): void;
  onRetry(): void;
  onCopy(): void;
  onShare(): void;
  onSwapLanguages(): void;
  onOpenExternal(): void;
  onDismiss(): void;
};

export function LookupDialog(props: Props) {
  const isTranslation = props.kind === 'translation';
  return (
    <Portal>
      <Dialog visible={props.visible} onDismiss={props.onDismiss} style={styles.dialog}>
        <Dialog.Title>{isTranslation ? 'Tradução' : 'Dicionário'}</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyMedium" style={styles.source}>“{props.sourceText}”</Text>
            <View style={styles.languages}>
              <TextInput
                mode="outlined"
                dense
                label="Idioma"
                value={props.sourceLanguage}
                onChangeText={props.onSourceLanguageChange}
                autoCapitalize="none"
                style={styles.language}
              />
              {isTranslation ? (
                <>
                  <IconButton
                    icon="swap-horizontal"
                    onPress={props.onSwapLanguages}
                    accessibilityLabel="Inverter idiomas"
                  />
                  <TextInput
                    mode="outlined"
                    dense
                    label="Traduzir para"
                    value={props.targetLanguage}
                    onChangeText={props.onTargetLanguageChange}
                    autoCapitalize="none"
                    style={styles.language}
                  />
                </>
              ) : null}
            </View>
            {props.loading ? <ActivityIndicator size="large" style={styles.loader} /> : null}
            {props.error ? <Text variant="bodyMedium" style={styles.error}>{props.error}</Text> : null}
            {props.result ? (
              <View style={styles.result}>
                <Text variant="bodyLarge" selectable>{props.result}</Text>
                {props.cached ? <Text variant="labelSmall">Resultado salvo no aparelho</Text> : null}
              </View>
            ) : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={props.onOpenExternal}>Abrir externo</Button>
          {!props.loading && (isTranslation || props.error || !props.result) ? (
            <Button onPress={props.onRetry}>{props.result && isTranslation ? 'Traduzir' : 'Tentar'}</Button>
          ) : null}
          {props.result ? <Button onPress={props.onShare}>Compartilhar</Button> : null}
          {props.result ? <Button onPress={props.onCopy}>Copiar</Button> : null}
          <Button onPress={props.onDismiss}>Fechar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '84%' },
  content: { padding: 22, gap: 14 },
  source: { fontStyle: 'italic' },
  languages: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  language: { flex: 1 },
  loader: { marginVertical: 28 },
  error: { color: '#B3261E' },
  result: { gap: 10 },
});
