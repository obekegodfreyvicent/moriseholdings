import React, { useEffect, useState } from 'react';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { Money } from '../components/Money';

// Asset Management (2 September 2026): asset categories, and a per-asset
// detail dialog with Inspections / Insurance / History tabs. Rendered from
// Assets.jsx.

function errText(err, fallback) {
  return err instanceof ApiRequestError ? err.apiError.message : fallback;
}

const COND_BADGE = { excellent: 'success', good: 'success', fair: 'warning', poor: 'error', unserviceable: 'error' };
const EVENT_LABEL = {
  registered: 'Registered', updated: 'Record updated', transferred: 'Transferred',
  depreciation: 'Depreciation', maintenance: 'Maintenance', inspection: 'Inspection',
  insurance_added: 'Insurance added', insurance_updated: 'Insurance updated',
  disposal_requested: 'Disposal requested', disposal_approved: 'Disposal approved', disposed: 'Disposed',
};

export function AssetCategoriesModal({ companies, onClose }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id || '');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', defaultDepreciationMethod: 'straight_line', defaultUsefulLifeYears: '', defaultSalvagePercent: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!companyId) { setRows([]); return; }
    setError(null);
    try {
      setRows(await apiRequest('/assets/categories', { query: { companyId } }));
    } catch (err) {
      setRows([]);
      setError(errText(err, 'Unable to load categories.'));
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function add(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/assets/categories', {
        method: 'POST',
        body: {
          companyId,
          code: form.code,
          name: form.name,
          defaultDepreciationMethod: form.defaultDepreciationMethod,
          defaultUsefulLifeYears: form.defaultUsefulLifeYears ? Number(form.defaultUsefulLifeYears) : undefined,
          defaultSalvagePercent: form.defaultSalvagePercent ? Number(form.defaultSalvagePercent) : undefined,
        },
      });
      setForm({ code: '', name: '', defaultDepreciationMethod: 'straight_line', defaultUsefulLifeYears: '', defaultSalvagePercent: '' });
      load();
    } catch (err) {
      setError(errText(err, 'Unable to add category.'));
    } finally {
      setSaving(false);
    }
  }
  async function toggle(row) {
    try {
      await apiRequest(`/assets/categories/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } });
      load();
    } catch (err) { setError(errText(err, 'Update failed.')); }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 680, maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2>Asset categories</h2>
        <p style={{ marginTop: -4, color: '#5b6a85' }}>Depreciation defaults a newly-registered asset inherits.</p>
        <div className="field" style={{ maxWidth: 320, marginBottom: 12 }}>
          <label>Company</label>
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {error && <div className="banner error">{error}</div>}
        {rows === null ? <div className="loading">Loading…</div> : rows.length === 0 ? (
          <div className="empty">No categories for this company yet.</div>
        ) : (
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Method</th><th className="num">Life (yrs)</th><th className="num">Salvage %</th><th className="num">Assets</th><th /></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.code}</td>
                  <td>{c.name}{!c.isActive && <span className="badge neutral" style={{ marginLeft: 6 }}>inactive</span>}</td>
                  <td>{c.defaultDepreciationMethod}</td>
                  <td className="num">{c.defaultUsefulLifeYears ?? '—'}</td>
                  <td className="num">{c.defaultSalvagePercent ?? '—'}</td>
                  <td className="num">{c.assetCount ?? 0}</td>
                  <td style={{ textAlign: 'right' }}><button className="btn-ghost" onClick={() => toggle(c)}>{c.isActive ? 'Deactivate' : 'Reactivate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={add} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, maxWidth: 100 }}><label>Code *</label><input className="input" value={form.code} onChange={set('code')} required /></div>
          <div className="field" style={{ margin: 0, minWidth: 160 }}><label>Name *</label><input className="input" value={form.name} onChange={set('name')} required /></div>
          <div className="field" style={{ margin: 0 }}><label>Method</label>
            <select className="select" value={form.defaultDepreciationMethod} onChange={set('defaultDepreciationMethod')}>
              <option value="none">none</option><option value="straight_line">straight_line</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0, maxWidth: 90 }}><label>Life yrs</label><input className="input" type="number" min="1" value={form.defaultUsefulLifeYears} onChange={set('defaultUsefulLifeYears')} /></div>
          <div className="field" style={{ margin: 0, maxWidth: 90 }}><label>Salvage %</label><input className="input" type="number" min="0" max="100" value={form.defaultSalvagePercent} onChange={set('defaultSalvagePercent')} /></div>
          <button className="btn btn-secondary" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add'}</button>
        </form>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function AssetDetailModal({ asset, canManage, onClose, onChanged }) {
  const [tab, setTab] = useState('overview');
  const [inspections, setInspections] = useState(null);
  const [insurance, setInsurance] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  const [showInspection, setShowInspection] = useState(false);
  const [showInsurance, setShowInsurance] = useState(false);

  async function loadAll() {
    setError(null);
    try {
      const [i, p, h] = await Promise.all([
        apiRequest(`/assets/${asset.id}/inspections`),
        apiRequest(`/assets/${asset.id}/insurance`),
        apiRequest(`/assets/${asset.id}/history`),
      ]);
      setInspections(i);
      setInsurance(p);
      setHistory(h);
    } catch (err) {
      setError(errText(err, 'Unable to load asset detail.'));
    }
  }
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 720, maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 2 }}><span className="mono">{asset.assetNumber}</span> — {asset.name}</h2>
        <p style={{ marginTop: 0, color: '#5b6a85' }}>{asset.categoryName || '—'} · NBV <Money value={asset.netBookValue} /></p>
        {error && <div className="banner error">{error}</div>}

        <div className="tabs" style={{ marginTop: 12, display: 'flex', gap: 6 }}>
          {[['overview', 'Overview'], ['inspections', `Inspections${inspections ? ` (${inspections.length})` : ''}`], ['insurance', `Insurance${insurance ? ` (${insurance.length})` : ''}`], ['history', `History${history ? ` (${history.length})` : ''}`]].map(([k, label]) => (
            <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="formgrid" style={{ marginTop: 16 }}>
            {[
              ['Category', asset.categoryName || '—'],
              ['Supplier', asset.supplierName || '—'],
              ['Purchase reference', asset.purchaseReference || '—'],
              ['Purchase date', asset.purchaseDate ? String(asset.purchaseDate).slice(0, 10) : '—'],
              ['Purchase cost', asset.purchaseCost],
              ['Accumulated depreciation', asset.accumulatedDepreciation],
              ['Net book value', asset.netBookValue],
              ['Depreciation method', asset.depreciationMethod],
              ['Useful life (yrs)', asset.usefulLifeYears ?? '—'],
              ['Salvage value', asset.salvageValue ?? '—'],
              ['Warranty expiry', asset.warrantyExpiryDate ? String(asset.warrantyExpiryDate).slice(0, 10) : '—'],
              ['Status', asset.status],
            ].map(([k, v]) => (
              <div className="field" key={k}><label>{k}</label><div>{v}</div></div>
            ))}
          </div>
        )}

        {tab === 'inspections' && (
          <div style={{ marginTop: 16 }}>
            {canManage && <button className="btn btn-primary btn-sm" style={{ marginBottom: 12 }} onClick={() => setShowInspection(true)}>+ New inspection</button>}
            {inspections === null ? <div className="loading">Loading…</div> : inspections.length === 0 ? <div className="empty">No inspections recorded.</div> : (
              <table>
                <thead><tr><th>Date</th><th>Condition</th><th>Findings</th><th>Action</th><th>Next due</th></tr></thead>
                <tbody>
                  {inspections.map((i) => (
                    <tr key={i.id}>
                      <td className="mono">{String(i.inspectionDate).slice(0, 10)}</td>
                      <td><span className={`badge ${COND_BADGE[i.condition] || 'neutral'}`}><span className="dot" />{i.condition}</span></td>
                      <td>{i.findings || '—'}</td>
                      <td>{i.actionRequired || '—'}</td>
                      <td className="mono">{i.nextInspectionDate ? String(i.nextInspectionDate).slice(0, 10) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'insurance' && (
          <div style={{ marginTop: 16 }}>
            {canManage && <button className="btn btn-primary btn-sm" style={{ marginBottom: 12 }} onClick={() => setShowInsurance(true)}>+ New policy</button>}
            {insurance === null ? <div className="loading">Loading…</div> : insurance.length === 0 ? <div className="empty">No insurance policies.</div> : (
              <table>
                <thead><tr><th>Policy #</th><th>Insurer</th><th className="num">Cover</th><th className="num">Premium</th><th>Term</th><th>Status</th>{canManage && <th />}</tr></thead>
                <tbody>
                  {insurance.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.policyNumber}</td>
                      <td>{p.insurer}</td>
                      <td className="num"><Money value={p.coverageAmount} /></td>
                      <td className="num">{p.premium != null ? <Money value={p.premium} /> : '—'}</td>
                      <td className="mono">{String(p.startDate).slice(0, 10)} → {String(p.endDate).slice(0, 10)}</td>
                      <td><span className={`badge ${p.status === 'active' ? 'success' : 'neutral'}`}><span className="dot" />{p.status}</span></td>
                      {canManage && (
                        <td style={{ textAlign: 'right' }}>
                          {p.status === 'active' && (
                            <button className="btn-ghost" onClick={async () => {
                              try { await apiRequest(`/assets/insurance/${p.id}`, { method: 'PATCH', body: { status: 'cancelled' } }); loadAll(); }
                              catch (err) { alert(errText(err, 'Update failed.')); }
                            }}>Cancel</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div style={{ marginTop: 16 }}>
            {history === null ? <div className="loading">Loading…</div> : history.length === 0 ? <div className="empty">No history.</div> : (
              <table>
                <thead><tr><th>When</th><th>Event</th><th>Summary</th></tr></thead>
                <tbody>
                  {history.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{String(e.occurredAt).slice(0, 10)}</td>
                      <td><span className="badge neutral"><span className="dot" />{EVENT_LABEL[e.eventType] || e.eventType}</span></td>
                      <td>{e.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      {showInspection && (
        <InspectionModal assetId={asset.id} onClose={() => setShowInspection(false)} onDone={() => { setShowInspection(false); loadAll(); onChanged && onChanged(); }} />
      )}
      {showInsurance && (
        <InsuranceModal assetId={asset.id} onClose={() => setShowInsurance(false)} onDone={() => { setShowInsurance(false); loadAll(); onChanged && onChanged(); }} />
      )}
    </div>
  );
}

function InspectionModal({ assetId, onClose, onDone }) {
  const [f, setF] = useState({ inspectionDate: new Date().toISOString().slice(0, 10), condition: 'good', findings: '', actionRequired: '', nextInspectionDate: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/assets/${assetId}/inspections`, {
        method: 'POST',
        body: {
          inspectionDate: f.inspectionDate,
          condition: f.condition,
          findings: f.findings || undefined,
          actionRequired: f.actionRequired || undefined,
          nextInspectionDate: f.nextInspectionDate || undefined,
        },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to record inspection.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2>New inspection</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field"><label>Date *</label><input className="input" type="date" value={f.inspectionDate} onChange={set('inspectionDate')} required /></div>
            <div className="field"><label>Condition *</label>
              <select className="select" value={f.condition} onChange={set('condition')}>
                {['excellent', 'good', 'fair', 'poor', 'unserviceable'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}><label>Findings</label><textarea className="input" rows={2} value={f.findings} onChange={set('findings')} /></div>
          <div className="field" style={{ marginBottom: 12 }}><label>Action required</label><input className="input" value={f.actionRequired} onChange={set('actionRequired')} /></div>
          <div className="field" style={{ marginBottom: 16 }}><label>Next inspection due</label><input className="input" type="date" value={f.nextInspectionDate} onChange={set('nextInspectionDate')} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InsuranceModal({ assetId, onClose, onDone }) {
  const [f, setF] = useState({ insurer: '', policyNumber: '', coverageAmount: '', premium: '', startDate: '', endDate: '', note: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/assets/${assetId}/insurance`, {
        method: 'POST',
        body: {
          insurer: f.insurer,
          policyNumber: f.policyNumber,
          coverageAmount: Number(f.coverageAmount),
          premium: f.premium ? Number(f.premium) : undefined,
          startDate: f.startDate,
          endDate: f.endDate,
          note: f.note || undefined,
        },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to add policy.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h2>New insurance policy</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 12 }}><label>Insurer *</label><input className="input" value={f.insurer} onChange={set('insurer')} required /></div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field"><label>Policy number *</label><input className="input" value={f.policyNumber} onChange={set('policyNumber')} required /></div>
            <div className="field"><label>Cover amount *</label><input className="input" type="number" min="1" value={f.coverageAmount} onChange={set('coverageAmount')} required /></div>
            <div className="field"><label>Premium</label><input className="input" type="number" min="0" value={f.premium} onChange={set('premium')} /></div>
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field"><label>Start *</label><input className="input" type="date" value={f.startDate} onChange={set('startDate')} required /></div>
            <div className="field"><label>End *</label><input className="input" type="date" value={f.endDate} onChange={set('endDate')} required /></div>
          </div>
          <div className="field" style={{ marginBottom: 16 }}><label>Note</label><input className="input" value={f.note} onChange={set('note')} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
