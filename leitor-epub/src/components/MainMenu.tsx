import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Appbar, Menu } from 'react-native-paper';
import { logout } from '@/services/sync';

type MainSection = 'books' | 'cards';

type Props = {
  current: MainSection;
  onSync?(): Promise<void>;
};

export function MainMenu({ current, onSync }: Props) {
  const db = useSQLiteContext();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const goTo = (path: '/' | '/cards' | '/backup') => {
    setVisible(false);
    router.replace(path);
  };

  const handleLogout = async () => {
    setVisible(false);
    await logout(db);
    router.replace('/login');
  };

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={(
        <Appbar.Action
          icon="menu"
          onPress={() => setVisible(true)}
          accessibilityLabel="Abrir menu principal"
        />
      )}
    >
      <Menu.Item
        leadingIcon="book-open-page-variant"
        title="Livro"
        disabled={current === 'books'}
        onPress={() => goTo('/')}
      />
      <Menu.Item
        leadingIcon="cards-outline"
        title="Cards"
        disabled={current === 'cards'}
        onPress={() => goTo('/cards')}
      />
      <Menu.Item
        leadingIcon="backup-restore"
        title="Backup e restauração"
        onPress={() => goTo('/backup')}
      />
      <Menu.Item
        leadingIcon="cloud-sync-outline"
        title="Sincronizar agora"
        disabled={!onSync}
        onPress={() => {
          setVisible(false);
          if (onSync) void onSync();
        }}
      />
      <Menu.Item
        leadingIcon="logout"
        title="Sair"
        onPress={() => void handleLogout()}
      />
    </Menu>
  );
}