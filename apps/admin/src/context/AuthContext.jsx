import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  get,
  post,
  del,
  setToken,
  getToken,
  setRememberedEmail,
  onSessionExpired,
  ApiError,
} from '../lib/api';

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

  // `rememberMe` ide i na backend (odredjuje rok tokena) i u lib/api
  // (odredjuje da li token prezivi zatvaranje pretrazivaca). Oba moraju da se
  // slazu: trajno skladiste sa kratkim tokenom samo bi produzilo cekanje do
  // iste odjave.
  const login = useCallback(async (email, password, rememberMe = false) => {
    const { token, user } = await post('/auth/login', { email, password, rememberMe });

    // Roditeljski nalozi ne smeju u admin panel. Backend bi ih ionako odbio na
    // svakoj ruti sa 403, ali bolje je odbiti odmah i sa jasnom porukom.
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ApiError('Ovaj nalog nema administratorska prava.', 403);
    }

    setToken(token, { trajno: rememberMe });
    setRememberedEmail(rememberMe ? email : '');
    setUser(user);
  }, []);

  // Odjava brise token iz oba skladista, ali NE i zapamceni email: poenta
  // "Zapamti me" je da se sledeci put ne kuca sve iznova.
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Brisanje sopstvenog naloga. Lozinka ide uz zahtev jer je radnja nepovratna,
  // a token je mogao da ostane otvoren na tudjem racunaru. Ako server odbije,
  // greska se propusta pozivaocu i korisnik ostaje prijavljen.
  const deleteAccount = useCallback(
    async (password) => {
      await del('/auth/me', { password });
      logout();
    },
    [logout]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
