import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Skeniranje QR koda kamerom.
//
// Do sada je ekran za prijave primao kod samo preko tastature: hardverski citac
// koji "ukuca" kod, ili rucno kucanje. Radnik sa telefonom ili tabletom nije
// imao cime da skenira, pa je ceo tok u praksi zavisio od dodatnog uredjaja.
//
// Rucni unos ostaje kao rezerva - kamera moze da zakaze (nema dozvole, los
// telefon, ekran roditelja pretaman), a prijava tada ne sme da stane.
//
// Kamera se pali sto redje: svako pokretanje je nov zahtev za pristup, a
// pregledac koji dozvolu ne pamti (telefon na samopotpisanom sertifikatu) pita
// iznova svaki put. Zato posle procitanog koda stream ostaje ziv, samo se
// rezultati pauziraju - pa ceo dan prodje sa jednim pitanjem umesto sa dva po
// detetu.

const READER_ID = 'qr-reader';

// Izabrana kamera se pamti po uredjaju. Na recepciji je to najcesce USB kamera
// uperena u pult, a ne ugradjena - i taj izbor ne treba praviti svaki put.
//
// Pamti se samo izbor iz biraca. Kamera koju je pregledac sam dao se ne pamti:
// kad dozvola nije trajna, `deviceId` se menja izmedju poseta, pa bi zapamcen
// id sledeci put samo propao i doneo jos jedno pitanje.
const IZBOR_KAMERE = 'igraonica_admin_kamera';

function zapamcenaKamera() {
  try {
    return localStorage.getItem(IZBOR_KAMERE);
  } catch {
    return null;
  }
}

function zapamtiKameru(id) {
  try {
    localStorage.setItem(IZBOR_KAMERE, id);
  } catch {
    // Privatni prozor bez skladista: sledeci put se samo opet nabraja.
  }
}

function zaboraviKameru() {
  try {
    localStorage.removeItem(IZBOR_KAMERE);
  } catch {
    // Isto - nema sta da se ocisti.
  }
}

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

export default function QrScanner({ active, paused = false, onScan, onError }) {
  const scannerRef = useRef(null);
  const [status, setStatus] = useState('starting');
  const [message, setMessage] = useState('');
  const [kamere, setKamere] = useState([]);

  // Rucni izbor je jedina stvar koja sme da restartuje kameru osim paljenja i
  // gasenja - zato je on zavisnost effect-a, a ne id kamere koja trenutno radi.
  // Pamti se po uredjaju: na recepciji je to USB kamera uperena u pult.
  const [rucniIzbor, setRucniIzbor] = useState(zapamcenaKamera);
  const [aktivna, setAktivna] = useState(null);

  // U ref-u, da promena funkcije ne restartuje kameru usred rada. Sinhronizuje
  // se u layout effect-u, ne u renderu: prekinut render bi inace ostavio ref sa
  // vrednoscu iz prolaza koji nikad nije prikazan.
  const onScanRef = useRef(onScan);
  useLayoutEffect(() => {
    onScanRef.current = onScan;
  });

  // Biblioteka javlja kod vise puta u sekundi, a `paused` sa vrha stize tek
  // posle novog rendera - u tom procepu bi isti kod otisao jos jednom. Zato uz
  // spoljnu pauzu ide i lokalna brava, koja se zatvara istog trena.
  const pauzaRef = useRef(paused);
  const isporuceno = useRef(false);
  useLayoutEffect(() => {
    pauzaRef.current = paused;
    if (!paused) isporuceno.current = false;
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

    function procitano(text) {
      // Kod stoji pred objektivom i cita se vise puta u sekundi. Dok radnik ne
      // zatrazi sledece dete, sve posle prvog citanja se preskace - inace bi
      // isti kod odmah odjavio dete koje je upravo prijavljen.
      if (isporuceno.current || pauzaRef.current) return;

      const code = String(text || '').trim().toUpperCase();
      if (!code) return;

      isporuceno.current = true;
      onScanRef.current?.(code);
    }

    async function nabroj(Html5Qrcode) {
      const lista = await Html5Qrcode.getCameras();
      if (stopped) return null;
      if (!lista.length) {
        javiGresku(PORUKE.NotFoundError);
        return null;
      }
      setKamere(lista);
      return podrazumevana(lista);
    }

    // Spisak kamera se posle uspesnog pokretanja moze pokupiti bez novog
    // zahteva za pristup: dok stream radi, uredjaji vec imaju nazive.
    async function dopuniSpisak() {
      try {
        const uredjaji = (await navigator.mediaDevices?.enumerateDevices?.()) || [];
        const video = uredjaji.filter((u) => u.kind === 'videoinput');
        if (video.length > 1 && !stopped) {
          setKamere(video.map((u, i) => ({ id: u.deviceId, label: u.label || `Kamera ${i + 1}` })));
        }
      } catch {
        // Birac kamere ostaje sakriven; skeniranje radi i bez njega.
      }
    }

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

        scanner = new Html5Qrcode(READER_ID, { verbose: false });
        scannerRef.current = scanner;

        // Nabrajanje kamera je zaseban zahtev za pristup, pa je jedno
        // skeniranje trazilo kameru dvaput. Bez izbora iz biraca trazi se
        // odmah zadnja kamera - `facingMode` je zelja, ne uslov, pa laptop sa
        // samo prednjom kamerom vraca nju umesto da pukne. Spisak za birac
        // stize posle pokretanja, iz `enumerateDevices`, sto se ne pita.
        let id = rucniIzbor;

        try {
          await scanner.start(id || { facingMode: 'environment' }, { fps: 10, qrbox }, procitano, () => {
            // Okida se na svaki kadar bez koda - nije greska, preskace se.
          });
        } catch (err) {
          // Zapamcena kamera vise ne postoji - USB izvucen ili drugi racunar.
          // Tek tada se placa nabrajanje.
          if (!id || stopped) throw err;
          zaboraviKameru();
          id = await nabroj(Html5Qrcode);
          if (id === null || stopped) return;
          await scanner.start(id, { fps: 10, qrbox }, procitano, () => {});
        }

        if (stopped) return;
        setAktivna(id || scanner.getRunningTrackSettings?.()?.deviceId || null);
        setStatus('running');
        dopuniSpisak();
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
    zapamtiKameru(id);
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
          {paused
            ? 'Kod je procitan. Kamera ceka sledece dete.'
            : 'Prinesite QR kod iz roditeljske aplikacije kameri.'}
        </div>
      )}
    </div>
  );
}
