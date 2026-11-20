// Isto pravilo kao na serveru (routes/auth.js): cifre uz razmake, crtice,
// kose crte i zagrade, opciono + na pocetku, najmanje 6 cifara.
const TELEFON = /^\+?[\d\s\-/()]{6,20}$/;

export function jeTelefon(vrednost) {
  const broj = (vrednost || '').trim();
  return TELEFON.test(broj) && broj.replace(/\D/g, '').length >= 6;
}
