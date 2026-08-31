import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Money } from '../components/Money';

export function CustomersPage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Sales Manager') || hasPermission('customer.manage');

  const [customers, setCustomers] = useState(null);
  const [selected, setSelected] = useState(null);
  const [statement, setStatement] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setError(null);
    try {
      const { items } = await apiRequestWithMeta('/customers', { pageSize: 100 });
      setCustomers(items);
      if (items.length > 0 && !selected) setSelected(items[0]);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load customers.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    apiRequest(`/customers/${selected.id}/statement`).then(setStatement).catch(() => setStatement(null));
  }, [selected]);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Customers</div>
          <h1>Customers</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Customer
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="grid-2">
        <div className="card">
          {customers === null ? (
            <div className="loading">Loading…</div>
          ) : customers.length === 0 ? (
            <div className="empty">No customers to show.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th className="num">Credit Limit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    style={selected?.id === c.id ? { background: '#EAF0FB' } : {}}
                  >
                    <td className="rowlink">{c.name}</td>
                    <td>{c.category || '—'}</td>
                    <td className="num">{c.creditLimit != null ? <Money value={c.creditLimit} /> : '—'}</td>
                    <td>
                      <span className={`badge ${c.status === 'active' ? 'success' : 'neutral'}`}>
                        <span className="dot" />
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          {selected ? (
            <CustomerDetailPanel
              key={selected.id}
              customer={selected}
              statement={statement}
              canManage={canManage}
              onChanged={load}
            />
          ) : (
            <div className="empty">Select a customer to view their statement.</div>
          )}
        </div>
      </div>

      {showCreate && <CreateCustomerModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </Layout>
  );
}

function CustomerDetailPanel({ customer, statement, canManage, onChanged }) {
  const [creditLimit, setCreditLimit] = useState(customer.creditLimit ?? '');
  const [paymentTermsDays, setPaymentTermsDays] = useState(customer.paymentTermsDays ?? '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiRequest(`/customers/${customer.id}`, {
        method: 'PATCH',
        body: {
          creditLimit: creditLimit === '' ? undefined : Number(creditLimit),
          paymentTermsDays: paymentTermsDays === '' ? undefined : Number(paymentTermsDays),
        },
      });
      setSaved(true);
      onChanged();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="card-head">{customer.name} — Statement</div>
      <div className="card-body">
        {error && <div className="banner error">{error}</div>}
        {saved && <div className="banner info">Saved.</div>}

        <div className="formsection">
          <div className="fs-title">Credit Terms</div>
          <div className="formgrid">
            <div className="field">
              <label>Credit Limit</label>
              <input
                className="input"
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                disabled={!canManage}
              />
            </div>
            <div className="field">
              <label>Payment Terms (days)</label>
              <input
                className="input"
                type="number"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)}
                disabled={!canManage}
              />
            </div>
          </div>
          {canManage && (
            <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>

        <div className="formsection">
          <div className="fs-title">Transaction History</div>
          {statement === null ? (
            <div className="loading">Loading…</div>
          ) : statement.transactions.length === 0 ? (
            <div className="hint">{statement.note}</div>
          ) : (
            <table>
              <tbody>
                {statement.transactions.map((t, i) => (
                  <tr key={i}>
                    <td>{t.date}</td>
                    <td>{t.ref}</td>
                    <td className="num"><Money value={t.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function CreateCustomerModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/customers', {
        method: 'POST',
        body: {
          companyId,
          name,
          category: category || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          address: address || undefined,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create customer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Customer</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Company ID <span className="req">*</span>
            </label>
            <input className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="uuid" required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Category</label>
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Wholesale" />
            </div>
            <div className="field">
              <label>Phone</label>
              <input className="input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Address</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
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
