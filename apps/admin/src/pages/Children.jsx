import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import { Alert, Empty, Pagination, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import AssignPackage from '../components/AssignPackage';
import { ageInYears, formatDate, formatHours, initials } from '../lib/format';

// Filteri po saglasnostima - isti kljucevi kao na serveru (?saglasnost=).
const FILTERI = [
  { key: '', label: 'Sva deca' },
  { key: 'nepotpuno', label: 'Nisu popunjene' },
  { key: 'bez_slikanja', label: 'Ne sme slikanje' },
  { key: 'bez_rucka', label: 'Ne jede rucak' },
  { key: 'bez_uzine', label: 'Ne jede uzinu' },
  { key: 'bez_setnje', label: 'Ne ide u setnju' },
];

const SAGLASNOSTI = [
  { key: 'photoConsent', label: 'Slikanje' },
  { key: 'eatsLunch', label: 'Rucak' },
  { key: 'eatsSnack', label: 'Uzina' },
  { key: 'walksConsent', label: 'Setnja' },
];

// "Ne" je izricita zabrana roditelja i mora da upadne u oci; "?" znaci da
// roditelj jos nije odgovorio, sto osoblje tretira kao "ne" dok ne odgovori.
function Saglasnost({ label, value }) {
  if (value === true) return <span className="badge green">{label}: Da</span>;
  if (value === false) return <span className="badge red">{label}: Ne</span>;
  return <span className="badge amber">{label}: ?</span>;
}

// Dodatni kontakt i ovlascene osobe su obavezni; prazno polje znaci da
// roditelj jos nije odgovorio, pa se istice kao i "?" kod saglasnosti.
function Upis({ value }) {
  if (!value) return <span className="badge amber">nije upisano</span>;
  return value;
}

export default function Children() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [assignFor, setAssignFor] = useState(null);
  const [filter, setFilter] = useState('');

  const params = new URLSearchParams({ page, limit: 20 });
  if (query) params.set('search', query);
  if (filter) params.set('saglasnost', filter);
  const { data, loading, error, reload } = useFetch(`/children/all?${params}`);

  // Pretraga radi dok se kuca.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <>
      <PageHeader
        title="Deca"
        subtitle="Sva registrovana deca, njihovi QR kodovi i saglasnosti roditelja"
      />

      <div className="page">
        <Alert>{error}</Alert>

        <div className="toolbar">
          <input
            className="search"
            placeholder="Pretraga po imenu deteta ili QR kodu"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button className="btn ghost" onClick={() => setSearch('')}>
              Ponisti
            </button>
          )}
          {!loading && data?.pagination && (
            <span className="faint">{data.pagination.total} rezultata</span>
          )}
        </div>

        <div
          className="chips"
          role="group"
          aria-label="Filter po saglasnostima"
          style={{ marginBottom: 14 }}
        >
          {FILTERI.map((f) => (
            <button
              key={f.key || 'sve'}
              type="button"
              className={`chip ${filter === f.key ? 'on' : ''}`}
              aria-pressed={filter === f.key}
              onClick={() => {
                setPage(1);
                setFilter(f.key);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="card">
          {loading ? (
            <Spinner />
          ) : !data?.children?.length ? (
            <Empty
              title="Nema dece"
              text={filter ? 'Nijedno dete ne odgovara ovom filteru.' : 'Nijedno dete ne odgovara pretrazi.'}
            />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dete</th>
                      <th>Uzrast</th>
                      <th>QR kod</th>
                      <th>Roditelj</th>
                      <th>Alergije</th>
                      <th>Saglasnosti</th>
                      <th>Dodatni kontakt</th>
                      <th>Preuzima</th>
                      <th>Paket roditelja</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.children.map((c) => (
                      <tr key={c.id}>
                        <td data-label="Dete">
                          <div className="inline">
                            <div className="avatar">{initials(c.firstName, c.lastName)}</div>
                            <div>
                              <div className="row-main">
                                {c.firstName} {c.lastName}
                              </div>
                              <div className="row-sub">{formatDate(c.dateOfBirth)}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Uzrast">{ageInYears(c.dateOfBirth)} god.</td>
                        <td className="mono" data-label="QR kod">{c.qrCode}</td>
                        <td data-label="Roditelj">
                          <Link to={`/korisnici/${c.parent.id}`} className="muted">
                            {c.parent.firstName} {c.parent.lastName}
                          </Link>
                        </td>
                        <td className="muted" data-label="Alergije">{c.allergies || '—'}</td>
                        <td data-label="Saglasnosti">
                          <div className="consent-badges">
                            {SAGLASNOSTI.map((sg) => (
                              <Saglasnost key={sg.key} label={sg.label} value={c[sg.key]} />
                            ))}
                          </div>
                        </td>
                        <td className="muted" data-label="Dodatni kontakt">
                          <Upis value={c.extraContactPhone} />
                        </td>
                        <td className="muted pre-line" data-label="Preuzima">
                          <Upis value={c.pickupPersons} />
                        </td>
                        <td data-label="Paket roditelja">
                          {c.parentRemainingHours > 0 ? (
                            <span className="badge green">
                              {formatHours(c.parentRemainingHours)}
                            </span>
                          ) : (
                            <span className="badge red">nema sati</span>
                          )}
                        </td>
                        <td className="actions">
                          <button className="btn sm" onClick={() => setAssignFor(c)}>
                            + Paket
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...data.pagination} onChange={setPage} />
            </>
          )}
        </div>
      </div>

      {assignFor && (
        <AssignPackage
          user={assignFor.parent}
          childName={assignFor.firstName}
          onClose={() => setAssignFor(null)}
          onDone={reload}
        />
      )}
    </>
  );
}
