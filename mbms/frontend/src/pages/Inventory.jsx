import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Admin » Inventory (28 August 2026). Company-level stock-on-hand, re-order
// thresholds, stock adjustments (receipt / issue / count) and an immutable
// movement ledger. Per-branch stock and inter-branch transfers are Warehouse
// Management System scope (docx/20) and are not part of this screen.

const STATUS_BADGE = { ok: 'success', low: 'warning', out: 'error' };
const STATUS_LABEL = { ok: 'In stock', low: 'Low', out: 'Out of stock' };
const TYPE_LABEL = { receipt: 'Receipt', issue: 'Issue', count: 'Count' };

export function InventoryPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('product.manage');

  const [companies, setCompanies] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [tab, setTab] = useState('stock');

  const [stock, setStock] = useState(null);
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const [adjustRow, setAdjustRow] = useState(null);
  const [reorderRow, setReorderRow] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await apiRequestWithMeta('/organization/companies', { pageSize: 100 });
        setCompanies(items);
      } catch {
        setCompanies([]);
      }
    })();
  }, []);

  async function loadStock() {
    setError(null);
    try {
      const query = {};
      if (companyId) query.companyId = companyId;
      if (lowOnly) query.lowStockOnly = 'true';
      if (search.trim()) query.search = search.trim();
      const res = await apiRequest('/inventory/stock', { query });
      setStock(res.items);
      setSummary(res.summary);
    } catch (err) {
      setStock([]);
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load stock levels.');
    }
  }

  async function loadMovements() {
    setError(null);
    try {
      const query = { limit: 200 };
      if (companyId) query.companyId = companyId;
      const rows = await apiRequest('/inventory/movements', { query });
      setMovements(rows);
    } catch (err) {
      setMovements([]);
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load stock movements.');
    }
  }

  useEffect(() => {
    if (tab === 'stock') loadStock();
    else loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companyId, lowOnly]);

  function refresh() {
    loadStock();
    if (tab === 'movements') loadMovements();
  }

  const companyName = useMemo(
    () => (companies || []).find((c) => c.id === companyId)?.name,
    [companies, companyId],
  );

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Admin / Backend</div>
          <h1>Inventory</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 260 }}>
          <label>Company</label>
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies in my scope</option>
            {(companies || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="tabs" style={{ display: 'flex', gap: 6 }}>
          <button className={`btn ${tab === 'stock' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('stock')}>
            Stock levels
          </button>
          <button className={`btn ${tab === 'movements' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('movements')}>
            Movements
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {tab === 'stock' && (
        <>
          {summary && (
            <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
              <div className="kpi"><div className="label">Stock-keeping units</div><div className="value">{summary.skus}</div></div>
              <div className="kpi"><div className="label">Low stock</div><div className="value" style={{ color: summary.lowStock ? 'var(--warning)' : undefined }}>{summary.lowStock}</div></div>
              <div className="kpi"><div className="label">Out of stock</div><div className="value" style={{ color: summary.outOfStock ? 'var(--error)' : undefined }}>{summary.outOfStock}</div></div>
              <div className="kpi"><div className="label">Stock value</div><div className="value"><Money value={summary.totalStockValue} /></div></div>
            </div>
          )}

          <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <form onSubmit={(e) => { e.preventDefault(); loadStock(); }} style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="Search name or code" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220 }} />
              <button className="btn btn-secondary" type="submit">Search</button>
            </form>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
              Low / out of stock only
            </label>
          </div>

          <div className="card">
            {stock === null ? (
              <div className="loading">Loading…</div>
            ) : stock.length === 0 ? (
              <div className="empty">No products to show{companyName ? ` for ${companyName}` : ''}.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>UoM</th>
                    <th style={{ textAlign: 'right' }}>On hand</th>
                    <th style={{ textAlign: 'right' }}>Re-order pt</th>
                    <th style={{ textAlign: 'right' }}>Unit price</th>
                    <th style={{ textAlign: 'right' }}>Stock value</th>
                    <th>Status</th>
                    {canManage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {stock.map((r) => (
                    <tr key={r.productId}>
                      <td className="mono">{r.productCode}</td>
                      <td>{r.name}</td>
                      <td>{r.categoryName || '—'}</td>
                      <td>{r.unitOfMeasure || '—'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{r.onHand.toLocaleString()}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {r.reorderPoint === null ? '—' : r.reorderPoint.toLocaleString()}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setReorderRow(r)}
                            style={{ marginLeft: 6, background: 'none', border: 'none', padding: 0, color: 'var(--navy)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}
                          >
                            set
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{r.unitPrice === null ? '—' : <Money value={r.unitPrice} />}</td>
                      <td style={{ textAlign: 'right' }}>{r.stockValue === null ? '—' : <Money value={r.stockValue} />}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[r.status]}`}><span className="dot" />{STATUS_LABEL[r.status]}</span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary" onClick={() => setAdjustRow(r)}>Adjust</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'movements' && (
        <div className="card">
          {movements === null ? (
            <div className="loading">Loading…</div>
          ) : movements.length === 0 ? (
            <div className="empty">No stock movements recorded{companyName ? ` for ${companyName}` : ''}.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Change</th>
                  <th style={{ textAlign: 'right' }}>Balance after</th>
                  <th>Reason</th>
                  <th>Ref</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{new Date(m.createdAt).toLocaleString()}</td>
                    <td><span className="mono">{m.productCode}</span> {m.productName}</td>
                    <td><span className="badge neutral"><span className="dot" />{TYPE_LABEL[m.movementType] || m.movementType}</span></td>
                    <td className="mono" style={{ textAlign: 'right', color: m.quantity < 0 ? 'var(--error)' : 'var(--success)' }}>
                      {m.quantity > 0 ? `+${m.quantity.toLocaleString()}` : m.quantity.toLocaleString()}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>{m.balanceAfter.toLocaleString()}</td>
                    <td>{m.reason || '—'}</td>
                    <td className="mono">{m.reference || '—'}</td>
                    <td>{m.createdByName || m.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {adjustRow && (
        <AdjustModal row={adjustRow} onClose={() => setAdjustRow(null)} onDone={() => { setAdjustRow(null); refresh(); }} />
      )}
      {reorderRow && (
        <ReorderModal row={reorderRow} onClose={() => setReorderRow(null)} onDone={() => { setReorderRow(null); refresh(); }} />
      )}
    </Layout>
  );
}

function AdjustModal({ row, onClose, onDone }) {
  const [movementType, setMovementType] = useState('receipt');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const qtyNum = Number(quantity);
  const projected =
    quantity === '' || Number.isNaN(qtyNum)
      ? null
      : movementType === 'receipt'
        ? row.onHand + qtyNum
        : movementType === 'issue'
          ? row.onHand - qtyNum
          : qtyNum;

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/inventory/adjustments', {
        method: 'POST',
        body: {
          productId: row.productId,
          movementType,
          quantity: qtyNum,
          reason: reason.trim() || undefined,
          reference: reference.trim() || undefined,
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to record the adjustment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2>Adjust stock</h2>
        <p style={{ marginTop: -4, color: '#5b6a85' }}>
          <span className="mono">{row.productCode}</span> · {row.name} · on hand <strong>{row.onHand.toLocaleString()}</strong> {row.unitOfMeasure || ''}
        </p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Type</label>
              <select className="select" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
                <option value="receipt">Receipt — goods in</option>
                <option value="issue">Issue — goods out</option>
                <option value="count">Count — set on-hand to</option>
              </select>
            </div>
            <div className="field">
              <label>{movementType === 'count' ? 'Counted quantity' : 'Quantity'} <span className="req">*</span></label>
              <input className="input" type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
          </div>
          {projected !== null && (
            <p style={{ marginTop: -4, marginBottom: 12, fontSize: 13, color: projected < 0 ? 'var(--error)' : '#5b6a85' }}>
              New on-hand: <strong>{projected.toLocaleString()}</strong>
              {projected < 0 && ' — cannot issue more than is in stock'}
            </p>
          )}
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Reason</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Supplier delivery GRN-042, damage write-off, quarterly count" />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Document / note number" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || projected < 0}>
              {saving ? 'Saving…' : 'Record adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReorderModal({ row, onClose, onDone }) {
  const [value, setValue] = useState(row.reorderPoint === null ? '' : String(row.reorderPoint));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save(clear) {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/inventory/products/${row.productId}/reorder-point`, {
        method: 'PUT',
        body: { reorderPoint: clear ? null : Number(value) },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to update the re-order point.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2>Re-order point</h2>
        <p style={{ marginTop: -4, color: '#5b6a85' }}>
          <span className="mono">{row.productCode}</span> · {row.name}
        </p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); save(false); }}>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Flag as low stock at or below</label>
            <input className="input" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 100" required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => save(true)} disabled={saving}>Clear threshold</button>
            <button type="submit" className="btn btn-primary" disabled={saving || value === ''}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
