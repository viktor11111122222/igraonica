import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Skeniranje QR koda kamerom.
//
// Do sada je ekran za prijave primao kod samo preko tastature: hardverski citac
// koji "ukuca" kod, ili rucno kucanje. Radnik sa telefonom ili tabletom nije
// imao cime da skenira, pa je ceo tok u praksi zavisio od dodatnog uredjaja.
//
// Rucni unos ostaje kao rezerva - kamera moze da zakaze (nema dozvole, los
// telefon, ekran roditelja pretaman), a prijava tada ne sme da stane.

const READER_ID = 'qr-reader';

// Izabrana kamera se pamti po uredjaju. Na recepciji je to najcesce USB kamera
// uperena u pult, a ne ugradjena - i taj izbor ne treba praviti svaki put.
const IZBOR_KAMERE = 'igraonica_admin_kamera';

// Deo kadra koji se gleda. Fiksnih 220px je pucalo na uskim telefonima -
// html5-qrcode odbija okvir siri od samog videa, pa se skener nije ni pokrenuo.
const QRBOX_RATIO = 0.7;

function qrbox(sirinaKadra, visinaKadra) {
  const strana = Math.floor(Math.min(sirinaKadra, visinaKadra) * QRBOX_RATIO);
  return { width: strana, height: strana };
}

// Zasto kamere nema pre nego sto se uopste proba.
//
// Bitno za telefone: iOS Safari ne postavlja `navigator.mediaDevices` ako
// stranica nije na HTTPS-u sa sertifikatom kojem uredjaj veruje. Samoprotpisan
// sertifikat koji je korisnik "propustio" kroz upozorenje se ne racuna. Tada
// nema nikakve greske pri pokretanju - objekta prosto nema, pa je bez ove
// provere ispadalo da skener cuti bez razloga.
function stanjeKamere() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return typeof window !== 'undefined' && window.isSecureContext === false
      ? 'nesigurno'
      : 'nedostupno';
  }
  return 'ok';
}

const PORUKE = {
  nesigurno:
    'Kamera radi samo preko HTTPS-a. Otvorite admin na https:// adresi, ili unesite kod rucno.',
  nedostupno:
    'Pregledac ne nudi kameru. Na iPhone-u Safari je sakrije dok sertifikat stranice nije od poverenja. Unesite kod rucno.',
  NotAllowedError:
    'Pristup kameri nije dozvoljen. Dozvolite ga u pregledacu ili unesite kod rucno.',
  NotFoundError: 'Na ovom uredjaju nema kamere. Unesite kod rucno.',
  NotReadableError:
    'Kameru drzi druga aplikacija. Zatvorite je pa probajte ponovo, ili unesite kod rucno.',
  OverconstrainedError: 'Izabrana kamera nije dostupna. Izaberite drugu ili unesite kod rucno.',
  default: 'Kamera nije dostupna. Unesite kod rucno.',
};

// Na telefonu treba zadnja kamera; naziv je jedini nagovestaj koji pregledac da.
function podrazumevana(kamere) {
  const zadnja = kamere.find((k) => /back|rear|environment|zadnj/i.test(k.label || ''));
  return (zadnja || kamere[0]).id;
}

export default function QrScanner({ active, onScan, onError }) {
  const scannerRef = useRef(null);
  const [status, setStatus] = useState('starting');
  const [message, setMessage] = useState('');
  const [kamere, setKamere] = useState([]);

  // Rucni izbor je jedina stvar koja sme da restartuje kameru osim paljenja i
  // gasenja - zato je on zavisnost effect-a, a ne id kamere koja trenutno radi.
  // Pamti se po uredjaju: na recepciji je to USB kamera uperena u pult.
  const [rucniIzbor, setRucniIzbor] = useState(() =>
    typeof localStorage === 'undefined' ? null : localStorage.getItem(IZBOR_KAMERE)
  );
  const [aktivna, setAktivna] = useState(null);

  // U ref-u, da promena funkcije ne restartuje kameru usred rada. Sinhronizuje
  // se u layout effect-u, ne u renderu: prekinut render bi inace ostavio ref sa
  // vrednoscu iz prolaza koji nikad nije prikazan.
  const onScanRef = useRef(onScan);
  useLayoutEffect(() => {
    onScanRef.current = onScan;
  });

  const javiGresku = useCallback(
    (tekst) => {
      setStatus('error');
      setMessage(tekst);
      onError?.(tekst);
    },
    [onError]
  );

  useEffect(() => {
    if (!active) return undefined;

    let scanner;
    let stopped = false;

    // Kod stoji pred objektivom i cita se vise puta u sekundi. Jedno paljenje
    // kamere sme da da tacno jedan rezultat: drugo citanje istog koda bi bila
    // odjava deteta koje je upravo prijavljeno. Radnik koji hoce jos jedno dete
    // ponovo pali kameru, i to je namerna radnja.
    let poslato = false;

    async function pokreni() {
      const stanje = stanjeKamere();
      if (stanje !== 'ok') {
        javiGresku(PORUKE[stanje]);
        return;
      }

      setStatus('starting');
      try {
        // Biblioteka se dovlaci tek kad se kamera ukljuci - vecina otvaranja
        // ekrana prodje bez skeniranja, pa nema razloga da je svi cekaju.
        const { Html5Qrcode } = await import('html5-qrcode');
        if (stopped) return;

        // Na racunaru kamera zna biti vise - ugradjena i USB - pa radnik mora
        // da moze da izabere.
        const lista = await Html5Qrcode.getCameras();
        if (stopped) return;
        if (!lista.length) {
          javiGresku(PORUKE.NotFoundError);
          return;
        }
        setKamere(lista);

        const id = lista.some((k) => k.id === rucniIzbor) ? rucniIzbor : podrazumevana(lista);
        setAktivna(id);

        scanner = new Html5Qrcode(READER_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          id,
          { fps: 10, qrbox },
          (text) => {
            if (poslato) return;
            const code = String(text || '').trim().toUpperCase();
            if (!code) return;

            poslato = true;
            onScanRef.current?.(code);
          },
          () => {
            // Okida se na svaki kadar bez koda - nije greska, preskace se.
          }
        );

        if (!stopped) setStatus('running');
      } catch (err) {
        if (!stopped) javiGresku(PORUKE[err?.name] || PORUKE.default);
      }
    }

    pokreni();

    return () => {
      stopped = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      // stop() puca ako skener nije stigao da se pokrene - nije greska.
      s?.stop()
        .then(() => s.clear())
        .catch(() => {});
    };
  }, [active, rucniIzbor, javiGresku]);

  if (!active) return null;

  function promeniKameru(id) {
    localStorage.setItem(IZBOR_KAMERE, id);
    setRucniIzbor(id);
  }

  return (
    <div className="scanner">
      {/* Birac se pojavljuje samo kada ima sta da se bira. Na recepciji je to
          izbor izmedju ugradjene i USB kamere uperene u pult. */}
      {kamere.length > 1 && (
        <div className="scanner-pick">
          <label htmlFor="izbor-kamere">Kamera</label>
          <select
            id="izbor-kamere"
            value={aktivna || ''}
            onChange={(e) => promeniKameru(e.target.value)}
          >
            {kamere.map((k, i) => (
              <option key={k.id} value={k.id}>
                {k.label || `Kamera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        id={READER_ID}
        className="scanner-view"
        style={{ minHeight: status === 'error' ? 0 : 220 }}
      />
      {status === 'starting' && (
        <div className="field-hint center">Kamera se pokrece...</div>
      )}
      {status === 'error' && <div className="field-hint">{message}</div>}
      {status === 'running' && (
        <div className="field-hint center">
          Prinesite QR kod iz roditeljske aplikacije kameri.
        </div>
      )}
    </div>
  );
}
