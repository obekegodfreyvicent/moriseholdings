import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Admin » Payroll (28 August 2026). Monthly payroll runs (Uganda PAYE + NSSF),
// payslips, and salary advances with a recovery schedule. A run moves
// draft → approved → paid; paying it posts a balanced journal entry.

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const RUN_BADGE = { draft: 'neutral', approved: 'warning', paid: 'success', cancelled: 'error' };
const ADV_BADGE = { requested: 'warning', approved: 'neutral', recovering: 'neutral', recovered: 'success', rejected: 'error', cancelled: 'error' };

export function PayrollPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('payroll.manage');
  const canApprove = hasPermission('payroll.approve');

  const [companies, setCompanies] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [tab, setTab] = useState('runs');
  const [runs, setRuns] = useState(null);
  const [advances, setAdvances] = useState(null);
  const [openRun, setOpenRun] = useState(null);
  const [error, setError] = useState(null);
  const [showNewRun, setShowNewRun] = useState(false);
  const [showNewAdvance, setShowNewAdvance] = useState(false);

  useEffect(() => {
    apiRequestWithMeta('/organization/companies', { pageSize: 100 }).then((r) => setCompanies(r.items)).catch(() => setCompanies([]));
  }, []);

  async function load() {
    setError(null);
    const q = companyId ? { companyId } : {};
    try {
      if (tab === 'runs') setRuns(await apiRequest('/payroll/runs', { query: q }));
      else setAdvances(await apiRequest('/payroll/salary-advances', { query: q }));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load.');
      if (tab === 'runs') setRuns([]);
      else setAdvances([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companyId]);

  async function runAction(id, action) {
    setError(null);
    try {
      const updated = await apiRequest(`/payroll/runs/${id}/${action}`, { method: 'POST' });
      if (openRun && openRun.id === id && updated?.id) setOpenRun(updated);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Action failed.');
    }
  }

  async function advAction(id, action) {
    setError(null);
    try {
      await apiRequest(`/payroll/salary-advances/${id}/${action}`, { method: 'POST', body: action === 'reject' ? {} : undefined });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Action failed.');
    }
  }

  async function viewRun(id) {
    try {
      setOpenRun(await apiRequest(`/payroll/runs/${id}`));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Could not load the run.');
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Human Resources</div>
          <h1>Payroll</h1>
        </div>
        <div className="actions">
          {tab === 'runs' && canManage && <button className="btn btn-primary" disabled={!companyId} onClick={() => setShowNewRun(true)}>+ New payroll run</button>}
          {tab === 'advances' && canManage && <button className="btn btn-primary" disabled={!companyId} onClick={() => setShowNewAdvance(true)}>+ Request advance</button>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 240 }}>
          <label>Company</label>
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies in my scope</option>
            {(companies || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`btn ${tab === 'runs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('runs')}>Payroll runs</button>
          <button className={`btn ${tab === 'advances' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('advances')}>Salary advances</button>
        </div>
        {canManage && !companyId && <span style={{ fontSize: 12, color: '#7c8aa3' }}>Pick a company to add a {tab === 'runs' ? 'run' : 'request'}.</span>}
      </div>

      {error && <div className="banner error">{error}</div>}

      {tab === 'runs' && (
        <div className="card">
          {runs === null ? <div className="loading">Loading…</div> : runs.length === 0 ? (
            <div className="empty">No payroll runs.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Period</th><th>Status</th><th style={{ textAlign: 'right' }}>Staff</th>
                  <th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>PAYE</th>
                  <th style={{ textAlign: 'right' }}>NSSF</th><th style={{ textAlign: 'right' }}>Net</th><th />
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="rowlink" style={{ cursor: 'pointer' }} onClick={() => viewRun(r.id)}>{r.periodLabel}</td>
                    <td><span className={`badge ${RUN_BADGE[r.status]}`}><span className="dot" />{r.status}</span></td>
                    <td className="mono" style={{ textAlign: 'right' }}>{r.employeeCount}</td>
                    <td style={{ textAlign: 'right' }}><Money value={r.totalGross} /></td>
                    <td style={{ textAlign: 'right' }}><Money value={r.totalPaye} /></td>
                    <td style={{ textAlign: 'right' }}><Money value={r.totalNssfEmployee} /></td>
                    <td style={{ textAlign: 'right' }}><Money value={r.totalNet} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary" onClick={() => viewRun(r.id)}>Payslips</button>{' '}
                      {r.status === 'draft' && canApprove && <button className="btn btn-secondary" onClick={() => runAction(r.id, 'approve')}>Approve</button>}
                      {r.status === 'approved' && canApprove && <button className="btn btn-primary" onClick={() => runAction(r.id, 'pay')}>Pay</button>}
                      {(r.status === 'draft' || r.status === 'approved') && canManage && <button className="btn btn-secondary" onClick={() => runAction(r.id, 'cancel')}>Cancel</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'advances' && (
        <div className="card">
          {advances === null ? <div className="loading">Loading…</div> : advances.length === 0 ? (
            <div className="empty">No salary advances.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Instal.</th>
                  <th style={{ textAlign: 'right' }}>Recovered</th><th style={{ textAlign: 'right' }}>Outstanding</th><th>Status</th><th>Reason</th><th />
                </tr>
              </thead>
              <tbody>
                {advances.map((a) => (
                  <tr key={a.id}>
                    <td>{a.employeeName}</td>
                    <td style={{ textAlign: 'right' }}><Money value={a.amount} /></td>
                    <td className="mono" style={{ textAlign: 'right' }}>{a.installments}</td>
                    <td style={{ textAlign: 'right' }}><Money value={a.amountRecovered} /></td>
                    <td style={{ textAlign: 'right' }}><Money value={a.outstanding} /></td>
                    <td><span className={`badge ${ADV_BADGE[a.status]}`}><span className="dot" />{a.status}</span></td>
                    <td style={{ color: '#5b6a85', fontSize: 13 }}>{a.reason || '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {a.status === 'requested' && canApprove && (
                        <>
                          <button className="btn btn-secondary" onClick={() => advAction(a.id, 'approve')}>Approve</button>{' '}
                          <button className="btn btn-secondary" onClick={() => advAction(a.id, 'reject')}>Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {openRun && <RunModal run={openRun} onClose={() => setOpenRun(null)} />}
      {showNewRun && <NewRunModal companyId={companyId} onClose={() => setShowNewRun(false)} onDone={() => { setShowNewRun(false); load(); }} />}
      {showNewAdvance && <NewAdvanceModal companyId={companyId} onClose={() => setShowNewAdvance(false)} onDone={() => { setShowNewAdvance(false); load(); }} />}
    </Layout>
  );
}

function RunModal({ run, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 780 }} onClick={(e) => e.stopPropagation()}>
        <h2>Payslips — {run.periodLabel} <span className={`badge ${RUN_BADGE[run.status]}`} style={{ marginLeft: 8 }}><span className="dot" />{run.status}</span></h2>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Employee</th><th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>PAYE</th>
              <th style={{ textAlign: 'right' }}>NSSF (emp)</th><th style={{ textAlign: 'right' }}>Advance</th><th style={{ textAlign: 'right' }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {(run.payslips || []).map((p) => (
              <tr key={p.id}>
                <td>{p.employeeName}</td>
                <td style={{ textAlign: 'right' }}><Money value={p.grossSalary} /></td>
                <td style={{ textAlign: 'right' }}><Money value={p.paye} /></td>
                <td style={{ textAlign: 'right' }}><Money value={p.nssfEmployee} /></td>
                <td style={{ textAlign: 'right' }}>{Number(p.advanceRecovery) ? <Money value={p.advanceRecovery} /> : '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}><Money value={p.netPay} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #E4E9F2', fontWeight: 700 }}>
              <td>Totals ({run.employeeCount})</td>
              <td style={{ textAlign: 'right' }}><Money value={run.totalGross} /></td>
              <td style={{ textAlign: 'right' }}><Money value={run.totalPaye} /></td>
              <td style={{ textAlign: 'right' }}><Money value={run.totalNssfEmployee} /></td>
              <td style={{ textAlign: 'right' }}><Money value={run.totalAdvances} /></td>
              <td style={{ textAlign: 'right' }}><Money value={run.totalNet} /></td>
            </tr>
          </tfoot>
        </table>
        <p style={{ fontSize: 12, color: '#7c8aa3', marginTop: 8 }}>
          Employer NSSF (10%): <Money value={run.totalNssfEmployer} />
          {run.journalEntryId && ` · posted to the ledger`}
        </p>
        <div className="modal-actions"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function NewRunModal({ companyId, onClose, onDone }) {
  const now = new Date();
  const [periodYear, setYear] = useState(now.getFullYear());
  const [periodMonth, setMonth] = useState(now.getMonth() + 1);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/payroll/runs', { method: 'POST', body: { companyId, periodYear: Number(periodYear), periodMonth: Number(periodMonth) } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Could not create the run.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2>New payroll run</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="formgrid" style={{ marginBottom: 16 }}>
            <div className="field">
              <label>Month</label>
              <select className="select" value={periodMonth} onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Year</label>
              <input className="input" type="number" min="2020" max="2100" value={periodYear} onChange={(e) => setYear(e.target.value)} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#7c8aa3', marginTop: -8, marginBottom: 12 }}>
            Every active employee with a gross salary is included; PAYE, NSSF and any approved salary-advance instalment are computed automatically.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Running…' : 'Create draft run'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewAdvanceModal({ companyId, onClose, onDone }) {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState('3');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequestWithMeta('/employees', { pageSize: 100 })
      .then((r) => setEmployees(r.items.filter((e) => e.companyId === companyId)))
      .catch(() => setEmployees([]));
  }, [companyId]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/payroll/salary-advances', {
        method: 'POST',
        body: { companyId, employeeId, amount: amount.trim(), installments: Number(installments), reason: reason.trim() || undefined },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Could not submit the request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <h2>Request a salary advance</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Employee <span className="req">*</span></label>
            <select className="select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              <option value="">— select —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Amount (UGX) <span className="req">*</span></label>
              <input className="input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="field">
              <label>Instalments</label>
              <input className="input" type="number" min="1" max="24" value={installments} onChange={(e) => setInstallments(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Reason</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !employeeId}>{saving ? 'Submitting…' : 'Submit request'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
