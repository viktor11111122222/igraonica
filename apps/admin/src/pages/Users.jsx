import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Confirm, Empty, Field, Modal, Pagination, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { del, patch, post } from '../lib/api';
import AssignPackage from '../components/AssignPackage';
import { formatDate, initials } from '../lib/format';

const EMPTY_FORM = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'PARENT',
};

export default function Users() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [assignTo, setAssignTo] = useState(null);
  const [form, setForm] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const params = new URLSearchParams({ page, limit: 20 });
  if (query) params.set('search', query);
  if (role) params.set('role', role);
  const { data, loading, error: loadError, reload } = useFetch(`/users?${params}`);

  // Pretraga radi dok se kuca. Kratko cekanje da se ne salje zahtev po slovu.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (form.id) {
        const { firstName, lastName, phone, role } = form;
        await patch(`/users/${form.id}`, { firstName, lastName, phone, role });
      } else {
        await post('/users', form);
      }
      setForm(null);
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    try {
      await del(`/users/${deactivating.id}`);
      setDeactivating(null);
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Roditelji" subtitle="Nalozi roditelja i osoblja">
        <button className="btn" onClick={() => setForm({ ...EMPTY_FORM })}>
          Nov nalog
        </button>
      </PageHeader>

      <div className="page">
        <Alert>{loadError || error}</Alert>

        <div className="toolbar">
          <input
            className="search"
            placeholder="Pretraga po imenu, prezimenu ili email-u"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Sve uloge</option>
            <option value="PARENT">Roditelji</option>
            <option value="ADMIN">Admini</option>
            <option value="SUPERADMIN">Superadmini</option>
          </select>
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
          ) : !data?.users?.length ? (
            <Empty title="Nema naloga" text="Nijedan nalog ne odgovara pretrazi." />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ime</th>
                      <th>Email</th>
                      <th>Telefon</th>
                      <th>Uloga</th>
                      <th>Kreiran</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="inline">
                            <div className="avatar">{initials(u.firstName, u.lastName)}</div>
                            <div>
                              <div className="row-main">
                                <Link to={`/korisnici/${u.id}`}>
                                  {u.firstName} {u.lastName}
                                </Link>
                              </div>
                              {!u.isActive && <div className="row-sub">Deaktiviran</div>}
                            </div>
                          </div>
                        </td>
                        <td className="muted">{u.email}</td>
                        <td className="muted">{u.phone || '—'}</td>
                        <td>
                          <Badge tone={u.role === 'PARENT' ? 'gray' : 'amber'}>{u.role}</Badge>
                        </td>
                        <td className="muted">{formatDate(u.createdAt)}</td>
                        <td className="actions">
                          {u.role === 'PARENT' && (
                            <>
                              <button className="btn sm" onClick={() => setAssignTo(u)}>
                                + Paket
                              </button>{' '}
                            </>
                          )}
                          <Link className="btn secondary sm" to={`/korisnici/${u.id}`}>
                            Detalji
                          </Link>{' '}
                          <button
                            className="btn ghost sm"
                            onClick={() =>
                              setForm({
                                id: u.id,
                                firstName: u.firstName,
                                lastName: u.lastName,
                                phone: u.phone || '',
                                role: u.role,
                                email: u.email,
                              })
                            }
                          >
                            Izmeni
                          </button>
                          {u.isActive && (
                            <button className="btn ghost sm" onClick={() => setDeactivating(u)}>
                              Deaktiviraj
                            </button>
                          )}
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

      {form && (
        <Modal
          title={form.id ? 'Izmena naloga' : 'Nov nalog'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>
                Odustani
              </button>
              <button className="btn" onClick={save} disabled={busy} type="submit">
                {busy ? 'Cuva se...' : 'Sacuvaj'}
              </button>
            </>
          }
        >
          <form onSubmit={save}>
            <Alert>{error}</Alert>
            <div className="field-row">
              <Field label="Ime">
                <input value={form.firstName} onChange={set('firstName')} required />
              </Field>
              <Field label="Prezime">
                <input value={form.lastName} onChange={set('lastName')} required />
              </Field>
            </div>
            <Field label="Email" hint={form.id ? 'Email se ne moze menjati.' : undefined}>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                disabled={!!form.id}
              />
            </Field>
            {!form.id && (
              <Field label="Lozinka" hint="Najmanje 6 karaktera.">
                <input
                  type="text"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={6}
                />
              </Field>
            )}
            <div className="field-row">
              <Field label="Telefon">
                <input value={form.phone} onChange={set('phone')} />
              </Field>
              <Field label="Uloga">
                <select value={form.role} onChange={set('role')}>
                  <option value="PARENT">Roditelj</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {deactivating && (
        <Confirm
          title="Deaktivirati nalog?"
          text={`${deactivating.firstName} ${deactivating.lastName} vise nece moci da se prijavi u aplikaciju. Podaci ostaju sacuvani.`}
          confirmLabel="Deaktiviraj"
          busy={busy}
          onConfirm={deactivate}
          onClose={() => setDeactivating(null)}
        />
      )}
    </>
  );
}
