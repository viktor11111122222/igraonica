import { useSyncExternalStore } from 'react';
import { get, patch, post } from '../lib/api';

// Obavestenja o dogadjajima u igraonici.
//
// Isti oblik kao `useActiveVisits`: podatak zivi van React-a, jedan tajmer i
// jedan zahtev koliko god mesta ga slusalo. Zvono stoji u zaglavlju svake
// stranice, pa bi svako za sebe znacilo zahtev po stranici.

const INTERVAL_MS = 30000;

let stanje = { notifications: [], unreadCount: 0, loading: true, error: '' };
const slusaoci = new Set();
let timer = null;

function objavi(novo) {
  stanje = novo;
  slusaoci.forEach((javi) => javi());
}

async function ucitaj() {
  try {
    const data = await get('/notifications?limit=20');
    objavi({
      notifications: data.notifications || [],
      unreadCount: data.unreadCount || 0,
      loading: false,
      error: '',
    });
  } catch (e) {
    objavi({ ...stanje, loading: false, error: e.message });
  }
}

// Oznacavanje se odmah vidi na ekranu, pa se ne ceka odgovor servera. Ako
// zahtev padne, sledece ucitavanje vrati pravo stanje.
async function oznaciProcitano(id) {
  const bilo = stanje.notifications.find((n) => n.id === id);
  if (!bilo || bilo.readAt) return;

  objavi({
    ...stanje,
    notifications: stanje.notifications.map((n) =>
      n.id === id ? { ...n, readAt: new Date().toISOString() } : n
    ),
    unreadCount: Math.max(0, stanje.unreadCount - 1),
  });

  try {
    await patch(`/notifications/${id}/read`);
  } catch {
    ucitaj();
  }
}

async function oznaciSve() {
  if (stanje.unreadCount === 0) return;

  const sada = new Date().toISOString();
  objavi({
    ...stanje,
    notifications: stanje.notifications.map((n) => (n.readAt ? n : { ...n, readAt: sada })),
    unreadCount: 0,
  });

  try {
    await post('/notifications/read-all');
  } catch {
    ucitaj();
  }
}

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

const snimak = () => stanje;

// Testovi dele modul, pa im treba cist pocetak.
export function __resetNotifications() {
  clearInterval(timer);
  timer = null;
  slusaoci.clear();
  stanje = { notifications: [], unreadCount: 0, loading: true, error: '' };
}

export function useNotifications() {
  const trenutno = useSyncExternalStore(pretplati, snimak, snimak);
  return { ...trenutno, reload: ucitaj, oznaciProcitano, oznaciSve };
}
