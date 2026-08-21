import { useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Confirm, Empty, Field, Modal, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import ClosedDays from '../components/ClosedDays';
import { del, patch, post } from '../lib/api';
import { DAY_NAMES, formatDate } from '../lib/format';

const EMPTY = {
  title: '',
  description: '',
  dayOfWeek: 0,
  startTime: '10:00',
  endTime: '11:00',
  ageGroup: '',
  color: '#7c9fc9',
  isRecurring: true,
  specificDate: '',
};

// Boje se biraju iz fiksne liste - roditeljska aplikacija ih prikazuje kao
// traku uz aktivnost, pa je bolje da budu ujednacene nego proizvoljne.
const COLORS = ['#7c9fc9', '#f8b653', '#4a9c6d', '#d9534f', '#9b7bc9', '#5bb8c4'];

export default function Schedule() {
  const { data, loading, error, reload } = useFetch('/schedule/all');
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  // Greska pri brisanju ide u sam dijalog. Traka na stranici je iza otvorenog
  // prozora, pa je radnik ne vidi - vidi samo da se nista nije desilo.
  const [brisanjeGreska, setBrisanjeGreska] = useState('');
  const [formError, setFormError] = useState('');

  const activities = data?.activities || [];
  const recurring = activities.filter((a) => a.isRecurring);
  const events = activities.filter((a) => !a.isRecurring);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const payload = {
      title: form.title,
      description: form.description || undefined,
      startTime: form.startTime,
      endTime: form.endTime,
      ageGroup: form.ageGroup || undefined,
      color: form.color || undefined,
      isRecurring: form.isRecurring,
      dayOfWeek: form.isRecurring ? Number(form.dayOfWeek) : undefined,
      specificDate: form.isRecurring ? undefined : form.specificDate,
    };
    try {
      if (form.id) await patch(`/schedule/${form.id}`, payload);
      else await post('/schedule', payload);
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
      await del(`/schedule/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setBrisanjeGreska(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a) {
    try {
      await patch(`/schedule/${a.id}`, { isActive: !a.isActive });
      reload();
    } catch (e) {
      setFormError(e.message);
    }
  }

  function edit(a) {
    setForm({
      id: a.id,
      title: a.title,
      description: a.description || '',
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
      ageGroup: a.ageGroup || '',
      color: a.color || COLORS[0],
      isRecurring: a.isRecurring,
      specificDate: a.specificDate ? a.specificDate.slice(0, 10) : '',
    });
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function Row({ a }) {
    return (
      <div className={`sched-row ${a.isActive ? '' : 'sakriven'}`}>
        <span
          className="sched-color"
          style={{ background: a.color || 'var(--primary)' }}
        />
        <div className="sched-main">
          <div className="row-main">{a.title}</div>
          <div className="row-sub">
            {a.startTime} – {a.endTime}
            {a.ageGroup ? ` · ${a.ageGroup}` : ''}
            {!a.isRecurring && a.specificDate ? ` · ${formatDate(a.specificDate)}` : ''}
          </div>
          {a.description && (
            <div className="row-sub" style={{ color: 'var(--text-muted)' }}>
              {a.description}
            </div>
          )}
        </div>
        <div className="sched-actions">
          {!a.isActive && <Badge tone="gray">Sakriveno</Badge>}
          <button className="btn ghost sm" onClick={() => toggleActive(a)}>
            {a.isActive ? 'Sakrij' : 'Prikazi'}
          </button>
          <button className="btn secondary sm" onClick={() => edit(a)}>
            Izmeni
          </button>
          <button className="btn ghost sm" onClick={() => setDeleting(a)}>
            Obrisi
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Raspored" subtitle="Nedeljne aktivnosti i jednokratni dogadjaji">
        <button className="btn" onClick={() => setForm({ ...EMPTY })}>
          Nova aktivnost
        </button>
      </PageHeader>

      <div className="page stack">
        <Alert>{error || formError}</Alert>

        {loading ? (
          <Spinner />
        ) : (
          <>
            <div className="grid cols-2">
              {DAY_NAMES.map((day, i) => {
                const items = recurring.filter((a) => a.dayOfWeek === i);
                return (
                  <div className="card" key={day}>
                    <div className="card-head">
                      <h2>{day}</h2>
                      <div className="spacer" />
                      <Badge tone={items.length ? 'green' : 'gray'}>{items.length}</Badge>
                    </div>
                    <div className="card-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                      {!items.length ? (
                        <div className="muted" style={{ padding: '14px 0' }}>
                          Nema aktivnosti.
                        </div>
                      ) : (
                        items.map((a) => <Row key={a.id} a={a} />)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Jednokratni dogadjaji</h2>
              </div>
              <div className="card-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                {!events.length ? (
                  <Empty
                    title="Nema jednokratnih dogadjaja"
                    text="Dogadjaji vezani za tacan datum pojavljuju se ovde."
                  />
                ) : (
                  events.map((a) => <Row key={a.id} a={a} />)
                )}
              </div>
            </div>

            <ClosedDays />
          </>
        )}
      </div>

      {form && (
        <Modal
          title={form.id ? 'Izmena aktivnosti' : 'Nova aktivnost'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>
                Odustani
              </button>
              <button className="btn" disabled={busy} type="submit" form="aktivnost-forma">
                {busy ? 'Cuva se...' : 'Sacuvaj'}
              </button>
            </>
          }
        >
          <form id="aktivnost-forma" onSubmit={save}>
            <Alert>{formError}</Alert>
            <Field label="Naziv">
              <input value={form.title} onChange={set('title')} required />
            </Field>
            <Field label="Opis">
              <textarea value={form.description} onChange={set('description')} />
            </Field>

            <label className="check">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked }))}
              />
              Ponavlja se svake nedelje
            </label>

            {form.isRecurring ? (
              <Field label="Dan u nedelji">
                <select value={form.dayOfWeek} onChange={set('dayOfWeek')}>
                  {DAY_NAMES.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Datum">
                <input
                  type="date"
                  value={form.specificDate}
                  onChange={set('specificDate')}
                  required
                />
              </Field>
            )}

            <div className="field-row">
              <Field label="Pocetak">
                <input type="time" value={form.startTime} onChange={set('startTime')} required />
              </Field>
              <Field label="Kraj">
                <input type="time" value={form.endTime} onChange={set('endTime')} required />
              </Field>
            </div>

            <Field label="Uzrast">
              <input value={form.ageGroup} onChange={set('ageGroup')} placeholder="npr. 3-6 godina" />
            </Field>

            <Field label="Boja">
              <div className="inline">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: c,
                      border:
                        form.color === c ? '3px solid var(--text)' : '1px solid var(--border)',
                    }}
                    aria-label={c}
                  />
                ))}
              </div>
            </Field>
          </form>
        </Modal>
      )}

      {deleting && (
        <Confirm
          title="Obrisati aktivnost?"
          text={`"${deleting.title}" ce biti trajno obrisana iz rasporeda.`}
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
