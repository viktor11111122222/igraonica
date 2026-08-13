import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import BarChart, { MARK_AMBER, MARK_BLUE } from '../components/BarChart';
import { Alert, Badge, Empty, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { formatDateTime, formatHours, VISIT_STATUSES } from '../lib/format';

function Stat({ label, value, hint, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

// Kratka oznaka dana za x osu; u tooltip-u i tabeli ide pun datum.
function dayLabel(d, full) {
  const date = new Date(d.date + 'T00:00:00');
  if (full) {
    return date.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return date.toLocaleDateString('sr-RS', { day: 'numeric', month: 'numeric' });
}

export default function Dashboard() {
  const [period, setPeriod] = useState('week');
  const stats = useFetch('/dashboard/stats');
  const visits = useFetch(`/dashboard/chart/visits?period=${period}`);
  const hours = useFetch(`/dashboard/chart/hours?period=${period}`);
  const recent = useFetch('/dashboard/recent-activity?limit=8');

  const s = stats.data;

  return (
    <>
      <PageHeader title="Pocetna" subtitle="Pregled dana u igraonici" />

      <div className="page stack">
        <Alert>{stats.error}</Alert>

        {stats.loading ? (
          <Spinner />
        ) : (
          <div className="grid stats">
            <Stat
              label="Trenutno u igraonici"
              value={s?.activeKids ?? 0}
              hint="Deca koja jos nisu odjavljena"
              tone="accent"
            />
            <Stat label="Posete danas" value={s?.todayVisits ?? 0} tone="primary" />
            <Stat label="Utroseno sati danas" value={formatHours(s?.hoursUsedToday)} />
            <Stat label="Roditelji" value={s?.totalUsers ?? 0} hint="Aktivna naloga" />
            <Stat label="Deca" value={s?.totalChildren ?? 0} hint="Registrovana" />
          </div>
        )}

        <div className="grid cols-2">
          <div className="card">
            <div className="card-head">
              <h2>Posete po danima</h2>
              <div className="spacer" />
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="week">7 dana</option>
                <option value="month">30 dana</option>
              </select>
            </div>
            <div className="card-body">
              {visits.loading ? (
                <Spinner />
              ) : (
                <BarChart
                  data={visits.data?.data}
                  valueKey="count"
                  color={MARK_BLUE}
                  formatLabel={dayLabel}
                  formatValue={(v) => Math.round(v)}
                />
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Utroseni sati po danima</h2>
            </div>
            <div className="card-body">
              {hours.loading ? (
                <Spinner />
              ) : (
                <BarChart
                  data={hours.data?.data}
                  valueKey="hours"
                  color={MARK_AMBER}
                  formatLabel={dayLabel}
                  formatValue={(v) => Number(v).toFixed(1).replace('.', ',')}
                />
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Poslednje aktivnosti</h2>
            <div className="spacer" />
            <Link className="btn secondary sm" to="/posete">
              Sve posete
            </Link>
          </div>
          {recent.loading ? (
            <Spinner />
          ) : !recent.data?.visits?.length ? (
            <Empty title="Jos nema poseta" text="Kada prijavite prvo dete, pojavice se ovde." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Dete</th>
                    <th>Prijava</th>
                    <th>Odjava</th>
                    <th>Sati</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data.visits.map((v) => {
                    const status = VISIT_STATUSES[v.status] || {};
                    return (
                      <tr key={v.id}>
                        <td className="row-main">
                          {v.child.firstName} {v.child.lastName}
                        </td>
                        <td className="muted">{formatDateTime(v.checkedInAt)}</td>
                        <td className="muted">
                          {v.checkedOutAt ? formatDateTime(v.checkedOutAt) : '—'}
                        </td>
                        <td>{v.hoursDeducted ? formatHours(v.hoursDeducted) : '—'}</td>
                        <td>
                          <Badge tone={status.tone}>{status.label || v.status}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
