import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Money } from '../components/Money';

// morise.docx, Section 2: "Maintain inter-company transactions." Only
// Super Administrator, Managing Director and Finance Manager hold
// organization.intercompany.manage/viewAll in this proof-of-concept — the
// same group-wide reach the API itself requires, since a transaction by
// definition touches two companies at once.
export function InterCompanyTransactionsPage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Managing Director', 'Finance Manager') || hasPermission('organization.intercompany.manage');

  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [postTarget, setPostTarget] = useState(null);

  async function load() {
    setError(null);
    try {
      const data = await apiRequest('/organization/inter-company-transactions');
      setTransactions(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load inter-company transactions.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Inter-Company Transactions</div>
          <h1>Inter-Company Transactions</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Transaction
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
        {transactions === null ? (
          <div className="loading">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="empty">No inter-company transactions yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>From Company</th>
                <th>To Company</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td style={{ textTransform: 'capitalize' }}>{t.transactionType.replace('_', ' ')}</td>
                  <td className="mono">{t.fromCompanyId.slice(0, 8)}…</td>
                  <td className="mono">{t.toCompanyId.slice(0, 8)}…</td>
                  <td className="num">
                    <Money value={t.amount} currency={t.currency} />
                  </td>
                  <td>
                    <span className={`badge ${t.status === 'posted' ? 'success' : 'neutral'}`}>
                      <span className="dot" />
                      {t.status}
                    </span>
                  </td>
                  <td>
                    {canManage && t.status === 'draft' && (
                      <button className="btn-ghost" onClick={() => setPostTarget(t)}>
                        Post…
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateTransactionModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {postTarget && <PostTransactionModal transaction={postTarget} onClose={() => setPostTarget(null)} onPosted={load} />}
    </Layout>
  );
}

function CreateTransactionModal({ onClose, onCreated }) {
  const [fromCompanyId, setFromCompanyId] = useState('');
  const [toCompanyId, setToCompanyId] = useState('');
  const [transactionType, setTransactionType] = useState('transfer');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [transactionDate, setTransactionDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/organization/inter-company-transactions', {
        method: 'POST',
        body: {
          fromCompanyId,
          toCompanyId,
          transactionType,
          amount: Number(amount),
          currency,
          transactionDate,
          description: description || undefined,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create transaction.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Inter-Company Transaction</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                From Company ID <span className="req">*</span>
              </label>
              <input className="input" value={fromCompanyId} onChange={(e) => setFromCompanyId(e.target.value)} placeholder="uuid" required />
            </div>
            <div className="field">
              <label>
                To Company ID <span className="req">*</span>
              </label>
              <input className="input" value={toCompanyId} onChange={(e) => setToCompanyId(e.target.value)} placeholder="uuid" required />
            </div>
            <div className="field">
              <label>Type</label>
              <select className="select" value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
                <option value="loan">Loan</option>
                <option value="transfer">Transfer</option>
                <option value="service_charge">Service Charge</option>
                <option value="cost_allocation">Cost Allocation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>
                Amount <span className="req">*</span>
              </label>
              <input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="field">
              <label>
                Currency <span className="req">*</span>
              </label>
              <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} required />
            </div>
            <div className="field">
              <label>
                Date <span className="req">*</span>
              </label>
              <input className="input" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PostTransactionModal({ transaction, onClose, onPosted }) {
  const [fromAccounts, setFromAccounts] = useState(null);
  const [toAccounts, setToAccounts] = useState(null);
  const [fromPeriods, setFromPeriods] = useState(null);
  const [toPeriods, setToPeriods] = useState(null);
  const [fromAccountId, setFromAccountId] = useState('');
  const [fromClearingAccountId, setFromClearingAccountId] = useState('');
  const [toClearingAccountId, setToClearingAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [fromFinancialPeriodId, setFromFinancialPeriodId] = useState('');
  const [toFinancialPeriodId, setToFinancialPeriodId] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest('/accounting/accounts', { query: { companyId: transaction.fromCompanyId } }),
      apiRequest('/accounting/accounts', { query: { companyId: transaction.toCompanyId } }),
      apiRequest('/accounting/financial-periods', { query: { companyId: transaction.fromCompanyId } }),
      apiRequest('/accounting/financial-periods', { query: { companyId: transaction.toCompanyId } }),
    ])
      .then(([fa, ta, fp, tp]) => {
        setFromAccounts(fa);
        setToAccounts(ta);
        setFromPeriods(fp.filter((p) => p.status === 'open'));
        setToPeriods(tp.filter((p) => p.status === 'open'));
      })
      .catch((err) => {
        if (err instanceof ApiRequestError) setError(err.apiError.message);
        else setError('Unable to load accounts/periods for one or both companies.');
      });
  }, [transaction.fromCompanyId, transaction.toCompanyId]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/organization/inter-company-transactions/${transaction.id}/post`, {
        method: 'POST',
        body: { fromAccountId, fromClearingAccountId, toClearingAccountId, toAccountId, fromFinancialPeriodId, toFinancialPeriodId },
      });
      onPosted();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to post this transaction.');
    } finally {
      setSaving(false);
    }
  }

  const accountOptions = (accounts) =>
    (accounts ?? []).map((a) => (
      <option key={a.id} value={a.id}>
        {a.accountCode} — {a.accountName} ({a.accountType})
      </option>
    ));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>Post Transaction</h2>
        <p style={{ opacity: 0.75, fontSize: '0.9em', marginTop: -4 }}>
          Posts one balanced entry in each company's own books: debit the "from" clearing account / credit the
          "from" operational account in the sending company, and debit the "to" operational account / credit the
          "to" clearing account in the receiving company.
        </p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="fs-title">From Company</div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Operational Account (credited)</label>
              <select className="select" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} required>
                <option value="">{fromAccounts === null ? 'Loading…' : 'Select…'}</option>
                {accountOptions(fromAccounts)}
              </select>
            </div>
            <div className="field">
              <label>Clearing Account (debited — "Due from...")</label>
              <select className="select" value={fromClearingAccountId} onChange={(e) => setFromClearingAccountId(e.target.value)} required>
                <option value="">{fromAccounts === null ? 'Loading…' : 'Select…'}</option>
                {accountOptions(fromAccounts)}
              </select>
            </div>
            <div className="field">
              <label>Financial Period</label>
              <select className="select" value={fromFinancialPeriodId} onChange={(e) => setFromFinancialPeriodId(e.target.value)} required>
                <option value="">{fromPeriods === null ? 'Loading…' : 'Select…'}</option>
                {(fromPeriods ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.periodName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="fs-title">To Company</div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Clearing Account (credited — "Due to...")</label>
              <select className="select" value={toClearingAccountId} onChange={(e) => setToClearingAccountId(e.target.value)} required>
                <option value="">{toAccounts === null ? 'Loading…' : 'Select…'}</option>
                {accountOptions(toAccounts)}
              </select>
            </div>
            <div className="field">
              <label>Operational Account (debited)</label>
              <select className="select" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} required>
                <option value="">{toAccounts === null ? 'Loading…' : 'Select…'}</option>
                {accountOptions(toAccounts)}
              </select>
            </div>
            <div className="field">
              <label>Financial Period</label>
              <select className="select" value={toFinancialPeriodId} onChange={(e) => setToFinancialPeriodId(e.target.value)} required>
                <option value="">{toPeriods === null ? 'Loading…' : 'Select…'}</option>
                {(toPeriods ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.periodName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Posting…' : 'Post & Balance Both Books'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
