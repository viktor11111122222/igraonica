// "Danas" je lokalni dan igraonice, ne UTC dan.
//
// Zasto ovo postoji: dashboard je racunao dan preko setUTCHours(0,0,0,0), pa je
// kod nas (UTC+1/+2) "danas" trajao od 01:00 ili 02:00 do istog sata sutradan.
// Poseta u 00:30 upisivala bi se u juce, a jutarnji brojevi bi bili pomereni.
// Mobilna aplikacija (utils/date.js) i panel (lib/format.js) vec racunaju
// lokalno, pa je backend bio jedini koji je odudarao.
//
// VAZNO: oslanja se na vremensku zonu procesa. Server mora da radi u zoni
// igraonice - u produkciji postaviti TZ=Europe/Belgrade.
//
// Pazi: ovo NE vazi za kolone tipa @db.Date (jelovnik, neradni dani). Tamo se
// datum namerno drzi na UTC ponoci, jer kolona nosi samo datum bez vremena.
// Ovi pomocnici su za prava vremena (checkedInAt, checkedOutAt).

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// YYYY-MM-DD po lokalnom datumu. toISOString() bi vratio UTC, pa bi kod nas
// vece posle 22h ispalo kao sutrasnji dan.
function toKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = { startOfDay, endOfDay, addDays, toKey };
