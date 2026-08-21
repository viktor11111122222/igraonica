import { useEffect, useLayoutEffect, useRef } from 'react';

// Rucni citac QR koda - onaj sa kase - racunaru se predstavlja kao tastatura.
// Procitani kod "otkuca" za nekoliko milisekundi i, zavisno od podesavanja
// samog citaca, doda Enter, doda Tab, ili ne doda nista.
//
// Zato se serija hvata na nivou prozora, a ne kroz polje za unos:
//
//   - kod stize i kada fokus nije u polju. Radnik koji je upravo kliknuo neko
//     dugme inace izgubi skeniranje, a zavrsni Enter jos i "pritisne" to dugme;
//   - sva tri podesavanja zavrsnog znaka rade isto, jer se kraj koda prepoznaje
//     po obliku, ne po Enter-u.
//
// Od kucanja rukom se razlikuje po brzini: citac izmedju dva znaka ima nekoliko
// milisekundi, covek bar desetak puta toliko.

// Kod je uvek "IGR-" i osam heksadecimalnih znakova. Taj fiksan oblik je ono
// sto dozvoljava prepoznavanje bez zavrsnog znaka.
export const OBRAZAC_KODA = /IGR-[0-9A-F]{8}$/;

// Granica je namerno siroka. Prekratka bi obarala citace preko bluetooth-a,
// gde razmak ume da varira, a "previse siroka" ovde ne znaci nista: da bi se
// slucajno okinula, covek bi morao rukom da otkuca tacno ovaj oblik.
const MAX_RAZMAK_MS = 100;

// Ako citac ipak posalje zavrsni znak, kod je vec otisao na obradu. Taj Enter
// se guta da ne bi drugi put poslao formu ili kliknuo fokusirano dugme.
const GUTANJE_MS = 300;

// Poneki citac dopisuje svoj prefiks pre koda, pa se gleda samo rep serije.
const PAMTI_ZNAKOVA = 24;

export default function useHardwareScanner(onScan, { enabled = true } = {}) {
  // Sinhronizacija u layout effect-u, ne u renderu - prekinut render bi ostavio
  // ref sa vrednoscu iz prolaza koji nikad nije prikazan.
  const onScanRef = useRef(onScan);
  useLayoutEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    let serija = '';
    let poslednjiZnak = 0;
    let gutajDo = 0;

    function posalji(sada) {
      const kod = serija.match(OBRAZAC_KODA)[0];
      serija = '';
      gutajDo = sada + GUTANJE_MS;
      onScanRef.current?.(kod);
    }

    function naTaster(e) {
      // Precice (Cmd+R i slicno) nisu deo skeniranja.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const sada = Date.now();

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (sada < gutajDo) {
          e.preventDefault();
          return;
        }
        if (OBRAZAC_KODA.test(serija)) {
          e.preventDefault();
          posalji(sada);
        }
        serija = '';
        return;
      }

      if (e.key.length !== 1) return;

      // Pauza duza od granice znaci da prethodni znakovi nisu iz istog citanja.
      if (sada - poslednjiZnak > MAX_RAZMAK_MS) serija = '';
      poslednjiZnak = sada;

      serija = (serija + e.key.toUpperCase()).slice(-PAMTI_ZNAKOVA);

      if (OBRAZAC_KODA.test(serija)) posalji(sada);
    }

    // Faza hvatanja: Enter mora da bude presretnut pre nego sto stranica na
    // njega odreaguje.
    window.addEventListener('keydown', naTaster, true);
    return () => window.removeEventListener('keydown', naTaster, true);
  }, [enabled]);
}
