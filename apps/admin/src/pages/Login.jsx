import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRememberedEmail } from '../lib/api';
import { Alert, Field } from '../components/ui';
import logo from '../assets/logo.png';

export default function Login() {
  const { login } = useAuth();
  // Ako je prosli put bila kvacica, email je zapamcen - polje krece popunjeno
  // i kvacica ostaje ukljucena, pa se prijava svodi na lozinku.
  const zapamcenEmail = getRememberedEmail();
  const [email, setEmail] = useState(zapamcenEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(!!zapamcenEmail);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password, rememberMe);
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

        {/* Racunar na recepciji deli vise ljudi, pa kvacica nije podrazumevana:
            bez nje prijava traje dok je kartica otvorena. */}
        <label className="check">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Zapamti me na ovom racunaru
        </label>

        <button className="btn block" type="submit" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? 'Prijava...' : 'Prijavi se'}
        </button>
      </form>
    </div>
  );
}
