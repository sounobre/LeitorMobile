import { useState, type FormEvent } from 'react';
import { login, type User } from './api';

type Props = {
  onLoggedIn: (user: User) => void;
};

export default function LoginView({ onLoggedIn }: Props) {
  const [email, setEmail] = useState('voce@exemplo.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      onLoggedIn(await login(email, password));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand login-brand"><span className="brand-mark">⌘</span><span>Leitor</span></div>
        <p className="eyebrow">BEM-VINDO DE VOLTA</p>
        <h1>Continue sua leitura.</h1>
        <p className="login-intro">Entre para acessar sua biblioteca, progresso e cards em qualquer dispositivo.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Senha<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button className="primary-button login-button" disabled={loading} type="submit">{loading ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <p className="login-note">A conta inicial é definida pelas variáveis `APP_AUTH_EMAIL` e `APP_AUTH_PASSWORD` do backend.</p>
      </section>
    </main>
  );
}
