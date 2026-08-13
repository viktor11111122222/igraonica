import { useEffect } from 'react';

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

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
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

export function Modal({ title, onClose, children, footer, wide }) {
  // Escape zatvara modal - ocekivano ponasanje, a i izlaz kada je forma duga.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>
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

export function Confirm({ title, text, confirmLabel = 'Potvrdi', tone = 'danger', onConfirm, onClose, busy }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose} disabled={busy}>
            Odustani
          </button>
          <button className={`btn ${tone}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Sacekajte...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
        {text}
      </p>
    </Modal>
  );
}
