import { useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Confirm, Empty, Field, Modal, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { del, patch, post } from '../lib/api';
import { formatHours } from '../lib/format';

const EMPTY = { name: '', description: '', totalHours: '', validityDays: '30' };

export default function Packages() {
  const { data, loading, error, reload } = useFetch('/packages');
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const payload = {
      name: form.name,
      description: form.description || undefined,
      totalHours: Number(form.totalHours),
      validityDays: Number(form.validityDays),
    };
    try {
      if (form.id) await patch(`/packages/${form.id}`, payload);
      else await post('/packages', payload);
      setForm(null);
      reload();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await del(`/packages/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Paketi" subtitle="Ponuda paketa sati koju osoblje dodeljuje roditeljima">
        <button className="btn" onClick={() => setForm({ ...EMPTY })}>
          Nov paket
        </button>
      </PageHeader>

      <div className="page">
        <Alert>{error || formError}</Alert>

        {loading ? (
          <Spinner />
        ) : !data?.packages?.length ? (
          <div className="card">
            <Empty title="Nema paketa" text="Napravite prvi paket da biste mogli da ga dodelite.">
              <button className="btn" onClick={() => setForm({ ...EMPTY })}>
                Nov paket
              </button>
            </Empty>
          </div>
        ) : (
          <div className="grid cols-3">
            {data.packages.map((p) => (
              <div className="card" key={p.id}>
                <div className="card-body">
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                  {p.description && (
                    <div className="muted" style={{ marginTop: 4, lineHeight: 1.5 }}>
                      {p.description}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      gap: 18,
                      marginTop: 16,
                      paddingTop: 14,
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div className="stat-label">Sati</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>
                        {formatHours(p.totalHours)}
                      </div>
                    </div>
                    <div>
                      <div className="stat-label">Vazi</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{p.validityDays} d</div>
                    </div>
                  </div>
                  <div className="inline" style={{ marginTop: 16 }}>
                    <button
                      className="btn secondary sm"
                      onClick={() =>
                        setForm({
                          id: p.id,
                          name: p.name,
                          description: p.description || '',
                          totalHours: String(p.totalHours),
                          validityDays: String(p.validityDays),
                        })
                      }
                    >
                      Izmeni
                    </button>
                    <button className="btn ghost sm" onClick={() => setDeleting(p)}>
                      Deaktiviraj
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && (
        <Modal
          title={form.id ? 'Izmena paketa' : 'Nov paket'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>
                Odustani
              </button>
              <button className="btn" onClick={save} disabled={busy}>
                {busy ? 'Cuva se...' : 'Sacuvaj'}
              </button>
            </>
          }
        >
          <form onSubmit={save}>
            <Alert>{formError}</Alert>
            <Field label="Naziv">
              <input value={form.name} onChange={set('name')} required placeholder="npr. Paket 10h" />
            </Field>
            <Field label="Opis">
              <textarea value={form.description} onChange={set('description')} />
            </Field>
            <div className="field-row">
              <Field label="Ukupno sati">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={form.totalHours}
                  onChange={set('totalHours')}
                  required
                />
              </Field>
            </div>
            <Field label="Vazenje (dana)" hint="Racuna se od dana dodele roditelju.">
              <input
                type="number"
                min="1"
                value={form.validityDays}
                onChange={set('validityDays')}
                required
              />
            </Field>
          </form>
        </Modal>
      )}

      {deleting && (
        <Confirm
          title="Deaktivirati paket?"
          text={`"${deleting.name}" vise nece moci da se dodeli. Vec dodeljeni paketi roditeljima ostaju netaknuti.`}
          confirmLabel="Deaktiviraj"
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
