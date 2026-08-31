import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, downloadReport, ApiRequestError } from '../lib/api';

const REPORT_TYPES = [
  { key: 'companies', label: 'Companies & Branches', path: '/reports/companies', needsCompany: false, needsPeriod: false, needsDateRange: false, needsPeriodName: false },
  { key: 'employees', label: 'Employees', path: '/reports/employees', needsCompany: true, needsPeriod: false, needsDateRange: false, needsPeriodName: false },
  { key: 'customers', label: 'Customers', path: '/reports/customers', needsCompany: true, needsPeriod: false, needsDateRange: false, needsPeriodName: false },
  { key: 'suppliers', label: 'Suppliers', path: '/reports/suppliers', needsCompany: true, needsPeriod: false, needsDateRange: false, needsPeriodName: false },
  { key: 'accounting', label: 'Chart of Accounts / Trial Balance', path: '/reports/accounting', needsCompany: true, needsPeriod: true, needsDateRange: false, needsPeriodName: false },
  { key: 'audit-trail', label: 'Audit Trail', path: '/reports/audit-trail', needsCompany: true, needsPeriod: false, needsDateRange: true, needsPeriodName: false },
  {
    key: 'company-comparison',
    label: 'Subsidiary Comparison / Consolidated Group',
    path: '/reports/company-comparison',
    needsCompany: false,
    needsPeriod: false,
    needsDateRange: false,
    needsPeriodName: true,
  },
];

export function ReportsPage() {
  const [reportKey, setReportKey] = useState('companies');
  const [companyId, setCompanyId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [periodName, setPeriodName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reportType = REPORT_TYPES.find((r) => r.key === reportKey);

  function buildQuery() {
    const query = {};
    if (reportType.needsCompany) {
      if (reportKey === 'accounting') query.companyId = companyId || undefined;
      else query['filter[companyId]'] = companyId || undefined;
    }
    if (reportType.needsPeriod) query.periodId = periodId || undefined;
    if (reportType.needsPeriodName) query.periodName = periodName || undefined;
    if (reportType.needsDateRange) {
      query['filter[dateFrom]'] = dateFrom || undefined;
      query['filter[dateTo]'] = dateTo || undefined;
    }
    return query;
  }

  async function generate() {
    setError(null);
    setLoading(true);
    setReport(null);
    try {
      const data = await apiRequest(reportType.path, { query: buildQuery() });
      setReport(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to generate report.');
    } finally {
      setLoading(false);
    }
  }

  async function exportAs(format) {
    setError(null);
    setExporting(true);
    try {
      await downloadReport(reportType.path, { ...buildQuery(), format });
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to export report.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Reports</div>
          <h1>Reports</h1>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
        <div className="card-body">
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Report</label>
              <select
                className="select"
                value={reportKey}
                onChange={(e) => {
                  setReportKey(e.target.value);
                  setReport(null);
                }}
              >
                {REPORT_TYPES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {reportType.needsCompany && (
              <div className="field">
                <label>Company ID {reportKey === 'accounting' && <span className="req">*</span>}</label>
                <input className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="uuid (optional unless noted)" />
              </div>
            )}
            {reportType.needsPeriod && (
              <div className="field">
                <label>Financial Period ID</label>
                <input
                  className="input"
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  placeholder="omit for chart of accounts, set for trial balance"
                />
              </div>
            )}
            {reportType.needsDateRange && (
              <>
                <div className="field">
                  <label>From</label>
                  <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="field">
                  <label>To</label>
                  <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </>
            )}
            {reportType.needsPeriodName && (
              <div className="field">
                <label>Period Name</label>
                <input
                  className="input"
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                  placeholder="e.g. FY2026-Q1 — omit for headcount/assets/projects only"
                />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={generate} disabled={loading || (reportKey === 'accounting' && !companyId)}>
              {loading ? 'Generating…' : 'Generate'}
            </button>
            <button className="btn btn-secondary" onClick={() => exportAs('csv')} disabled={exporting || (reportKey === 'accounting' && !companyId)}>
              Export CSV
            </button>
            <button className="btn btn-secondary" onClick={() => exportAs('pdf')} disabled={exporting || (reportKey === 'accounting' && !companyId)}>
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {report && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            {report.title}
            {report.subtitle && <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 8 }}>{report.subtitle}</span>}
          </div>
          <div className="card-body">
            {report.rows.length === 0 ? (
              <div className="empty">No rows.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    {report.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className={j === 0 ? 'mono' : undefined}>
                          {cell === '' || cell === null ? '—' : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
