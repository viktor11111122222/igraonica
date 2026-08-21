import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Confirm, Empty, Spinner } from '../components/ui';
import QrScanner from '../components/QrScanner';
import useHardwareScanner, { OBRAZAC_KODA } from '../hooks/useHardwareScanner';
import { useActiveVisits } from '../hooks/useActiveVisits';
import { post } from '../lib/api';
import { formatDuration, formatHours, formatTime } from '../lib/format';

// Glavni radni ekran osoblja: skener QR koda plus lista dece koja su unutra.
//
// Smer se ne bira rukom. Isti kod znaci dolazak ili odlazak, zavisi samo od
// toga da li je dete vec unutra - radnik sa telefonom u ruci nema kad da pazi
// na prekidac, a pogresan rezim je tiha greska koja se vidi tek u obracunu.
export default function CheckIn() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Greska iz "Zatvori sve" ide u sam dijalog - traka ishoda je iza njega.
  const [closeError, setCloseError] = useState('');
  const [scanning, setScanning] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef(null);
  const resultRef = useRef(null);
  const scannerRef = useRef(null);

  // Lista se osvezava sama - trajanje boravka raste dok je ekran otvoren.
  // Isti izvor hrani i znacku u bocnoj traci, pa ide jedan zahtev umesto dva.
  const {
    visits,
    loading,
    error: listaGreska,
    reload: loadVisits,
  } = useActiveVisits();

  // Rezultat je jedini povratni podatak koji radnik ceka, a na telefonu je
  // ispod pregiba cim se kamera otvori. Zato mu se ekran sam vraca. Razmak
  // ispod zaglavlja drzi `scroll-margin-top` u CSS-u - zaglavlje je lepljivo,
  // pa bi inace prekrilo vrh trake.
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [result]);

  // Kamera se pali dugmetom sa trake ishoda, koja je na vrhu strane - bez ovoga
  // bi se otvorila ispod pregiba i radnik bi gledao u prazno.
  useEffect(() => {
    if (scanning) scannerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [scanning]);

  // Spisak prisutnih je vec ucitan, pa se smer zna bez dodatnog pitanja
  // serveru.
  function jeUnutra(qrCode) {
    return visits.some((v) => v.child.qrCode === qrCode);
  }

  async function submit(e, forcedCode) {
    e?.preventDefault();
    const uneto = (forcedCode ?? code).trim().toUpperCase();
    if (!uneto) return;

    // Poneki citac dopise svoj prefiks pre koda. Kod ima fiksan oblik, pa se
    // izvlaci; ako ga nema, ide sta je uneto i server javi da kod ne postoji.
    const qrCode = uneto.match(OBRAZAC_KODA)?.[0] ?? uneto;

    // Dva citanja u razmaku od par desetina milisekundi bi inace poslala dva
    // zahteva, pa bi drugi odmah odjavio dete koje je prvi prijavio.
    if (busyRef.current) return;
    busyRef.current = true;

    const smer = jeUnutra(qrCode) ? 'out' : 'in';

    setBusy(true);
    setResult(null);
    try {
      const path = smer === 'in' ? '/visits/check-in' : '/visits/check-out';
      const data = await post(path, { qrCode });
      setResult({
        ok: true,
        smer,
        message: data.message,
        remainingHours: data.remainingHours,
        duration: data.duration,
      });
      setCode('');
      loadVisits();
    } catch (e) {
      setResult({ ok: false, message: e.message });
    } finally {
      busyRef.current = false;
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  // Citac sa kase se ponasa kao tastatura i kuca bilo gde na strani, pa se
  // hvata van forme. Dok je otvorena potvrda za "Zatvori sve", skeniranje bi
  // radilo iza dijaloga - zato je tada iskljuceno.
  useHardwareScanner(
    (qrCode) => {
      setScanning(false);
      setCode('');
      submit(null, qrCode);
    },
    { enabled: !confirmClose }
  );

  async function autoClose() {
    setClosing(true);
    try {
      const data = await post('/visits/auto-close');
      setResult({ ok: true, message: data.message });
      setConfirmClose(false);
      loadVisits();
    } catch (e) {
      setCloseError(e.message);
    } finally {
      setClosing(false);
    }
  }

  const smerUnetog = jeUnutra(code.trim().toUpperCase()) ? 'out' : 'in';

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
        {result && (
          <div
            ref={resultRef}
            className={`scan-result ${result.ok ? result.smer || 'in' : 'bad'}`}
            role="status"
            aria-live="polite"
          >
            <div className="scan-result-mark" aria-hidden="true">
              {result.ok ? '✓' : '!'}
            </div>
            <div className="scan-result-text">
              <div className="scan-result-title">{result.message}</div>
              {(result.duration || result.remainingHours != null) && (
                <div className="scan-result-meta">
                  {result.duration && `Naplaceno ${formatDuration(result.duration.charged)}. `}
                  {result.remainingHours != null &&
                    `Preostalo: ${formatHours(result.remainingHours)}.`}
                </div>
              )}
            </div>
            <button
              className="btn secondary scan-result-next"
              onClick={() => {
                setResult(null);
                setScanning(true);
              }}
            >
              {result.ok ? 'Skeniraj sledece' : 'Skeniraj ponovo'}
            </button>
          </div>
        )}

        <div className="card" ref={scannerRef}>
          <div className="card-body">
            <form onSubmit={submit}>
              <button
                type="button"
                className={`btn ${scanning ? '' : 'secondary'} block`}
                style={{ marginBottom: 14 }}
                onClick={() => setScanning((s) => !s)}
              >
                {scanning ? 'Ugasi kameru' : 'Skeniraj kamerom'}
              </button>

              {/* Skenirani kod ide istim putem kao rucno unet, pa se ponasanje
                  ne racva na dva mesta. Kamera se gasi posle jednog citanja -
                  inace bi isti kod pred objektivom odmah okinuo i odjavu. */}
              <QrScanner
                active={scanning}
                onScan={(qrCode) => {
                  setScanning(false);
                  submit(null, qrCode);
                }}
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
                  {busy ? 'Salje se...' : smerUnetog === 'in' ? 'Prijavi' : 'Odjavi'}
                </button>
              </div>
              <div className="field-hint">
                Prvo skeniranje prijavljuje dete, sledece ga odjavljuje. Kamera,
                rucni citac i kucanje rade isto.
              </div>
            </form>
          </div>
        </div>

        <Alert>{listaGreska}</Alert>

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
                      <td data-label="Dete">
                        <div className="row-main">
                          {v.child.firstName} {v.child.lastName}
                        </div>
                        <div className="row-sub mono">{v.child.qrCode}</div>
                      </td>
                      <td className="muted" data-label="Roditelj">
                        {v.child.parent.firstName} {v.child.parent.lastName}
                      </td>
                      <td className="muted" data-label="Prijavljen">{formatTime(v.checkedInAt)}</td>
                      <td data-label="Boravi">{formatDuration(v.currentDurationMinutes)}</td>
                      <td data-label="Preostalo u paketu">
                        {v.userPackage ? formatHours(v.userPackage.remainingHours) : '—'}
                      </td>
                      <td className="actions">
                        <button
                          className="btn accent sm"
                          onClick={(e) => submit(e, v.child.qrCode)}
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
          error={closeError}
          onConfirm={autoClose}
          onClose={() => {
            setConfirmClose(false);
            setCloseError('');
          }}
        />
      )}
    </>
  );
}
