// Iz jednog izvora (dokumenti.mjs) pravi tri kopije:
//
//   1. javne HTML stranice u apps/admin/public/pravno - njihove adrese idu na
//      App Store i Google Play, i moraju da rade bez prijave i bez aplikacije;
//   2. JSON za panel, koji ih prikazuje kao svoju stranicu;
//   3. JSON za mobilnu aplikaciju, koja ih prikazuje kao svoj ekran.
//
// Kopije se ne diraju rukom. Menja se dokumenti.mjs pa `npm run pravno`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOKUMENTI, JEZICI } from './dokumenti.mjs';

const OVDE = path.dirname(fileURLToPath(import.meta.url));
const KOREN = path.join(OVDE, '..');
const IZLAZ_HTML = path.join(KOREN, 'apps/admin/public/pravno');
const IZLAZ_ADMIN = path.join(KOREN, 'apps/admin/src/pravno');
const IZLAZ_MOBILNI = path.join(KOREN, 'apps/mobile/src/pravno');

const ZAGLAVLJE = '// Generisano iz pravno/dokumenti.mjs - ne menjati rucno.\n';

function escHtml(s) {
  return String(s).replace(/[&<>]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[z]);
}

// **podebljano**, [natpis](adresa) i {{POPUNITI: sta}}
function tekstUHtml(s) {
  return escHtml(s)
    .replace(/\{\{(POPUNITI:[^}]*)\}\}/g, (_, x) => `<span class="popuni">[${escHtml(x)}]</span>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

function blokUHtml(b) {
  switch (b.t) {
    case 'p':
      return `<p>${tekstUHtml(b.x)}</p>`;
    case 'h3':
      return `<h3>${tekstUHtml(b.x)}</h3>`;
    case 'ul':
    case 'ol':
      return `<${b.t}>${b.x.map((s) => `<li>${tekstUHtml(s)}</li>`).join('')}</${b.t}>`;
    case 'karta':
      return `<div class="karta">${b.x.map(blokUHtml).join('')}</div>`;
    case 'tabela':
      return (
        '<div class="tabela-okvir"><table><thead><tr>' +
        b.zaglavlje.map((z) => `<th>${tekstUHtml(z)}</th>`).join('') +
        '</tr></thead><tbody>' +
        b.redovi
          .map((r) => `<tr>${r.map((c) => `<td>${tekstUHtml(c)}</td>`).join('')}</tr>`)
          .join('') +
        '</tbody></table></div>'
      );
    default:
      throw new Error(`Nepoznat blok: ${b.t}`);
  }
}

function stranica(kljuc, jezik) {
  const dok = DOKUMENTI[kljuc];
  const sadrzaj = dok[jezik];
  const drugi = JEZICI.filter((j) => j.kod !== jezik);
  const rec = jezik === 'sr' ? { azurirano: 'Poslednja izmena', jezik: 'Jezik' } : { azurirano: 'Last updated', jezik: 'Language' };

  const prekidacJezika = drugi
    .map((j) => `<a href="./${dok.datoteka[j.kod]}.html">${j.naziv}</a>`)
    .join('');

  const ostali = Object.entries(DOKUMENTI)
    .filter(([k]) => k !== kljuc)
    .map(([, d]) => `<a href="./${d.datoteka[jezik]}.html">${escHtml(d.naslov[jezik])}</a>`)
    .join('');

  const telo = sadrzaj.sekcije
    .map((s) => `<h2>${tekstUHtml(s.naslov)}</h2>${s.blokovi.map(blokUHtml).join('')}`)
    .join('');

  return `<!doctype html>
<html lang="${jezik}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escHtml(dok.naslov[jezik])} — Kids club</title>
    <link rel="stylesheet" href="./stil.css" />
  </head>
  <body>
    <main>
      <nav class="jezici">${rec.jezik}: ${prekidacJezika}</nav>
      <h1>${escHtml(dok.naslov[jezik])}</h1>
      <p class="datum">${rec.azurirano}: ${escHtml(sadrzaj.azurirano)}</p>
      <p>${tekstUHtml(sadrzaj.uvod)}</p>
      ${telo}
      <footer>${ostali}</footer>
    </main>
  </body>
</html>
`;
}

function upisi(putanja, sadrzaj) {
  fs.mkdirSync(path.dirname(putanja), { recursive: true });
  fs.writeFileSync(putanja, sadrzaj);
  return path.relative(KOREN, putanja);
}

const napravljeno = [];

for (const kljuc of Object.keys(DOKUMENTI)) {
  for (const { kod } of JEZICI) {
    const ime = DOKUMENTI[kljuc].datoteka[kod];
    napravljeno.push(upisi(path.join(IZLAZ_HTML, `${ime}.html`), stranica(kljuc, kod)));
  }
}

// Aplikacije dobijaju isti sadrzaj kao podatke. Panel ga ucitava kroz Vite, a
// mobilna kroz Metro - oba umeju JSON, pa nema koraka prevodjenja.
const zaAplikacije = JSON.stringify({ jezici: JEZICI, dokumenti: DOKUMENTI }, null, 2);
napravljeno.push(upisi(path.join(IZLAZ_ADMIN, 'dokumenti.json'), zaAplikacije));
napravljeno.push(upisi(path.join(IZLAZ_MOBILNI, 'dokumenti.json'), zaAplikacije));
napravljeno.push(
  upisi(path.join(IZLAZ_ADMIN, 'README.md'), `${ZAGLAVLJE}\nSadrzaj dolazi iz pravno/dokumenti.mjs. Pokreni \`npm run pravno\`.\n`)
);

console.log('Napravljeno:');
for (const p of napravljeno) console.log('  ' + p);
