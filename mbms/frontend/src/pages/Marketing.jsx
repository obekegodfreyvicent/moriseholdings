import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Admin » Marketing & Promos (28 August 2026). Storefront discount codes
// (validated & applied at checkout) and promotional banners (rendered on the
// storefront home). Per company.

export function MarketingPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('marketing.manage');

  const [companies, setCompanies] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [tab, setTab] = useState('codes');

  const [codes, setCodes] = useState(null);
  const [banners, setBanners] = useState(null);
  const [error, setError] = useState(null);

  const [editCode, setEditCode] = useState(null); // {} for new, row for edit
  const [editBanner, setEditBanner] = useState(null);

  useEffect(() => {
    apiRequestWithMeta('/organization/companies', { pageSize: 100 })
      .then(({ items }) => setCompanies(items))
      .catch(() => setCompanies([]));
  }, []);

  async function load() {
    setError(null);
    const q = companyId ? { companyId } : {};
    try {
      if (tab === 'codes') setCodes(await apiRequest('/marketing/discount-codes', { query: q }));
      else setBanners(await apiRequest('/marketing/banners', { query: q }));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load.');
      if (tab === 'codes') setCodes([]);
      else setBanners([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companyId]);

  async function codeAction(id, action) {
    setError(null);
    try {
      await apiRequest(`/marketing/discount-codes/${id}/${action}`, { method: 'POST' });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Action failed.');
    }
  }

  async function deleteCode(row) {
    if (!window.confirm(`Delete discount code ${row.code}?${row.timesRedeemed ? ` It has been redeemed ${row.timesRedeemed} time(s); past orders keep the code text.` : ''}`)) return;
    setError(null);
    try {
      await apiRequest(`/marketing/discount-codes/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Delete failed.');
    }
  }

  async function deleteBanner(id) {
    if (!window.confirm('Delete this banner?')) return;
    try {
      await apiRequest(`/marketing/banners/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Delete failed.');
    }
  }

  const canPickCompany = useMemo(() => (companies || []).length > 0, [companies]);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Admin / Backend</div>
          <h1>Marketing &amp; Promos</h1>
        </div>
        {canManage && (
          <div className="actions">
            {tab === 'codes' ? (
              <button className="btn btn-primary" disabled={!companyId} onClick={() => setEditCode({})}>+ New discount code</button>
            ) : (
              <button className="btn btn-primary" disabled={!companyId} onClick={() => setEditBanner({})}>+ New banner</button>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 260 }}>
          <label>Company</label>
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)} disabled={!canPickCompany}>
            <option value="">All companies in my scope</option>
            {(companies || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`btn ${tab === 'codes' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('codes')}>Discount codes</button>
          <button className={`btn ${tab === 'banners' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('banners')}>Banners</button>
        </div>
        {canManage && !companyId && <span style={{ fontSize: 12, color: '#7c8aa3' }}>Pick a company to add a {tab === 'codes' ? 'code' : 'banner'}.</span>}
      </div>

      {error && <div className="banner error">{error}</div>}

      {tab === 'codes' && (
        <div className="card">
          {codes === null ? (
            <div className="loading">Loading…</div>
          ) : codes.length === 0 ? (
            <div className="empty">No discount codes.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Type</th><th style={{ textAlign: 'right' }}>Value</th><th style={{ textAlign: 'right' }}>Min order</th>
                  <th style={{ textAlign: 'right' }}>Redeemed</th><th>Window</th><th>Status</th>{canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.code}</td>
                    <td>{c.discountType === 'percentage' ? 'Percentage' : 'Fixed amount'}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{c.discountType === 'percentage' ? `${c.value}%` : <Money value={c.value} />}</td>
                    <td style={{ textAlign: 'right' }}>{c.minOrderValue ? <Money value={c.minOrderValue} /> : '—'}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{c.timesRedeemed}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}</td>
                    <td style={{ fontSize: 12 }}>
                      {c.startsAt ? new Date(c.startsAt).toLocaleDateString() : '—'} → {c.endsAt ? new Date(c.endsAt).toLocaleDateString() : '—'}
                    </td>
                    <td><span className={`badge ${c.status === 'active' ? 'success' : 'neutral'}`}><span className="dot" />{c.status}</span></td>
                    {canManage && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-secondary" onClick={() => setEditCode(c)}>Edit</button>{' '}
                        <button className="btn btn-secondary" onClick={() => codeAction(c.id, c.status === 'active' ? 'deactivate' : 'activate')}>
                          {c.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>{' '}
                        <button className="btn btn-secondary" onClick={() => deleteCode(c)}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'banners' && (
        <div className="card">
          {banners === null ? (
            <div className="loading">Loading…</div>
          ) : banners.length === 0 ? (
            <div className="empty">No banners.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Heading</th><th>Link</th><th style={{ textAlign: 'right' }}>Order</th><th>Window</th><th>Active</th>{canManage && <th />}</tr>
              </thead>
              <tbody>
                {banners.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div>{b.heading}</div>
                      {b.body && <div style={{ fontSize: 12, color: '#7c8aa3' }}>{b.body}</div>}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{b.linkUrl || '—'}{b.linkLabel ? ` (${b.linkLabel})` : ''}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{b.sortOrder}</td>
                    <td style={{ fontSize: 12 }}>
                      {b.startsAt ? new Date(b.startsAt).toLocaleDateString() : '—'} → {b.endsAt ? new Date(b.endsAt).toLocaleDateString() : '—'}
                    </td>
                    <td><span className={`badge ${b.active ? 'success' : 'neutral'}`}><span className="dot" />{b.active ? 'live' : 'off'}</span></td>
                    {canManage && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-secondary" onClick={() => setEditBanner(b)}>Edit</button>{' '}
                        <button className="btn btn-secondary" onClick={() => deleteBanner(b.id)}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editCode && (
        <DiscountCodeModal companyId={companyId} row={editCode.id ? editCode : null} onClose={() => setEditCode(null)} onDone={() => { setEditCode(null); load(); }} />
      )}
      {editBanner && (
        <BannerModal companyId={companyId} row={editBanner.id ? editBanner : null} onClose={() => setEditBanner(null)} onDone={() => { setEditBanner(null); load(); }} />
      )}
    </Layout>
  );
}

function toDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function DiscountCodeModal({ companyId, row, onClose, onDone }) {
  const editing = !!row;
  const [code, setCode] = useState(row?.code || '');
  const [description, setDescription] = useState(row?.description || '');
  const [discountType, setDiscountType] = useState(row?.discountType || 'percentage');
  const [value, setValue] = useState(row?.value ? String(row.value) : '');
  const [minOrderValue, setMinOrderValue] = useState(row?.minOrderValue ? String(row.minOrderValue) : '');
  const [maxRedemptions, setMaxRedemptions] = useState(row?.maxRedemptions ? String(row.maxRedemptions) : '');
  const [startsAt, setStartsAt] = useState(toDateInput(row?.startsAt));
  const [endsAt, setEndsAt] = useState(toDateInput(row?.endsAt));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        description: description.trim() || undefined,
        discountType,
        value: value.trim(),
        minOrderValue: minOrderValue.trim() || (editing ? null : undefined),
        maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : (editing ? null : undefined),
        startsAt: startsAt || (editing ? null : undefined),
        endsAt: endsAt || (editing ? null : undefined),
      };
      if (editing) {
        await apiRequest(`/marketing/discount-codes/${row.id}`, { method: 'PATCH', body });
      } else {
        await apiRequest('/marketing/discount-codes', { method: 'POST', body: { companyId, code: code.trim(), ...body } });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 500 }} onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? `Edit ${row.code}` : 'New discount code'}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          {!editing && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Code <span className="req">*</span></label>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. WELCOME10" required />
            </div>
          )}
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Type</label>
              <select className="select" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="percentage">Percentage of subtotal</option>
                <option value="fixed">Fixed amount (UGX)</option>
              </select>
            </div>
            <div className="field">
              <label>{discountType === 'percentage' ? 'Percent (0–100)' : 'Amount (UGX)'} <span className="req">*</span></label>
              <input className="input" type="number" min="0" step={discountType === 'percentage' ? '1' : '0.01'} value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
            <div className="field">
              <label>Minimum order (UGX)</label>
              <input className="input" type="number" min="0" value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value)} placeholder="none" />
            </div>
            <div className="field">
              <label>Max redemptions</label>
              <input className="input" type="number" min="1" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="unlimited" />
            </div>
            <div className="field">
              <label>Valid from</label>
              <input className="input" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="field">
              <label>Valid until</label>
              <input className="input" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown to staff only" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BannerModal({ companyId, row, onClose, onDone }) {
  const editing = !!row;
  const [heading, setHeading] = useState(row?.heading || '');
  const [body, setBody] = useState(row?.body || '');
  const [linkUrl, setLinkUrl] = useState(row?.linkUrl || '');
  const [linkLabel, setLinkLabel] = useState(row?.linkLabel || '');
  const [sortOrder, setSortOrder] = useState(row?.sortOrder != null ? String(row.sortOrder) : '0');
  const [startsAt, setStartsAt] = useState(toDateInput(row?.startsAt));
  const [endsAt, setEndsAt] = useState(toDateInput(row?.endsAt));
  const [active, setActive] = useState(row ? !!row.active : true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body_ = {
        heading: heading.trim(),
        body: body.trim() || (editing ? null : undefined),
        linkUrl: linkUrl.trim() || (editing ? null : undefined),
        linkLabel: linkLabel.trim() || (editing ? null : undefined),
        sortOrder: Number(sortOrder) || 0,
        startsAt: startsAt || (editing ? null : undefined),
        endsAt: endsAt || (editing ? null : undefined),
        active,
      };
      if (editing) await apiRequest(`/marketing/banners/${row.id}`, { method: 'PATCH', body: body_ });
      else await apiRequest('/marketing/banners', { method: 'POST', body: { companyId, ...body_ } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 500 }} onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? 'Edit banner' : 'New banner'}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Heading <span className="req">*</span></label>
            <input className="input" value={heading} onChange={(e) => setHeading(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Body</label>
            <textarea className="input" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Link URL</label>
              <input className="input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/shop" />
            </div>
            <div className="field">
              <label>Link label</label>
              <input className="input" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Shop now" />
            </div>
            <div className="field">
              <label>Sort order</label>
              <input className="input" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
            <div className="field">
              <label>Live</label>
              <select className="select" value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>
            <div className="field">
              <label>Show from</label>
              <input className="input" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="field">
              <label>Show until</label>
              <input className="input" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
