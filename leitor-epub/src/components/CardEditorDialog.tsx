import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Dialog, Portal, TextInput } from 'react-native-paper';
import type { CardDraft, CardRecord } from '@/types/domain';

type Props = {
  visible: boolean;
  card: CardRecord | null;
  onDismiss(): void;
  onSave(draft: CardDraft): void;
};

function linesToText(values: string[]): string {
  return values.join('\n');
}

function textToLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

export function CardEditorDialog({ visible, card, onDismiss, onSave }: Props) {
  const [selectedText, setSelectedText] = useState(() => card?.selectedText ?? '');
  const [translation, setTranslation] = useState(() => card?.translation ?? '');
  const [pronunciation, setPronunciation] = useState(() => card?.pronunciation ?? '');
  const [partOfSpeech, setPartOfSpeech] = useState(() => card?.partOfSpeech ?? '');
  const [definition, setDefinition] = useState(() => card?.definition ?? '');
  const [background, setBackground] = useState(() => card?.background ?? '');
  const [examples, setExamples] = useState(() => linesToText(card?.examples ?? []));
  const [relatedWords, setRelatedWords] = useState(() => linesToText(card?.relatedWords ?? []));

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Editar card</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={{ gap: 12, paddingHorizontal: 24, paddingBottom: 4 }}>
            <TextInput
              label="Frente"
              value={selectedText}
              onChangeText={setSelectedText}
              mode="outlined"
              multiline
              maxLength={2_000}
            />
            <TextInput
              label="Verso / tradução"
              value={translation}
              onChangeText={setTranslation}
              mode="outlined"
              multiline
              maxLength={2_000}
            />
            <TextInput
              label="Pronúncia"
              value={pronunciation}
              onChangeText={setPronunciation}
              mode="outlined"
              maxLength={200}
            />
            <TextInput
              label="Classe gramatical"
              value={partOfSpeech}
              onChangeText={setPartOfSpeech}
              mode="outlined"
              maxLength={100}
            />
            <TextInput
              label="Definição"
              value={definition}
              onChangeText={setDefinition}
              mode="outlined"
              multiline
              maxLength={4_000}
            />
            <TextInput
              label="Contexto / background"
              value={background}
              onChangeText={setBackground}
              mode="outlined"
              multiline
              maxLength={4_000}
            />
            <TextInput
              label="Exemplos"
              value={examples}
              onChangeText={setExamples}
              mode="outlined"
              multiline
              placeholder="Um exemplo por linha"
              maxLength={6_000}
            />
            <TextInput
              label="Palavras relacionadas"
              value={relatedWords}
              onChangeText={setRelatedWords}
              mode="outlined"
              multiline
              placeholder="Uma palavra por linha"
              maxLength={2_000}
            />
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancelar</Button>
          <Button
            disabled={!selectedText.trim()}
            onPress={() => onSave({
              selectedText: selectedText.trim(),
              translation: translation.trim(),
              pronunciation: pronunciation.trim(),
              partOfSpeech: partOfSpeech.trim(),
              definition: definition.trim(),
              background: background.trim(),
              examples: textToLines(examples),
              relatedWords: textToLines(relatedWords),
            })}
          >
            Salvar
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
