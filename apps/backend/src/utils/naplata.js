// Racunica naplate boravka.
//
// Naplacuje se u punim satima. Minuti preko punog sata se ne naplacuju dok ih
// je do praga (podrazumevano 15), a cim ga predju povlace ceo sat:
//
//   0-60 min   -> 1 sat        (svaki boravak je najmanje jedan sat)
//   1h 15m     -> 1 sat        (15 nije "preko 15")
//   1h 16m     -> 2 sata
//   2h 00m     -> 2 sata
//
// Prag je podesavanje (`hour_grace_minutes`), pa se ovde ne cita iz baze - ova
// funkcija mora da ostane cista da bi mogla da se proveri tabelom slucajeva.
function naplativiSati(minuti, pragMinuta = 15) {
  const ukupno = Math.max(0, Math.floor(Number(minuti) || 0));
  const prag = Number.isFinite(Number(pragMinuta)) ? Number(pragMinuta) : 15;

  const puniSati = Math.floor(ukupno / 60);
  const ostatak = ukupno % 60;

  return Math.max(1, puniSati + (ostatak > prag ? 1 : 0));
}

// Isti racun izrazen u minutima - u posetu se upisuje naplaceno trajanje.
function naplativiMinuti(minuti, pragMinuta = 15) {
  return naplativiSati(minuti, pragMinuta) * 60;
}

module.exports = { naplativiSati, naplativiMinuti };
