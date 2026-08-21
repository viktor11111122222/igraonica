import { cloneElement, isValidElement, useEffect, useId, useRef } from 'react';

export function Spinner() {
  return <div className="spinner" />;
}

export function Empty({ title, text, children }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {text && <div>{text}</div>}
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}

export function Alert({ tone = 'error', children }) {
  if (!children) return null;
  return <div className={`alert ${tone}`}>{children}</div>;
}

export function Badge({ tone, children }) {
  return <span className={`badge ${tone || ''}`}>{children}</span>;
}

// Natpis se vezuje za samo polje. Bez `htmlFor`/`id` citac ekrana ne zna cemu
// natpis pripada, a klik na natpis ne fokusira polje.
export function Field({ label, hint, children }) {
  const id = useId();
  const kontrola =
    isValidElement(children) && children.props.id === undefined
      ? cloneElement(children, { id })
      : children;

  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {kontrola}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

// Prekidac. Klik je i potvrda - nema odvojenog "Sacuvaj".
export function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`switch ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}

// Broj se menja dugmadima i precicama, tastatura je samo za neobicne vrednosti.
export function Stepper({ value, onChange, step = 5, min = 1, max = 240, presets = [], unit }) {
  const n = Number(value) || 0;
  const clamp = (v) => Math.min(max, Math.max(min, v));

  return (
    <div className="stepper-wrap">
      <div className="stepper">
        <button type="button" onClick={() => onChange(String(clamp(n - step)))} disabled={n <= min}>
          −
        </button>
        <span className="stepper-value">
          {n}
          {unit && <em>{unit}</em>}
        </span>
        <button type="button" onClick={() => onChange(String(clamp(n + step)))} disabled={n >= max}>
          +
        </button>
      </div>
      {presets.length > 0 && (
        <div className="chips">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={`chip ${n === p ? 'on' : ''}`}
              onClick={() => onChange(String(p))}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Red sa nazivom levo i kontrolom desno.
export function SettingRow({ label, hint, children, status }) {
  return (
    <div className="setting-row">
      <div className="setting-text">
        <div className="setting-label">
          {label}
          {status === 'saving' && <span className="setting-status">cuva se...</span>}
          {status === 'saved' && <span className="setting-status ok">sacuvano ✓</span>}
        </div>
        {hint && <div className="setting-hint">{hint}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

// Sta se moze fokusirati unutar prozora - potrebno i za pocetni fokus i za
// zadrzavanje tastature unutra.
const FOKUSIRAJUCI =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Prozor preko stranice.
//
// Dugmad za potvrdu stoje u podnozju, koje je u DOM-u susedno telu - dakle van
// <form> koja je u telu. Zato ona koja salju formu moraju da nose `form={id}`,
// a forma isti taj `id`. Bez toga `type="submit"` ne radi nista i pregledac
// preskoci `required`, `minLength` i proveru email-a.
export function Modal({ title, onClose, children, footer, wide, busy }) {
  const naslovId = useId();
  const okvir = useRef(null);
  const prethodniFokus = useRef(null);

  // Fokus ulazi u prozor pri otvaranju i vraca se na dugme koje ga je otvorilo.
  useEffect(() => {
    prethodniFokus.current = document.activeElement;
    const prvo = okvir.current?.querySelector(FOKUSIRAJUCI);
    (prvo || okvir.current)?.focus();
    return () => prethodniFokus.current?.focus?.();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        // Dok traje cuvanje, zatvaranje bi ostavilo zahtev u vazduhu.
        if (!busy) onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Bez ovoga tab izadje iza prozora, na stranicu koja se ne vidi.
      const polja = [...(okvir.current?.querySelectorAll(FOKUSIRAJUCI) || [])];
      if (!polja.length) return;
      const prvo = polja[0];
      const poslednje = polja[polja.length - 1];
      if (e.shiftKey && document.activeElement === prvo) {
        e.preventDefault();
        poslednje.focus();
      } else if (!e.shiftKey && document.activeElement === poslednje) {
        e.preventDefault();
        prvo.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={naslovId}
        ref={okvir}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2 id={naslovId}>{title}</h2>
          <button
            type="button"
            className="btn ghost"
            style={{ marginLeft: 'auto' }}
            onClick={onClose}
            disabled={busy}
            aria-label="Zatvori"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) {
    return total ? <div className="pagination">Ukupno {total}</div> : null;
  }
  return (
    <div className="pagination">
      <span>
        Strana {page} od {pages} · ukupno {total}
      </span>
      <button className="btn secondary sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Prethodna
      </button>
      <button
        className="btn secondary sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Sledeca
      </button>
    </div>
  );
}

// `error` se prikazuje unutar dijaloga. Ranije je isao u traku na stranici,
// koja je iza otvorenog prozora - radnik je video da se nista nije desilo, ali
// ne i zasto.
export function Confirm({
  title,
  text,
  confirmLabel = 'Potvrdi',
  tone = 'danger',
  onConfirm,
  onClose,
  busy,
  error,
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>
            Odustani
          </button>
          <button type="button" className={`btn ${tone}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Sacekajte...' : confirmLabel}
          </button>
        </>
      }
    >
      <Alert>{error}</Alert>
      <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
        {text}
      </p>
    </Modal>
  );
}
