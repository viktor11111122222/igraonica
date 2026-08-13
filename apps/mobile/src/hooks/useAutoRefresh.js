import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Koliko cesto se podaci povlace dok korisnik gleda ekran.
export const REFRESH_INTERVAL = 15000;

// Jelovnik, raspored i obavestenja se menjaju iz admina dok je aplikacija
// otvorena, pa nije dovoljno ucitati ih jednom pri ulasku u ekran - roditelj
// bi gledao stari podatak dok sam ne povuce da osvezi.
//
// Osvezavanje se okida na tri mesta, jer nijedno samo za sebe nije dovoljno:
//   - pri ulasku u ekran (podatak promenjen dok si bio na drugom tabu),
//   - na `interval` dok stojis na ekranu (promena bas sada u adminu),
//   - kad se aplikacija vrati iz pozadine (tajmeri u pozadini nisu pouzdani).
//
// Tajmer zivi samo dok je ekran fokusiran - useFocusEffect ga cisti pri
// izlasku, pa ekrani u pozadini ne trose ni mrezu ni bateriju.
//
// `load` mora biti stabilan (useCallback). Kada zavisi od necega sto se menja
// (npr. izabrani dan), ta zavisnost ide u njegov dependency niz - promena tada
// odmah povlaci nove podatke, umesto da se ceka sledeci tik tajmera.
export function useAutoRefresh(load, interval = REFRESH_INTERVAL) {
  useFocusEffect(
    useCallback(() => {
      load();

      const timer = setInterval(load, interval);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') load();
      });

      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [load, interval])
  );
}

export default useAutoRefresh;
