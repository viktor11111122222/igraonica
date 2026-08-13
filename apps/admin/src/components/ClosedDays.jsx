import { useState } from 'react';
import { Alert, Badge, Confirm, Empty, Field, Spinner } from './ui';
import { useFetch } from '../hooks/useFetch';
import { del, post } from '../lib/api';
import { DAY_NAMES, fromKey, dayIndex, formatDate, todayKey } from '../lib/format';

// Najcesci razlozi, da se ne kuca svaki put. Razlog je i dalje slobodan tekst -
// ovo su samo precice.
const PREDLOZI = ['Rodjendan', 'Privatna proslava', 'Praznik', 'Godisnji odmor'];

const PRAZNO = { date: '', reason: '', note: '' };

// Neradni dani: datumi kada igraonica ne prima decu. Roditeljska aplikacija ih
// sama pokupi i prikaze obavestenje, bez ikakvog dodatnog unosa.
export default function ClosedDays() {
  const { data, loading, error, reload } = useFetch('/closed-days/all');
  const [form, setForm] = useState(PRAZNO);
  const [brisem, setBrisem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [greska, setGreska] = useState('');

  const dani = data?.closedDays || [];
  const danas = todayKey();

  async function dodaj(e) {
    e.preventDefault();
    setBusy(true);
    setGreska('');
    try {
      await post('/closed-days', {
        date: form.date,
        reason: form.reason.trim(),
        note: form.note.trim() || undefined,
      });
      setForm(PRAZNO);
      reload();
    } catch (err) {
      setGreska(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function obrisi() {
    setBusy(true);
    setGreska('');
    try {
      await del(`/closed-days/${brisem.id}`);
      setBrisem(null);
      reload();
    } catch (err) {
      setGreska(err.message);
    } finally {
      setBusy(false);
    }
  }

  const popunjeno = form.date && form.reason.trim();

  return (
    <div className="card">
      <div className="card-head">
        <h2>Neradni dani</h2>
        <div className="spacer" />
        <Badge tone={dani.length ? 'amber' : 'gray'}>{dani.length}</Badge>
      </div>

      <div className="card-body">
        <Alert>{error || greska}</Alert>

        <p className="muted" style={{ marginTop: 0 }}>
          Dan oznacen ovde aplikacija prikazuje kao neradni i sama javi
          roditeljima da se tog dana ne dolazi. Aktivnosti i jelovnik se za taj
          dan ne prikazuju.
        </p>

        <form onSubmit={dodaj}>
          <div className="field-row">
            <Field label="Datum">
              <input
                type="date"
                value={form.date}
                min={danas}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </Field>
            <Field label="Razlog" hint="Ovo roditelj vidi u aplikaciji.">
              <input
                placeholder="npr. Rodjendan"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                required
              />
            </Field>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {PREDLOZI.map((p) => (
              <button
                type="button"
                key={p}
                className="btn ghost sm"
                onClick={() => setForm((f) => ({ ...f, reason: p }))}
              >
                {p}
              </button>
            ))}
          </div>

          <Field label="Napomena" hint="Nije obavezno.">
            <input
              placeholder="npr. Radimo od 18h"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </Field>

          <button className="btn" type="submit" disabled={busy || !popunjeno}>
            {busy ? 'Cuva se...' : 'Oznaci kao neradni'}
          </button>
        </form>

        <div style={{ marginTop: 18 }}>
          {loading ? (
            <Spinner />
          ) : !dani.length ? (
            <Empty
              title="Nema neradnih dana"
              text="Kada oznacite dan, ovde ce se pojaviti spisak."
            />
          ) : (
            dani.map((d) => {
              const prosao = d.date < danas;
              return (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                    opacity: prosao ? 0.5 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-main">
                      {DAY_NAMES[dayIndex(fromKey(d.date))]}, {formatDate(d.date)}
                    </div>
                    <div className="row-sub">
                      {d.reason}
                      {d.note ? ` · ${d.note}` : ''}
                    </div>
                  </div>
                  {d.date === danas && <Badge tone="amber">danas</Badge>}
                  {prosao && <Badge tone="gray">proslo</Badge>}
                  <button className="btn ghost sm" onClick={() => setBrisem(d)}>
                    Vrati u radne
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {brisem && (
        <Confirm
          title="Vratiti dan u radne?"
          text={`${formatDate(brisem.date)} vise nece biti oznacen kao neradni i obavestenje u aplikaciji nestaje.`}
          confirmLabel="Vrati u radne"
          onConfirm={obrisi}
          onClose={() => setBrisem(null)}
          busy={busy}
        />
      )}
    </div>
  );
}
