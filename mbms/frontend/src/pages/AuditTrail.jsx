import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequestWithMeta, ApiRequestError } from '../lib/api';

const ACTION_BADGE = {
  create: 'success',
  update: 'warning',
  delete: 'error',
  approve: 'success',
  access_denied: 'error',
};

export function AuditTrailPage() {
  const [logs, setLogs] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({ action: '', entityType: '', dateFrom: '', dateTo: '' });

  async function load() {
    setError(null);
    try {
      const { items, meta } = await apiRequestWithMeta('/audit/logs', {
        pageSize: 50,
        'filter[action]': filters.action || undefined,
        'filter[entityType]': filters.entityType || undefined,
        'filter[dateFrom]': filters.dateFrom || undefined,
        'filter[dateTo]': filters.dateTo || undefined,
      });
      setLogs(items);
      setTotal(meta.total);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load the audit trail.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Audit Trail</div>
          <h1>Audit Trail</h1>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="filterbar">
        <span className="flabel">Filter</span>
        <select className="select" value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}>
          <option value="">Action: All</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="approve">Approve</option>
          <option value="access_denied">Denied</option>
        </select>
        <input
          className="input"
          placeholder="Entity type (e.g. employee)"
          value={filters.entityType}
          onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
        />
        <input className="input" type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
        <input className="input" type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
      </div>

      <div className="card">
        {logs === null ? (
          <div className="loading">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="empty">No audit events match these filters.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Entity</th>
                <th>Action</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <React.Fragment key={l.id}>
                  <tr onClick={() => setExpandedId(expandedId === l.id ? null : l.id)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{new Date(l.occurredAt).toLocaleString()}</td>
                    <td className="rowlink">{l.eventType}</td>
                    <td>
                      {l.entityType}
                      {l.entityId ? ` (${l.entityId.slice(0, 8)}…)` : ''}
                    </td>
                    <td>
                      <span className={`badge ${ACTION_BADGE[l.action] || 'neutral'}`}>
                        <span className="dot" />
                        {l.action}
                      </span>
                    </td>
                    <td>{expandedId === l.id ? '▲' : '▼'}</td>
                  </tr>
                  {expandedId === l.id && (
                    <tr>
                      <td colSpan={5} style={{ background: '#F4F6FA' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 8 }}>
                          <div>
                            <div className="fs-title" style={{ fontSize: 11 }}>
                              Before
                            </div>
                            <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                              {l.previousValue ? JSON.stringify(l.previousValue, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <div className="fs-title" style={{ fontSize: 11 }}>
                              After
                            </div>
                            <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                              {l.newValue ? JSON.stringify(l.newValue, null, 2) : '—'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
        <div className="pagination">
          <div>Showing {logs?.length ?? 0} of {total} events</div>
        </div>
      </div>

      <div className="hint" style={{ marginTop: 10 }}>
        This is a read-only view — there is no edit or delete action anywhere on this screen, by
        design, per FR-AUDIT-03.
      </div>
    </Layout>
  );
}
