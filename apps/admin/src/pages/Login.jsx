import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Alert, Field } from '../components/ui';
import logo from '../assets/logo.png';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <img className="login-logo" src={logo} alt="Kids club" />

        <Alert>{error}</Alert>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </Field>

        <Field label="Lozinka">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>

        <button className="btn block" type="submit" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? 'Prijava...' : 'Prijavi se'}
        </button>
      </form>
    </div>
  );
}
