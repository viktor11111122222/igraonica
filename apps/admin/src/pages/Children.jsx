import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import { Alert, Empty, Pagination, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import AssignPackage from '../components/AssignPackage';
import { ageInYears, formatDate, formatHours, initials } from '../lib/format';

export default function Children() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [assignFor, setAssignFor] = useState(null);

  const params = new URLSearchParams({ page, limit: 20 });
  if (query) params.set('search', query);
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
      <PageHeader title="Deca" subtitle="Sva registrovana deca i njihovi QR kodovi" />

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

        <div className="card">
          {loading ? (
            <Spinner />
          ) : !data?.children?.length ? (
            <Empty title="Nema dece" text="Nijedno dete ne odgovara pretrazi." />
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
                      <th>Paket roditelja</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.children.map((c) => (
                      <tr key={c.id}>
                        <td>
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
                        <td>{ageInYears(c.dateOfBirth)} god.</td>
                        <td className="mono">{c.qrCode}</td>
                        <td>
                          <Link to={`/korisnici/${c.parent.id}`} className="muted">
                            {c.parent.firstName} {c.parent.lastName}
                          </Link>
                        </td>
                        <td className="muted">{c.allergies || '—'}</td>
                        <td>
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
