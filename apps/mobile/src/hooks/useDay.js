import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { todayKey } from '../utils/date';

// "Danas" se racuna u renderu, pa ekran koji se u medjuvremenu ne re-renderuje
// ostaje na jucerasnjem datumu - aplikacija otvorena preko ponoci i dalje
// pokazuje zutu tackicu na jucerasnjem danu. Hook zato sam osvezava kljuc:
// tajmerom na ponoc i kad se aplikacija vrati iz pozadine (tajmeri u pozadini
// nisu pouzdani, pa su potrebna oba).
export function useToday() {
  const [key, setKey] = useState(todayKey);

  useEffect(() => {
    let timer;

    function scheduleNextMidnight() {
      clearTimeout(timer);
      const now = new Date();
      // Sekunda posle ponoci - da se ne okine tacno na granici.
      const next = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1
      );
      timer = setTimeout(sync, next - now);
    }

    // setKey sa istom vrednoscu React preskace, pa ovo ne pravi suvisne rendere.
    function sync() {
      setKey(todayKey());
      scheduleNextMidnight();
    }

    scheduleNextMidnight();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  // Traka se vidi samo kada je ekran fokusiran, pa je ulazak u tab poslednja
  // i najpouzdanija tacka za proveru: cak i ako tajmer zakaze (JS uspavan u
  // pozadini), datum je tacan u trenutku kada ga korisnik gleda.
  useFocusEffect(
    useCallback(() => {
      setKey(todayKey());
    }, [])
  );

  return key;
}

// Danasnji dan + izabrani dan iz trake. Jelovnik i Raspored koriste isti hook
// da bi im se traka ponasala identicno.
export function useDaySelection() {
  const today = useToday();
  const [selected, setSelected] = useState(today);
  const prevToday = useRef(today);

  useEffect(() => {
    if (prevToday.current === today) return;
    // Ako je korisnik ostao na "danas", selekcija prati prelazak u novi dan.
    // Ako je rucno izabrao neki drugi datum, taj izbor se ne dira.
    setSelected((current) => (current === prevToday.current ? today : current));
    prevToday.current = today;
  }, [today]);

  return { today, selected, setSelected };
}
