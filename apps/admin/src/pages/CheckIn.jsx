import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Confirm, Empty, Spinner } from '../components/ui';
import QrScanner from '../components/QrScanner';
import { get, post } from '../lib/api';
import { formatDuration, formatHours, formatTime } from '../lib/format';

// Glavni radni ekran osoblja: skener QR koda plus lista dece koja su unutra.
export default function CheckIn() {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('in');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);

  async function loadVisits() {
    try {
      const data = await get('/visits/active');
      setVisits(data.visits || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Lista se osvezava sama - trajanje boravka raste dok je ekran otvoren.
  useEffect(() => {
    loadVisits();
    const timer = setInterval(loadVisits, 30000);
    return () => clearInterval(timer);
  }, []);

  async function submit(e, forcedCode, forcedMode) {
    e?.preventDefault();
    const qrCode = (forcedCode ?? code).trim();
    if (!qrCode) return;

    setBusy(true);
    setError('');
    setResult(null);
    try {
      const path = (forcedMode ?? mode) === 'in' ? '/visits/check-in' : '/visits/check-out';
      const data = await post(path, { qrCode });
      setResult(data);
      setCode('');
      loadVisits();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      // Citac QR koda "kuca" u polje, pa fokus mora da ostane na njemu.
      inputRef.current?.focus();
    }
  }

  async function autoClose() {
    setClosing(true);
    try {
      const data = await post('/visits/auto-close');
      setResult({ message: data.message });
      setConfirmClose(false);
      loadVisits();
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(false);
    }
  }

  return (
    <>
      <PageHeader title="Prijave" subtitle="Skeniranje QR koda pri dolasku i odlasku">
        <button
          className="btn secondary"
          onClick={() => setConfirmClose(true)}
          disabled={!visits.length}
        >
          Zatvori sve ({visits.length})
        </button>
      </PageHeader>

      <div className="page stack">
        <div className="card">
          <div className="card-body">
            <form onSubmit={submit}>
              <div className="inline" style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className={`btn ${mode === 'in' ? '' : 'secondary'}`}
                  onClick={() => setMode('in')}
                >
                  Prijava
                </button>
                <button
                  type="button"
                  className={`btn ${mode === 'out' ? 'accent' : 'secondary'}`}
                  onClick={() => setMode('out')}
                >
                  Odjava
                </button>

                <div className="spacer" />

                <button
                  type="button"
                  className={`btn ${scanning ? '' : 'secondary'}`}
                  onClick={() => setScanning((s) => !s)}
                >
                  {scanning ? 'Ugasi kameru' : 'Skeniraj kamerom'}
                </button>
              </div>

              {/* Skenirani kod ide istim putem kao rucno unet, pa se ponasanje
                  ne racva na dva mesta. */}
              <QrScanner
                active={scanning}
                onScan={(qrCode) => submit(null, qrCode)}
                onError={setError}
              />

              <div className="inline">
                <input
                  ref={inputRef}
                  className="search"
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    fontSize: 16,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                  placeholder="IGR-XXXXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoFocus
                />
                <button className="btn" type="submit" disabled={busy || !code.trim()}>
                  {busy ? 'Salje se...' : mode === 'in' ? 'Prijavi' : 'Odjavi'}
                </button>
              </div>
              <div className="field-hint">
                Skenirajte kamerom, citacem, ili unesite kod rucno - svejedno je.
              </div>
            </form>

            <div style={{ marginTop: 16 }}>
              <Alert>{error}</Alert>
              {result && (
                <Alert tone="ok">
                  {result.message}
                  {result.remainingHours != null &&
                    ` Preostalo: ${formatHours(result.remainingHours)}.`}
                  {result.duration &&
                    ` Naplaceno ${formatDuration(result.duration.charged)}.`}
                </Alert>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Trenutno u igraonici</h2>
            <div className="spacer" />
            <Badge tone={visits.length ? 'green' : 'gray'}>{visits.length} dece</Badge>
          </div>

          {loading ? (
            <Spinner />
          ) : !visits.length ? (
            <Empty title="Igraonica je prazna" text="Nijedno dete trenutno nije prijavljeno." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Dete</th>
                    <th>Roditelj</th>
                    <th>Prijavljen</th>
                    <th>Boravi</th>
                    <th>Preostalo u paketu</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div className="row-main">
                          {v.child.firstName} {v.child.lastName}
                        </div>
                        <div className="row-sub mono">{v.child.qrCode}</div>
                      </td>
                      <td className="muted">
                        {v.child.parent.firstName} {v.child.parent.lastName}
                      </td>
                      <td className="muted">{formatTime(v.checkedInAt)}</td>
                      <td>{formatDuration(v.currentDurationMinutes)}</td>
                      <td>
                        {v.userPackage ? formatHours(v.userPackage.remainingHours) : '—'}
                      </td>
                      <td className="actions">
                        <button
                          className="btn accent sm"
                          onClick={(e) => submit(e, v.child.qrCode, 'out')}
                          disabled={busy}
                        >
                          Odjavi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {confirmClose && (
        <Confirm
          title="Zatvoriti sve posete?"
          text={`${visits.length} dece je jos prijavljeno. Svima ce biti obracunato vreme do sada i oduzeti sati iz paketa. Ovo se ne moze ponistiti.`}
          confirmLabel="Zatvori sve"
          busy={closing}
          onConfirm={autoClose}
          onClose={() => setConfirmClose(false)}
        />
      )}
    </>
  );
}
