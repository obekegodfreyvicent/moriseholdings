import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Money } from '../components/Money';

const TABS = [
  { key: 'coa', label: 'Chart of Accounts' },
  { key: 'journal', label: 'Journal Entries' },
  { key: 'periods', label: 'Financial Periods' },
  { key: 'trial', label: 'Trial Balance' },
  { key: 'ledger', label: 'General Ledger' },
  { key: 'income', label: 'Income Statement' },
  { key: 'balance', label: 'Balance Sheet' },
  { key: 'recurring', label: 'Recurring Entries' },
];

export function AccountingPage() {
  const { user, hasRole, hasPermission } = useAuth();
  const canViewAll = hasRole('Super Administrator', 'Managing Director', 'Group CEO');
  const canManage = hasRole('Super Administrator', 'Finance Manager') || hasPermission('accounting.manage');

  const [companies, setCompanies] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [tab, setTab] = useState('coa');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadCompanies() {
      setError(null);
      try {
        if (canViewAll) {
          const { items } = await apiRequestWithMeta('/organization/companies', { pageSize: 100 });
          setCompanies(items);
          if (items.length > 0) setCompanyId(items[0].id);
        } else {
          const list = await Promise.all(
            (user?.scopes ?? []).map((s) => apiRequest(`/organization/companies/${s.company_id}`)),
          );
          setCompanies(list);
          if (list.length > 0) setCompanyId(list[0].id);
        }
      } catch (err) {
        if (err instanceof ApiRequestError) setError(err.apiError.message);
        else setError('Unable to load companies.');
      }
    }
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewAll]);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Accounting</div>
          <h1>Accounting</h1>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="filterbar">
        <span className="flabel">Company</span>
        <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          {(companies ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <span className="pill-tab">
          {TABS.map((t) => (
            <span key={t.key} className={t.key === tab ? 'active' : ''} onClick={() => setTab(t.key)} style={{ cursor: 'pointer' }}>
              {t.label}
            </span>
          ))}
        </span>
      </div>

      {!companyId ? (
        <div className="empty">No company available.</div>
      ) : tab === 'coa' ? (
        <ChartOfAccountsTab companyId={companyId} canManage={canManage} />
      ) : tab === 'journal' ? (
        <JournalEntriesTab companyId={companyId} canManage={canManage} />
      ) : tab === 'periods' ? (
        <FinancialPeriodsTab companyId={companyId} canManage={canManage} />
      ) : tab === 'trial' ? (
        <TrialBalanceTab companyId={companyId} />
      ) : tab === 'ledger' ? (
        <GeneralLedgerTab companyId={companyId} />
      ) : tab === 'income' ? (
        <IncomeStatementTab companyId={companyId} />
      ) : tab === 'balance' ? (
        <BalanceSheetTab companyId={companyId} />
      ) : (
        <RecurringEntriesTab companyId={companyId} canManage={canManage} />
      )}
    </Layout>
  );
}

// ---------------------------------------------------------- Chart of Accounts
function ChartOfAccountsTab({ companyId, canManage }) {
  const [accounts, setAccounts] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    try {
      const data = await apiRequest('/accounting/accounts', { query: { companyId } });
      setAccounts(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load the chart of accounts.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <div className="card">
      <div className="card-head">
        Chart of Accounts
        {canManage && (
          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowCreate(true)}>
            + New Account
          </button>
        )}
      </div>
      {error && (
        <div className="card-body">
          <div className="banner error">{error}</div>
        </div>
      )}
      {accounts === null ? (
        <div className="loading">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="empty">No accounts yet for this company.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account Name</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.accountCode}</td>
                <td className="rowlink">{a.accountName}</td>
                <td style={{ textTransform: 'capitalize' }}>{a.accountType}</td>
                <td>
                  <span className={`badge ${a.isActive ? 'success' : 'neutral'}`}>
                    <span className="dot" />
                    {a.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <NewAccountModal companyId={companyId} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}

function NewAccountModal({ companyId, onClose, onCreated }) {
  const [accountCode, setAccountCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('asset');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/accounting/accounts', { method: 'POST', body: { companyId, accountCode, accountName, accountType } });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Account</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Account Code *</label>
              <input className="input" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} required />
            </div>
            <div className="field">
              <label>Type *</label>
              <select className="select" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Account Name *</label>
            <input className="input" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Journal Entries
function JournalEntriesTab({ companyId, canManage }) {
  const [entries, setEntries] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError(null);
    try {
      const [{ items }, accts, prds] = await Promise.all([
        apiRequestWithMeta('/accounting/journal-entries', { companyId, pageSize: 50 }),
        apiRequest('/accounting/accounts', { query: { companyId } }),
        apiRequest('/accounting/financial-periods', { query: { companyId } }),
      ]);
      setEntries(items);
      setAccounts(accts);
      setPeriods(prds);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load journal entries.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function postEntry(id) {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest(`/accounting/journal-entries/${id}/post`, { method: 'POST' });
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to post entry.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        Journal Entries
        {canManage && periods.length > 0 && (
          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowCreate(true)}>
            + New Entry
          </button>
        )}
      </div>
      {error && (
        <div className="card-body">
          <div className="banner error">{error}</div>
        </div>
      )}
      {canManage && periods.length === 0 && (
        <div className="card-body">
          <div className="hint">Create a financial period first (Financial Periods tab) before posting journal entries.</div>
        </div>
      )}
      {entries === null ? (
        <div className="loading">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="empty">No journal entries yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Entry #</th>
              <th>Date</th>
              <th>Description</th>
              <th className="num">Debits</th>
              <th className="num">Credits</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const debit = e.items.reduce((s, i) => s + Number(i.debitAmount), 0);
              const credit = e.items.reduce((s, i) => s + Number(i.creditAmount), 0);
              return (
                <tr key={e.id}>
                  <td className="mono">{e.entryNumber}</td>
                  <td>{e.entryDate.slice(0, 10)}</td>
                  <td>{e.description || '—'}</td>
                  <td className="num"><Money value={debit} /></td>
                  <td className="num"><Money value={credit} /></td>
                  <td>
                    <span className={`badge ${e.status === 'posted' ? 'success' : 'warning'}`}>
                      <span className="dot" />
                      {e.status}
                    </span>
                  </td>
                  <td>
                    {canManage && e.status === 'draft' && (
                      <button className="btn-ghost" disabled={busyId === e.id} onClick={() => postEntry(e.id)}>
                        {busyId === e.id ? 'Posting…' : 'Post'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showCreate && (
        <NewJournalEntryModal
          companyId={companyId}
          accounts={accounts}
          periods={periods}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}

function NewJournalEntryModal({ companyId, accounts, periods, onClose, onCreated }) {
  const openPeriods = periods.filter((p) => p.status === 'open');
  const [financialPeriodId, setFinancialPeriodId] = useState(openPeriods[0]?.id ?? '');
  const [entryDate, setEntryDate] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([
    { accountId: accounts[0]?.id ?? '', debitAmount: '', creditAmount: '' },
    { accountId: accounts[0]?.id ?? '', debitAmount: '', creditAmount: '' },
  ]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const debitTotal = lines.reduce((s, l) => s + (Number(l.debitAmount) || 0), 0);
  const creditTotal = lines.reduce((s, l) => s + (Number(l.creditAmount) || 0), 0);
  const balanced = lines.length >= 2 && debitTotal === creditTotal && debitTotal > 0;

  function updateLine(i, patch) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await apiRequest('/accounting/journal-entries', {
        method: 'POST',
        body: {
          companyId,
          financialPeriodId,
          entryDate,
          description,
          items: lines.map((l) => ({
            accountId: l.accountId,
            debitAmount: Number(l.debitAmount) || 0,
            creditAmount: Number(l.creditAmount) || 0,
          })),
        },
      });
      if (balanced) {
        await apiRequest(`/accounting/journal-entries/${created.id}/post`, { method: 'POST' });
      }
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create entry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
        <h2>New Journal Entry</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Period *</label>
              <select className="select" value={financialPeriodId} onChange={(e) => setFinancialPeriodId(e.target.value)} required>
                {openPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.periodName} (Open)
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date *</label>
              <input className="input" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <table style={{ marginBottom: 10 }}>
            <thead>
              <tr>
                <th>Account</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <select className="select" value={l.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })}>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.accountCode} — {a.accountName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={l.debitAmount}
                      onChange={(e) => updateLine(i, { debitAmount: e.target.value, creditAmount: '' })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={l.creditAmount}
                      onChange={(e) => updateLine(i, { creditAmount: e.target.value, debitAmount: '' })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="btn-ghost"
            style={{ marginBottom: 12 }}
            onClick={() => setLines((prev) => [...prev, { accountId: accounts[0]?.id ?? '', debitAmount: '', creditAmount: '' }])}
          >
            + Add Line
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13 }}>
              Total Debits: <b className="mono">{debitTotal.toLocaleString()}</b> &nbsp; Total Credits:{' '}
              <b className="mono">{creditTotal.toLocaleString()}</b>
            </div>
            <span className={`badge ${balanced ? 'success' : 'error'}`}>
              <span className="dot" />
              {balanced ? 'Balanced — will post immediately' : 'Unbalanced — will save as draft'}
            </span>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !financialPeriodId}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Financial Periods
function FinancialPeriodsTab({ companyId, canManage }) {
  const [periods, setPeriods] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError(null);
    try {
      const data = await apiRequest('/accounting/financial-periods', { query: { companyId } });
      setPeriods(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load financial periods.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function closePeriod(id) {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest(`/accounting/financial-periods/${id}/close`, { method: 'POST' });
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to close period.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        Financial Periods
        {canManage && (
          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowCreate(true)}>
            + New Period
          </button>
        )}
      </div>
      {error && (
        <div className="card-body">
          <div className="banner error">{error}</div>
        </div>
      )}
      {periods === null ? (
        <div className="loading">Loading…</div>
      ) : periods.length === 0 ? (
        <div className="empty">No financial periods yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id}>
                <td className="rowlink">{p.periodName}</td>
                <td>{p.startDate.slice(0, 10)}</td>
                <td>{p.endDate.slice(0, 10)}</td>
                <td>
                  <span className={`badge ${p.status === 'open' ? 'success' : 'neutral'}`}>
                    <span className="dot" />
                    {p.status}
                  </span>
                </td>
                <td>
                  {canManage && p.status === 'open' && (
                    <button className="btn-ghost" disabled={busyId === p.id} onClick={() => closePeriod(p.id)}>
                      {busyId === p.id ? 'Closing…' : 'Close Period'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <NewPeriodModal companyId={companyId} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}

function NewPeriodModal({ companyId, onClose, onCreated }) {
  const [periodName, setPeriodName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/accounting/financial-periods', { method: 'POST', body: { companyId, periodName, startDate, endDate } });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create period.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Financial Period</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Period Name *</label>
            <input className="input" value={periodName} onChange={(e) => setPeriodName(e.target.value)} placeholder="e.g. FY2026-Q2" required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Start Date *</label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>End Date *</label>
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- Trial Balance
function TrialBalanceTab({ companyId }) {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiRequest('/accounting/financial-periods', { query: { companyId } }).then((data) => {
      setPeriods(data);
      if (data.length > 0) setPeriodId(data[0].id);
    });
  }, [companyId]);

  async function generate() {
    setError(null);
    setReport(null);
    try {
      const data = await apiRequest('/accounting/reports/trial-balance', { query: { companyId, periodId } });
      setReport(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to generate report.');
    }
  }

  return (
    <div className="card">
      <div className="card-head">Trial Balance Report</div>
      <div className="card-body">
        {error && <div className="banner error">{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <select className="select" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.periodName}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={generate} disabled={!periodId}>
            Generate
          </button>
        </div>

        {report && (
          <>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((l) => (
                  <tr key={l.account_code}>
                    <td className="mono">{l.account_code}</td>
                    <td>{l.account_name}</td>
                    <td className="num"><Money value={l.debit} /></td>
                    <td className="num"><Money value={l.credit} /></td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 800 }}>
                  <td></td>
                  <td>Total</td>
                  <td className="num"><Money value={report.total_debits} /></td>
                  <td className="num"><Money value={report.total_credits} /></td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 10 }}>
              <span className={`badge ${report.balanced ? 'success' : 'error'}`}>
                <span className="dot" />
                {report.balanced ? 'Balanced' : 'Unbalanced'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------- General Ledger

function GeneralLedgerTab({ companyId }) {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setReport(null);
    apiRequest('/accounting/accounts', { query: { companyId } }).then((data) => {
      setAccounts(data);
      if (data.length > 0) setAccountId(data[0].id);
    });
    apiRequest('/accounting/financial-periods', { query: { companyId } }).then((data) => {
      setPeriods(data);
      setPeriodId('');
    });
  }, [companyId]);

  async function generate() {
    setError(null);
    setReport(null);
    try {
      const data = await apiRequest('/accounting/reports/general-ledger', {
        query: { companyId, accountId, ...(periodId ? { periodId } : {}) },
      });
      setReport(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to generate report.');
    }
  }

  return (
    <div className="card">
      <div className="card-head">General Ledger (FR-ACC-03)</div>
      <div className="card-body">
        {error && <div className="banner error">{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountCode} — {a.accountName}
              </option>
            ))}
          </select>
          <select className="select" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">All periods</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.periodName}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={generate} disabled={!accountId}>
            Generate
          </button>
        </div>

        {report && (
          <>
            <div className="hint" style={{ marginBottom: 10 }}>
              {report.account_code} — {report.account_name} ({report.account_type})
            </div>
            {report.lines.length === 0 ? (
              <div className="empty">No posted entries for this account yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Entry #</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="num">Debit</th>
                    <th className="num">Credit</th>
                    <th className="num">Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="mono">{l.entry_number}</td>
                      <td className="mono">{l.entry_date?.slice(0, 10)}</td>
                      <td>{l.description || '—'}</td>
                      <td className="num"><Money value={l.debit} /></td>
                      <td className="num"><Money value={l.credit} /></td>
                      <td className="num"><Money value={l.running_balance} /></td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 800 }}>
                    <td colSpan={5}>Closing Balance</td>
                    <td className="num"><Money value={report.closing_balance} /></td>
                  </tr>
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------- Income Statement
function IncomeStatementTab({ companyId }) {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [consolidated, setConsolidated] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setReport(null);
    apiRequest('/accounting/financial-periods', { query: { companyId } }).then((data) => {
      setPeriods(data);
      setPeriodId(data.length > 0 ? data[0].id : '');
    });
  }, [companyId]);

  async function generate() {
    setError(null);
    setReport(null);
    try {
      const data = await apiRequest('/accounting/reports/income-statement', {
        query: { companyId, periodId, consolidated: consolidated ? 'true' : undefined },
      });
      setReport(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to generate report.');
    }
  }

  return (
    <div className="card">
      <div className="card-head">Income Statement (Sprint 10 — Full Accounting)</div>
      <div className="card-body">
        {error && <div className="banner error">{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <select className="select" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {periods.length === 0 && <option value="">No periods for this company</option>}
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.periodName}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9em' }}>
            <input type="checkbox" checked={consolidated} onChange={(e) => setConsolidated(e.target.checked)} />
            Consolidated (this company + subsidiaries)
          </label>
          <button className="btn btn-secondary" onClick={generate} disabled={!periodId}>
            Generate
          </button>
        </div>

        {report && !consolidated && (
          <IncomeStatementLines title="Revenue" lines={report.revenue} total={report.total_revenue} />
        )}
        {report && !consolidated && (
          <IncomeStatementLines title="Expense" lines={report.expense} total={report.total_expense} />
        )}
        {report && !consolidated && (
          <div style={{ marginTop: 10, fontWeight: 800 }}>
            Net Income:{' '}
            <span className="num" style={{ color: Number(report.net_income) < 0 ? 'var(--danger, #b91c1c)' : undefined }}>
              <Money value={report.net_income} />
            </span>
          </div>
        )}

        {report && consolidated && (
          <>
            {report.by_company.map((c) => (
              <div key={c.company_id} style={{ marginBottom: 20 }}>
                <div className="hint" style={{ marginBottom: 6, fontWeight: 700 }}>
                  {c.company_name}
                </div>
                <IncomeStatementLines title="Revenue" lines={c.revenueLines.map(toFixedLine)} total={c.total_revenue.toFixed(2)} />
                <IncomeStatementLines title="Expense" lines={c.expenseLines.map(toFixedLine)} total={c.total_expense.toFixed(2)} />
                <div style={{ fontWeight: 700 }}>Net Income: <Money value={c.net_income} /></div>
              </div>
            ))}
            {report.excluded_companies.length > 0 && (
              <div className="hint" style={{ marginBottom: 10 }}>
                Excluded: {report.excluded_companies.map((e) => `${e.company_name} (${e.reason})`).join('; ')}
              </div>
            )}
            <div style={{ fontWeight: 800, borderTop: '1px solid var(--border, #ddd)', paddingTop: 10 }}>
              Consolidated Total Revenue: <Money value={report.consolidated.total_revenue} /> — Total Expense:{' '}
              <Money value={report.consolidated.total_expense} /> — Net Income: <Money value={report.consolidated.net_income} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function toFixedLine(l) {
  return { account_code: l.account_code, account_name: l.account_name, balance: l.balance.toFixed(2) };
}

function IncomeStatementLines({ title, lines, total }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="hint" style={{ marginBottom: 6 }}>
        {title}
      </div>
      {lines.length === 0 ? (
        <div className="empty">None.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account Name</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.account_code}>
                <td className="mono">{l.account_code}</td>
                <td>{l.account_name}</td>
                <td className="num"><Money value={l.balance} /></td>
              </tr>
            ))}
            <tr style={{ fontWeight: 800 }}>
              <td></td>
              <td>Total</td>
              <td className="num"><Money value={total} /></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------- Balance Sheet
function BalanceSheetTab({ companyId }) {
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [consolidated, setConsolidated] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  async function generate() {
    setError(null);
    setReport(null);
    try {
      const data = await apiRequest('/accounting/reports/balance-sheet', {
        query: { companyId, asOfDate, consolidated: consolidated ? 'true' : undefined },
      });
      setReport(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to generate report.');
    }
  }

  return (
    <div className="card">
      <div className="card-head">Balance Sheet (Sprint 10 — Full Accounting)</div>
      <div className="card-body">
        {error && <div className="banner error">{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <input className="input" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} style={{ maxWidth: 180 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9em' }}>
            <input type="checkbox" checked={consolidated} onChange={(e) => setConsolidated(e.target.checked)} />
            Consolidated (this company + subsidiaries)
          </label>
          <button className="btn btn-secondary" onClick={generate} disabled={!asOfDate}>
            Generate
          </button>
        </div>

        {report && !consolidated && (
          <>
            <IncomeStatementLines title="Assets" lines={report.assets} total={report.total_assets} />
            <IncomeStatementLines title="Liabilities" lines={report.liabilities} total={report.total_liabilities} />
            <IncomeStatementLines title="Equity" lines={report.equity} total={report.total_equity} />
            <div style={{ marginTop: 10 }}>
              <span className={`badge ${report.balanced ? 'success' : 'error'}`}>
                <span className="dot" />
                {report.balanced ? 'Balanced' : 'Unbalanced'}
              </span>
            </div>
          </>
        )}

        {report && consolidated && (
          <>
            {report.by_company.map((c) => (
              <div key={c.company_id} style={{ marginBottom: 20 }}>
                <div className="hint" style={{ marginBottom: 6, fontWeight: 700 }}>
                  {c.company_name}
                </div>
                <div>Total Assets: <Money value={c.total_assets} /></div>
                <div>Total Liabilities: <Money value={c.total_liabilities} /></div>
                <div>Total Equity (incl. net income to date): <Money value={c.total_equity} /></div>
              </div>
            ))}
            {report.excluded_companies.length > 0 && (
              <div className="hint" style={{ marginBottom: 10 }}>
                Excluded: {report.excluded_companies.map((e) => `${e.company_name} (${e.reason})`).join('; ')}
              </div>
            )}
            <div style={{ fontWeight: 800, borderTop: '1px solid var(--border, #ddd)', paddingTop: 10 }}>
              Consolidated Total Assets: <Money value={report.consolidated.total_assets} /> — Total Liabilities:{' '}
              <Money value={report.consolidated.total_liabilities} /> — Total Equity: <Money value={report.consolidated.total_equity} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------- Recurring Entries
function RecurringEntriesTab({ companyId, canManage }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [generateTarget, setGenerateTarget] = useState(null);

  async function load() {
    setError(null);
    try {
      const data = await apiRequest('/accounting/recurring-entries', { query: { companyId } });
      setEntries(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load recurring entries.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <div className="card">
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Recurring &amp; Adjusting Entries (FR-ACC-07)</span>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Template
          </button>
        )}
      </div>
      <div className="card-body">
        {error && <div className="banner error">{error}</div>}
        {entries === null ? (
          <div className="loading">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="empty">No recurring entry templates yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Times Generated</th>
                <th>Last Generated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="rowlink">{e.name}</td>
                  <td>
                    <span className={`badge ${e.isActive ? 'success' : 'neutral'}`}>
                      <span className="dot" />
                      {e.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="mono">{e.timesGenerated}</td>
                  <td className="mono">{e.lastGeneratedAt ? e.lastGeneratedAt.slice(0, 10) : '—'}</td>
                  <td>
                    {canManage && e.isActive && (
                      <button className="btn-ghost" onClick={() => setGenerateTarget(e)}>
                        Generate…
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <NewRecurringEntryModal companyId={companyId} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {generateTarget && (
        <GenerateRecurringEntryModal
          companyId={companyId}
          entry={generateTarget}
          onClose={() => setGenerateTarget(null)}
          onGenerated={load}
        />
      )}
    </div>
  );
}

function NewRecurringEntryModal({ companyId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [items, setItems] = useState([
    { accountId: '', debitAmount: '', creditAmount: '', description: '' },
    { accountId: '', debitAmount: '', creditAmount: '', description: '' },
  ]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest('/accounting/accounts', { query: { companyId } }).then(setAccounts);
  }, [companyId]);

  function updateItem(i, field, value) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/accounting/recurring-entries', {
        method: 'POST',
        body: {
          companyId,
          name,
          description: description || undefined,
          items: items.map((it) => ({
            accountId: it.accountId,
            debitAmount: it.debitAmount ? Number(it.debitAmount) : undefined,
            creditAmount: it.creditAmount ? Number(it.creditAmount) : undefined,
            description: it.description || undefined,
          })),
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create recurring entry template.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>New Recurring Entry Template</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly Office Rent" required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="fs-title">Line Items (must balance)</div>
          {items.map((it, i) => (
            <div className="formgrid" style={{ marginBottom: 8 }} key={i}>
              <div className="field">
                <label>Account</label>
                <select className="select" value={it.accountId} onChange={(e) => updateItem(i, 'accountId', e.target.value)} required>
                  <option value="">Select…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountCode} — {a.accountName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Debit</label>
                <input className="input" type="number" min="0" step="0.01" value={it.debitAmount} onChange={(e) => updateItem(i, 'debitAmount', e.target.value)} />
              </div>
              <div className="field">
                <label>Credit</label>
                <input className="input" type="number" min="0" step="0.01" value={it.creditAmount} onChange={(e) => updateItem(i, 'creditAmount', e.target.value)} />
              </div>
              <div className="field">
                <label>Description</label>
                <input className="input" value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn-ghost"
            style={{ marginBottom: 12 }}
            onClick={() => setItems((prev) => [...prev, { accountId: '', debitAmount: '', creditAmount: '', description: '' }])}
          >
            + Add line
          </button>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GenerateRecurringEntryModal({ companyId, entry, onClose, onGenerated }) {
  const [periods, setPeriods] = useState([]);
  const [financialPeriodId, setFinancialPeriodId] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest('/accounting/financial-periods', { query: { companyId } }).then((data) => {
      setPeriods(data.filter((p) => p.status === 'open'));
    });
  }, [companyId]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/accounting/recurring-entries/${entry.id}/generate`, {
        method: 'POST',
        body: { financialPeriodId, entryDate },
      });
      onGenerated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to generate an entry from this template.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Generate Entry — {entry.name}</h2>
        <p style={{ opacity: 0.75, fontSize: '0.9em', marginTop: -4 }}>
          Creates a new draft journal entry from this template. You still need to post it separately from the
          Journal Entries tab (the same balance/period-closed checks apply as any manually-created entry).
        </p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Financial Period <span className="req">*</span>
            </label>
            <select className="select" value={financialPeriodId} onChange={(e) => setFinancialPeriodId(e.target.value)} required>
              <option value="">Select an open period…</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.periodName}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Entry Date <span className="req">*</span>
            </label>
            <input className="input" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
