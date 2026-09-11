import { Dialog, List, Portal } from 'react-native-paper';
import type { SelectionPayload } from '@/types/domain';

type Props = {
  visible: boolean;
  selection: SelectionPayload | null;
  onCopy(): void;
  onShare(): void;
  onSearchBook(): void;
  onSearchWeb(): void;
  onTranslateExternal(): void;
  onDictionaryExternal(): void;
  onDismiss(): void;
};

export function MoreActionsDialog(props: Props) {
  return (
    <Portal>
      <Dialog visible={props.visible} onDismiss={props.onDismiss}>
        <Dialog.Title>Mais ações</Dialog.Title>
        <Dialog.Content>
          <List.Item title="Copiar" left={(p) => <List.Icon {...p} icon="content-copy" />} onPress={props.onCopy} />
          <List.Item title="Compartilhar" left={(p) => <List.Icon {...p} icon="share-variant" />} onPress={props.onShare} />
          <List.Item title="Pesquisar no livro" left={(p) => <List.Icon {...p} icon="book-search-outline" />} onPress={props.onSearchBook} />
          <List.Item title="Pesquisar na web" left={(p) => <List.Icon {...p} icon="web" />} onPress={props.onSearchWeb} />
          <List.Item title="Abrir tradutor externo" left={(p) => <List.Icon {...p} icon="translate" />} onPress={props.onTranslateExternal} />
          <List.Item title="Abrir dicionário externo" left={(p) => <List.Icon {...p} icon="book-alphabet" />} onPress={props.onDictionaryExternal} />
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}
