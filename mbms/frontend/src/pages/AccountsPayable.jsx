import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Money } from '../components/Money';

const STATUS_BADGE = { draft: 'neutral', pending_approval: 'warning', approved: 'neutral', partially_paid: 'warning', paid: 'success', overdue: 'error', void: 'neutral' };

export function AccountsPayablePage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Finance Manager', 'Chief Financial Officer', 'Procurement Manager') || hasPermission('ap.manage');
  const canApprove = hasRole('Super Administrator', 'Managing Director', 'Chief Financial Officer') || hasPermission('ap.approve');

  const [invoices, setInvoices] = useState(null);
  const [aging, setAging] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [payTarget, setPayTarget] = useState(null);

  async function load() {
    setError(null);
    try {
      const [inv, ag] = await Promise.all([
        apiRequest('/ap/invoices'),
        apiRequest('/ap/aging').catch(() => null),
      ]);
      setInvoices(inv);
      setAging(ag);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load accounts payable data.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id, action) {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest(`/ap/invoices/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError(`Unable to ${action.replace(/-/g, ' ')}.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Accounts Payable</div>
          <h1>Accounts Payable</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Supplier Invoice
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      {aging && (
        <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 18 }}>
          <Kpi label="Current" value={<Money value={aging.buckets.current} />} />
          <Kpi label="1-30 Days" value={<Money value={aging.buckets.days_1_30} />} />
          <Kpi label="31-60 Days" value={<Money value={aging.buckets.days_31_60} />} />
          <Kpi label="61-90 Days" value={<Money value={aging.buckets.days_61_90} />} />
          <Kpi label="90+ Days" value={<Money value={aging.buckets.days_90_plus} />} tone="error" />
        </div>
      )}

      <div className="card">
        <div className="card-head">Supplier Invoices</div>
        {invoices === null ? (
          <div className="loading">Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="empty">No supplier invoices to show.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Due Date</th>
                <th className="num">Total</th>
                <th className="num">Paid</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="rowlink">{inv.invoiceNumber}</td>
                  <td>{inv.dueDate?.slice(0, 10)}</td>
                  <td className="num"><Money value={inv.totalAmount} /></td>
                  <td className="num"><Money value={inv.amountPaid} /></td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[inv.status] ?? 'neutral'}`}>
                      <span className="dot" />
                      {inv.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {canManage && inv.status === 'draft' && (
                        <button className="btn-ghost" disabled={busyId === inv.id} onClick={() => act(inv.id, 'submit-for-approval')}>
                          Submit
                        </button>
                      )}
                      {canApprove && inv.status === 'pending_approval' && (
                        <button className="btn-ghost" disabled={busyId === inv.id} onClick={() => act(inv.id, 'approve')}>
                          Approve
                        </button>
                      )}
                      {canManage && ['approved', 'partially_paid'].includes(inv.status) && (
                        <button className="btn-ghost" disabled={busyId === inv.id} onClick={() => setPayTarget(inv)}>
                          Record Payment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateSupplierInvoiceModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {payTarget && <RecordPaymentModal invoice={payTarget} onClose={() => setPayTarget(null)} onPaid={load} />}
    </Layout>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={tone === 'error' ? { color: '#B33A3A' } : undefined}>
        {value}
      </div>
    </div>
  );
}

function CreateSupplierInvoiceModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [apAccountId, setApAccountId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [financialPeriodId, setFinancialPeriodId] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [accounts, setAccounts] = useState(null);
  const [periods, setPeriods] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadOptions() {
    if (!companyId) return;
    try {
      const [acc, per] = await Promise.all([
        apiRequest('/accounting/accounts', { query: { companyId } }),
        apiRequest('/accounting/financial-periods', { query: { companyId } }),
      ]);
      setAccounts(acc);
      setPeriods(per.filter((p) => p.status === 'open'));
    } catch {
      setAccounts([]);
      setPeriods([]);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/ap/invoices', {
        method: 'POST',
        body: {
          companyId,
          supplierId,
          invoiceDate,
          dueDate,
          currency,
          apAccountId,
          expenseAccountId,
          financialPeriodId,
          items: [{ description, unitPrice: Number(unitPrice), quantity: 1 }],
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create supplier invoice.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>New Supplier Invoice</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                Company ID <span className="req">*</span>
              </label>
              <input className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} onBlur={loadOptions} placeholder="uuid" required />
            </div>
            <div className="field">
              <label>
                Supplier ID <span className="req">*</span>
              </label>
              <input className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="uuid" required />
            </div>
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                Invoice Date <span className="req">*</span>
              </label>
              <input className="input" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>
                Due Date <span className="req">*</span>
              </label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Currency</label>
              <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Description <span className="req">*</span>
            </label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Amount <span className="req">*</span>
            </label>
            <input className="input" type="number" min="0.01" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                AP Account <span className="req">*</span>
              </label>
              <select className="select" value={apAccountId} onChange={(e) => setApAccountId(e.target.value)} required>
                <option value="">{accounts === null ? 'Enter Company ID first' : 'Select…'}</option>
                {(accounts ?? []).filter((a) => a.accountSubType === 'payable').map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} — {a.accountName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>
                Expense Account <span className="req">*</span>
              </label>
              <select className="select" value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)} required>
                <option value="">{accounts === null ? 'Enter Company ID first' : 'Select…'}</option>
                {(accounts ?? []).filter((a) => a.accountType === 'expense').map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} — {a.accountName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Financial Period <span className="req">*</span>
            </label>
            <select className="select" value={financialPeriodId} onChange={(e) => setFinancialPeriodId(e.target.value)} required>
              <option value="">{periods === null ? 'Enter Company ID first' : 'Select an open period…'}</option>
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
              {saving ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecordPaymentModal({ invoice, onClose, onPaid }) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest('/accounting/accounts', { query: { companyId: invoice.companyId } })
      .then((acc) => setAccounts(acc.filter((a) => a.accountSubType === 'cash' || a.accountSubType === 'bank')))
      .catch(() => setAccounts([]));
  }, [invoice.companyId]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/ap/payments', {
        method: 'POST',
        body: {
          companyId: invoice.companyId,
          supplierId: invoice.supplierId,
          paymentDate,
          amount: Number(amount),
          currency: invoice.currency,
          bankAccountId,
          invoiceId: invoice.id,
        },
      });
      onPaid();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to record payment.');
    } finally {
      setSaving(false);
    }
  }

  const remaining = (Number(invoice.totalAmount) - Number(invoice.amountPaid)).toFixed(2);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Record Payment — {invoice.invoiceNumber}</h2>
        <p style={{ opacity: 0.75, fontSize: '0.9em', marginTop: -4 }}>Remaining balance: <Money value={remaining} /></p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                Amount <span className="req">*</span>
              </label>
              <input className="input" type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="field">
              <label>
                Payment Date <span className="req">*</span>
              </label>
              <input className="input" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Pay From <span className="req">*</span>
            </label>
            <select className="select" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required>
              <option value="">{accounts === null ? 'Loading…' : 'Select an account…'}</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
