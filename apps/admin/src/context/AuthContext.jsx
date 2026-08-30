import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { get, post, setToken, getToken, onSessionExpired, ApiError } from '../lib/api';

const AuthContext = createContext(null);

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Bez tokena nema sta da se ceka, pa se ni ne ulazi u stanje ucitavanja -
  // ranije je prvi render uvek bio spiner koji odmah nestane.
  const [loading, setLoading] = useState(() => !!getToken());

  // Token zivi u localStorage, ali izvor istine o korisniku je backend -
  // rola je mogla da se promeni od poslednje prijave.
  useEffect(() => {
    if (!getToken()) return;

    get('/auth/me')
      .then(({ user }) => {
        if (ADMIN_ROLES.includes(user.role)) setUser(user);
        else setToken(null);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  // Kada bilo koji poziv naidje na istekao token, korisnik se vraca na prijavu
  // sam od sebe - umesto da gleda "Greska 401" na svakoj stranici.
  useEffect(() => onSessionExpired(() => setUser(null)), []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await post('/auth/login', { email, password });

    // Roditeljski nalozi ne smeju u admin panel. Backend bi ih ionako odbio na
    // svakoj ruti sa 403, ali bolje je odbiti odmah i sa jasnom porukom.
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ApiError('Ovaj nalog nema administratorska prava.', 403);
    }

    setToken(token);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
