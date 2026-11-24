// Isto pravilo kao na serveru (routes/auth.js): cifre uz razmake, crtice,
// kose crte i zagrade, opciono + na pocetku, najmanje 6 cifara.
const TELEFON = /^\+?[\d\s\-/()]{6,20}$/;

export function jeTelefon(vrednost) {
  const broj = (vrednost || '').trim();
  return TELEFON.test(broj) && broj.replace(/\D/g, '').length >= 6;
}

// Dodatni kontakt (stavka 4): broj telefona, ili rec kojom roditelj kaze da
// nema nikoga ("Nema"). Cim u polju ima cifara, mora biti ispravan broj - inace
// bi "064 12" prosao kao tekst.
export function jeKontakt(vrednost) {
  const tekst = (vrednost || '').trim();
  if (!tekst) return false;
  if (/\d/.test(tekst)) return jeTelefon(tekst);
  return tekst.length >= 2;
}
