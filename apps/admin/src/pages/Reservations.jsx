import { useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Confirm, Empty, Field, Modal, Pagination, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { del, patch, post } from '../lib/api';
import {
  formatDate,
  RESERVATION_STATUSES,
  RESERVATION_TYPES,
  todayKey,
} from '../lib/format';

const EMPTY = {
  type: 'BIRTHDAY',
  customType: '',
  title: '',
  date: todayKey(),
  startTime: '17:00',
  endTime: '20:00',
  guestCount: '',
  childName: '',
  childAge: '',
  contactPhone: '',
  notes: '',
  isFullDay: false,
};

const statusOf = (key) => RESERVATION_STATUSES.find((s) => s.key === key) || {};

// Kod tipa "Drugo" u tabeli stoji ono sto je osoblje upisalo - "Drugo" samo po
// sebi ne kaze nista.
const typeLabel = (r) =>
  r.type === 'OTHER'
    ? r.customType || 'Drugo'
    : RESERVATION_TYPES.find((t) => t.key === r.type)?.label || r.type;

export default function Reservations() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  // Greska pri brisanju ide u sam dijalog. Traka na stranici je iza otvorenog
  // prozora, pa je radnik ne vidi - vidi samo da se nista nije desilo.
  const [brisanjeGreska, setBrisanjeGreska] = useState('');
  const [formError, setFormError] = useState('');

  const params = new URLSearchParams({ page, limit: 20 });
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  const { data, loading, error, reload } = useFetch(`/reservations/all?${params}`);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const payload = {
      type: form.type,
      customType: form.type === 'OTHER' ? form.customType : undefined,
      title: form.title,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      guestCount: form.guestCount ? Number(form.guestCount) : undefined,
      childName: form.childName || undefined,
      childAge: form.childAge ? Number(form.childAge) : undefined,
      contactPhone: form.contactPhone || undefined,
      notes: form.notes || undefined,
      isFullDay: form.isFullDay,
    };
    try {
      if (form.id) await patch(`/reservations/${form.id}`, payload);
      else await post('/reservations', payload);
      setForm(null);
      reload();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatusOf(r, next) {
    try {
      await patch(`/reservations/${r.id}`, { status: next });
      reload();
    } catch (e) {
      setFormError(e.message);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await del(`/reservations/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setBrisanjeGreska(e.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Rezervacije" subtitle="Rodjendani, proslave, mesecni i sopstveni dogadjaji">
        <button className="btn" onClick={() => setForm({ ...EMPTY })}>
          Nova rezervacija
        </button>
      </PageHeader>

      <div className="page">
        <Alert>{error || formError}</Alert>

        <div className="toolbar">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Svi statusi</option>
            {RESERVATION_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Svi tipovi</option>
            {RESERVATION_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="card">
          {loading ? (
            <Spinner />
          ) : !data?.reservations?.length ? (
            <Empty title="Nema rezervacija" text="Nijedna rezervacija ne odgovara filterima.">
              <button className="btn" onClick={() => setForm({ ...EMPTY })}>
                Nova rezervacija
              </button>
            </Empty>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Naziv</th>
                      <th>Tip</th>
                      <th>Datum</th>
                      <th>Vreme</th>
                      <th>Gosti</th>
                      <th>Kontakt</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reservations.map((r) => {
                      const s = statusOf(r.status);
                      return (
                        <tr key={r.id}>
                          <td data-label="Naziv">
                            <div className="row-main">{r.title}</div>
                            {r.childName && (
                              <div className="row-sub">
                                {r.childName}
                                {r.childAge ? `, ${r.childAge} god.` : ''}
                              </div>
                            )}
                            {r.notes && <div className="row-sub">{r.notes}</div>}
                          </td>
                          <td className="muted" data-label="Tip">{typeLabel(r)}</td>
                          <td className="muted" data-label="Datum">{formatDate(r.date)}</td>
                          <td className="muted" data-label="Vreme">
                            {r.isFullDay ? 'Ceo dan' : `${r.startTime} – ${r.endTime}`}
                          </td>
                          <td data-label="Gosti">{r.guestCount || '—'}</td>
                          <td className="muted" data-label="Kontakt">
                            {r.contactPhone ||
                              (r.user ? `${r.user.firstName} ${r.user.lastName}` : '—')}
                          </td>
                          <td data-label="Status">
                            <Badge tone={s.tone}>{s.label || r.status}</Badge>
                          </td>
                          <td className="actions">
                            {r.status !== 'CONFIRMED' && (
                              <button
                                className="btn secondary sm"
                                onClick={() => setStatusOf(r, 'CONFIRMED')}
                              >
                                Potvrdi
                              </button>
                            )}{' '}
                            {r.status !== 'CANCELLED' && (
                              <button
                                className="btn ghost sm"
                                onClick={() => setStatusOf(r, 'CANCELLED')}
                              >
                                Otkazi
                              </button>
                            )}
                            <button
                              className="btn ghost sm"
                              onClick={() =>
                                setForm({
                                  id: r.id,
                                  type: r.type,
                                  customType: r.customType || '',
                                  title: r.title,
                                  date: r.date.slice(0, 10),
                                  startTime: r.startTime,
                                  endTime: r.endTime,
                                  guestCount: r.guestCount ?? '',
                                  childName: r.childName || '',
                                  childAge: r.childAge ?? '',
                                  contactPhone: r.contactPhone || '',
                                  notes: r.notes || '',
                                  isFullDay: r.isFullDay,
                                })
                              }
                            >
                              Izmeni
                            </button>
                            <button className="btn ghost sm" onClick={() => setDeleting(r)}>
                              Obrisi
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
          title={form.id ? 'Izmena rezervacije' : 'Nova rezervacija'}
          onClose={() => setForm(null)}
          wide
          footer={
            <>
              <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>
                Odustani
              </button>
              <button className="btn" disabled={busy} type="submit" form="rezervacija-forma">
                {busy ? 'Cuva se...' : 'Sacuvaj'}
              </button>
            </>
          }
        >
          <form id="rezervacija-forma" onSubmit={save}>
            <Alert>{formError}</Alert>
            <div className="field-row">
              <Field label="Tip">
                <select value={form.type} onChange={set('type')}>
                  {RESERVATION_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Naziv">
                <input value={form.title} onChange={set('title')} required />
              </Field>
            </div>

            {form.type === 'OTHER' && (
              <Field label="Naziv tipa">
                <input
                  value={form.customType}
                  onChange={set('customType')}
                  placeholder="npr. Skolska ekskurzija"
                  required
                />
              </Field>
            )}

            <div className="field-row">
              <Field label="Datum">
                <input type="date" value={form.date} onChange={set('date')} required />
              </Field>
              <Field label="Broj gostiju">
                <input type="number" min="1" value={form.guestCount} onChange={set('guestCount')} />
              </Field>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={form.isFullDay}
                onChange={(e) => setForm((f) => ({ ...f, isFullDay: e.target.checked }))}
              />
              Zauzima ceo dan
            </label>

            <div className="field-row">
              <Field label="Pocetak">
                <input type="time" value={form.startTime} onChange={set('startTime')} required />
              </Field>
              <Field label="Kraj">
                <input type="time" value={form.endTime} onChange={set('endTime')} required />
              </Field>
            </div>

            <div className="field-row">
              <Field label="Ime deteta">
                <input value={form.childName} onChange={set('childName')} />
              </Field>
              <Field label="Uzrast deteta">
                <input type="number" min="0" value={form.childAge} onChange={set('childAge')} />
              </Field>
            </div>

            <Field label="Kontakt telefon">
              <input value={form.contactPhone} onChange={set('contactPhone')} />
            </Field>
            <Field label="Napomene">
              <textarea value={form.notes} onChange={set('notes')} />
            </Field>
          </form>
        </Modal>
      )}

      {deleting && (
        <Confirm
          title="Obrisati rezervaciju?"
          text={`"${deleting.title}" ce biti trajno obrisana. Ako zelite da je samo ponistite, koristite "Otkazi".`}
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
