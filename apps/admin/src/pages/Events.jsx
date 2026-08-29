import { useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Confirm, Empty, Field, Modal, Pagination, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { del, patch, post } from '../lib/api';
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  formatDate,
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

const statusOf = (key) => EVENT_STATUSES.find((s) => s.key === key) || {};

// Kod tipa "Drugo" u tabeli stoji ono sto je osoblje upisalo - "Drugo" samo po
// sebi ne kaze nista.
const typeLabel = (d) =>
  d.type === 'OTHER'
    ? d.customType || 'Drugo'
    : EVENT_TYPES.find((t) => t.key === d.type)?.label || d.type;

export default function Events() {
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
  const { data, loading, error, reload } = useFetch(`/events?${params}`);

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
      if (form.id) await patch(`/events/${form.id}`, payload);
      else await post('/events', payload);
      setForm(null);
      reload();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatusOf(d, next) {
    try {
      await patch(`/events/${d.id}`, { status: next });
      reload();
    } catch (e) {
      setFormError(e.message);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await del(`/events/${deleting.id}`);
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
      <PageHeader title="Dogadjaji" subtitle="Interna evidencija - vidi je samo osoblje">
        <button className="btn" onClick={() => setForm({ ...EMPTY })}>
          Novi dogadjaj
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
            {EVENT_STATUSES.map((s) => (
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
            {EVENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="card">
          {loading ? (
            <Spinner />
          ) : !data?.events?.length ? (
            <Empty title="Nema dogadjaja" text="Nijedan dogadjaj ne odgovara filterima.">
              <button className="btn" onClick={() => setForm({ ...EMPTY })}>
                Novi dogadjaj
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
                    {data.events.map((d) => {
                      const s = statusOf(d.status);
                      return (
                        <tr key={d.id}>
                          <td data-label="Naziv">
                            <div className="row-main">{d.title}</div>
                            {d.childName && (
                              <div className="row-sub">
                                {d.childName}
                                {d.childAge ? `, ${d.childAge} god.` : ''}
                              </div>
                            )}
                            {d.notes && <div className="row-sub">{d.notes}</div>}
                          </td>
                          <td className="muted" data-label="Tip">{typeLabel(d)}</td>
                          <td className="muted" data-label="Datum">{formatDate(d.date)}</td>
                          <td className="muted" data-label="Vreme">
                            {d.isFullDay ? 'Ceo dan' : `${d.startTime} – ${d.endTime}`}
                          </td>
                          <td data-label="Gosti">{d.guestCount || '—'}</td>
                          <td className="muted" data-label="Kontakt">
                            {d.contactPhone ||
                              (d.user ? `${d.user.firstName} ${d.user.lastName}` : '—')}
                          </td>
                          <td data-label="Status">
                            <Badge tone={s.tone}>{s.label || d.status}</Badge>
                          </td>
                          <td className="actions">
                            {d.status !== 'CONFIRMED' && (
                              <button
                                className="btn secondary sm"
                                onClick={() => setStatusOf(d, 'CONFIRMED')}
                              >
                                Potvrdi
                              </button>
                            )}{' '}
                            {d.status !== 'CANCELLED' && (
                              <button
                                className="btn ghost sm"
                                onClick={() => setStatusOf(d, 'CANCELLED')}
                              >
                                Otkazi
                              </button>
                            )}
                            <button
                              className="btn ghost sm"
                              onClick={() =>
                                setForm({
                                  id: d.id,
                                  type: d.type,
                                  customType: d.customType || '',
                                  title: d.title,
                                  date: d.date.slice(0, 10),
                                  startTime: d.startTime,
                                  endTime: d.endTime,
                                  guestCount: d.guestCount ?? '',
                                  childName: d.childName || '',
                                  childAge: d.childAge ?? '',
                                  contactPhone: d.contactPhone || '',
                                  notes: d.notes || '',
                                  isFullDay: d.isFullDay,
                                })
                              }
                            >
                              Izmeni
                            </button>
                            <button className="btn ghost sm" onClick={() => setDeleting(d)}>
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
          title={form.id ? 'Izmena dogadjaja' : 'Novi dogadjaj'}
          onClose={() => setForm(null)}
          wide
          footer={
            <>
              <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>
                Odustani
              </button>
              <button className="btn" disabled={busy} type="submit" form="dogadjaj-forma">
                {busy ? 'Cuva se...' : 'Sacuvaj'}
              </button>
            </>
          }
        >
          <form id="dogadjaj-forma" onSubmit={save}>
            <Alert>{formError}</Alert>
            <div className="field-row">
              <Field label="Tip">
                <select value={form.type} onChange={set('type')}>
                  {EVENT_TYPES.map((t) => (
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
                  placeholder="npr. Radionica slikanja"
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
          title="Obrisati dogadjaj?"
          text={`"${deleting.title}" ce biti trajno obrisan. Ako zelite da ga samo ponistite, koristite "Otkazi".`}
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
