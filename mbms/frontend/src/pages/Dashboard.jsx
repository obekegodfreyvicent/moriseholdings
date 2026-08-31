import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatMoney } from '../lib/currency';

export function DashboardPage() {
  const { user, hasRole } = useAuth();
  const [summary, setSummary] = useState(null);
  const [accountingSummary, setAccountingSummary] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [charts, setCharts] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [recentActivity, setRecentActivity] = useState(null);
  const [subsidiaryCards, setSubsidiaryCards] = useState(null);
  const [error, setError] = useState(null);

  const isGroupLevel = hasRole('Super Administrator', 'Managing Director', 'Group CEO');

  useEffect(() => {
    async function load() {
      setError(null);
      if (isGroupLevel) {
        try {
          const [s, a, f, c, al, r] = await Promise.all([
            apiRequest('/dashboard/summary'),
            apiRequest('/dashboard/accounting-summary').catch(() => null),
            apiRequest('/dashboard/financials').catch(() => null),
            apiRequest('/dashboard/charts').catch(() => null),
            apiRequest('/dashboard/alerts').catch(() => null),
            apiRequest('/dashboard/recent-activity').catch(() => null),
          ]);
          setSummary(s);
          setAccountingSummary(a);
          setFinancials(f);
          setCharts(c);
          setAlerts(al);
          setRecentActivity(r);
        } catch (err) {
          if (err instanceof ApiRequestError) setError(err.apiError.message);
          else setError('Unable to load the dashboard.');
        }
      } else {
        // Subsidiary/branch-scoped roles get one card per company in their
        // own scope — never the group-wide summary (BR-01 / FR-DASH-03).
        try {
          const cards = await Promise.all(
            (user?.scopes ?? []).map((s) => apiRequest(`/dashboard/companies/${s.company_id}`)),
          );
          setSubsidiaryCards(cards);
        } catch (err) {
          if (err instanceof ApiRequestError) setError(err.apiError.message);
          else setError('Unable to load the dashboard.');
        }
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroupLevel]);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Dashboard</div>
          <h1>{isGroupLevel ? 'Holding Company Dashboard' : 'Subsidiary Dashboard'}</h1>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {isGroupLevel ? (
        <>
          {!summary ? (
            <div className="loading">Loading…</div>
          ) : (
            <>
              <AlertBanners alerts={alerts} />

              <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
                <Kpi label="Companies" value={summary.companies} />
                <Kpi label="Branches" value={summary.branches} />
                <Kpi label="Active Users" value={summary.users} />
              </div>
              <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
                <Kpi label="Active Employees" value={summary.employees} />
                <Kpi label="Active Customers" value={summary.customers} />
                <Kpi label="Active Suppliers" value={summary.suppliers} />
              </div>
              <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
                <Kpi label="Assets (not disposed)" value={summary.assets} />
                <Kpi label="Current Projects" value={summary.currentProjects?.total ?? summary.activeProjects} sub={`${summary.activeProjects} active`} />
                <Kpi label="Pending Approvals" value={summary.pendingApprovals?.total ?? '—'} />
              </div>

              {financials && (
                <>
                  <div className="fs-title" style={{ marginBottom: 8 }}>Group Financial Position</div>
                  <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
                    <Kpi label="Total Assets" value={money(financials.totalAssets)} />
                    <Kpi label="Total Revenue" value={money(financials.totalRevenue)} />
                    <Kpi label="Total Expenses" value={money(financials.totalExpense)} />
                    <Kpi label="Net Profit" value={money(financials.netProfit)} tone={Number(financials.netProfit) >= 0 ? 'success' : 'error'} />
                  </div>
                  <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
                    <Kpi label="Cash Position" value={money(financials.cashPosition)} />
                    <Kpi label="Bank Balances" value={money(financials.bankBalances)} />
                    <Kpi label="Outstanding Receivables" value={money(financials.outstandingReceivables)} />
                    <Kpi label="Outstanding Payables" value={money(financials.outstandingPayables)} />
                  </div>
                </>
              )}

              <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
                <Kpi label="Outstanding Loans (Inter-Company)" value={summary.outstandingLoans ? money(summary.outstandingLoans.total) : '—'} sub={summary.outstandingLoans ? `${summary.outstandingLoans.count} posted` : ''} />
                <NotBuiltKpi label="Inventory Value" block={summary.inventoryValue} />
                <NotBuiltKpi label="Sales Performance" block={summary.salesPerformance} />
              </div>
              <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 18 }}>
                <NotBuiltKpi label="Procurement Performance" block={summary.procurementPerformance} />
                <Kpi label="Employee Statistics" value={`${summary.employeeStatistics?.active ?? '—'} active`} sub={`of ${summary.employeeStatistics?.total ?? '—'} total`} />
              </div>

              {charts && (
                <div className="grid-2" style={{ marginBottom: 18 }}>
                  <ChartCard title="Monthly Revenue" series={charts.monthlyRevenue} color="#2E7D4F" />
                  <ChartCard title="Monthly Expenses" series={charts.monthlyExpense} color="#B33A3A" />
                  <ChartCard title="Profit &amp; Loss" series={charts.profitAndLoss} color="#2E5395" diverging />
                  <ChartCard title="Cash Flow (Cash/Bank Movement)" series={charts.cashFlow} color="#D98C00" diverging />
                </div>
              )}

              <div className="grid-2">
                <div className="card">
                  <div className="card-head">Chart of Accounts / Trial Balance Summary (per company)</div>
                  {accountingSummary === null ? (
                    <div className="empty">You don't have permission to view group-wide accounting data.</div>
                  ) : accountingSummary.length === 0 ? (
                    <div className="empty">No posted journal entries yet.</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th className="num">Debits</th>
                          <th className="num">Credits</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountingSummary.map((row) => (
                          <tr key={row.companyId}>
                            <td>{row.companyName}</td>
                            <td className="num mono">{row.totalDebits}</td>
                            <td className="num mono">{row.totalCredits}</td>
                            <td>
                              <span className={`badge ${row.balanced ? 'success' : 'error'}`}>
                                <span className="dot" />
                                {row.balanced ? 'Balanced' : 'Unbalanced'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="card">
                  <div className="card-head">Recent Activity (Audit Feed)</div>
                  {recentActivity === null ? (
                    <div className="empty">You don't have permission to view the audit feed.</div>
                  ) : recentActivity.length === 0 ? (
                    <div className="empty">No activity recorded yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                      {recentActivity.map((a) => (
                        <div key={a.id} style={{ fontSize: 12.8 }}>
                          <b>{a.userName}</b> {describeAction(a)}
                          <div style={{ color: '#8592a8', fontSize: 11.5, marginTop: 2 }}>
                            {new Date(a.occurredAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {financials?.byCompany?.length > 0 && (
                <div className="card" style={{ marginTop: 18 }}>
                  <div className="card-head">Company Performance Comparison</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th className="num">Revenue</th>
                        <th className="num">Expenses</th>
                        <th className="num">Net Profit</th>
                        <th className="num">Total Assets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financials.byCompany.map((c) => (
                        <tr key={c.companyId}>
                          <td>{c.companyName}</td>
                          <td className="num mono">{c.revenue}</td>
                          <td className="num mono">{c.expense}</td>
                          <td className="num mono">{c.netProfit}</td>
                          <td className="num mono">{c.totalAssets}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="banner info">
            <span>&#128274;</span> Scoped to your assigned compan{(user?.scopes?.length ?? 0) === 1 ? 'y' : 'ies'} — no
            Group totals or other subsidiaries' data are visible on this screen.
          </div>
          {!subsidiaryCards ? (
            <div className="loading">Loading…</div>
          ) : (
            subsidiaryCards.map((c) => (
              <div key={c.companyId} className="card" style={{ marginBottom: 14 }}>
                <div className="card-head">{c.companyName}</div>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
                  <Kpi label="Branches" value={c.branches} />
                  <Kpi label="Departments" value={c.departments} />
                  <Kpi label="Active Employees" value={c.employees} />
                  <Kpi label="Active Customers" value={c.customers} />
                  <Kpi label="Active Suppliers" value={c.suppliers} />
                </div>
                {c.accounting && (
                  <div className="card-body" style={{ borderTop: '1px solid #E7EBF2', paddingTop: 14 }}>
                    <div className="fs-title" style={{ marginBottom: 8 }}>
                      Chart of Accounts / Trial Balance Status (FR-DASH-02)
                    </div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>
                        Debits: <b className="mono">{c.accounting.totalDebits}</b>
                      </span>
                      <span>
                        Credits: <b className="mono">{c.accounting.totalCredits}</b>
                      </span>
                      <span className={`badge ${c.accounting.balanced ? 'success' : 'error'}`}>
                        <span className="dot" />
                        {c.accounting.balanced ? 'Balanced' : 'Unbalanced'}
                      </span>
                    </div>
                  </div>
                )}
                {c.financials && (
                  <div className="card-body" style={{ borderTop: '1px solid #E7EBF2', paddingTop: 14 }}>
                    <div className="fs-title" style={{ marginBottom: 8 }}>
                      Financial Position{c.financials.periodName ? ` (${c.financials.periodName})` : ''}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 10 }}>
                      <Kpi label="Total Assets" value={money(c.financials.totalAssets)} />
                      <Kpi label="Revenue" value={money(c.financials.revenue)} />
                      <Kpi label="Expenses" value={money(c.financials.expense)} />
                      <Kpi label="Net Profit" value={money(c.financials.netProfit)} tone={Number(c.financials.netProfit) >= 0 ? 'success' : 'error'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                      <Kpi label="Cash Position" value={money(c.financials.cashPosition)} />
                      <Kpi label="Bank Balances" value={money(c.financials.bankBalances)} />
                      <Kpi label="Receivables" value={money(c.financials.outstandingReceivables)} />
                      <Kpi label="Payables" value={money(c.financials.outstandingPayables)} />
                    </div>
                  </div>
                )}
                {c.charts && (
                  <div className="card-body" style={{ borderTop: '1px solid #E7EBF2', paddingTop: 14 }}>
                    <div className="fs-title" style={{ marginBottom: 8 }}>Monthly Trends</div>
                    <div className="grid-2">
                      <ChartCard title="Revenue" series={c.charts.monthlyRevenue} color="#2E7D4F" compact />
                      <ChartCard title="Expenses" series={c.charts.monthlyExpense} color="#B33A3A" compact />
                      <ChartCard title="Profit &amp; Loss" series={c.charts.profitAndLoss} color="#2E5395" diverging compact />
                      <ChartCard title="Cash Flow" series={c.charts.cashFlow} color="#D98C00" diverging compact />
                    </div>
                  </div>
                )}
                {c.outstandingLoans && (Number(c.outstandingLoans.owedToUs) > 0 || Number(c.outstandingLoans.owedByUs) > 0) && (
                  <div className="card-body" style={{ borderTop: '1px solid #E7EBF2', paddingTop: 14 }}>
                    <div className="fs-title" style={{ marginBottom: 8 }}>Outstanding Inter-Company Loans</div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      <span>Owed to us: <b className="mono">{c.outstandingLoans.owedToUs}</b></span>
                      <span>Owed by us: <b className="mono">{c.outstandingLoans.owedByUs}</b></span>
                    </div>
                  </div>
                )}
                {(c.assets || c.projects) && (
                  <div className="card-body" style={{ borderTop: '1px solid #E7EBF2', paddingTop: 14 }}>
                    <div className="fs-title" style={{ marginBottom: 8 }}>
                      Assets &amp; Projects
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      {c.assets && (
                        <span>
                          Assets: <b className="mono">{c.assets.active}</b> active,{' '}
                          <b className="mono">{c.assets.pendingDisposalApproval}</b> awaiting disposal approval
                        </span>
                      )}
                      {c.projects && (
                        <span>
                          Projects: <b className="mono">{c.projects.active}</b> active of{' '}
                          <b className="mono">{c.projects.total}</b> total
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="card-body" style={{ borderTop: '1px solid #E7EBF2', paddingTop: 14 }}>
                  <div className="fs-title" style={{ marginBottom: 8 }}>Not Available for This Company</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge neutral"><span className="dot" />Inventory Value</span>
                    <span className="badge neutral"><span className="dot" />Sales Performance</span>
                    <span className="badge neutral"><span className="dot" />Procurement Performance</span>
                  </div>
                </div>
                {(c.myPendingApprovals?.expensesAwaitingMe > 0 || c.myPendingApprovals?.assetDisposalsAwaitingMe > 0) && (
                  <div className="card-body" style={{ borderTop: '1px solid #E7EBF2', paddingTop: 14 }}>
                    <div className="fs-title" style={{ marginBottom: 8 }}>
                      Awaiting Your Approval
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      {c.myPendingApprovals.expensesAwaitingMe > 0 && (
                        <span className="badge neutral">
                          <span className="dot" />
                          {c.myPendingApprovals.expensesAwaitingMe} expense claim
                          {c.myPendingApprovals.expensesAwaitingMe === 1 ? '' : 's'}
                        </span>
                      )}
                      {c.myPendingApprovals.assetDisposalsAwaitingMe > 0 && (
                        <span className="badge neutral">
                          <span className="dot" />
                          {c.myPendingApprovals.assetDisposalsAwaitingMe} asset disposal
                          {c.myPendingApprovals.assetDisposalsAwaitingMe === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}
    </Layout>
  );
}

function describeAction(a) {
  const verb = { create: 'created', update: 'updated', delete: 'deleted', approve: 'approved', access_denied: 'was denied access to' }[a.action] || a.action;
  if (a.action === 'access_denied') return `${verb} an action on ${a.entityType}`;
  return `${verb} ${a.entityType}${a.entityId ? ` ${a.entityId.slice(0, 8)}…` : ''}`;
}

// Currency display (20 August 2026): every dashboard money figure is UGX
// — formatMoney appends a fixed-rate USD equivalent alongside it (see
// lib/currency.js for the rate and why it's a display-only constant, not
// a live one).
function money(v) {
  return formatMoney(v, 'UGX');
}

function Kpi({ label, value, sub, tone }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={tone === 'success' ? { color: '#2E7D4F' } : tone === 'error' ? { color: '#B33A3A' } : undefined}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#8592a8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// A tile for a KPI this codebase honestly cannot compute — no Sales/
// Procurement/Inventory module exists to source it from (see
// mbms/README.md's Dashboard Deepening section). Rendered as a labeled
// empty state, not hidden and not faked with a zero.
function NotBuiltKpi({ label, block }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: 13, fontWeight: 600, color: '#8592a8' }}>Not available</div>
      {block?.reason && <div style={{ fontSize: 11, color: '#8592a8', marginTop: 2 }}>{block.reason}</div>}
    </div>
  );
}

// Financial + operational alerts (dashboard.service.ts's alerts()/
// companyDashboard() are the source). Plain-CSS banners, matching the
// existing .banner.error/.banner.info classes — no new component library.
function AlertBanners({ alerts }) {
  if (!alerts) return null;
  const all = [...(alerts.financial ?? []), ...(alerts.operational ?? [])];
  if (all.length === 0) return null;
  return (
    <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {all.map((a, i) => (
        <div key={i} className={`banner ${a.severity === 'error' ? 'error' : 'info'}`}>
          <span>{a.severity === 'error' ? '⚠️' : 'ℹ️'}</span> {a.message}
        </div>
      ))}
    </div>
  );
}

// Lightweight inline-SVG bar chart — this project has deliberately kept
// frontend dependencies minimal throughout (react/react-dom/react-router-
// dom only), so a monthly series chart is drawn directly rather than
// pulling in a charting library for four small bar charts.
function ChartCard({ title, series, color, diverging, compact }) {
  const height = compact ? 90 : 120;
  const width = 320;
  const barGap = 6;
  const values = (series ?? []).map((s) => s.value);
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const barWidth = series?.length ? (width - barGap * (series.length - 1)) / series.length : 0;
  const zeroY = diverging ? height / 2 : height;

  return (
    <div className="card">
      <div className="card-head">{title}</div>
      <div className="card-body">
        {!series || series.length === 0 ? (
          <div className="empty">No data yet.</div>
        ) : (
          <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${title} monthly chart`}>
            {diverging && <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="#E4E9F2" strokeWidth={1} />}
            {series.map((s, i) => {
              const barHeight = (Math.abs(s.value) / max) * (diverging ? height / 2 - 4 : height - 4);
              const x = i * (barWidth + barGap);
              const y = diverging ? (s.value >= 0 ? zeroY - barHeight : zeroY) : zeroY - barHeight;
              return (
                <g key={s.month}>
                  <rect x={x} y={y} width={barWidth} height={Math.max(1, barHeight)} fill={color} rx={2} opacity={0.85}>
                    <title>{`${s.month}: ${s.value.toLocaleString()}`}</title>
                  </rect>
                </g>
              );
            })}
          </svg>
        )}
        {series && series.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8592a8', marginTop: 4 }}>
            <span>{series[0].month}</span>
            <span>{series[series.length - 1].month}</span>
          </div>
        )}
      </div>
    </div>
  );
}
