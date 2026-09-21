// Mere ekrana pred prijavu, zajednicke za ucitavanje i za samu prijavu.
//
// Preuzete su iz predloska (ekran 796x1703 px, tj. 393x841 pt) i stoje kao
// udeo sirine, da bi se raspored isto ponasao i na uzem i na sirem telefonu.
// Razmere slika su iz samih fajlova, pa se nista ne rasteze.
//
// Stoje ovde, a ne u jednom ekranu, jer ih dele ekran ucitavanja i ekran
// prijave: ista podloga, isti ukrasi i logo iste velicine. Prelaz sa jednog na
// drugi zato nije rez - pozadina ostaje ista, logo se digne i pojavi se forma.
// (Visina loga se razlikuje namerno: na ucitavanju je na sredini, jer ispod
// njega nema forme.)
export const LOGO_RATIO = 536 / 260;
export const LOGO_SHARE = 264 / 393;
export const LOGO_MAX = 300;

export const ILLUSTRATION_RATIO = 591 / 579;
export const ILLUSTRATION_SHARE = 292 / 393;
export const ILLUSTRATION_LEFT_SHARE = 34 / 393;
