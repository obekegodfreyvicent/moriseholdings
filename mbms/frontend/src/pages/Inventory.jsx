import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { WarehouseOps } from './WarehouseOps';

// Admin » Inventory (28 August 2026); extended into full Inventory Management
// (1 September 2026): warehouses & stock locations, per-warehouse balances,
// transfers, returns, batch / expiry / serial tracking, min / max stock
// levels and the eight inventory reports.

const STATUS_BADGE = { ok: 'success', low: 'warning', out: 'error' };
const STATUS_LABEL = { ok: 'In stock', low: 'Low', out: 'Out of stock' };
const TYPE_LABEL = {
  receipt: 'Receipt',
  issue: 'Issue',
  count: 'Count',
  adjustment: 'Adjustment',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  return: 'Return',
};

const REPORTS = [
  ['stock-balance', 'Stock balance'],
  ['stock-movement', 'Stock movement'],
  ['movement-analysis', 'Fast / slow / dead stock'],
  ['valuation', 'Stock valuation'],
  ['shortage', 'Stock shortage'],
  ['surplus', 'Stock surplus'],
  ['expiring', 'Expiring batches'],
];

function errText(err, fallback) {
  return err instanceof ApiRequestError ? err.apiError.message : fallback;
}

export function InventoryPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('product.manage');

  const [companies, setCompanies] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [tab, setTab] = useState('stock');
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');

  const [stock, setStock] = useState(null);
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState(null);

  const [adjustRow, setAdjustRow] = useState(null);
  const [levelsRow, setLevelsRow] = useState(null);
  const [transferRow, setTransferRow] = useState(null);
  const [returnRow, setReturnRow] = useState(null);

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

  async function loadWarehouses() {
    try {
      const query = {};
      if (companyId) query.companyId = companyId;
      const rows = await apiRequest('/inventory/warehouses', { query });
      setWarehouses(rows);
    } catch {
      setWarehouses([]);
    }
  }

  useEffect(() => {
    loadWarehouses();
    setWarehouseId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function loadStock() {
    setError(null);
    try {
      const query = {};
      if (companyId) query.companyId = companyId;
      if (warehouseId) query.warehouseId = warehouseId;
      if (lowOnly) query.lowStockOnly = 'true';
      if (search.trim()) query.search = search.trim();
      const res = await apiRequest('/inventory/stock', { query });
      setStock(res.items);
      setSummary(res.summary);
    } catch (err) {
      setStock([]);
      setError(errText(err, 'Unable to load stock levels.'));
    }
  }

  async function loadMovements() {
    setError(null);
    try {
      const query = { limit: 300 };
      if (companyId) query.companyId = companyId;
      if (from) query.from = from;
      if (to) query.to = to;
      const rows = await apiRequest('/inventory/movements', { query });
      setMovements(rows);
    } catch (err) {
      setMovements([]);
      setError(errText(err, 'Unable to load stock movements.'));
    }
  }

  useEffect(() => {
    if (tab === 'stock') loadStock();
    else if (tab === 'movements') loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companyId, warehouseId, lowOnly]);

  function refresh() {
    loadStock();
    loadWarehouses();
    if (tab === 'movements') loadMovements();
  }

  const companyName = useMemo(
    () => (companies || []).find((c) => c.id === companyId)?.name,
    [companies, companyId],
  );
  const sameCompanyWarehouses = warehouses.filter((w) => !companyId || w.companyId === companyId);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Admin / Backend</div>
          <h1>Inventory</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 240 }}>
          <label>Company</label>
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies in my scope</option>
            {(companies || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {tab === 'stock' && sameCompanyWarehouses.length > 0 && (
          <div className="field" style={{ margin: 0, minWidth: 220 }}>
            <label>Warehouse</label>
            <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Company roll-up (all warehouses)</option>
              {sameCompanyWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}{w.isActive ? '' : ' (inactive)'}</option>
              ))}
            </select>
          </div>
        )}
        <div className="tabs" style={{ display: 'flex', gap: 6 }}>
          {[
            ['stock', 'Stock levels'],
            ['warehouses', 'Warehouses'],
            ['warehouse', 'Warehouse ops'],
            ['movements', 'Movements'],
            ['reports', 'Reports'],
          ].map(([k, label]) => (
            <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {tab === 'stock' && (
        <>
          {summary && (
            <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 14 }}>
              <div className="kpi"><div className="label">Stock-keeping units</div><div className="value">{summary.skus}</div></div>
              <div className="kpi"><div className="label">Warehouses</div><div className="value">{summary.warehouses}</div></div>
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
            {warehouseId && <span className="badge neutral"><span className="dot" />Showing warehouse balance</span>}
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
                    <th style={{ textAlign: 'right' }}>Re-order</th>
                    <th style={{ textAlign: 'right' }}>Min / Max</th>
                    <th style={{ textAlign: 'right' }}>Unit price</th>
                    <th style={{ textAlign: 'right' }}>Stock value</th>
                    <th>Track</th>
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
                      <td className="mono" style={{ textAlign: 'right' }}>{r.reorderPoint === null ? '—' : r.reorderPoint.toLocaleString()}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {(r.minStockLevel === null ? '—' : r.minStockLevel.toLocaleString())} / {(r.maxStockLevel === null ? '—' : r.maxStockLevel.toLocaleString())}
                      </td>
                      <td style={{ textAlign: 'right' }}>{r.unitPrice === null ? '—' : <Money value={r.unitPrice} />}</td>
                      <td style={{ textAlign: 'right' }}>{r.stockValue === null ? '—' : <Money value={r.stockValue} />}</td>
                      <td style={{ fontSize: 12 }}>
                        {r.trackBatches && <span className="badge neutral" style={{ marginRight: 4 }}>Batch</span>}
                        {r.trackSerials && <span className="badge neutral">Serial</span>}
                        {!r.trackBatches && !r.trackSerials && '—'}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[r.status]}`}><span className="dot" />{STATUS_LABEL[r.status]}</span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn btn-secondary" onClick={() => setAdjustRow(r)}>Adjust</button>{' '}
                          <button className="btn-ghost" onClick={() => setTransferRow(r)}>Transfer</button>{' '}
                          <button className="btn-ghost" onClick={() => setReturnRow(r)}>Return</button>{' '}
                          <button className="btn-ghost" onClick={() => setLevelsRow(r)}>Levels</button>
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

      {tab === 'warehouses' && (
        <WarehousesTab
          companyId={companyId}
          companies={companies || []}
          canManage={canManage}
          onChanged={loadWarehouses}
        />
      )}

      {tab === 'movements' && (
        <>
          <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>From</label>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>To</label>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button className="btn btn-secondary" onClick={loadMovements}>Apply</button>
          </div>
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
                    <th>Warehouse</th>
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
                      <td className="mono">
                        {m.warehouseCode || '—'}
                        {m.counterpartyWarehouseCode ? ` → ${m.counterpartyWarehouseCode}` : ''}
                      </td>
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
        </>
      )}

      {tab === 'warehouse' && (
        <WarehouseOps
          companyId={companyId}
          companies={companies || []}
          warehouses={warehouses}
          canManage={canManage}
        />
      )}

      {tab === 'reports' && <ReportsTab companyId={companyId} warehouses={sameCompanyWarehouses} />}

      {adjustRow && (
        <AdjustModal row={adjustRow} warehouses={sameCompanyWarehouses.filter((w) => w.companyId === adjustRow.companyId)} onClose={() => setAdjustRow(null)} onDone={() => { setAdjustRow(null); refresh(); }} />
      )}
      {levelsRow && (
        <LevelsModal row={levelsRow} onClose={() => setLevelsRow(null)} onDone={() => { setLevelsRow(null); refresh(); }} />
      )}
      {transferRow && (
        <TransferModal row={transferRow} warehouses={sameCompanyWarehouses.filter((w) => w.companyId === transferRow.companyId)} onClose={() => setTransferRow(null)} onDone={() => { setTransferRow(null); refresh(); }} />
      )}
      {returnRow && (
        <ReturnModal row={returnRow} warehouses={sameCompanyWarehouses.filter((w) => w.companyId === returnRow.companyId)} onClose={() => setReturnRow(null)} onDone={() => { setReturnRow(null); refresh(); }} />
      )}
    </Layout>
  );
}

function WarehousesTab({ companyId, companies, canManage, onChanged }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setError(null);
    try {
      const query = {};
      if (companyId) query.companyId = companyId;
      setRows(await apiRequest('/inventory/warehouses', { query }));
    } catch (err) {
      setRows([]);
      setError(errText(err, 'Unable to load warehouses.'));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Warehouses</h3>
        {canManage && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New warehouse</button>}
      </div>
      {error && <div className="banner error">{error}</div>}
      {rows === null ? (
        <div className="loading">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty">No warehouses yet.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Address</th><th>Locations</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <React.Fragment key={w.id}>
                <tr>
                  <td className="mono">{w.code}{w.isDefault && <span className="badge success" style={{ marginLeft: 6 }}>default</span>}</td>
                  <td>{w.name}</td>
                  <td>{w.address || '—'}</td>
                  <td>{w.locationCount ?? 0}</td>
                  <td><span className={`badge ${w.isActive ? 'success' : 'neutral'}`}><span className="dot" />{w.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-ghost" onClick={() => setExpanded(expanded === w.id ? null : w.id)}>
                      {expanded === w.id ? 'Hide' : 'Locations'}
                    </button>
                  </td>
                </tr>
                {expanded === w.id && (
                  <tr>
                    <td colSpan={6} style={{ background: 'var(--surface-2, #f7f8fa)' }}>
                      <LocationsPanel warehouseId={w.id} canManage={canManage} onChanged={load} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
      {showCreate && (
        <CreateWarehouseModal
          companies={companies}
          defaultCompanyId={companyId}
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); load(); onChanged(); }}
        />
      )}
    </div>
  );
}

const LOCATION_KINDS = ['receiving', 'storage', 'picking', 'packing', 'dispatch', 'quarantine'];

function LocationsPanel({ warehouseId, canManage, onChanged }) {
  const [rows, setRows] = useState(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('storage');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setRows(await apiRequest(`/inventory/warehouses/${warehouseId}/locations`));
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  async function add(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/inventory/warehouses/${warehouseId}/locations`, { method: 'POST', body: { code, name, kind } });
      setCode('');
      setName('');
      setKind('storage');
      load();
      onChanged();
    } catch (err) {
      setError(errText(err, 'Unable to add location.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '10px 4px' }}>
      {error && <div className="banner error">{error}</div>}
      {rows === null ? (
        <div className="loading">Loading…</div>
      ) : rows.length === 0 ? (
        <p style={{ color: '#5b6a85', margin: '4px 0' }}>No bins / aisles defined.</p>
      ) : (
        <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
          {rows.map((l) => (
            <li key={l.id}>
              <span className="mono">{l.code}</span> — {l.name}
              {l.kind ? <span className="badge neutral" style={{ marginLeft: 6 }}>{l.kind}</span> : null}
              {l.description ? <span style={{ color: '#5b6a85' }}> · {l.description}</span> : null}
              {!l.isActive && <span className="badge neutral" style={{ marginLeft: 6 }}>inactive</span>}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form onSubmit={add} style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} required style={{ maxWidth: 120 }} />
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ maxWidth: 220 }} />
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value)} style={{ maxWidth: 140 }}>
            {LOCATION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button className="btn btn-secondary" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add'}</button>
        </form>
      )}
    </div>
  );
}

function CreateWarehouseModal({ companies, defaultCompanyId, onClose, onDone }) {
  const [companyId, setCompanyId] = useState(defaultCompanyId || (companies[0]?.id ?? ''));
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/inventory/warehouses', {
        method: 'POST',
        body: { companyId, code, name, address: address.trim() || undefined },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to create warehouse.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2>New warehouse</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Company <span className="req">*</span></label>
            <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
              <option value="" disabled>Select…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Code <span className="req">*</span></label>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. KLA-01" required />
            </div>
            <div className="field">
              <label>Name <span className="req">*</span></label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Address</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !companyId}>{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdjustModal({ row, warehouses, onClose, onDone }) {
  const [movementType, setMovementType] = useState('receipt');
  const [quantity, setQuantity] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [serialText, setSerialText] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const qtyNum = Number(quantity);
  const serials = serialText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

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
          warehouseId: warehouseId || undefined,
          batchNumber: movementType === 'receipt' && batchNumber.trim() ? batchNumber.trim() : undefined,
          expiryDate: movementType === 'receipt' && expiryDate ? expiryDate : undefined,
          serialNumbers: serials.length ? serials : undefined,
          reason: reason.trim() || undefined,
          reference: reference.trim() || undefined,
        },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to record the adjustment.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480, maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2>Adjust stock</h2>
        <p style={{ marginTop: -4, color: '#5b6a85' }}>
          <span className="mono">{row.productCode}</span> · {row.name} · roll-up on hand <strong>{row.onHand.toLocaleString()}</strong> {row.unitOfMeasure || ''}
        </p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Type</label>
              <select className="select" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
                <option value="receipt">Receipt — goods in</option>
                <option value="issue">Issue — goods out</option>
                <option value="count">Count — set warehouse on-hand to</option>
              </select>
            </div>
            <div className="field">
              <label>{movementType === 'count' ? 'Counted quantity' : 'Quantity'} <span className="req">*</span></label>
              <input className="input" type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
          </div>
          {warehouses.length > 0 && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Warehouse</label>
              <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
          )}
          {movementType === 'receipt' && row.trackBatches && (
            <div className="formgrid" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>Batch number</label>
                <input className="input" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
              </div>
              <div className="field">
                <label>Expiry date</label>
                <input className="input" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>
          )}
          {row.trackSerials && movementType !== 'count' && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Serial numbers (comma / space separated — must match quantity)</label>
              <textarea className="input" rows={2} value={serialText} onChange={(e) => setSerialText(e.target.value)} />
              {serials.length > 0 && <span style={{ fontSize: 12, color: serials.length === qtyNum ? '#5b6a85' : 'var(--error)' }}>{serials.length} serial(s)</span>}
            </div>
          )}
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Reason</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Supplier delivery GRN-042, damage write-off, quarterly count" />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record adjustment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TransferModal({ row, warehouses, onClose, onDone }) {
  const active = warehouses.filter((w) => w.isActive);
  const [fromWarehouseId, setFrom] = useState(active[0]?.id || '');
  const [toWarehouseId, setTo] = useState(active[1]?.id || '');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/inventory/transfers', {
        method: 'POST',
        body: { productId: row.productId, fromWarehouseId, toWarehouseId, quantity: Number(quantity), reason: reason.trim() || undefined, reference: reference.trim() || undefined },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to transfer stock.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2>Transfer stock</h2>
        <p style={{ marginTop: -4, color: '#5b6a85' }}><span className="mono">{row.productCode}</span> · {row.name}</p>
        {error && <div className="banner error">{error}</div>}
        {warehouses.length < 2 ? (
          <p>Need at least two warehouses for this company. Add one on the Warehouses tab.</p>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="formgrid" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>From</label>
                <select className="select" value={fromWarehouseId} onChange={(e) => setFrom(e.target.value)}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>To</label>
                <select className="select" value={toWarehouseId} onChange={(e) => setTo(e.target.value)}>
                  {active.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Quantity <span className="req">*</span></label>
              <input className="input" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Reason</label>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Reference</label>
              <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || fromWarehouseId === toWarehouseId}>{saving ? 'Saving…' : 'Transfer'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ReturnModal({ row, warehouses, onClose, onDone }) {
  const active = warehouses.filter((w) => w.isActive);
  const [warehouseId, setWarehouseId] = useState(active.find((w) => w.isDefault)?.id || active[0]?.id || '');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/inventory/returns', {
        method: 'POST',
        body: { productId: row.productId, warehouseId, quantity: Number(quantity), reason: reason.trim() || undefined, reference: reference.trim() || undefined },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to record the return.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <h2>Record a return</h2>
        <p style={{ marginTop: -4, color: '#5b6a85' }}><span className="mono">{row.productCode}</span> · {row.name} — goods coming back into stock</p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          {active.length > 0 && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Into warehouse</label>
              <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                {active.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Quantity <span className="req">*</span></label>
            <input className="input" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Reason</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer return — order SO-1042" />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record return'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LevelsModal({ row, onClose, onDone }) {
  const [reorderPoint, setReorder] = useState(row.reorderPoint === null ? '' : String(row.reorderPoint));
  const [minStockLevel, setMin] = useState(row.minStockLevel === null ? '' : String(row.minStockLevel));
  const [maxStockLevel, setMax] = useState(row.maxStockLevel === null ? '' : String(row.maxStockLevel));
  const [trackBatches, setBatches] = useState(!!row.trackBatches);
  const [trackSerials, setSerials] = useState(!!row.trackSerials);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const num = (v) => (v === '' ? null : Number(v));
    try {
      await apiRequest(`/inventory/products/${row.productId}/stock-levels`, {
        method: 'PUT',
        body: {
          reorderPoint: num(reorderPoint),
          minStockLevel: num(minStockLevel),
          maxStockLevel: num(maxStockLevel),
          trackBatches,
          trackSerials,
        },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to update stock levels.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <h2>Stock levels &amp; tracking</h2>
        <p style={{ marginTop: -4, color: '#5b6a85' }}><span className="mono">{row.productCode}</span> · {row.name}</p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Re-order point</label>
              <input className="input" type="number" min="0" value={reorderPoint} onChange={(e) => setReorder(e.target.value)} placeholder="—" />
            </div>
            <div className="field">
              <label>Minimum level</label>
              <input className="input" type="number" min="0" value={minStockLevel} onChange={(e) => setMin(e.target.value)} placeholder="—" />
            </div>
            <div className="field">
              <label>Maximum level</label>
              <input className="input" type="number" min="0" value={maxStockLevel} onChange={(e) => setMax(e.target.value)} placeholder="—" />
            </div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input type="checkbox" checked={trackBatches} onChange={(e) => setBatches(e.target.checked)} />
            Track batches &amp; expiry dates
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <input type="checkbox" checked={trackSerials} onChange={(e) => setSerials(e.target.checked)} />
            Track serial numbers
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReportsTab({ companyId, warehouses }) {
  const [report, setReport] = useState('stock-balance');
  const [warehouseId, setWarehouseId] = useState('');
  const [days, setDays] = useState('90');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const query = {};
      if (companyId) query.companyId = companyId;
      if (warehouseId && ['stock-balance', 'valuation'].includes(report)) query.warehouseId = warehouseId;
      if (report === 'movement-analysis') query.days = days;
      if (report === 'expiring') query.days = days;
      setData(await apiRequest(`/inventory/reports/${report}`, { query }));
    } catch (err) {
      setError(errText(err, 'Unable to run the report.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, companyId, warehouseId]);

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="field" style={{ margin: 0, minWidth: 240 }}>
          <label>Report</label>
          <select className="select" value={report} onChange={(e) => setReport(e.target.value)}>
            {REPORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        {['stock-balance', 'valuation'].includes(report) && warehouses.length > 0 && (
          <div className="field" style={{ margin: 0, minWidth: 200 }}>
            <label>Warehouse</label>
            <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">All (roll-up)</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
          </div>
        )}
        {['movement-analysis', 'expiring'].includes(report) && (
          <div className="field" style={{ margin: 0, maxWidth: 120 }}>
            <label>Window (days)</label>
            <input className="input" type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} onBlur={run} />
          </div>
        )}
        <button className="btn btn-secondary" onClick={run}>Refresh</button>
      </div>

      {error && <div className="banner error">{error}</div>}
      {loading ? <div className="loading">Running…</div> : <ReportBody report={report} data={data} />}
    </div>
  );
}

function ReportBody({ report, data }) {
  if (!data) return <div className="empty">No data.</div>;

  if (report === 'stock-balance') {
    return (
      <table>
        <thead><tr><th>Code</th><th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>On hand</th><th>By warehouse</th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.productId}>
              <td className="mono">{r.productCode}</td>
              <td>{r.name}</td>
              <td>{r.categoryName || '—'}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{r.onHand.toLocaleString()}</td>
              <td style={{ fontSize: 12 }}>{r.byWarehouse.length ? r.byWarehouse.map((w) => `${w.code}: ${w.quantity}`).join(' · ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (report === 'stock-movement') {
    return (
      <table>
        <thead><tr><th>When</th><th>Product</th><th>Type</th><th>Warehouse</th><th style={{ textAlign: 'right' }}>Change</th><th>Reason</th></tr></thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.id}>
              <td className="mono">{new Date(m.createdAt).toLocaleDateString()}</td>
              <td><span className="mono">{m.productCode}</span> {m.productName}</td>
              <td>{TYPE_LABEL[m.movementType] || m.movementType}</td>
              <td className="mono">{m.warehouseCode || '—'}{m.counterpartyWarehouseCode ? ` → ${m.counterpartyWarehouseCode}` : ''}</td>
              <td className="mono" style={{ textAlign: 'right', color: m.quantity < 0 ? 'var(--error)' : 'var(--success)' }}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
              <td>{m.reason || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (report === 'movement-analysis') {
    const block = (title, rows, valueLabel) => (
      <div style={{ marginBottom: 18 }}>
        <h4 style={{ margin: '6px 0' }}>{title}</h4>
        {rows.length === 0 ? <p style={{ color: '#5b6a85' }}>None.</p> : (
          <table>
            <thead><tr><th>Code</th><th>Product</th><th style={{ textAlign: 'right' }}>{valueLabel}</th><th style={{ textAlign: 'right' }}>On hand</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId}>
                  <td className="mono">{r.productCode}</td><td>{r.name}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{r.issued.toLocaleString()}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{r.onHand.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
    return (
      <div>
        <p style={{ color: '#5b6a85' }}>Issues over the last {data.windowDays} days.</p>
        {block('Fast-moving', data.fastMoving, 'Issued')}
        {block('Slow-moving', data.slowMoving, 'Issued')}
        {block('Dead stock (no issues, still on hand)', data.deadStock, 'Issued')}
      </div>
    );
  }

  if (report === 'valuation') {
    return (
      <>
        <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
          <div className="kpi"><div className="label">Total stock value</div><div className="value"><Money value={data.totalValue} /></div></div>
          <div className="kpi"><div className="label">Priced SKUs</div><div className="value">{data.pricedSkus}</div></div>
          <div className="kpi"><div className="label">Unpriced SKUs</div><div className="value">{data.unpricedSkus}</div></div>
        </div>
        <table>
          <thead><tr><th>Code</th><th>Product</th><th style={{ textAlign: 'right' }}>On hand</th><th style={{ textAlign: 'right' }}>Unit price</th><th style={{ textAlign: 'right' }}>Value</th></tr></thead>
          <tbody>
            {data.lines.map((l) => (
              <tr key={l.productId}>
                <td className="mono">{l.productCode}</td><td>{l.name}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{l.onHand.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}><Money value={l.unitPrice} /></td>
                <td style={{ textAlign: 'right' }}><Money value={l.stockValue} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  if (report === 'shortage') {
    return data.length === 0 ? <div className="empty">No shortages — every product with a threshold is at or above it.</div> : (
      <table>
        <thead><tr><th>Code</th><th>Product</th><th style={{ textAlign: 'right' }}>On hand</th><th style={{ textAlign: 'right' }}>Threshold</th><th>Kind</th><th style={{ textAlign: 'right' }}>Short by</th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.productId}>
              <td className="mono">{r.productCode}</td><td>{r.name}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{r.onHand.toLocaleString()}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{r.threshold.toLocaleString()}</td>
              <td>{r.thresholdKind}</td>
              <td className="mono" style={{ textAlign: 'right', color: 'var(--error)' }}>{r.shortBy.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (report === 'surplus') {
    return data.length === 0 ? <div className="empty">No surplus — nothing is above its maximum stock level.</div> : (
      <table>
        <thead><tr><th>Code</th><th>Product</th><th style={{ textAlign: 'right' }}>On hand</th><th style={{ textAlign: 'right' }}>Maximum</th><th style={{ textAlign: 'right' }}>Over by</th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.productId}>
              <td className="mono">{r.productCode}</td><td>{r.name}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{r.onHand.toLocaleString()}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{r.maxStockLevel.toLocaleString()}</td>
              <td className="mono" style={{ textAlign: 'right', color: 'var(--warning)' }}>{r.overBy.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (report === 'expiring') {
    return data.batches.length === 0 ? <div className="empty">No batches expiring within {data.windowDays} days.</div> : (
      <table>
        <thead><tr><th>Code</th><th>Product</th><th>Warehouse</th><th>Batch</th><th>Expiry</th><th style={{ textAlign: 'right' }}>Qty</th><th>Status</th></tr></thead>
        <tbody>
          {data.batches.map((b) => (
            <tr key={b.id}>
              <td className="mono">{b.productCode}</td><td>{b.productName}</td>
              <td className="mono">{b.warehouseCode || '—'}</td>
              <td className="mono">{b.batchNumber}</td>
              <td className="mono">{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '—'}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{b.quantity.toLocaleString()}</td>
              <td><span className={`badge ${b.expired ? 'error' : 'warning'}`}><span className="dot" />{b.expired ? 'Expired' : 'Expiring'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return <pre style={{ fontSize: 12, overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>;
}
