import { useEffect, useState } from 'react';
import { Alert, Field, Modal, Spinner } from './ui';
import { get, post } from '../lib/api';
import { formatHours } from '../lib/format';

// Dodela paketa roditelju. Isti prozor se otvara sa liste roditelja, sa liste
// dece i sa stranice roditelja, da se paket moze dodati odakle god zatreba.
//
// `user` je roditelj kome se dodeljuje. `childName` se prosledjuje kada se
// dodela pokrece sa deteta, da bude jasno o cijem roditelju je rec.
export default function AssignPackage({ user, childName, onClose, onDone }) {
  const [packages, setPackages] = useState(null);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get('/packages')
      .then((d) => {
        const list = d.packages || [];
        setPackages(list);
        // Kada postoji samo jedan paket, nema sta da se bira.
        if (list.length === 1) setSelected(list[0].id);
      })
      .catch((e) => {
        setPackages([]);
        setError(e.message);
      });
  }, []);

  async function assign() {
    setBusy(true);
    setError('');
    try {
      await post('/packages/assign', {
        userId: user.id,
        packageId: selected,
        notes: notes.trim() || undefined,
      });
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Dodela paketa"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose} disabled={busy}>
            Odustani
          </button>
          <button className="btn" onClick={assign} disabled={busy || !selected}>
            {busy ? 'Dodeljuje se...' : 'Dodeli paket'}
          </button>
        </>
      }
    >
      <Alert>{error}</Alert>

      <p className="muted" style={{ marginTop: 0 }}>
        {childName ? (
          <>
            Paket se vodi na roditelja <strong>{user.firstName} {user.lastName}</strong>, pa
            ga koristi i {childName} i ostala njegova deca.
          </>
        ) : (
          <>
            Prima <strong>{user.firstName} {user.lastName}</strong>. Sate koriste sva
            njegova deca.
          </>
        )}
      </p>

      {!packages ? (
        <Spinner />
      ) : !packages.length ? (
        <Alert>Nema nijednog aktivnog paketa. Napravite ga na stranici Paketi.</Alert>
      ) : (
        <div className="pick-list">
          {packages.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pick ${selected === p.id ? 'on' : ''}`}
              onClick={() => setSelected(p.id)}
            >
              <div className="pick-main">
                <div className="pick-title">{p.name}</div>
                {p.description && <div className="pick-sub">{p.description}</div>}
              </div>
              <div className="pick-meta">
                <div className="pick-hours">{formatHours(p.totalHours)}</div>
                <div className="pick-sub">vazi {p.validityDays} dana</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Field label="Napomena (nije obavezno)">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="npr. produzenje, poklon sati"
        />
      </Field>
    </Modal>
  );
}
