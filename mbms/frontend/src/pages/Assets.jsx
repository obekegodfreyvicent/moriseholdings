import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Money } from '../components/Money';
import { AssetCategoriesModal, AssetDetailModal } from './AssetExtras';

const STATUS_BADGE = {
  active: 'success',
  disposal_requested: 'neutral',
  disposal_approved: 'neutral',
  disposed: 'error',
};

const STATUS_LABEL = {
  active: 'Active',
  disposal_requested: 'Disposal requested — awaiting management approval',
  disposal_approved: 'Disposal approved — awaiting disposal',
  disposed: 'Disposed',
};

export function AssetsPage() {
  const { hasRole, hasPermission } = useAuth();
  // Sprint 11 permission model (see mbms/README.md, "Sprint 11"):
  // asset.manage — Super Administrator, Finance Manager, Procurement
  // Manager. asset.approve.disposal — Super Administrator, Finance
  // Manager, Managing Director (05_Business Process Document, Section
  // 6.5's disposal workflow names its second step "Management Approval").
  const canManage = hasRole('Super Administrator', 'Finance Manager', 'Procurement Manager') || hasPermission('asset.manage');
  const canApproveDisposal = hasRole('Super Administrator', 'Finance Manager', 'Managing Director') || hasPermission('asset.approve.disposal');

  const [assets, setAssets] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [detailAsset, setDetailAsset] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [depreciationTarget, setDepreciationTarget] = useState(null);
  const [requestDisposalTarget, setRequestDisposalTarget] = useState(null);
  const [approveDisposalTarget, setApproveDisposalTarget] = useState(null);
  const [disposeTarget, setDisposeTarget] = useState(null);
  const [maintenanceTarget, setMaintenanceTarget] = useState(null);

  async function load() {
    setError(null);
    try {
      const { items } = await apiRequestWithMeta('/assets', { pageSize: 100 });
      setAssets(items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load assets.');
    }
  }

  useEffect(() => {
    load();
    apiRequestWithMeta('/organization/companies', { pageSize: 100 })
      .then(({ items }) => setCompanies(items))
      .catch(() => setCompanies([]));
  }, []);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Assets</div>
          <h1>Assets</h1>
        </div>
        {canManage && (
          <div className="actions" style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowCategories(true)}>
              Categories
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Register Asset
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
        {assets === null ? (
          <div className="loading">Loading…</div>
        ) : assets.length === 0 ? (
          <div className="empty">No assets registered yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Asset #</th>
                <th>Name</th>
                <th>Category</th>
                <th className="num">Net Book Value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.assetNumber}</td>
                  <td className="rowlink">
                    <button className="linkbtn" onClick={() => setDetailAsset(a)}>{a.name}</button>
                  </td>
                  <td>{a.categoryName || a.category || '—'}</td>
                  <td className="num"><Money value={a.netBookValue} /></td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[a.status] ?? 'neutral'}`}>
                      <span className="dot" />
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-ghost" onClick={() => setDetailAsset(a)}>
                        Detail
                      </button>
                      <button className="btn-ghost" onClick={() => setMaintenanceTarget(a)}>
                        Maintenance
                      </button>
                      {canManage && a.status === 'active' && (
                        <>
                          <button className="btn-ghost" onClick={() => setTransferTarget(a)}>
                            Transfer
                          </button>
                          <button className="btn-ghost" onClick={() => setDepreciationTarget(a)}>
                            Record Depreciation
                          </button>
                          <button className="btn-ghost" onClick={() => setRequestDisposalTarget(a)}>
                            Request Disposal
                          </button>
                        </>
                      )}
                      {canApproveDisposal && a.status === 'disposal_requested' && (
                        <button className="btn-ghost" onClick={() => setApproveDisposalTarget(a)}>
                          Approve Disposal
                        </button>
                      )}
                      {canApproveDisposal && a.status === 'disposal_approved' && (
                        <button className="btn-ghost" onClick={() => setDisposeTarget(a)}>
                          Dispose
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

      {showCreate && <CreateAssetModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {showCategories && <AssetCategoriesModal companies={companies} onClose={() => setShowCategories(false)} />}
      {detailAsset && (
        <AssetDetailModal
          asset={detailAsset}
          canManage={canManage}
          onClose={() => setDetailAsset(null)}
          onChanged={load}
        />
      )}
      {transferTarget && (
        <TransferAssetModal asset={transferTarget} onClose={() => setTransferTarget(null)} onDone={load} />
      )}
      {depreciationTarget && (
        <RecordDepreciationModal asset={depreciationTarget} onClose={() => setDepreciationTarget(null)} onDone={load} />
      )}
      {requestDisposalTarget && (
        <RequestDisposalModal asset={requestDisposalTarget} onClose={() => setRequestDisposalTarget(null)} onDone={load} />
      )}
      {approveDisposalTarget && (
        <ApproveDisposalModal asset={approveDisposalTarget} onClose={() => setApproveDisposalTarget(null)} onDone={load} />
      )}
      {disposeTarget && <DisposeAssetModal asset={disposeTarget} onClose={() => setDisposeTarget(null)} onDone={load} />}
      {maintenanceTarget && (
        <MaintenanceModal asset={maintenanceTarget} canManage={canManage} onClose={() => setMaintenanceTarget(null)} />
      )}
    </Layout>
  );
}

// ---------------------------------------------------------------- Create
function CreateAssetModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [assetNumber, setAssetNumber] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseReference, setPurchaseReference] = useState('');
  const [warrantyExpiryDate, setWarrantyExpiryDate] = useState('');
  const [description, setDescription] = useState('');
  const [custodianEmployeeId, setCustodianEmployeeId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [depreciationMethod, setDepreciationMethod] = useState('none');
  const [usefulLifeYears, setUsefulLifeYears] = useState('');
  const [salvageValue, setSalvageValue] = useState('');
  const [assetAccountId, setAssetAccountId] = useState('');
  const [depreciationExpenseAccountId, setDepreciationExpenseAccountId] = useState('');
  const [accumulatedDepreciationAccountId, setAccumulatedDepreciationAccountId] = useState('');
  const [insurer, setInsurer] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');
  const [documentReference, setDocumentReference] = useState('');
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadAccounts() {
    if (!companyId) return;
    try {
      const data = await apiRequest('/accounting/accounts', { query: { companyId } });
      setAccounts(data);
    } catch {
      setAccounts([]);
    }
    try {
      setCategories(await apiRequest('/assets/categories', { query: { companyId } }));
    } catch {
      setCategories([]);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/assets', {
        method: 'POST',
        body: {
          companyId,
          branchId: branchId || undefined,
          departmentId: departmentId || undefined,
          assetNumber: assetNumber || undefined,
          name,
          category: category || undefined,
          categoryId: categoryId || undefined,
          supplierId: supplierId || undefined,
          purchaseReference: purchaseReference || undefined,
          warrantyExpiryDate: warrantyExpiryDate || undefined,
          description: description || undefined,
          custodianEmployeeId: custodianEmployeeId || undefined,
          purchaseDate,
          purchaseCost: Number(purchaseCost),
          depreciationMethod,
          usefulLifeYears: usefulLifeYears ? Number(usefulLifeYears) : undefined,
          salvageValue: salvageValue ? Number(salvageValue) : undefined,
          assetAccountId: assetAccountId || undefined,
          depreciationExpenseAccountId: depreciationExpenseAccountId || undefined,
          accumulatedDepreciationAccountId: accumulatedDepreciationAccountId || undefined,
          insurer: insurer || undefined,
          insurancePolicyNumber: insurancePolicyNumber || undefined,
          insuranceExpiryDate: insuranceExpiryDate || undefined,
          documentReference: documentReference || undefined,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to register asset.');
    } finally {
      setSaving(false);
    }
  }

  const assetAccounts = (accounts ?? []).filter((a) => a.accountType === 'asset');
  const expenseAccounts = (accounts ?? []).filter((a) => a.accountType === 'expense');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>Register Asset</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Company ID <span className="req">*</span>
            </label>
            <input className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} onBlur={loadAccounts} placeholder="uuid" required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Asset Number</label>
              <input className="input" value={assetNumber} onChange={(e) => setAssetNumber(e.target.value)} placeholder="auto (AST-YYYY-NNNN)" />
            </div>
            <div className="field">
              <label>
                Name <span className="req">*</span>
              </label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Category</label>
              <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— none / free-text below —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Category (free text, if no category above)</label>
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Vehicle" />
            </div>
            <div className="field">
              <label>Supplier ID</label>
              <input className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="uuid (optional)" />
            </div>
            <div className="field">
              <label>Purchase reference (PO / invoice)</label>
              <input className="input" value={purchaseReference} onChange={(e) => setPurchaseReference(e.target.value)} placeholder="optional" />
            </div>
            <div className="field">
              <label>Warranty expiry</label>
              <input className="input" type="date" value={warrantyExpiryDate} onChange={(e) => setWarrantyExpiryDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Custodian Employee ID</label>
              <input className="input" value={custodianEmployeeId} onChange={(e) => setCustodianEmployeeId(e.target.value)} placeholder="uuid (optional)" />
            </div>
            <div className="field">
              <label>Branch ID (location)</label>
              <input className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="uuid (optional)" />
            </div>
            <div className="field">
              <label>Department ID</label>
              <input className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} placeholder="uuid (optional)" />
            </div>
            <div className="field">
              <label>
                Purchase Date <span className="req">*</span>
              </label>
              <input className="input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>
                Purchase Cost <span className="req">*</span>
              </label>
              <input className="input" type="number" min="0.01" step="0.01" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="fs-title">Depreciation (FR-ACC-07-adjacent — optional)</div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Method</label>
              <select className="select" value={depreciationMethod} onChange={(e) => setDepreciationMethod(e.target.value)}>
                <option value="none">None</option>
                <option value="straight_line">Straight-line</option>
              </select>
            </div>
            <div className="field">
              <label>Useful Life (years)</label>
              <input className="input" type="number" min="1" value={usefulLifeYears} onChange={(e) => setUsefulLifeYears(e.target.value)} />
            </div>
            <div className="field">
              <label>Salvage Value</label>
              <input className="input" type="number" min="0" step="0.01" value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)} />
            </div>
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Fixed Assets Account</label>
              <select className="select" value={assetAccountId} onChange={(e) => setAssetAccountId(e.target.value)}>
                <option value="">
                  {accounts === null ? 'Enter Company ID above first' : 'None'}
                </option>
                {assetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} — {a.accountName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Depreciation Expense Account</label>
              <select className="select" value={depreciationExpenseAccountId} onChange={(e) => setDepreciationExpenseAccountId(e.target.value)}>
                <option value="">None</option>
                {expenseAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} — {a.accountName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Accumulated Depreciation Account</label>
              <select className="select" value={accumulatedDepreciationAccountId} onChange={(e) => setAccumulatedDepreciationAccountId(e.target.value)}>
                <option value="">None</option>
                {assetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} — {a.accountName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="fs-title">Insurance &amp; Documents (optional)</div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Insurer</label>
              <input className="input" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
            </div>
            <div className="field">
              <label>Policy Number</label>
              <input className="input" value={insurancePolicyNumber} onChange={(e) => setInsurancePolicyNumber(e.target.value)} />
            </div>
            <div className="field">
              <label>Insurance Expiry</label>
              <input className="input" type="date" value={insuranceExpiryDate} onChange={(e) => setInsuranceExpiryDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Document Reference</label>
              <input
                className="input"
                value={documentReference}
                onChange={(e) => setDocumentReference(e.target.value)}
                placeholder="e.g. logbook ref — file upload not built in this slice"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Transfer
function TransferAssetModal({ asset, onClose, onDone }) {
  const [branchId, setBranchId] = useState(asset.branchId || '');
  const [custodianEmployeeId, setCustodianEmployeeId] = useState(asset.custodianEmployeeId || '');
  const [toCompanyId, setToCompanyId] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/assets/${asset.id}/transfer`, {
        method: 'POST',
        body: { branchId: branchId || undefined, custodianEmployeeId: custodianEmployeeId || undefined, toCompanyId: toCompanyId || undefined },
      });
      onDone();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to transfer this asset.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Transfer — {asset.name}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>New Branch ID (location)</label>
            <input className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="uuid" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>New Custodian Employee ID</label>
            <input className="input" value={custodianEmployeeId} onChange={(e) => setCustodianEmployeeId(e.target.value)} placeholder="uuid" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Transfer to a Different Company (optional)</label>
            <input
              className="input"
              value={toCompanyId}
              onChange={(e) => setToCompanyId(e.target.value)}
              placeholder="uuid — leave blank to stay in the same company"
            />
            {toCompanyId && (
              <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: 4 }}>
                Moving this asset out of its current company clears its GL account links (Fixed Assets/
                Depreciation Expense/Accumulated Depreciation) — they belong to the old company's chart of
                accounts and won't carry over.
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Transferring…' : 'Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Record Depreciation
function RecordDepreciationModal({ asset, onClose, onDone }) {
  const [periods, setPeriods] = useState([]);
  const [financialPeriodId, setFinancialPeriodId] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest('/accounting/financial-periods', { query: { companyId: asset.companyId } }).then((data) => {
      setPeriods(data.filter((p) => p.status === 'open'));
    });
  }, [asset.companyId]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/assets/${asset.id}/record-depreciation`, {
        method: 'POST',
        body: { financialPeriodId, entryDate, amount: Number(amount) },
      });
      onDone();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to record depreciation.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Record Depreciation — {asset.name}</h2>
        <p style={{ opacity: 0.75, fontSize: '0.9em', marginTop: -4 }}>
          Current net book value: <Money value={asset.netBookValue} />. Posts debit Depreciation Expense / credit Accumulated
          Depreciation for the amount below.
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
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                Entry Date <span className="req">*</span>
              </label>
              <input className="input" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>
                Amount <span className="req">*</span>
              </label>
              <input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Posting…' : 'Record Depreciation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Request Disposal
function RequestDisposalModal({ asset, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/assets/${asset.id}/request-disposal`, { method: 'POST', body: { reason: reason || undefined } });
      onDone();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to request disposal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Request Disposal — {asset.name}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Reason</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Beyond economical repair" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Request Disposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Approve Disposal
function ApproveDisposalModal({ asset, onClose, onDone }) {
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/assets/${asset.id}/approve-disposal`, { method: 'POST', body: { inspectionNotes: inspectionNotes || undefined } });
      onDone();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to approve disposal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Approve Disposal — {asset.name}</h2>
        {asset.disposalRequestReason && (
          <p style={{ opacity: 0.75, fontSize: '0.9em', marginTop: -4 }}>Requested reason: {asset.disposalRequestReason}</p>
        )}
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Inspection Notes</label>
            <input className="input" value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Approving…' : 'Approve Disposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Dispose
function DisposeAssetModal({ asset, onClose, onDone }) {
  const [accounts, setAccounts] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [disposalMethod, setDisposalMethod] = useState('sale');
  const [disposalProceeds, setDisposalProceeds] = useState('0');
  const [proceedsAccountId, setProceedsAccountId] = useState('');
  const [gainLossAccountId, setGainLossAccountId] = useState('');
  const [financialPeriodId, setFinancialPeriodId] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest('/accounting/accounts', { query: { companyId: asset.companyId } }),
      apiRequest('/accounting/financial-periods', { query: { companyId: asset.companyId } }),
    ]).then(([acc, per]) => {
      setAccounts(acc);
      setPeriods(per.filter((p) => p.status === 'open'));
    });
  }, [asset.companyId]);

  const gainLoss = (Number(disposalProceeds || 0) - Number(asset.netBookValue)).toFixed(2);
  const isGain = Number(gainLoss) >= 0;

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/assets/${asset.id}/dispose`, {
        method: 'POST',
        body: {
          disposalMethod,
          disposalProceeds: Number(disposalProceeds || 0),
          proceedsAccountId,
          gainLossAccountId,
          financialPeriodId,
          entryDate,
        },
      });
      onDone();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to dispose of this asset.');
    } finally {
      setSaving(false);
    }
  }

  const assetAccounts = (accounts ?? []).filter((a) => a.accountType === 'asset');
  const gainLossCandidates = (accounts ?? []).filter((a) => a.accountType === 'revenue' || a.accountType === 'expense');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Dispose — {asset.name}</h2>
        <p style={{ opacity: 0.75, fontSize: '0.9em', marginTop: -4 }}>
          Net book value: <Money value={asset.netBookValue} />. This is a{' '}
          <strong>{isGain ? 'gain' : 'loss'}</strong> of {Math.abs(Number(gainLoss)).toFixed(2)} — pick a revenue
          account below if this is a gain, or an expense account if this is a loss.
        </p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Disposal Method</label>
              <select className="select" value={disposalMethod} onChange={(e) => setDisposalMethod(e.target.value)}>
                <option value="sale">Sale</option>
                <option value="write_off">Write-off</option>
              </select>
            </div>
            <div className="field">
              <label>Disposal Proceeds</label>
              <input className="input" type="number" min="0" step="0.01" value={disposalProceeds} onChange={(e) => setDisposalProceeds(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Proceeds Account (asset) <span className="req">*</span>
            </label>
            <select className="select" value={proceedsAccountId} onChange={(e) => setProceedsAccountId(e.target.value)} required>
              <option value="">{accounts === null ? 'Loading…' : 'Select…'}</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Gain/Loss Account <span className="req">*</span>
            </label>
            <select className="select" value={gainLossAccountId} onChange={(e) => setGainLossAccountId(e.target.value)} required>
              <option value="">{accounts === null ? 'Loading…' : 'Select…'}</option>
              {gainLossCandidates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName} ({a.accountType})
                </option>
              ))}
            </select>
          </div>
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
              {saving ? 'Disposing…' : 'Dispose & Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Maintenance
function MaintenanceModal({ asset, canManage, onClose }) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    try {
      const data = await apiRequest(`/assets/${asset.id}/maintenance-records`);
      setRecords(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load maintenance records.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>Maintenance — {asset.name}</h2>
        {error && <div className="banner error">{error}</div>}
        {records === null ? (
          <div className="loading">Loading…</div>
        ) : records.length === 0 ? (
          <div className="empty">No maintenance records yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.maintenanceDate?.slice(0, 10)}</td>
                  <td>{r.description}</td>
                  <td className="num mono">{r.cost ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canManage && !showAdd && (
          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>
            + Add Record
          </button>
        )}
        {showAdd && (
          <AddMaintenanceRecordForm
            asset={asset}
            onAdded={() => {
              setShowAdd(false);
              load();
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AddMaintenanceRecordForm({ asset, onAdded, onCancel }) {
  const [maintenanceDate, setMaintenanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [financialPeriodId, setFinancialPeriodId] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest('/accounting/accounts', { query: { companyId: asset.companyId } }),
      apiRequest('/accounting/financial-periods', { query: { companyId: asset.companyId } }),
    ]).then(([acc, per]) => {
      setAccounts(acc);
      setPeriods(per.filter((p) => p.status === 'open'));
    });
  }, [asset.companyId]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/assets/${asset.id}/maintenance-records`, {
        method: 'POST',
        body: {
          maintenanceDate,
          description,
          cost: cost ? Number(cost) : undefined,
          expenseAccountId: expenseAccountId || undefined,
          paymentAccountId: paymentAccountId || undefined,
          financialPeriodId: financialPeriodId || undefined,
          entryDate: cost ? maintenanceDate : undefined,
        },
      });
      onAdded();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to add maintenance record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 12, borderTop: '1px solid var(--border, #ddd)', paddingTop: 12 }}>
      {error && <div className="banner error">{error}</div>}
      <div className="formgrid" style={{ marginBottom: 12 }}>
        <div className="field">
          <label>Date *</label>
          <input className="input" type="date" value={maintenanceDate} onChange={(e) => setMaintenanceDate(e.target.value)} required />
        </div>
        <div className="field">
          <label>Description *</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div className="field">
          <label>Cost (optional)</label>
          <input className="input" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
      </div>
      {cost && (
        <div className="formgrid" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Expense Account</label>
            <select className="select" value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.filter((a) => a.accountType === 'expense').map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Payment Account</label>
            <select className="select" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.filter((a) => a.accountType === 'asset').map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Financial Period</label>
            <select className="select" value={financialPeriodId} onChange={(e) => setFinancialPeriodId(e.target.value)}>
              <option value="">Select…</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.periodName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Add Record'}
        </button>
      </div>
    </form>
  );
}
