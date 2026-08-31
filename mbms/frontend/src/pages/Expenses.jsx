import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Money } from '../components/Money';

const STATUS_BADGE = {
  submitted: 'neutral',
  manager_approved: 'neutral',
  finance_approved: 'neutral',
  paid: 'success',
  rejected: 'error',
};

const STATUS_LABEL = {
  submitted: 'Submitted — awaiting manager',
  manager_approved: 'Manager approved — awaiting finance',
  finance_approved: 'Finance approved — awaiting payment',
  paid: 'Paid & posted',
  rejected: 'Rejected',
};

export function ExpensesPage() {
  const { user, hasRole, hasPermission } = useAuth();
  // Sprint 9 permission model (see mbms/README.md, "Sprint 9"): every seeded
  // role except Auditor holds expense.create; Branch Manager/HR Manager/
  // Sales Manager/Procurement Manager hold expense.approve.manager; Finance
  // Manager holds expense.approve.finance (which also gates pay/post). The
  // frontend approximates the server-enforced permission with a role check,
  // same convention every other page here already uses.
  const canCreate = !hasRole('Auditor');
  const canApproveManager = hasRole('Super Administrator', 'Branch Manager', 'Human Resources Manager', 'Sales Manager', 'Procurement Manager') || hasPermission('expense.approve.manager');
  const canApproveFinance = hasRole('Super Administrator', 'Finance Manager') || hasPermission('expense.approve.finance');

  const [expenses, setExpenses] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);

  async function load() {
    setError(null);
    try {
      const { items } = await apiRequestWithMeta('/expenses', { pageSize: 100 });
      setExpenses(items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load expense claims.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(expense) {
    setBusyId(expense.id);
    setError(null);
    try {
      await apiRequest(`/expenses/${expense.id}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to approve this claim.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Expenses</div>
          <h1>Expense Claims</h1>
        </div>
        {canCreate && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Expense Claim
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
        {expenses === null ? (
          <div className="loading">Loading…</div>
        ) : expenses.length === 0 ? (
          <div className="empty">No expense claims to show.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Expense Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const mine = e.submittedBy === user?.id;
                const canActManager = canApproveManager && e.status === 'submitted';
                const canActFinance = canApproveFinance && e.status === 'manager_approved';
                const canPay = canApproveFinance && e.status === 'finance_approved';
                return (
                  <tr key={e.id}>
                    <td className="rowlink">{e.category || '—'}</td>
                    <td>{e.description || '—'}</td>
                    <td>
                      <Money value={e.amount} currency={e.currency} />
                    </td>
                    <td>{e.expenseDate?.slice(0, 10)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[e.status] ?? 'neutral'}`}>
                        <span className="dot" />
                        {STATUS_LABEL[e.status] ?? e.status}
                      </span>
                      {mine && <span style={{ marginLeft: 6, opacity: 0.6, fontSize: '0.85em' }}>(yours)</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(canActManager || canActFinance) && (
                          <>
                            <button className="btn-ghost" disabled={busyId === e.id} onClick={() => approve(e)}>
                              {busyId === e.id ? 'Working…' : 'Approve'}
                            </button>
                            <button className="btn-ghost" disabled={busyId === e.id} onClick={() => setRejectTarget(e)}>
                              Reject
                            </button>
                          </>
                        )}
                        {canPay && (
                          <button className="btn-ghost" disabled={busyId === e.id} onClick={() => setPayTarget(e)}>
                            Pay &amp; Post
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateExpenseModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {rejectTarget && (
        <RejectExpenseModal expense={rejectTarget} onClose={() => setRejectTarget(null)} onRejected={load} />
      )}
      {payTarget && <PayExpenseModal expense={payTarget} onClose={() => setPayTarget(null)} onPaid={load} />}
    </Layout>
  );
}

// ---------------------------------------------------------------- Create
function CreateExpenseModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [expenseDate, setExpenseDate] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadAccounts() {
    if (!companyId) return;
    setAccounts(null);
    try {
      const data = await apiRequest('/accounting/accounts', { query: { companyId } });
      setAccounts(data.filter((a) => a.accountType === 'expense'));
    } catch {
      setAccounts([]);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/expenses', {
        method: 'POST',
        body: {
          companyId,
          branchId: branchId || undefined,
          departmentId: departmentId || undefined,
          category: category || undefined,
          description: description || undefined,
          amount: Number(amount),
          currency,
          expenseDate,
          receiptReference: receiptReference || undefined,
          expenseAccountId,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to submit expense claim.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>New Expense Claim</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Company ID <span className="req">*</span>
            </label>
            <input
              className="input"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              onBlur={loadAccounts}
              placeholder="uuid"
              required
            />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Branch ID</label>
              <input className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="uuid (optional)" />
            </div>
            <div className="field">
              <label>Department ID</label>
              <input className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} placeholder="uuid (optional)" />
            </div>
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Category</label>
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Travel" />
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
                Expense Date <span className="req">*</span>
              </label>
              <input className="input" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Receipt Reference</label>
            <input
              className="input"
              value={receiptReference}
              onChange={(e) => setReceiptReference(e.target.value)}
              placeholder="e.g. RCPT-2026-0141 — receipt upload is not built in this slice"
            />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Expense Account <span className="req">*</span>
            </label>
            <select className="select" value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)} required>
              <option value="">
                {accounts === null ? 'Enter a Company ID above, then leave the field to load accounts' : 'Select an account…'}
              </option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName}
                </option>
              ))}
            </select>
            {accounts !== null && accounts.length === 0 && (
              <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: 4 }}>
                No expense-type accounts found for that company. Create one on the Accounting screen first.
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Claim'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Reject
function RejectExpenseModal({ expense, onClose, onRejected }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/expenses/${expense.id}/reject`, { method: 'POST', body: { reason: reason || undefined } });
      onRejected();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to reject this claim.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Reject Expense Claim</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Reason</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional — shown to the claimant" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Rejecting…' : 'Reject Claim'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Pay
function PayExpenseModal({ expense, onClose, onPaid }) {
  const [accounts, setAccounts] = useState(null);
  const [periods, setPeriods] = useState(null);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [financialPeriodId, setFinancialPeriodId] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [acc, per] = await Promise.all([
          apiRequest('/accounting/accounts', { query: { companyId: expense.companyId } }),
          apiRequest('/accounting/financial-periods', { query: { companyId: expense.companyId } }),
        ]);
        setAccounts(acc.filter((a) => a.accountType === 'asset'));
        setPeriods(per.filter((p) => p.status === 'open'));
      } catch (err) {
        if (err instanceof ApiRequestError) setError(err.apiError.message);
        else setError('Unable to load accounts/periods for this company.');
      }
    }
    loadOptions();
  }, [expense.companyId]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/expenses/${expense.id}/pay`, { method: 'POST', body: { paymentAccountId, financialPeriodId } });
      onPaid();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to pay this claim.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Pay &amp; Post to Accounting</h2>
        <p style={{ opacity: 0.75, fontSize: '0.9em', marginTop: -4 }}>
          Posts a balanced journal entry: debit the expense account, credit the payment account you choose below, for{' '}
          <Money value={expense.amount} currency={expense.currency} />.
        </p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Payment Account <span className="req">*</span>
            </label>
            <select className="select" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} required>
              <option value="">{accounts === null ? 'Loading…' : 'Select an account…'}</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Financial Period <span className="req">*</span>
            </label>
            <select className="select" value={financialPeriodId} onChange={(e) => setFinancialPeriodId(e.target.value)} required>
              <option value="">{periods === null ? 'Loading…' : 'Select an open period…'}</option>
              {(periods ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.periodName}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Posting…' : 'Pay & Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
