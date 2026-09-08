// Javne adrese pravnih dokumenata.
//
// Iste adrese idu i u opis na prodavnicama - Apple i Google traze da politika
// privatnosti bude dostupna i pre instalacije, sa adrese koja ne trazi prijavu.
// Zato stoje ovde kao konstante, a ne kao ekran u aplikaciji.
const OSNOVA = 'https://admin.207.154.218.139.sslip.io/pravno';

export const PRAVNO = {
  privatnost: `${OSNOVA}/privatnost.html`,
  uslovi: `${OSNOVA}/uslovi.html`,
  brisanjeNaloga: `${OSNOVA}/brisanje-naloga.html`,
};
