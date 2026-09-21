import { useEffect, useState } from 'react';

// Trenutak kada je bundle ucitan, tj. prakticno pokretanje aplikacije.
// Stoji na nivou modula da bi svi koji ga gledaju merili od ISTE tacke.
const POCETAK = Date.now();

// Koliko ekran ucitavanja najmanje stoji pri pokretanju.
export const BOOT_MS = 900;
// Koliko najmanje stoji dok traje prijava.
export const RADNJA_MS = 450;

// Podizanje aplikacije ima dve kapije: ucitavanje fonta (App.js) i proveru
// sesije (AppNavigator). Obe se resavaju za desetak-dvadesetak milisekundi, pa
// je ekran ucitavanja do sada samo bljesnuo i covek ga nije ni video.
//
// Zato obe kapije cekaju do istog trenutka - `POCETAK + BOOT_MS`. Kljucno je
// da se mere od zajednicke tacke: da svaka drzi "svojih 900ms" od sebe, dve bi
// se nadovezale i pokretanje bi trajalo skoro dve sekunde.
export function useMinimalniBoot(ms = BOOT_MS) {
  const [proslo, setProslo] = useState(() => Date.now() - POCETAK >= ms);

  useEffect(() => {
    if (proslo) return undefined;

    // Math.max drzi tajmer i kada je rok vec presao: poziv se tada samo
    // odlozi za sledeci krug, umesto da se setState pozove usred efekta.
    const ostalo = Math.max(0, ms - (Date.now() - POCETAK));
    const tajmer = setTimeout(() => setProslo(true), ostalo);
    return () => clearTimeout(tajmer);
  }, [proslo, ms]);

  return proslo;
}

// Drzi `true` jos malo posto radnja zavrsi, da ekran ucitavanja ne trepne.
// Na lokalnom serveru prijava zna da prodje za 80ms - bez ovoga bi se video
// samo bljesak, sto izgleda kao greska u crtanju.
//
// Ne usporava korisnika kad je mreza spora: prag se broji od pocetka radnje,
// pa ako je ona vec trajala duze, ceka se nula.
export function useNajmanjeTrajanje(aktivno, ms = RADNJA_MS) {
  const [pocetak, setPocetak] = useState(0);
  const [drzi, setDrzi] = useState(aktivno);

  useEffect(() => {
    if (aktivno) {
      // Pocetak radnje je spoljni dogadjaj (pritisak na dugme), a ne izvedeno
      // stanje - zato se pamti ovde.
      /* eslint-disable react-hooks/set-state-in-effect */
      setPocetak(Date.now());
      setDrzi(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      return undefined;
    }

    if (!drzi) return undefined;

    // Prag se meri od POCETKA radnje, ne od njenog kraja: ako je prijava vec
    // trajala duze od praga, ceka se nula i korisnik ne gubi ni milisekundu.
    const ostalo = Math.max(0, ms - (Date.now() - pocetak));
    const tajmer = setTimeout(() => setDrzi(false), ostalo);
    return () => clearTimeout(tajmer);
    // `drzi` i `pocetak` namerno nisu u zavisnostima: kada tajmer spusti
    // `drzi`, ponovno pokretanje efekta bi samo zakazalo tajmer bez posla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktivno, ms]);

  return aktivno || drzi;
}
