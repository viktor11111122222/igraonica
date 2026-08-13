import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiRequest } from '../utils/api';

// Neradni dani koje admin oznaci u web panelu. Cita se sa GET /api/closed-days
// (bez prijave), pa obavestenje moze da se prikaze i pre nego sto se roditelj
// prijavi.
//
// Drzi se na jednom mestu, a ne po ekranu, jer isti podatak treba i Pocetnoj i
// Jelovniku i Rasporedu - inace bi tri ekrana zvala isti endpoint.

// Koliko cesto se proverava dok je aplikacija otvorena. Isto kao podesavanja:
// admin oznaci neradni dan dok roditelj drzi aplikaciju otvorenu.
const POLL_MS = 15000;

const ClosedDaysContext = createContext(null);

const PRAZNO = {};

export function ClosedDaysProvider({ children }) {
  const [byDate, setByDate] = useState(PRAZNO);
  const [loading, setLoading] = useState(true);
  // Poslednji odgovor kao tekst - bez ovoga bi svako povlacenje pravilo novi
  // objekat i ponovni render svih ekrana, i kada se nista nije promenilo.
  const lastRaw = useRef('');

  const load = useCallback(async () => {
    try {
      const data = await apiRequest('/closed-days');
      const raw = JSON.stringify(data.closedDays || []);
      if (raw !== lastRaw.current) {
        lastRaw.current = raw;
        const mapa = {};
        for (const dan of data.closedDays || []) mapa[dan.date] = dan;
        setByDate(mapa);
      }
    } catch {
      // Bez servera se drzi poslednje poznato stanje. Lazno "ne radimo" je
      // gore od nikakvog obavestenja, pa se pri gresci nista ne izmislja.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

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

  const value = useMemo(
    () => ({
      closedDays: byDate,
      loading,
      reload: load,
      // Vraca ceo podatak (razlog, napomena) ili null.
      closedOn: (dateKey) => byDate[dateKey] || null,
      isClosed: (dateKey) => !!byDate[dateKey],
    }),
    [byDate, loading, load]
  );

  return (
    <ClosedDaysContext.Provider value={value}>{children}</ClosedDaysContext.Provider>
  );
}

export function useClosedDays() {
  return (
    useContext(ClosedDaysContext) || {
      closedDays: PRAZNO,
      loading: false,
      reload: () => {},
      closedOn: () => null,
      isClosed: () => false,
    }
  );
}
