// Racunica sati. Jedno mesto, da se ista brojka ne racuna na dva nacina.
//
// Roditelj moze da ima vise paketa odjednom (npr. dokupi novi pre nego sto
// stari istekne), pa zbir mora da ide preko svih koji jos vaze.

// Paket vazi ako je aktivan i ako mu rok nije prosao. Paket sa 0 preostalih
// sati i dalje ulazi u zbir - iskorisceni sati su deo racunice.
export function isValid(userPackage) {
  return userPackage.isActive && new Date(userPackage.expiresAt) > new Date();
}

// Sati se mogu koristiti samo ako paket vazi i ako jos ima preostalog.
export function isUsable(userPackage) {
  return isValid(userPackage) && Number(userPackage.remainingHours) > 0;
}

export function summarize(userPackages = []) {
  const valid = userPackages.filter(isValid);

  const total = valid.reduce((sum, p) => sum + Number(p.totalHours || 0), 0);
  const remaining = valid.reduce((sum, p) => sum + Number(p.remainingHours || 0), 0);
  // Iskorisceno je razlika, nikad negativna - backend drzi preostalo <= ukupno.
  const spent = Math.max(0, total - remaining);

  // Paket koji prvi istice trosi se prvi, isti redosled koji backend koristi
  // pri prijavi deteta (visits.js, findActivePackage).
  const usable = valid
    .filter(isUsable)
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));

  return {
    packages: valid,
    total,
    remaining,
    spent,
    progress: total > 0 ? remaining / total : 0,
    hasAny: valid.length > 0,
    // Paketi iz kojih jos ima sta da se trosi. Potroseni paketi ostaju u
    // `packages` zbog racunice, ali se ovde ne broje.
    usable,
    usableCount: usable.length,
    // Paket iz kog se trenutno trosi, i datum kada prvi istice.
    current: usable[0] || null,
    expiresAt: usable[0]?.expiresAt || null,
  };
}
