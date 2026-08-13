import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiRequest } from '../utils/api';

// Podesavanja koja admin menja kroz web panel, a aplikacija ih cita sa
// GET /api/settings/public (bez prijave). Backend uvek vrati sve kljuceve,
// pa su ove vrednosti samo osigurac ako server nije dostupan.
const FALLBACK = {
  club_name: 'Kids club',
  club_phone: '',
  club_email: '',
  club_address: '',
  working_hours: '',
  club_latitude: '',
  club_longitude: '',
  mobile_announcement: '',
  announcement_tabs: 'home',
  mobile_tab_menu: 'true',
  mobile_tab_schedule: 'true',
  mobile_tab_gallery: 'true',
};

// Koliko cesto se proverava dok je aplikacija otvorena. Admin promeni nesto na
// racunaru dok roditelj drzi aplikaciju otvorenu - bez ovoga bi video staro
// stanje sve dok je ne izadje iz nje.
const POLL_MS = 15000;

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);
  // Cuva se poslednji odgovor kao tekst, da se stanje ne menja i ne izaziva
  // ponovni render kada se nista nije promenilo.
  const lastRaw = useRef('');

  const load = useCallback(async () => {
    try {
      const data = await apiRequest('/settings/public');
      const raw = JSON.stringify(data.settings || {});
      if (raw !== lastRaw.current) {
        lastRaw.current = raw;
        setSettings({ ...FALLBACK, ...(data.settings || {}) });
      }
    } catch {
      // Bez servera radimo sa poslednjim poznatim vrednostima - aplikacija ne
      // sme da ostane prazna zbog podesavanja.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Tri okidaca: odmah po pokretanju, na svakih POLL_MS dok je aplikacija u
    // prvom planu, i pri svakom povratku iz pozadine.
    let timer = setInterval(load, POLL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      clearInterval(timer);
      if (state === 'active') {
        load();
        timer = setInterval(load, POLL_MS);
      }
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [load]);

  return (
    <SettingsContext.Provider value={{ settings, loading, reload: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext) || { settings: FALLBACK, loading: false, reload: () => {} };
}

// Vrednosti stizu kao tekst, jer su u bazi kolona tipa String.
export function isOn(value) {
  return value === 'true';
}
