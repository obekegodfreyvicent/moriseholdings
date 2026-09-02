import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, ApiRequestError } from '../lib/api';

// Notifications & Alerts (section 39): one cross-module feed of every
// time-sensitive thing that needs attention — overdue invoices, expiring
// contracts / renewals, vehicle service due, stock below minimum, pending
// approvals, project deadlines. Read-only, scoped per BR-01.

const SEV = {
  critical: { badge: 'error', label: 'Critical' },
  warning: { badge: 'warning', label: 'Due soon' },
  info: { badge: 'neutral', label: 'For info' },
};
const CAT_LABEL = {
  'invoice.overdue': 'Invoice overdue',
  'supplier_invoice.overdue': 'Payable overdue',
  'approval.pending': 'Pending approval',
  'contract.expiring': 'Contract expiring',
  'vehicle.renewal': 'Vehicle renewal',
  'vehicle.service_due': 'Vehicle service due',
  'asset.insurance_expiring': 'Asset insurance',
  'asset.inspection_due': 'Asset inspection',
  'stock.below_minimum': 'Stock below minimum',
  'batch.expiring': 'Batch expiring',
  'project.deadline': 'Project deadline',
};

export function AlertsPage() {
  const [days, setDays] = useState('30');
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState(null);
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    try {
      const q = { days };
      const [s, l] = await Promise.all([
        apiRequest('/alerts/summary', { query: { days } }),
        apiRequest('/alerts', {
          query: { ...q, ...(category ? { category } : {}), ...(severity ? { severity } : {}) },
        }),
      ]);
      setSummary(s);
      setRows(l.alerts);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load alerts.');
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, category, severity]);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Admin / Backend</div>
          <h1>Alerts</h1>
        </div>
        <div className="actions">
          <select className="select" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="14">Next 14 days</option>
            <option value="30">Next 30 days</option>
            <option value="60">Next 60 days</option>
            <option value="90">Next 90 days</option>
            <option value="180">Next 180 days</option>
          </select>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {summary && (
        <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 16 }}>
          <div className="kpi"><div className="label">Open alerts</div><div className="value">{summary.total}</div></div>
          <div className="kpi"><div className="label">Critical</div><div className="value" style={{ color: summary.critical ? 'var(--error)' : undefined }}>{summary.critical}</div></div>
          <div className="kpi"><div className="label">Due soon</div><div className="value" style={{ color: summary.warning ? 'var(--warning)' : undefined }}>{summary.warning}</div></div>
          <div className="kpi"><div className="label">Overdue / expired</div><div className="value" style={{ color: summary.overdue ? 'var(--error)' : undefined }}>{summary.overdue}</div></div>
          <div className="kpi"><div className="label">Upcoming</div><div className="value">{summary.upcoming}</div></div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label>Category</label>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Severity</label>
          <select className="select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">Any</option>
            <option value="critical">Critical</option>
            <option value="warning">Due soon</option>
            <option value="info">For info</option>
          </select>
        </div>
        {summary && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(summary.byCategory).map(([k, n]) => (
              <button
                key={k}
                className={`badge ${category === k ? 'success' : 'neutral'}`}
                style={{ cursor: 'pointer', border: 'none' }}
                onClick={() => setCategory(category === k ? '' : k)}
              >
                {CAT_LABEL[k] || k} · {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        {rows === null ? (
          <div className="loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">Nothing needs attention in this window. 🎉</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Category</th>
                <th>What</th>
                <th>When</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className={`badge ${SEV[a.severity]?.badge || 'neutral'}`}>
                      <span className="dot" />{SEV[a.severity]?.label || a.severity}
                    </span>
                  </td>
                  <td>{CAT_LABEL[a.category] || a.category}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--ink, inherit)' }}>{a.title}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{a.detail}</div>
                  </td>
                  <td className="mono">{a.date ? String(a.date).slice(0, 10) : '—'}</td>
                  <td className="num">{a.amount != null ? <Money value={a.amount} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
