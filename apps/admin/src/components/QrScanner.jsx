import { useEffect, useRef, useState } from 'react';

// Skeniranje QR koda kamerom.
//
// Do sada je ekran za prijave primao kod samo preko tastature: hardverski citac
// koji "ukuca" kod, ili rucno kucanje. Radnik sa telefonom ili tabletom nije
// imao cime da skenira, pa je ceo tok u praksi zavisio od dodatnog uredjaja.
//
// Rucni unos ostaje kao rezerva - kamera moze da zakaze (nema dozvole, los
// telefon, ekran roditelja pretaman), a prijava tada ne sme da stane.

const READER_ID = 'qr-reader';

// Isti kod ume da se procita vise puta u sekundi dok je pred kamerom. Bez ove
// pauze bi se posle prijave odmah okinula i odjava.
const COOLDOWN_MS = 3000;

export default function QrScanner({ active, onScan, onError }) {
  const scannerRef = useRef(null);
  const lastRef = useRef({ code: null, at: 0 });
  const [status, setStatus] = useState('starting');
  const [message, setMessage] = useState('');

  // U ref-u, da promena funkcije ne restartuje kameru usred rada.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!active) return undefined;

    let scanner;
    let stopped = false;

    async function start() {
      try {
        // Biblioteka se dovlaci tek kad se kamera ukljuci - vecina otvaranja
        // ekrana prodje bez skeniranja, pa nema razloga da je svi cekaju.
        const { Html5Qrcode } = await import('html5-qrcode');
        if (stopped) return;

        scanner = new Html5Qrcode(READER_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            const code = String(text || '').trim().toUpperCase();
            if (!code) return;

            const now = Date.now();
            const last = lastRef.current;
            if (last.code === code && now - last.at < COOLDOWN_MS) return;
            lastRef.current = { code, at: now };

            onScanRef.current?.(code);
          },
          () => {
            // Okida se na svaki kadar bez koda - nije greska, preskace se.
          }
        );

        if (!stopped) setStatus('running');
      } catch (err) {
        if (stopped) return;
        setStatus('error');
        const text =
          err?.name === 'NotAllowedError'
            ? 'Pristup kameri nije dozvoljen. Dozvolite ga u pregledacu ili unesite kod rucno.'
            : 'Kamera nije dostupna. Unesite kod rucno.';
        setMessage(text);
        onError?.(text);
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
    <div style={{ marginBottom: 14 }}>
      <div
        id={READER_ID}
        style={{
          width: '100%',
          maxWidth: 320,
          margin: '0 auto',
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          background: '#000',
          minHeight: status === 'error' ? 0 : 220,
        }}
      />
      {status === 'starting' && (
        <div className="field-hint" style={{ textAlign: 'center' }}>
          Kamera se pokrece...
        </div>
      )}
      {status === 'error' && <div className="field-hint">{message}</div>}
      {status === 'running' && (
        <div className="field-hint" style={{ textAlign: 'center' }}>
          Prinesite QR kod iz roditeljske aplikacije kameri.
        </div>
      )}
    </div>
  );
}
