import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { DEFAULT_API_BASE_URL, login, syncLibrary } from '@/services/sync';

export default function LoginScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState('voce@exemplo.com');
  const [password, setPassword] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      await login(db, email.trim(), password, apiBaseUrl.trim());
      try {
        await syncLibrary(db);
      } catch {
        // O login continua válido mesmo quando a sincronização inicial está offline.
      }
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>Entrar no Leitor</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Use a mesma conta do leitor web para sincronizar sua biblioteca e seus cards.
        </Text>
        <TextInput label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <TextInput label="Senha" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
        <TextInput label="Endereço da API" value={apiBaseUrl} onChangeText={setApiBaseUrl} autoCapitalize="none" autoCorrect={false} style={styles.input} />
        <Text variant="bodySmall" style={styles.hint}>
          No celular físico, use o IP do computador, por exemplo http://192.168.0.103:8080/api.
        </Text>
        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
        <Button mode="contained" onPress={() => void handleLogin()} loading={loading} disabled={loading || !email.trim() || !password} style={styles.button}>
          Entrar e sincronizar
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  content: { padding: 24, gap: 10 },
  title: { marginBottom: 4, fontWeight: '700' },
  subtitle: { marginBottom: 14, lineHeight: 21, opacity: 0.76 },
  input: { marginBottom: 2 },
  hint: { opacity: 0.68, lineHeight: 18 },
  button: { marginTop: 8 },
});
