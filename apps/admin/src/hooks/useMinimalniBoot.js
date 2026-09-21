import { useEffect, useState } from 'react';

// Trenutak kada je stranica ucitana. Stoji na nivou modula da bi se merilo od
// jedne tacke, bez obzira ko pita.
const POCETAK = Date.now();

const BOOT_MS = 700;

// Provera sesije na localhostu prodje za desetak milisekundi, pa bi ekran
// ucitavanja samo bljesnuo - a bljesak izgleda kao greska u crtanju, ne kao
// ucitavanje. Zato se drzi do `POCETAK + BOOT_MS`.
//
// Prag se meri od ucitavanja stranice, ne od pocetka provere: ako je provera
// vec trajala duze, ceka se nula i niko ne gubi vreme.
export function useMinimalniBoot(ms = BOOT_MS) {
  const [proslo, setProslo] = useState(() => Date.now() - POCETAK >= ms);

  useEffect(() => {
    if (proslo) return undefined;

    const ostalo = Math.max(0, ms - (Date.now() - POCETAK));
    const tajmer = setTimeout(() => setProslo(true), ostalo);
    return () => clearTimeout(tajmer);
  }, [proslo, ms]);

  return proslo;
}
