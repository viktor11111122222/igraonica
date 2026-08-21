import { useEffect, useRef, useState } from 'react';

// Boje se citaju iz tokena teme (styles.css), jer tamna tema ima svoje
// korake provereno birane prema tamnoj podlozi - nisu obrnute svetle.
// SVG mora da ih dobije kroz `style`, presentation atribut ne razresava var().
export const MARK_BLUE = 'var(--chart-blue)';
export const MARK_AMBER = 'var(--chart-amber)';

const PAD = { top: 18, right: 10, bottom: 26, left: 40 };

// Zaokruzi gornju granicu ose na "lepu" vrednost da oznake ne budu 3.7, 7.4...
function niceMax(value) {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export default function BarChart({
  data,
  color = MARK_BLUE,
  height = 200,
  formatValue = (v) => v,
  // Tacka podatka je objekat, pa ga podrazumevana funkcija ne sme vratiti kao
  // takvog - React bi pukao na "Objects are not valid as a React child".
  formatLabel = (d) => (d && typeof d === 'object' ? d.date ?? '' : d),
  valueKey = 'value',
}) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);

  // SVG se crta u pikselima da tekst ne bi bio razvucen skaliranjem.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = data || [];
  const values = points.map((d) => Number(d[valueKey]) || 0);
  const max = niceMax(Math.max(...values, 0));
  const maxIndex = values.indexOf(Math.max(...values));

  const plotW = Math.max(10, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const slot = points.length ? plotW / points.length : plotW;
  // 2px razmaka izmedju susednih stubaca, ali stubac nikad tanji od 2px.
  const barW = Math.max(2, slot - 2);

  const y = (v) => PAD.top + plotH - (v / max) * plotH;

  // Oznake na x osi se proredjuju da se ne bi preklapale.
  const labelStep = Math.max(1, Math.ceil(points.length / Math.floor(plotW / 46)));

  // Kod malih vrednosti (max = 1) sredina se posle formatiranja poklopi sa
  // vrhom, pa bi osa imala dve iste oznake. Zato izbacujemo duplikate.
  const ticks = [0, max / 2, max].filter(
    (t, i, all) => all.findIndex((o) => String(formatValue(o)) === String(formatValue(t))) === i
  );

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img" aria-label="Grafikon po danima">
        {ticks.map((t, i) => (
          <g key={i}>
            {/* Mreza je namerno jedva vidljiva - podaci su ti koji nose paznju. */}
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              strokeWidth="1"
              style={{ stroke: 'var(--chart-grid)' }}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="10"
              style={{ fill: 'var(--chart-axis)' }}
            >
              {formatValue(t)}
            </text>
          </g>
        ))}

        {points.map((d, i) => {
          const v = Number(d[valueKey]) || 0;
          // Vrednost vecu od nule uvek prikazi bar kao 2px traku, inace bi
          // mali dan izgledao isto kao dan bez ijedne posete.
          const barH = v === 0 ? 0 : Math.max(2, (v / max) * plotH);
          const barY = PAD.top + plotH - barH;
          const x = PAD.left + i * slot + (slot - barW) / 2;
          return (
            <g key={i}>
              {/* Nevidljiva meta za hover je visa od stupca - lakse se pogadja. */}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover({ i, x: x + barW / 2, y: barY })}
                onMouseLeave={() => setHover(null)}
              />
              <rect
                x={x}
                y={barY}
                width={barW}
                height={barH}
                rx="4"
                opacity={hover && hover.i !== i ? 0.45 : 1}
                style={{ fill: color, transition: 'opacity 0.12s' }}
                pointerEvents="none"
              />
              {/* Direktna oznaka samo na najvisoj vrednosti, ne na svakoj. */}
              {i === maxIndex && v > 0 && (
                <text
                  x={x + barW / 2}
                  y={barY - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  pointerEvents="none"
                  style={{ fill: 'var(--chart-label)' }}
                >
                  {formatValue(v)}
                </text>
              )}
              {i % labelStep === 0 && (
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  pointerEvents="none"
                  style={{ fill: 'var(--chart-axis)' }}
                >
                  {formatLabel(d)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover && points[hover.i] && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(hover.x, 60), width - 60),
            top: Math.max(0, hover.y - 46),
            transform: 'translateX(-50%)',
            background: 'var(--chart-tooltip-bg)',
            color: 'var(--chart-tooltip-text)',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          {formatLabel(points[hover.i], true)} · {formatValue(points[hover.i][valueKey])}
        </div>
      )}

      <button
        className="btn ghost sm"
        onClick={() => setShowTable((v) => !v)}
        style={{ marginTop: 4 }}
      >
        {showTable ? 'Sakrij tabelu' : 'Prikazi kao tabelu'}
      </button>

      {showTable && (
        <div className="table-wrap" style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Vrednost</th>
              </tr>
            </thead>
            <tbody>
              {points.map((d, i) => (
                <tr key={i}>
                  <td data-label="Datum">{formatLabel(d, true)}</td>
                  <td data-label="Vrednost">{formatValue(d[valueKey])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
