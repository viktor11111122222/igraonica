import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { del, post } from '../lib/api';
import { addDays, DAY_NAMES, fromKey, MEALS, todayKey, toKey } from '../lib/format';

const cellKey = (date, meal) => `${date}|${meal}`;
const emptyCell = () => ({ id: null, name: '', description: '', allergens: '' });

export default function Menu() {
  const [anchor, setAnchor] = useState(todayKey());
  const { data, loading, error } = useFetch(`/menu/week?date=${anchor}`);

  const [draft, setDraft] = useState({});
  const [status, setStatus] = useState({});
  const [saveError, setSaveError] = useState('');
  const todayRef = useRef(null);
  const savedTimers = useRef({});

  const dates = useMemo(() => (data?.week ? Object.keys(data.week).sort() : []), [data]);

  // Draft se puni iz ucitane nedelje. Svaka celija pamti i id postojece
  // stavke - po njemu se zna sta treba obrisati kada se polje isprazni.
  useEffect(() => {
    if (!data?.week) return;
    const next = {};
    for (const [date, items] of Object.entries(data.week)) {
      for (const meal of MEALS) {
        const item = items.find((i) => i.mealType === meal.key);
        next[cellKey(date, meal.key)] = item
          ? {
              id: item.id,
              name: item.name,
              description: item.description || '',
              allergens: item.allergens || '',
            }
          : emptyCell();
      }
    }
    setDraft(next);
  }, [data]);

  // Status se cisti samo pri promeni nedelje. Da se cisti na svako
  // osvezavanje podataka, potvrda "Sacuvano" bi nestala pre nego sto se vidi.
  useEffect(() => setStatus({}), [anchor]);

  // Danasnji dan je onaj koji se najcesce unosi, pa se skace na njega.
  useEffect(() => {
    if (!dates.length) return;
    const timer = setTimeout(
      () => todayRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      100
    );
    return () => clearTimeout(timer);
  }, [dates]);

  function update(key, field, value) {
    const [date] = key.split('|');
    setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));
    setStatus((s) => ({ ...s, [date]: 'dirty' }));
  }

  function dayCells(date) {
    return MEALS.map((meal) => ({
      meal,
      key: cellKey(date, meal.key),
      cell: draft[cellKey(date, meal.key)] || emptyCell(),
    }));
  }

  const filledCount = (date) => dayCells(date).filter((c) => c.cell.name.trim()).length;

  async function saveDay(date) {
    setStatus((s) => ({ ...s, [date]: 'saving' }));
    setSaveError('');
    try {
      const items = [];
      const toDelete = [];

      for (const { meal, cell } of dayCells(date)) {
        const name = cell.name.trim();
        if (name) {
          items.push({
            date,
            mealType: meal.key,
            name,
            description: cell.description.trim() || undefined,
            allergens: cell.allergens.trim() || undefined,
          });
        } else if (cell.id) {
          // Ime obrisano, a stavka postoji - obrok je uklonjen.
          toDelete.push(cell.id);
        }
      }

      const saved = items.length ? await post('/menu/bulk', { items }) : null;
      for (const id of toDelete) await del(`/menu/${id}`);

      // Namerno bez reload(): ponovno ucitavanje cele nedelje pobrisalo bi
      // ono sto je u medjuvremenu otkucano na drugim danima. Dovoljno je
      // preuzeti id-jeve novih stavki, zbog kasnijeg brisanja.
      setDraft((d) => {
        const next = { ...d };
        for (const item of saved?.items || []) {
          const key = cellKey(date, item.mealType);
          next[key] = { ...next[key], id: item.id };
        }
        for (const meal of MEALS) {
          const key = cellKey(date, meal.key);
          if (!next[key]?.name.trim()) next[key] = emptyCell();
        }
        return next;
      });

      setStatus((s) => ({ ...s, [date]: 'saved' }));
      clearTimeout(savedTimers.current[date]);
      savedTimers.current[date] = setTimeout(
        () => setStatus((s) => (s[date] === 'saved' ? { ...s, [date]: null } : s)),
        4000
      );
    } catch (e) {
      setSaveError(e.message);
      setStatus((s) => ({ ...s, [date]: 'dirty' }));
    }
  }

  // Prepisivanje sa prethodnog dana - najbrzi nacin da se popuni nedelja.
  function copyFromPrevious(date) {
    const prev = toKey(addDays(fromKey(date), -1));
    setDraft((d) => {
      const next = { ...d };
      for (const meal of MEALS) {
        const from = d[cellKey(prev, meal.key)];
        if (!from) continue;
        next[cellKey(date, meal.key)] = {
          // id ostaje od ciljnog dana: prepisuje se sadrzaj, ne identitet.
          id: next[cellKey(date, meal.key)]?.id || null,
          name: from.name,
          description: from.description,
          allergens: from.allergens,
        };
      }
      return next;
    });
    setStatus((s) => ({ ...s, [date]: 'dirty' }));
  }

  function shiftWeek(days) {
    setAnchor(toKey(addDays(fromKey(data?.weekStart || anchor), days)));
  }

  const today = todayKey();

  return (
    <>
      <PageHeader title="Jelovnik" subtitle="Unos obroka po danima. Svaki dan se cuva zasebno.">
        <button className="btn secondary" onClick={() => setAnchor(todayKey())}>
          Ova nedelja
        </button>
      </PageHeader>

      <div className="page">
        <Alert>{error || saveError}</Alert>

        <div className="toolbar">
          <button className="btn secondary" onClick={() => shiftWeek(-7)}>
            ← Prethodna
          </button>
          <div style={{ fontWeight: 700, minWidth: 210, textAlign: 'center' }}>
            {data?.weekStart && data?.weekEnd
              ? `${fromKey(data.weekStart).toLocaleDateString('sr-RS')} — ${fromKey(
                  data.weekEnd
                ).toLocaleDateString('sr-RS')}`
              : '...'}
          </div>
          <button className="btn secondary" onClick={() => shiftWeek(7)}>
            Sledeca →
          </button>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <div className="stack">
            {dates.map((date, index) => {
              const d = fromKey(date);
              const isToday = date === today;
              const state = status[date];
              const filled = filledCount(date);

              return (
                <div
                  className="card"
                  key={date}
                  ref={isToday ? todayRef : null}
                  style={
                    isToday
                      ? { borderColor: 'var(--primary)', borderWidth: 2 }
                      : undefined
                  }
                >
                  <div className="card-head">
                    <h2>
                      {DAY_NAMES[(d.getDay() + 6) % 7]}, {d.toLocaleDateString('sr-RS')}
                    </h2>
                    {isToday && <Badge tone="amber">danas</Badge>}
                    <Badge tone={filled ? 'green' : 'gray'}>
                      {filled ? `${filled} od 4 obroka` : 'prazno'}
                    </Badge>

                    <div className="spacer" />

                    {index > 0 && (
                      <button
                        className="btn ghost sm"
                        onClick={() => copyFromPrevious(date)}
                        title="Prepisi obroke sa prethodnog dana"
                      >
                        Kopiraj prethodni dan
                      </button>
                    )}

                    {state === 'saved' && (
                      <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>
                        Sacuvano ✓
                      </span>
                    )}
                    <button
                      className={`btn ${state === 'dirty' ? '' : 'secondary'}`}
                      onClick={() => saveDay(date)}
                      disabled={state === 'saving' || !state}
                    >
                      {state === 'saving'
                        ? 'Cuva se...'
                        : state === 'dirty'
                          ? 'Sacuvaj ovaj dan'
                          : 'Sacuvano'}
                    </button>
                  </div>

                  <div className="card-body">
                    <div className="grid meals">
                      {dayCells(date).map(({ meal, key, cell }) => (
                        <div key={meal.key}>
                          <div className="section-title">{meal.label}</div>
                          <div className="field">
                            <input
                              placeholder="Naziv jela"
                              value={cell.name}
                              onChange={(e) => update(key, 'name', e.target.value)}
                            />
                          </div>
                          {/* Opis i alergeni imaju smisla tek kada postoji jelo. */}
                          {cell.name.trim() !== '' && (
                            <div className="field-row">
                              <div className="field" style={{ marginBottom: 0 }}>
                                <input
                                  placeholder="Opis"
                                  value={cell.description}
                                  onChange={(e) => update(key, 'description', e.target.value)}
                                />
                              </div>
                              <div className="field" style={{ marginBottom: 0 }}>
                                <input
                                  placeholder="Alergeni"
                                  value={cell.allergens}
                                  onChange={(e) => update(key, 'allergens', e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
