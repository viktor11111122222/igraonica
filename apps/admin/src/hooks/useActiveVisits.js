import { useCallback, useEffect, useState } from 'react';
import { get } from '../lib/api';

// Ko je trenutno u igraonici. Podatak treba na dva mesta: bocnoj traci za
// znacku sa brojem, i ekranu Prijave za tabelu. Dok su svaki za sebe anketirali
// `/visits/active`, na Prijavama su isla dva zahteva svakih 30 sekundi.
//
// Ovde je jedan tajmer i jedan zahtev, koliko god mesta ga slusalo. Uz to,
// `reload()` posle prijave deteta odmah osvezi i znacku - ranije je kasnila do
// pola minuta.

const INTERVAL_MS = 30000;

let stanje = { visits: [], count: 0, loading: true, error: '' };
const slusaoci = new Set();
let timer = null;

function objavi(novo) {
  stanje = novo;
  slusaoci.forEach((javi) => javi(stanje));
}

async function ucitaj() {
  try {
    const data = await get('/visits/active');
    const visits = data.visits || [];
    objavi({ visits, count: data.count ?? visits.length, loading: false, error: '' });
  } catch (e) {
    objavi({ ...stanje, loading: false, error: e.message });
  }
}

// Testovi dele modul, pa im treba cist pocetak.
export function __resetActiveVisits() {
  clearInterval(timer);
  timer = null;
  slusaoci.clear();
  stanje = { visits: [], count: 0, loading: true, error: '' };
}

export function useActiveVisits() {
  const [lokalno, setLokalno] = useState(stanje);

  useEffect(() => {
    slusaoci.add(setLokalno);
    setLokalno(stanje);

    // Prvi pretplatnik pali tajmer, poslednji ga gasi.
    if (slusaoci.size === 1) {
      ucitaj();
      timer = setInterval(ucitaj, INTERVAL_MS);
    }

    return () => {
      slusaoci.delete(setLokalno);
      if (slusaoci.size === 0) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);

  return { ...lokalno, reload: useCallback(ucitaj, []) };
}
