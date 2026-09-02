import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, ApiRequestError } from '../lib/api';

// Final System Objective — one screen that answers the group-management
// questions the specification closes with, from live data, scoped per BR-01.

const STATUS = {
  answered: { badge: 'success', label: 'Answered' },
  partial: { badge: 'warning', label: 'Partial' },
  planned: { badge: 'neutral', label: 'Roadmap' },
};

function fmt(v, unit) {
  if (v === null || v === undefined) return '—';
  if (unit === 'money') return `UGX ${Math.round(v).toLocaleString()}`;
  return Number(v).toLocaleString();
}

export function ExecutivePage() {
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [q, o] = await Promise.all([
          apiRequest('/executive/questions'),
          apiRequest('/executive/overview'),
        ]);
        setData(q);
        setOverview(o);
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load.');
      }
    })();
  }, []);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Financial &amp; Accounting</div>
          <h1>Executive Q&amp;A</h1>
        </div>
        {data && <div className="muted" style={{ alignSelf: 'center' }}>Scope: {data.scope}</div>}
      </div>

      {error && <div className="banner error">{error}</div>}

      {overview && (
        <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 18 }}>
          <div className="kpi"><div className="label">Group cash</div><div className="value"><Money value={overview.groupCash} /></div></div>
          <div className="kpi"><div className="label">Net profit (period)</div><div className="value" style={{ color: overview.netProfit < 0 ? 'var(--error)' : undefined }}><Money value={overview.netProfit} /></div></div>
          <div className="kpi"><div className="label">Owed by customers</div><div className="value"><Money value={overview.receivables} /></div></div>
          <div className="kpi"><div className="label">Owed to suppliers</div><div className="value"><Money value={overview.payables} /></div></div>
          <div className="kpi"><div className="label">Employees</div><div className="value">{overview.headcount}</div></div>
          <div className="kpi"><div className="label">Monthly salary bill</div><div className="value"><Money value={overview.monthlySalaryBill} /></div></div>
        </div>
      )}

      {data === null ? (
        <div className="card"><div className="loading">Loading…</div></div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.answers.map((a) => (
            <div key={a.key} className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span className={`badge ${STATUS[a.status]?.badge || 'neutral'}`} style={{ flex: 'none', marginTop: 2 }}>
                  <span className="dot" />{STATUS[a.status]?.label || a.status}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.question}</div>
                  <div style={{ marginTop: 4, color: 'var(--ink-soft, #4a5568)' }}>{a.answer}</div>
                  {a.breakdown && a.breakdown.length > 0 && (
                    <button
                      className="btn-ghost"
                      style={{ marginTop: 6, padding: 0 }}
                      onClick={() => setOpen(open === a.key ? null : a.key)}
                    >
                      {open === a.key ? 'Hide breakdown' : `Breakdown (${a.breakdown.length})`}
                    </button>
                  )}
                </div>
                {a.value !== null && (
                  <div style={{ flex: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 18 }}>
                    {fmt(a.value, a.unit)}
                  </div>
                )}
              </div>
              {open === a.key && a.breakdown && a.breakdown.length > 0 && (
                <div style={{ marginTop: 12, overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>{Object.keys(a.breakdown[0]).map((k) => <th key={k}>{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {a.breakdown.map((row, i) => (
                        <tr key={i}>
                          {Object.entries(row).map(([k, v]) => (
                            <td key={k} className={typeof v === 'string' && /^-?\d/.test(v) ? 'num mono' : ''}>
                              {v === null || v === undefined ? '—' : String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
