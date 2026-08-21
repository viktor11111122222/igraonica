import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Empty, Field, Modal, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { get, post } from '../lib/api';
import AssignPackage from '../components/AssignPackage';
import {
  ageInYears,
  formatDate,
  formatDateTime,
  formatHours,
  initials,
} from '../lib/format';

// Ista racunica kao u mobilnoj aplikaciji (apps/mobile/src/utils/packages.js):
// zbir ide preko svih paketa koji jos vaze, a ne preko jednog.
function summarize(userPackages = []) {
  const now = new Date();
  const valid = userPackages.filter((p) => p.isActive && new Date(p.expiresAt) > now);
  const total = valid.reduce((s, p) => s + Number(p.totalHours || 0), 0);
  const remaining = valid.reduce((s, p) => s + Number(p.remainingHours || 0), 0);
  return { count: valid.length, total, remaining, spent: Math.max(0, total - remaining) };
}

function packageState(up) {
  const expired = new Date(up.expiresAt) <= new Date();
  const empty = Number(up.remainingHours) <= 0;
  if (!up.isActive) return { label: 'Neaktivan', tone: 'gray' };
  if (expired) return { label: 'Istekao', tone: 'red' };
  if (empty) return { label: 'Potroseni sati', tone: 'amber' };
  return { label: 'Aktivan', tone: 'green' };
}

export default function UserDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(`/users/${id}`);

  const [assigning, setAssigning] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ hours: '', reason: '' });
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const user = data?.user;
  const sum = summarize(user?.userPackages);

  async function adjust(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await post(`/packages/${adjusting.id}/adjust-hours`, {
        hours: Number(adjustForm.hours),
        reason: adjustForm.reason || undefined,
      });
      setAdjusting(null);
      setAdjustForm({ hours: '', reason: '' });
      reload();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function openHistory(up) {
    setHistory({ userPackage: up, items: null });
    try {
      const data = await get(`/packages/${up.id}/adjustments`);
      setHistory({ userPackage: up, items: data.adjustments });
    } catch (e) {
      setHistory({ userPackage: up, items: [], error: e.message });
    }
  }

  if (loading) return <Spinner />;
  if (error || !user) {
    return (
      <>
        <PageHeader title="Roditelj" />
        <div className="page">
          <Alert>{error || 'Korisnik nije pronadjen.'}</Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        subtitle={`${user.email}${user.phone ? ` · ${user.phone}` : ''}`}
      >
        <Link className="btn secondary" to="/korisnici">
          Nazad
        </Link>
        <button className="btn" onClick={() => setAssigning(true)}>
          Dodeli paket
        </button>
      </PageHeader>

      <div className="page stack">
        <div className="grid stats">
          <div className="stat primary">
            <div className="stat-label">Deca</div>
            <div className="stat-value">{user.children?.length || 0}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Ukupno sati</div>
            <div className="stat-value">{formatHours(sum.total)}</div>
            <div className="stat-hint">
              {sum.count === 1 ? '1 paket koji vazi' : `${sum.count} paketa koja vaze`}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Iskorisceno</div>
            <div className="stat-value" style={{ color: 'var(--accent-dark)' }}>
              {formatHours(sum.spent)}
            </div>
          </div>
          <div className="stat accent">
            <div className="stat-label">Preostalo</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {formatHours(sum.remaining)}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Deca</h2>
          </div>
          {!user.children?.length ? (
            <Empty title="Nema dece" text="Roditelj jos nije dodao nijedno dete u aplikaciji." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ime</th>
                    <th>Uzrast</th>
                    <th>QR kod</th>
                    <th>Alergije</th>
                    <th>Napomene</th>
                  </tr>
                </thead>
                <tbody>
                  {user.children.map((c) => (
                    <tr key={c.id}>
                      <td data-label="Ime">
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
                      <td className="muted" data-label="Alergije">{c.allergies || '—'}</td>
                      <td className="muted" data-label="Napomene">{c.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Paketi</h2>
          </div>
          {!user.userPackages?.length ? (
            <Empty title="Nema paketa" text="Dodelite paket da bi dete moglo da se prijavi.">
              <button className="btn" onClick={() => setAssigning(true)}>
                Dodeli paket
              </button>
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Paket</th>
                    <th>Sati</th>
                    <th>Kupljen</th>
                    <th>Vazi do</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {user.userPackages.map((up) => {
                    const state = packageState(up);
                    return (
                      <tr key={up.id}>
                        <td data-label="Paket">
                          <div className="row-main">{up.package.name}</div>
                          {up.notes && <div className="row-sub">{up.notes}</div>}
                        </td>
                        <td data-label="Sati">
                          <div className="row-main">
                            {formatHours(up.remainingHours)} <span className="faint">/</span>{' '}
                            <span className="muted">{formatHours(up.totalHours)}</span>
                          </div>
                          <div className="row-sub">
                            iskorisceno{' '}
                            {formatHours(
                              Math.max(0, Number(up.totalHours) - Number(up.remainingHours))
                            )}
                          </div>
                        </td>
                        <td className="muted" data-label="Kupljen">{formatDate(up.purchasedAt)}</td>
                        <td className="muted" data-label="Vazi do">{formatDate(up.expiresAt)}</td>
                        <td data-label="Status">
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </td>
                        <td className="actions">
                          <button className="btn secondary sm" onClick={() => setAdjusting(up)}>
                            Koriguj sate
                          </button>{' '}
                          <button className="btn ghost sm" onClick={() => openHistory(up)}>
                            Istorija
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {assigning && (
        <AssignPackage
          user={user}
          onClose={() => setAssigning(false)}
          onDone={reload}
        />
      )}

      {adjusting && (
        <Modal
          title="Korekcija sati"
          onClose={() => setAdjusting(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setAdjusting(null)} disabled={busy}>
                Odustani
              </button>
              <button className="btn" disabled={busy || !adjustForm.hours} type="submit" form="sati-forma">
                {busy ? 'Cuva se...' : 'Sacuvaj'}
              </button>
            </>
          }
        >
          <form id="sati-forma" onSubmit={adjust}>
            <Alert>{formError}</Alert>
            <p className="muted" style={{ marginTop: 0 }}>
              {adjusting.package.name} · trenutno {formatHours(adjusting.remainingHours)}
            </p>
            <Field
              label="Promena sati"
              hint="Pozitivan broj dodaje sate, negativan ih oduzima. Sati ne mogu ispod nule."
            >
              <input
                type="number"
                step="0.5"
                value={adjustForm.hours}
                onChange={(e) => setAdjustForm((f) => ({ ...f, hours: e.target.value }))}
                placeholder="npr. 2 ili -1.5"
                required
              />
            </Field>
            <Field label="Razlog">
              <input
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="npr. greska pri odjavi"
              />
            </Field>
          </form>
        </Modal>
      )}

      {history && (
        <Modal title="Istorija korekcija" onClose={() => setHistory(null)} wide>
          {/* Bez ove poruke neuspelo ucitavanje izgleda kao "nema korekcija" -
              a to su dve razlicite stvari. */}
          <Alert>{history.error}</Alert>
          {!history.items ? (
            <Spinner />
          ) : history.error ? null : !history.items.length ? (
            <Empty title="Nema korekcija" text="Sati ovog paketa nisu rucno menjani." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kada</th>
                    <th>Pre</th>
                    <th>Posle</th>
                    <th>Razlog</th>
                    <th>Ko</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((a) => (
                    <tr key={a.id}>
                      <td className="muted" data-label="Kada">{formatDateTime(a.createdAt)}</td>
                      <td data-label="Pre">{formatHours(a.hoursBefore)}</td>
                      <td className="row-main" data-label="Posle">{formatHours(a.hoursAfter)}</td>
                      <td className="muted" data-label="Razlog">{a.reason || '—'}</td>
                      <td className="muted" data-label="Ko">
                        {a.adjustedBy.firstName} {a.adjustedBy.lastName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
