import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { formatDateTime } from '../lib/format';

// Zvono sa spiskom obavestenja.
//
// Stoji u zaglavlju svake stranice, jer se dogadjaji desavaju dok osoblje radi
// nesto drugo: roditelj otvori nalog, doda dete, ili drugi radnik prijavi dete
// na drugoj stanici.

// Znak uz vrstu dogadjaja - brze se prepoznaje nego iz samog teksta.
const ZNAK = {
  CHILD_CHECKED_IN: '→',
  CHILD_CHECKED_OUT: '←',
  PARENT_REGISTERED: '☺',
  CHILD_ADDED: '✦',
  CHILD_REMOVED: '✕',
  PACKAGE_ASSIGNED: '▦',
  HOURS_ADJUSTED: '±',
  DEBT_SETTLED: '✓',
};

// Koliko je proslo, grubo. Tacno vreme stoji u naslovu reda.
function pre(datum) {
  const minuta = Math.round((Date.now() - new Date(datum)) / 60000);
  if (minuta < 1) return 'upravo sada';
  if (minuta < 60) return `pre ${minuta} min`;
  const sati = Math.round(minuta / 60);
  if (sati < 24) return `pre ${sati} h`;
  const dana = Math.round(sati / 24);
  return dana === 1 ? 'juce' : `pre ${dana} dana`;
}

export default function Notifications() {
  const { notifications, unreadCount, loading, error, oznaciProcitano, oznaciSve } =
    useNotifications();
  const [otvoren, setOtvoren] = useState(false);
  const okvir = useRef(null);

  // Klik van panela i Escape ga zatvaraju - panel visi nad stranicom, pa mora
  // da se sklanja bez trazenja dugmeta.
  useEffect(() => {
    if (!otvoren) return undefined;

    function naKlik(e) {
      if (!okvir.current?.contains(e.target)) setOtvoren(false);
    }
    function naTaster(e) {
      if (e.key === 'Escape') setOtvoren(false);
    }

    document.addEventListener('mousedown', naKlik);
    document.addEventListener('keydown', naTaster);
    return () => {
      document.removeEventListener('mousedown', naKlik);
      document.removeEventListener('keydown', naTaster);
    };
  }, [otvoren]);

  return (
    <div className="zvono-okvir" ref={okvir}>
      <button
        type="button"
        className="zvono"
        onClick={() => setOtvoren((o) => !o)}
        aria-expanded={otvoren}
        aria-label={
          unreadCount > 0 ? `Obavestenja, ${unreadCount} neprocitano` : 'Obavestenja'
        }
      >
        {/* Zvonce je crtez, ne znak iz fonta: jedini zvonci u Unicode-u su ili
            emoji (u boji, ne slusaju CSS) ili APL simbol koji se crta kao lampa.
            Popunjen je da drzi istu tezinu kao dingbati u bocnoj traci. */}
        <svg className="zvono-ikona" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3c-.55 0-1 .45-1 1v.6C8.16 5.09 6 7.55 6 10.5v3.2l-1.4 2.1A.8.8 0 0 0 5.27 17h13.46a.8.8 0 0 0 .67-1.2L18 13.7v-3.2c0-2.95-2.16-5.41-5-5.9V4c0-.55-.45-1-1-1z" />
          <path d="M10 18.5a2 2 0 0 0 4 0h-4z" />
        </svg>
        {unreadCount > 0 && <span className="zvono-broj">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {otvoren && (
        <div className="zvono-panel" role="dialog" aria-label="Obavestenja">
          <div className="zvono-glava">
            <strong>Obavestenja</strong>
            {unreadCount > 0 && (
              <button type="button" className="btn ghost sm" onClick={oznaciSve}>
                Oznaci sve
              </button>
            )}
          </div>

          {error && <div className="alert error">{error}</div>}

          {loading ? (
            <div className="zvono-prazno">Ucitava se...</div>
          ) : !notifications.length ? (
            <div className="zvono-prazno">Nema obavestenja.</div>
          ) : (
            <ul className="zvono-spisak">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`zvono-red ${n.readAt ? '' : 'novo'}`}
                    onClick={() => oznaciProcitano(n.id)}
                    title={formatDateTime(n.createdAt)}
                  >
                    <span className="zvono-znak" aria-hidden="true">{ZNAK[n.type] || '•'}</span>
                    <span className="zvono-tekst">
                      <span className="zvono-naslov">{n.title}</span>
                      <span className="zvono-telo">{n.body}</span>
                      <span className="zvono-kada">{pre(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="zvono-tacka" aria-label="neprocitano" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
