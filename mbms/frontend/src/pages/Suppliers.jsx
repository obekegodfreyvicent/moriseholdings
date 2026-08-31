import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function SuppliersPage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Procurement Manager') || hasPermission('supplier.manage');

  const [suppliers, setSuppliers] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError(null);
    try {
      const { items } = await apiRequestWithMeta('/suppliers', { pageSize: 100 });
      setSuppliers(items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load suppliers.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBlacklist(supplier) {
    setBusyId(supplier.id);
    setError(null);
    try {
      const action = supplier.status === 'blacklisted' ? 'unblacklist' : 'blacklist';
      await apiRequest(`/suppliers/${supplier.id}/${action}`, { method: 'POST' });
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to update supplier status.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Suppliers</div>
          <h1>Suppliers</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Supplier
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
        {suppliers === null ? (
          <div className="loading">Loading…</div>
        ) : suppliers.length === 0 ? (
          <div className="empty">No suppliers to show.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Tax ID</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="rowlink">{s.name}</td>
                  <td>{s.category || '—'}</td>
                  <td className="mono">{s.taxId || '—'}</td>
                  <td>
                    <span
                      className={`badge ${
                        s.status === 'active' ? 'success' : s.status === 'blacklisted' ? 'error' : 'neutral'
                      }`}
                    >
                      <span className="dot" />
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {canManage && (
                      <button className="btn-ghost" disabled={busyId === s.id} onClick={() => toggleBlacklist(s)}>
                        {busyId === s.id
                          ? 'Working…'
                          : s.status === 'blacklisted'
                            ? 'Unblacklist'
                            : 'Blacklist'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateSupplierModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </Layout>
  );
}

function CreateSupplierModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contractReference, setContractReference] = useState('');
  const [contractExpiryDate, setContractExpiryDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/suppliers', {
        method: 'POST',
        body: {
          companyId,
          name,
          category: category || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          address: address || undefined,
          taxId: taxId || undefined,
          contractReference: contractReference || undefined,
          contractExpiryDate: contractExpiryDate || undefined,
          bankName: bankName || undefined,
          bankAccountNumber: bankAccountNumber || undefined,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create supplier.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>New Supplier</h2>
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
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Raw Materials" />
            </div>
            <div className="field">
              <label>Tax ID</label>
              <input className="input" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div className="field">
              <label>Contact Email</label>
              <input className="input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Contact Phone</label>
              <input className="input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Address</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="fs-title">Contract (FR-SUPP-02)</div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Contract Reference</label>
              <input className="input" value={contractReference} onChange={(e) => setContractReference(e.target.value)} />
            </div>
            <div className="field">
              <label>Contract Expiry Date</label>
              <input className="input" type="date" value={contractExpiryDate} onChange={(e) => setContractExpiryDate(e.target.value)} />
            </div>
          </div>

          <div className="fs-title">Bank Details (masked on read unless you hold supplier.view.sensitive)</div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Bank Name</label>
              <input className="input" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="field">
              <label>Bank Account Number</label>
              <input className="input" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
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
