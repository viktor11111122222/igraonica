import { useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Confirm, Empty, Field, Modal, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { del, patch, post } from '../lib/api';
import { danas, popustLabel, stanje } from '../lib/promotions';

const VRSTE = [
  { key: 'PERCENT', label: 'Procenat' },
  { key: 'AMOUNT', label: 'Iznos u dinarima' },
  { key: 'TEXT', label: 'Opisna (bez broja)' },
];

const PRAZNA = {
  title: '',
  description: '',
  discountType: 'PERCENT',
  discountValue: '',
  dateFrom: danas(),
  dateTo: danas(),
  isActive: true,
};

export default function Promotions() {
  const { data, loading, error, reload } = useFetch('/promotions/all');
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  // Greska pri brisanju ide u sam dijalog - traka na stranici je iza otvorenog
  // prozora, pa je radnik ne vidi.
  const [brisanjeGreska, setBrisanjeGreska] = useState('');
  const [formError, setFormError] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');

    const opisna = form.discountType === 'TEXT';
    const payload = {
      title: form.title,
      description: form.description || undefined,
      discountType: form.discountType,
      discountValue: opisna ? null : Number(form.discountValue),
      dateFrom: form.dateFrom,
      dateTo: form.dateTo,
      isActive: form.isActive,
    };

    try {
      if (form.id) await patch(`/promotions/${form.id}`, payload);
      else await post('/promotions', payload);
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
      await del(`/promotions/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setBrisanjeGreska(e.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const opisna = form?.discountType === 'TEXT';

  return (
    <>
      <PageHeader
        title="Akcije"
        subtitle="Popusti koji vaze u zadatom periodu i vide se u aplikaciji roditelja"
      >
        <button className="btn" onClick={() => setForm({ ...PRAZNA })}>
          Nova akcija
        </button>
      </PageHeader>

      <div className="page">
        <Alert>{error || formError}</Alert>

        {loading ? (
          <Spinner />
        ) : !data?.promotions?.length ? (
          <div className="card">
            <Empty
              title="Nema akcija"
              text="Napravite akciju i roditelji ce je videti u aplikaciji dok traje."
            >
              <button className="btn" onClick={() => setForm({ ...PRAZNA })}>
                Nova akcija
              </button>
            </Empty>
          </div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Naziv</th>
                  <th>Popust</th>
                  <th>Period</th>
                  <th>Stanje</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.promotions.map((p) => {
                  const s = stanje(p);
                  return (
                    <tr key={p.id}>
                      <td data-label="Naziv">
                        <div style={{ fontWeight: 600 }}>{p.title}</div>
                        {p.description && (
                          <div className="muted" style={{ marginTop: 2 }}>
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td data-label="Popust">{popustLabel(p)}</td>
                      <td className="muted" data-label="Period">
                        {p.dateFrom} – {p.dateTo}
                      </td>
                      <td data-label="Stanje">
                        <span className={`badge ${s.key === 'live' ? 'success' : ''}`}>
                          {s.label}
                        </span>
                      </td>
                      <td>
                        <div className="inline">
                          <button
                            className="btn secondary sm"
                            onClick={() =>
                              setForm({
                                id: p.id,
                                title: p.title,
                                description: p.description || '',
                                discountType: p.discountType,
                                discountValue:
                                  p.discountValue === null ? '' : String(p.discountValue),
                                dateFrom: p.dateFrom,
                                dateTo: p.dateTo,
                                isActive: p.isActive,
                              })
                            }
                          >
                            Izmeni
                          </button>
                          <button className="btn ghost sm" onClick={() => setDeleting(p)}>
                            Obrisi
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <Modal
          title={form.id ? 'Izmena akcije' : 'Nova akcija'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>
                Odustani
              </button>
              <button className="btn" disabled={busy} type="submit" form="akcija-forma">
                {busy ? 'Cuva se...' : 'Sacuvaj'}
              </button>
            </>
          }
        >
          <form id="akcija-forma" onSubmit={save}>
            <Alert>{formError}</Alert>

            <Field label="Naziv">
              <input
                value={form.title}
                onChange={set('title')}
                required
                placeholder="npr. Letnja akcija"
              />
            </Field>

            <Field label="Opis">
              <textarea value={form.description} onChange={set('description')} />
            </Field>

            <div className="field-row">
              <Field label="Vrsta popusta">
                <select value={form.discountType} onChange={set('discountType')}>
                  {VRSTE.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Opisna akcija ("drugo dete besplatno") se ne izrazava brojem,
                  pa se polje sklanja umesto da stoji prazno i zbunjuje. */}
              {!opisna && (
                <Field label={form.discountType === 'AMOUNT' ? 'Iznos (RSD)' : 'Procenat (%)'}>
                  <input
                    type="number"
                    min="0"
                    max={form.discountType === 'PERCENT' ? '100' : undefined}
                    step={form.discountType === 'PERCENT' ? '1' : '10'}
                    value={form.discountValue}
                    onChange={set('discountValue')}
                    required
                  />
                </Field>
              )}
            </div>

            <div className="field-row">
              <Field label="Vazi od">
                <input type="date" value={form.dateFrom} onChange={set('dateFrom')} required />
              </Field>
              <Field label="Vazi do" hint="Isti datum znaci da akcija traje jedan dan.">
                <input type="date" value={form.dateTo} onChange={set('dateTo')} required />
              </Field>
            </div>

            <label className="inline" style={{ gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <span>Prikazuj u aplikaciji</span>
            </label>
          </form>
        </Modal>
      )}

      {deleting && (
        <Confirm
          title="Obrisati akciju?"
          text={`"${deleting.title}" ce nestati iz aplikacije. Ako zelite da je sacuvate za kasnije, umesto brisanja iskljucite "Prikazuj u aplikaciji".`}
          confirmLabel="Obrisi"
          busy={busy}
          onConfirm={remove}
          error={brisanjeGreska}
          onClose={() => {
            setDeleting(null);
            setBrisanjeGreska('');
          }}
        />
      )}
    </>
  );
}
