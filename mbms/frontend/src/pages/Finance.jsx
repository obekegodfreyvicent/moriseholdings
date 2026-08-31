import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, ApiRequestError } from '../lib/api';

// Admin » Financial & Accounting (28 August 2026). The overview landing for
// the finance area: consolidated group financial position, working-capital
// figures, period-close status, and shortcuts into the working sub-screens.
// Read-only.

const SHORTCUTS = [
  { to: '/accounting', icon: '📒', label: 'General Ledger & Journals', desc: 'Chart of accounts, journal entries, financial periods' },
  { to: '/accounts-payable', icon: '📤', label: 'Accounts Payable', desc: 'Supplier invoices, payments, credit notes' },
  { to: '/expenses', icon: '🧾', label: 'Expenses', desc: 'Claims, manager & finance approval, payment' },
  { to: '/assets', icon: '🏗', label: 'Assets', desc: 'Register, depreciation, maintenance, disposal' },
  { to: '/projects', icon: '📋', label: 'Projects', desc: 'Budgets, actuals, profitability' },
  { to: '/reports', icon: '📄', label: 'Reports', desc: 'Trial balance, P&L, balance sheet, exports' },
  { to: '/suppliers', icon: '🚚', label: 'Suppliers', desc: 'Records, contracts, blacklist' },
  { to: '/inter-company', icon: '🔁', label: 'Inter-Company', desc: 'Transactions between group companies' },
];

function Tile({ label, value, hint, tone }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: '#7c8aa3', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function FinancePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiRequest('/finance/overview')
      .then(setData)
      .catch((err) => setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load the finance overview.'));
  }, []);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Financial &amp; Accounting</div>
          <h1>Financial &amp; Accounting</h1>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {!data ? (
        <div className="card"><div className="loading">Loading…</div></div>
      ) : (
        <>
          <h2 style={{ fontSize: 15 }}>Group financial position</h2>
          <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
            <Tile label="Total assets" value={<Money value={data.financials.totalAssets} />} />
            <Tile label="Total liabilities" value={<Money value={data.financials.totalLiabilities} />} />
            <Tile label="Total equity" value={<Money value={data.financials.totalEquity} />} />
            <Tile label="Cash position" value={<Money value={data.financials.cashPosition} />} hint={<>bank <Money value={data.financials.bankBalances} /></>} />
          </div>
          <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
            <Tile label="Revenue (open period)" value={<Money value={data.financials.totalRevenue} />} />
            <Tile label="Expenses (open period)" value={<Money value={data.financials.totalExpense} />} />
            <Tile label="Net profit" value={<Money value={data.financials.netProfit} />} tone={Number(data.financials.netProfit) < 0 ? 'error' : 'success'} />
            <Tile label="Outstanding receivables" value={<Money value={data.financials.outstandingReceivables} />} hint={<>payables <Money value={data.financials.outstandingPayables} /></>} />
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <strong>By company</strong>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ marginTop: 8, minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Company</th><th style={{ textAlign: 'right' }}>Assets</th><th style={{ textAlign: 'right' }}>Liabilities</th>
                    <th style={{ textAlign: 'right' }}>Equity</th><th style={{ textAlign: 'right' }}>Cash</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Net profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.financials.byCompany.map((c) => (
                    <tr key={c.companyId}>
                      <td>{c.companyName}</td>
                      <td style={{ textAlign: 'right' }}><Money value={c.totalAssets} /></td>
                      <td style={{ textAlign: 'right' }}><Money value={c.totalLiabilities} /></td>
                      <td style={{ textAlign: 'right' }}><Money value={c.totalEquity} /></td>
                      <td style={{ textAlign: 'right' }}><Money value={c.cashPosition} /></td>
                      <td style={{ textAlign: 'right' }}><Money value={c.revenue} /></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}><Money value={c.netProfit} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <h2 style={{ fontSize: 15 }}>Needs attention</h2>
          <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 18 }}>
            <Tile
              label="AP outstanding"
              value={<Money value={data.operations.accountsPayable.outstandingAmount} />}
              hint={`${data.operations.accountsPayable.outstandingCount} invoice(s)${data.operations.accountsPayable.overdueCount ? ` · ${data.operations.accountsPayable.overdueCount} overdue` : ''}`}
              tone={data.operations.accountsPayable.overdueCount ? 'warning' : undefined}
            />
            <Tile
              label="AR outstanding"
              value={<Money value={data.operations.accountsReceivable.outstandingAmount} />}
              hint={`${data.operations.accountsReceivable.outstandingCount} invoice(s)${data.operations.accountsReceivable.overdueCount ? ` · ${data.operations.accountsReceivable.overdueCount} overdue` : ''}`}
              tone={data.operations.accountsReceivable.overdueCount ? 'error' : undefined}
            />
            <Tile
              label="Expenses awaiting finance"
              value={data.operations.expenses.awaitingFinanceCount}
              hint={<><Money value={data.operations.expenses.awaitingFinanceAmount} /></>}
              tone={data.operations.expenses.awaitingFinanceCount ? 'warning' : undefined}
            />
            <Tile
              label="Assets — net book value"
              value={<Money value={data.operations.assets.netBookValue} />}
              hint={`${data.operations.assets.activeCount} active${data.operations.assets.disposalRequestedCount ? ` · ${data.operations.assets.disposalRequestedCount} disposal req.` : ''}`}
            />
            <Tile
              label="Active projects"
              value={data.operations.projects.active}
              hint={`${data.operations.projects.onHold} on hold · ${data.operations.projects.planned} planned`}
            />
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <strong>Period close</strong>{' '}
            <span style={{ fontSize: 13, color: '#7c8aa3' }}>
              {data.periods.totalOpenPeriods} open · {data.periods.totalClosedPeriods} closed across the group
            </span>
            {data.periods.companies.length === 0 ? (
              <div className="empty">No financial periods configured.</div>
            ) : (
              <table style={{ marginTop: 8 }}>
                <thead>
                  <tr><th>Company</th><th>Current period</th><th>Dates</th><th>Status</th><th style={{ textAlign: 'right' }}>Open</th><th style={{ textAlign: 'right' }}>Closed</th></tr>
                </thead>
                <tbody>
                  {data.periods.companies.map((c) => (
                    <tr key={c.companyId}>
                      <td>{c.companyName}</td>
                      <td>{c.currentPeriod?.name || '—'}</td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {c.currentPeriod ? `${new Date(c.currentPeriod.startDate).toLocaleDateString()} – ${new Date(c.currentPeriod.endDate).toLocaleDateString()}` : '—'}
                      </td>
                      <td>{c.currentPeriod && <span className={`badge ${c.currentPeriod.status === 'open' ? 'success' : 'neutral'}`}><span className="dot" />{c.currentPeriod.status}</span>}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{c.openCount}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{c.closedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ fontSize: 12, color: '#7c8aa3', marginTop: 8 }}>Close a period from General Ledger &amp; Journals once its month-end is reconciled.</p>
          </div>

          <h2 style={{ fontSize: 15 }}>Finance area</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {SHORTCUTS.map((s) => (
              <Link key={s.to} to={s.to} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontSize: 22 }}>{s.icon}</div>
                <strong style={{ display: 'block', marginTop: 6 }}>{s.label}</strong>
                <div style={{ fontSize: 12, color: '#7c8aa3', marginTop: 4 }}>{s.desc}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
