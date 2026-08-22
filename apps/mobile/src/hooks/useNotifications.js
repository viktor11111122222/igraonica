import { useCallback, useState } from 'react';
import { apiRequest } from '../utils/api';
import { useAutoRefresh } from './useAutoRefresh';

// Obavestenja roditelju: kada dete udje u igraonicu, kada izadje, kada dobije
// paket ili kada mu osoblje ispravi sate.
//
// Osvezava se dok je ekran otvoren, kao i ostali podaci - roditelj cesto drzi
// aplikaciju otvorenu bas dok se dete prijavljuje.
// `samoBroj` je za zvono na pocetnom ekranu: tamo treba samo znacka, pa nema
// razloga povlaciti ceo spisak svakih 15 sekundi.
export function useNotifications({ samoBroj = false } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      if (samoBroj) {
        const data = await apiRequest('/notifications/unread-count');
        setUnreadCount(data.unreadCount || 0);
        return;
      }

      const data = await apiRequest('/notifications?limit=30');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Bez servera se drzi poslednje poznato stanje - prazna lista bi
      // izgledala kao da obavestenja nema.
    } finally {
      setLoading(false);
    }
  }, [samoBroj]);

  useAutoRefresh(load);

  // Oznacavanje se odmah vidi; ako zahtev padne, sledece ucitavanje vrati
  // pravo stanje.
  const oznaciProcitano = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((n) => Math.max(0, n - 1));

    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      load();
    }
  }, [load]);

  const oznaciSve = useCallback(async () => {
    const sada = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: sada })));
    setUnreadCount(0);

    try {
      await apiRequest('/notifications/read-all', { method: 'POST' });
    } catch {
      load();
    }
  }, [load]);

  return { notifications, unreadCount, loading, reload: load, oznaciProcitano, oznaciSve };
}

export default useNotifications;
