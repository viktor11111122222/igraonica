import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import podaci from '../pravno/dokumenti.json';

// Pravni tekstovi unutar panela. Isti sadrzaj stoji i kao samostalna stranica u
// public/pravno - ona sluzi prodavnicama i posetiocima bez naloga - ali oba
// izlaza dolaze iz istog izvora, pa ne mogu da se raziđu.

const PO_PUTANJI = Object.fromEntries(
  Object.entries(podaci.dokumenti).map(([kljuc, dok]) => [dok.putanja, { kljuc, ...dok }])
);

// **podebljano**, [natpis](adresa) i {{POPUNITI: sta}} - isti oblik kao u izvoru.
function tekst(s) {
  const delovi = String(s).split(/(\*\*[^*]+\*\*|\{\{POPUNITI:[^}]*\}\}|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return delovi.map((deo, i) => {
    // Ime rukovaoca je i podebljano i nepopunjeno, pa se u podebljano ulazi
    // jos jednom - inace bi zagrade ostale kao goli tekst.
    if (deo.startsWith('**')) return <strong key={i}>{tekst(deo.slice(2, -2))}</strong>;
    if (deo.startsWith('{{')) return (
      <span key={i} className="popuni">
        [{deo.slice(2, -2)}]
      </span>
    );
    const veza = deo.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (veza) return (
      <a key={i} href={veza[2]} target="_blank" rel="noreferrer">
        {veza[1]}
      </a>
    );
    return deo;
  });
}

function Blok({ b }) {
  switch (b.t) {
    case 'p':
      return <p>{tekst(b.x)}</p>;
    case 'h3':
      return <h3>{tekst(b.x)}</h3>;
    case 'ul':
      return (
        <ul>
          {b.x.map((s, i) => (
            <li key={i}>{tekst(s)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol>
          {b.x.map((s, i) => (
            <li key={i}>{tekst(s)}</li>
          ))}
        </ol>
      );
    case 'karta':
      return (
        <div className="pravno-karta">
          {b.x.map((unutra, i) => (
            <Blok key={i} b={unutra} />
          ))}
        </div>
      );
    case 'tabela':
      return (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {b.zaglavlje.map((z, i) => (
                  <th key={i}>{tekst(z)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.redovi.map((red, i) => (
                <tr key={i}>
                  {red.map((c, j) => (
                    <td key={j}>{tekst(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

export default function Pravno() {
  const { dokument } = useParams();
  const [jezik, setJezik] = useState('sr');

  const dok = PO_PUTANJI[dokument];
  if (!dok) return <Navigate to="/pravno/privatnost" replace />;

  const sadrzaj = dok[jezik];
  const rec = jezik === 'sr' ? 'Poslednja izmena' : 'Last updated';

  return (
    <>
      <PageHeader title={dok.naslov[jezik]} subtitle={`${rec}: ${sadrzaj.azurirano}`}>
        <div className="chips">
          {podaci.jezici.map((j) => (
            <button
              key={j.kod}
              type="button"
              className={`chip ${jezik === j.kod ? 'on' : ''}`}
              onClick={() => setJezik(j.kod)}
            >
              {j.naziv}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="page">
        <div className="card">
          <div className="card-body pravno-tekst">
            <p>{tekst(sadrzaj.uvod)}</p>
            {sadrzaj.sekcije.map((s) => (
              <section key={s.naslov}>
                <h2>{tekst(s.naslov)}</h2>
                {s.blokovi.map((b, i) => (
                  <Blok key={i} b={b} />
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
