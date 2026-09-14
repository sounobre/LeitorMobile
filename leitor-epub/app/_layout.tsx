import { Suspense, useEffect, useState } from 'react';
import { ReaderProvider } from '@epubjs-react-native/core';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrateDatabase } from '@/db/migrations';
import { getSession } from '@/services/sync';
import { darkTheme, lightTheme } from '@/theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider
          theme={theme}
          settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}
        >
          <Suspense fallback={<ActivityIndicator size="large" style={{ flex: 1 }} />}>
            <SQLiteProvider databaseName="leitor-epub.db" onInit={migrateDatabase} useSuspense>
              <ReaderProvider>
                <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                <AuthGate />
              </ReaderProvider>
            </SQLiteProvider>
          </Suspense>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  const db = useSQLiteContext();
  const router = useRouter();
  const segments = useSegments();
  const inLogin = segments[0] === 'login';
  const [lastAuthCheck, setLastAuthCheck] = useState<{
    db: unknown;
    inLogin: boolean;
    router: unknown;
  } | null>(null);
  const ready = lastAuthCheck?.db === db
    && lastAuthCheck.inLogin === inLogin
    && lastAuthCheck.router === router;

  useEffect(() => {
    let cancelled = false;
    void getSession(db).then((session) => {
      if (cancelled) return;
      setLastAuthCheck({ db, inLogin, router });
      if (!session && !inLogin) router.replace('/login');
      if (session && inLogin) router.replace('/');
    });
    return () => {
      cancelled = true;
    };
  }, [db, inLogin, router]);

  if (!ready) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="index" />
      <Stack.Screen name="cards" />
      <Stack.Screen name="reader/[id]" />
      <Stack.Screen name="backup" />
    </Stack>
  );
}
