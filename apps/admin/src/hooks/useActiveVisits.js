import { useSyncExternalStore } from 'react';
import { get } from '../lib/api';

// Ko je trenutno u igraonici. Podatak treba na dva mesta: bocnoj traci za
// znacku sa brojem, i ekranu Prijave za tabelu. Dok su svaki za sebe anketirali
// `/visits/active`, na Prijavama su isla dva zahteva svakih 30 sekundi.
//
// Ovde je jedan tajmer i jedan zahtev, koliko god mesta ga slusalo. Uz to,
// `reload()` posle prijave deteta odmah osvezi i znacku - ranije je kasnila do
// pola minuta.
//
// Radi kao spoljni izvor (`useSyncExternalStore`), a ne kao stanje koje se
// prepisuje iz effect-a: podatak zivi van React-a, pa mu je to i prirodan oblik.

const INTERVAL_MS = 30000;

let stanje = { visits: [], count: 0, loading: true, error: '' };
const slusaoci = new Set();
let timer = null;

function objavi(novo) {
  stanje = novo;
  slusaoci.forEach((javi) => javi());
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

// Prvi pretplatnik pali tajmer, poslednji ga gasi.
function pretplati(javi) {
  slusaoci.add(javi);
  if (slusaoci.size === 1) {
    ucitaj();
    timer = setInterval(ucitaj, INTERVAL_MS);
  }

  return () => {
    slusaoci.delete(javi);
    if (slusaoci.size === 0) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// Snimak mora da bude ista referenca dok se nista ne menja, inace bi React
// renderovao u krug. `objavi` zato pravi nov objekat samo kada ima novog
// podatka.
const snimak = () => stanje;

// Testovi dele modul, pa im treba cist pocetak.
export function __resetActiveVisits() {
  clearInterval(timer);
  timer = null;
  slusaoci.clear();
  stanje = { visits: [], count: 0, loading: true, error: '' };
}

export function useActiveVisits() {
  const trenutno = useSyncExternalStore(pretplati, snimak, snimak);
  return { ...trenutno, reload: ucitaj };
}
