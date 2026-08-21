import { useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Alert, Badge, Empty, Pagination, Spinner } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import { formatDateTime, formatDuration, formatHours, VISIT_STATUSES } from '../lib/format';

export default function Visits() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const params = new URLSearchParams({ page, limit: 20 });
  if (status) params.set('status', status);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const { data, loading, error } = useFetch(`/visits/history?${params}`);

  function reset() {
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  return (
    <>
      <PageHeader title="Posete" subtitle="Istorija dolazaka i odlazaka" />

      <div className="page">
        <Alert>{error}</Alert>

        <div className="toolbar">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Svi statusi</option>
            <option value="CHECKED_IN">U igraonici</option>
            <option value="CHECKED_OUT">Odjavljeni</option>
            <option value="AUTO_CLOSED">Auto-zatvoreni</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
          {(status || dateFrom || dateTo) && (
            <button className="btn ghost" onClick={reset}>
              Ponisti filtere
            </button>
          )}
        </div>

        <div className="card">
          {loading ? (
            <Spinner />
          ) : !data?.visits?.length ? (
            <Empty title="Nema poseta" text="Nijedna poseta ne odgovara filterima." />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dete</th>
                      <th>Prijava</th>
                      <th>Odjava</th>
                      <th>Trajanje</th>
                      <th>Naplaceno</th>
                      <th>Paket</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.visits.map((v) => {
                      const s = VISIT_STATUSES[v.status] || {};
                      return (
                        <tr key={v.id}>
                          <td className="row-main" data-label="Dete">
                            {v.child.firstName} {v.child.lastName}
                          </td>
                          <td className="muted" data-label="Prijava">{formatDateTime(v.checkedInAt)}</td>
                          <td className="muted" data-label="Odjava">
                            {v.checkedOutAt ? formatDateTime(v.checkedOutAt) : '—'}
                          </td>
                          <td data-label="Trajanje">{formatDuration(v.durationMinutes)}</td>
                          <td data-label="Naplaceno">{v.hoursDeducted ? formatHours(v.hoursDeducted) : '—'}</td>
                          <td className="muted" data-label="Paket">{v.userPackage?.package?.name || '—'}</td>
                          <td data-label="Status">
                            <Badge tone={s.tone}>{s.label || v.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination {...data.pagination} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
