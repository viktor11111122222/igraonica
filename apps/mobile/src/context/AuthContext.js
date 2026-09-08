import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import * as storage from '../utils/storage';
import { registrujUredjaj } from '../utils/push';
import { apiRequest, onSessionExpired } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const token = await storage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const data = await apiRequest('/auth/me');
      setUser(data.user);
      // Token uredjaja se salje samo ako se promenio (npr. posle reinstalacije).
      registrujUredjaj(data.user.pushToken);
    } catch {
      await storage.deleteItem('token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Ucitavanje naloga pri pokretanju je posao effect-a: podatak dolazi iz
    // Keychain-a i sa servera, dakle spolja. Pravilo cilja izvedeno stanje, a
    // ovde se stanje menja tek kad odgovor stigne.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();
  }, [loadUser]);

  // Kada bilo koji poziv naidje na istekao token, aplikacija se sama vrati na
  // prijavu umesto da svaki ekran pise gresku bez izlaza.
  useEffect(() => onSessionExpired(() => setUser(null)), []);

  async function login(email, password) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    await storage.setItem('token', data.token);
    setUser(data.user);
    registrujUredjaj(data.user.pushToken);
    return data;
  }

  async function register(fields) {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: fields,
    });
    await storage.setItem('token', data.token);
    setUser(data.user);
    return data;
  }

  async function logout() {
    await storage.deleteItem('token');
    setUser(null);
  }

  // Brisanje sopstvenog naloga. Obe prodavnice traze da nalog napravljen u
  // aplikaciji moze i da se obrise iz nje, bez pisanja podrsci. Lozinka ide uz
  // zahtev jer je radnja nepovratna, a telefon zna da ostane otkljucan u tudjim
  // rukama.
  async function deleteAccount(password) {
    await apiRequest('/auth/me', { method: 'DELETE', body: { password } });
    await storage.deleteItem('token');
    setUser(null);
  }

  async function updateProfile(fields) {
    const data = await apiRequest('/auth/profile', {
      method: 'PATCH',
      body: fields,
    });
    setUser(data.user);
    return data;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateProfile, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
}
