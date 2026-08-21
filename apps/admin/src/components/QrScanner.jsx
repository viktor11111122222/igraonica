import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Skeniranje QR koda kamerom.
//
// Do sada je ekran za prijave primao kod samo preko tastature: hardverski citac
// koji "ukuca" kod, ili rucno kucanje. Radnik sa telefonom ili tabletom nije
// imao cime da skenira, pa je ceo tok u praksi zavisio od dodatnog uredjaja.
//
// Rucni unos ostaje kao rezerva - kamera moze da zakaze (nema dozvole, los
// telefon, ekran roditelja pretaman), a prijava tada ne sme da stane.

const READER_ID = 'qr-reader';

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
  OverconstrainedError: 'Zadnja kamera nije dostupna. Unesite kod rucno.',
  default: 'Kamera nije dostupna. Unesite kod rucno.',
};

export default function QrScanner({ active, onScan, onError }) {
  const scannerRef = useRef(null);
  const [status, setStatus] = useState('starting');
  const [message, setMessage] = useState('');

  // U ref-u, da promena funkcije ne restartuje kameru usred rada. Sinhronizuje
  // se u layout effect-u, ne u renderu: prekinut render bi inace ostavio ref sa
  // vrednoscu iz prolaza koji nikad nije prikazan.
  const onScanRef = useRef(onScan);
  useLayoutEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!active) return undefined;

    let scanner;
    let stopped = false;

    // Kod stoji pred objektivom i cita se vise puta u sekundi. Jedno paljenje
    // kamere sme da da tacno jedan rezultat: drugo citanje istog koda bi bila
    // odjava deteta koje je upravo prijavljeno. Roditelj koji hoce jos jedno
    // dete ponovo pali kameru, i to je namerna radnja.
    let poslato = false;

    function pukni(tekst) {
      if (stopped) return;
      setStatus('error');
      setMessage(tekst);
      onError?.(tekst);
    }

    async function start() {
      const stanje = stanjeKamere();
      if (stanje !== 'ok') {
        pukni(PORUKE[stanje]);
        return;
      }

      try {
        // Biblioteka se dovlaci tek kad se kamera ukljuci - vecina otvaranja
        // ekrana prodje bez skeniranja, pa nema razloga da je svi cekaju.
        const { Html5Qrcode } = await import('html5-qrcode');
        if (stopped) return;

        scanner = new Html5Qrcode(READER_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
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
        pukni(PORUKE[err?.name] || PORUKE.default);
      }
    }

    start();

    return () => {
      stopped = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      // stop() puca ako skener nije stigao da se pokrene - nije greska.
      s?.stop()
        .then(() => s.clear())
        .catch(() => {});
    };
  }, [active, onError]);

  if (!active) return null;

  return (
    <div className="scanner">
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
