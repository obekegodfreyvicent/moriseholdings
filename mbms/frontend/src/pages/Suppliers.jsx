import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

function statusClass(status) {
  if (status === 'active') return 'success';
  if (status === 'blacklisted') return 'error';
  if (status === 'suspended') return 'warning';
  return 'neutral';
}

export function SuppliersPage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Procurement Manager') || hasPermission('supplier.manage');

  const [suppliers, setSuppliers] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);
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
                  <td className="rowlink">
                    <button className="linkbtn" onClick={() => setDetailId(s.id)}>
                      {s.name}
                    </button>
                  </td>
                  <td>{s.category || '—'}</td>
                  <td className="mono">{s.taxId || '—'}</td>
                  <td>
                    <span className={`badge ${statusClass(s.status)}`}>
                      <span className="dot" />
                      {s.status}
                    </span>
                    {s.status === 'suspended' && s.suspendedUntil && (
                      <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                        until {String(s.suspendedUntil).slice(0, 10)}
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn-ghost" onClick={() => setDetailId(s.id)}>
                      Manage
                    </button>
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
      {detailId && (
        <SupplierDetailModal
          supplierId={detailId}
          canManage={canManage}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </Layout>
  );
}

function SupplierDetailModal({ supplierId, canManage, onClose, onChanged }) {
  const [tab, setTab] = useState('contacts');
  const [supplier, setSupplier] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [evaluations, setEvaluations] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [error, setError] = useState(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddEval, setShowAddEval] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    setError(null);
    try {
      const [s, c, e, p] = await Promise.all([
        apiRequest(`/suppliers/${supplierId}`),
        apiRequest(`/suppliers/${supplierId}/contacts`),
        apiRequest(`/suppliers/${supplierId}/evaluations`),
        apiRequest(`/suppliers/${supplierId}/performance`),
      ]);
      setSupplier(s);
      setContacts(c);
      setEvaluations(e);
      setPerformance(p);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load supplier.');
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  async function act(path, body) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(path, { method: 'POST', body });
      await loadAll();
      onChanged();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function removeContact(id) {
    if (!window.confirm('Remove this contact?')) return;
    setBusy(true);
    try {
      await apiRequest(`/suppliers/${supplierId}/contacts/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to remove contact.');
    } finally {
      setBusy(false);
    }
  }

  async function removeEval(id) {
    if (!window.confirm('Delete this evaluation?')) return;
    setBusy(true);
    try {
      await apiRequest(`/suppliers/${supplierId}/evaluations/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to delete evaluation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto', width: 720, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>{supplier?.name || 'Supplier'}</h2>
            {supplier && (
              <span className={`badge ${statusClass(supplier.status)}`}>
                <span className="dot" />
                {supplier.status}
              </span>
            )}
          </div>
          {canManage && supplier && supplier.status !== 'blacklisted' && (
            <div className="actions">
              {supplier.status === 'suspended' ? (
                <button className="btn btn-secondary" disabled={busy} onClick={() => act(`/suppliers/${supplierId}/unsuspend`)}>
                  Lift suspension
                </button>
              ) : (
                <button className="btn btn-secondary" disabled={busy} onClick={() => setShowSuspend(true)}>
                  Suspend
                </button>
              )}
            </div>
          )}
        </div>

        {supplier?.status === 'suspended' && (
          <div className="banner warning" style={{ marginTop: 12 }}>
            Suspended{supplier.suspendedUntil ? ` until ${String(supplier.suspendedUntil).slice(0, 10)}` : ''}
            {supplier.suspensionReason ? ` — ${supplier.suspensionReason}` : ''}
          </div>
        )}
        {error && <div className="banner error" style={{ marginTop: 12 }}>{error}</div>}

        <div className="tabs" style={{ marginTop: 16 }}>
          <button className={`tab ${tab === 'contacts' ? 'active' : ''}`} onClick={() => setTab('contacts')}>
            Contacts {contacts ? `(${contacts.length})` : ''}
          </button>
          <button className={`tab ${tab === 'evaluations' ? 'active' : ''}`} onClick={() => setTab('evaluations')}>
            Evaluations {evaluations ? `(${evaluations.length})` : ''}
          </button>
          <button className={`tab ${tab === 'performance' ? 'active' : ''}`} onClick={() => setTab('performance')}>
            Performance
          </button>
        </div>

        {tab === 'contacts' && (
          <div style={{ marginTop: 16 }}>
            {canManage && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddContact(true)} style={{ marginBottom: 12 }}>
                + Add contact
              </button>
            )}
            {contacts === null ? (
              <div className="loading">Loading…</div>
            ) : contacts.length === 0 ? (
              <div className="empty">No contacts recorded.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Title</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.name} {c.isPrimary && <span className="badge success" style={{ marginLeft: 6 }}>primary</span>}
                        {c.note && <div className="muted" style={{ fontSize: 12 }}>{c.note}</div>}
                      </td>
                      <td>{c.title || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td>{c.phone || '—'}</td>
                      <td>
                        {canManage && (
                          <button className="btn-ghost" disabled={busy} onClick={() => removeContact(c.id)}>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'evaluations' && (
          <div style={{ marginTop: 16 }}>
            {canManage && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddEval(true)} style={{ marginBottom: 12 }}>
                + New evaluation
              </button>
            )}
            {evaluations === null ? (
              <div className="loading">Loading…</div>
            ) : evaluations.length === 0 ? (
              <div className="empty">No evaluations recorded.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Delivery</th>
                    <th>Quality</th>
                    <th>Price</th>
                    <th>Comms</th>
                    <th>Compliance</th>
                    <th>Overall</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {e.periodLabel}
                        {e.comments && <div className="muted" style={{ fontSize: 12 }}>{e.comments}</div>}
                      </td>
                      <td>{e.deliveryScore}</td>
                      <td>{e.qualityScore}</td>
                      <td>{e.priceScore}</td>
                      <td>{e.communicationScore}</td>
                      <td>{e.complianceScore}</td>
                      <td>
                        <strong>{Number(e.overallScore).toFixed(2)}</strong>
                      </td>
                      <td>
                        {canManage && (
                          <button className="btn-ghost" disabled={busy} onClick={() => removeEval(e.id)}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'performance' && (
          <div style={{ marginTop: 16 }}>
            {performance === null ? (
              <div className="loading">Loading…</div>
            ) : (
              <div className="formgrid">
                <div className="field">
                  <label>Overall rating</label>
                  <div>
                    <strong style={{ fontSize: 20 }}>
                      {performance.evaluation.overallAverage ?? '—'}
                    </strong>{' '}
                    {performance.evaluation.ratingBand && (
                      <span className="badge neutral">{performance.evaluation.ratingBand}</span>
                    )}{' '}
                    {performance.evaluation.trend && (
                      <span className="muted">
                        {performance.evaluation.trend === 'up' ? '▲ improving' : performance.evaluation.trend === 'down' ? '▼ declining' : '▬ flat'}
                      </span>
                    )}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {performance.evaluation.count} evaluation(s)
                      {performance.evaluation.latest ? `, latest ${performance.evaluation.latest.periodLabel}` : ''}
                    </div>
                  </div>
                </div>
                <div className="field">
                  <label>Criterion averages</label>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {Object.entries(performance.evaluation.criteriaAverages).map(([k, v]) => (
                      <div key={k}>
                        {k}: <strong>{v ?? '—'}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>Accounts payable</label>
                  <div className="muted" style={{ fontSize: 13 }}>
                    <div>Invoices: {performance.accountsPayable.invoices} ({performance.accountsPayable.paidInvoices} paid, {performance.accountsPayable.overdueInvoices} overdue)</div>
                    <div>Invoiced: {performance.accountsPayable.totalInvoiced.toLocaleString()}</div>
                    <div>Paid: {performance.accountsPayable.totalPaid.toLocaleString()}</div>
                    <div>Outstanding: <strong>{performance.accountsPayable.outstanding.toLocaleString()}</strong></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {showAddContact && (
        <AddContactModal
          supplierId={supplierId}
          onClose={() => setShowAddContact(false)}
          onSaved={() => {
            setShowAddContact(false);
            loadAll();
          }}
        />
      )}
      {showAddEval && (
        <AddEvaluationModal
          supplierId={supplierId}
          onClose={() => setShowAddEval(false)}
          onSaved={() => {
            setShowAddEval(false);
            loadAll();
            onChanged();
          }}
        />
      )}
      {showSuspend && (
        <SuspendModal
          onClose={() => setShowSuspend(false)}
          onConfirm={async (reason, until) => {
            setShowSuspend(false);
            await act(`/suppliers/${supplierId}/suspend`, { reason, until: until || undefined });
          }}
        />
      )}
    </div>
  );
}

function AddContactModal({ supplierId, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', title: '', email: '', phone: '', note: '', isPrimary: false });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/suppliers/${supplierId}/contacts`, {
        method: 'POST',
        body: {
          name: form.name,
          title: form.title || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          note: form.note || undefined,
          isPrimary: form.isPrimary,
        },
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to add contact.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add contact</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Name *</label>
            <input className="input" value={form.name} onChange={set('name')} required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Title</label>
              <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Accounts" />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input className="input" value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Note</label>
            <input className="input" value={form.note} onChange={set('note')} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={form.isPrimary} onChange={set('isPrimary')} />
            Primary contact
          </label>
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

const CRITERIA = [
  ['deliveryScore', 'On-time delivery'],
  ['qualityScore', 'Goods / service quality'],
  ['priceScore', 'Price competitiveness'],
  ['communicationScore', 'Communication / responsiveness'],
  ['complianceScore', 'Documentation / terms compliance'],
];

function AddEvaluationModal({ supplierId, onClose, onSaved }) {
  const [periodLabel, setPeriodLabel] = useState('');
  const [scores, setScores] = useState({
    deliveryScore: 3,
    qualityScore: 3,
    priceScore: 3,
    communicationScore: 3,
    complianceScore: 3,
  });
  const [comments, setComments] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const overall = (Object.values(scores).reduce((a, b) => a + Number(b), 0) / 5).toFixed(2);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/suppliers/${supplierId}/evaluations`, {
        method: 'POST',
        body: {
          periodLabel,
          ...Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Number(v)])),
          comments: comments || undefined,
        },
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to save evaluation.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>New evaluation</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Period label *</label>
            <input className="input" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="e.g. Q3 2026" required />
          </div>
          {CRITERIA.map(([key, label]) => (
            <div className="field" style={{ marginBottom: 10 }} key={key}>
              <label>
                {label}: <strong>{scores[key]}</strong>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={scores[key]}
                onChange={(e) => setScores({ ...scores, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Overall (auto)</label>
            <div>
              <strong style={{ fontSize: 18 }}>{overall}</strong> / 5
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Comments</label>
            <textarea className="input" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
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

function SuspendModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Suspend supplier</h2>
        <p className="muted">
          A time-bound hold — the supplier is skipped for new purchase orders until lifted. Distinct from an
          indefinite blacklist.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSaving(true);
            onConfirm(reason, until);
          }}
        >
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Reason *</label>
            <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Auto-lift date (optional)</label>
            <input className="input" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !reason}>
              {saving ? 'Working…' : 'Suspend'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
