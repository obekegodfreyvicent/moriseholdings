import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Warehouse ops (1 September 2026): warehouse staff, receiving (goods
// receipts), picking / packing / dispatch (pick lists) and physical count +
// reconciliation (stock counts). Rendered as a sub-tabbed panel inside the
// Inventory screen.

function errText(err, fallback) {
  return err instanceof ApiRequestError ? err.apiError.message : fallback;
}
const badge = {
  draft: 'neutral', pending: 'neutral', open: 'neutral',
  received: 'success', picked: 'warning', packed: 'warning', counting: 'warning',
  picking: 'warning', dispatched: 'success', reconciled: 'success',
  cancelled: 'error',
};

export function WarehouseOps({ companyId, companies, warehouses, canManage }) {
  const [sub, setSub] = useState('staff');
  const wh = warehouses.filter((w) => !companyId || w.companyId === companyId);

  return (
    <div>
      <div className="tabs" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          ['staff', 'Staff'],
          ['receipts', 'Goods receipts'],
          ['picks', 'Pick lists'],
          ['counts', 'Stock counts'],
        ].map(([k, label]) => (
          <button key={k} className={`btn ${sub === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSub(k)}>
            {label}
          </button>
        ))}
      </div>
      {sub === 'staff' && <StaffPanel warehouses={wh} canManage={canManage} />}
      {sub === 'receipts' && <ReceiptsPanel companyId={companyId} companies={companies} warehouses={wh} canManage={canManage} />}
      {sub === 'picks' && <PicksPanel companyId={companyId} companies={companies} warehouses={wh} canManage={canManage} />}
      {sub === 'counts' && <CountsPanel companyId={companyId} companies={companies} warehouses={wh} canManage={canManage} />}
    </div>
  );
}

const WH_ROLES = ['manager', 'supervisor', 'receiver', 'picker', 'packer', 'dispatcher'];

function StaffPanel({ warehouses, canManage }) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [rows, setRows] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('picker');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id);
  }, [warehouses, warehouseId]);

  async function load() {
    if (!warehouseId) { setRows([]); return; }
    setError(null);
    try {
      setRows(await apiRequest(`/inventory/warehouses/${warehouseId}/staff`));
    } catch (err) {
      setRows([]);
      setError(errText(err, 'Unable to load staff.'));
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await apiRequestWithMeta('/employees', { pageSize: 200 });
        setEmployees(items);
      } catch {
        setEmployees([]);
      }
    })();
  }, []);

  async function add(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/inventory/warehouses/${warehouseId}/staff`, { method: 'POST', body: { employeeId, role } });
      setEmployeeId('');
      load();
    } catch (err) {
      setError(errText(err, 'Unable to add staff.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row) {
    try {
      await apiRequest(`/inventory/warehouse-staff/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } });
      load();
    } catch (err) { setError(errText(err, 'Update failed.')); }
  }
  async function remove(row) {
    if (!window.confirm('Remove this assignment?')) return;
    try {
      await apiRequest(`/inventory/warehouse-staff/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(errText(err, 'Remove failed.')); }
  }

  return (
    <div className="card">
      <div className="field" style={{ maxWidth: 320, marginBottom: 12 }}>
        <label>Warehouse</label>
        <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
        </select>
      </div>
      {error && <div className="banner error">{error}</div>}
      {rows === null ? <div className="loading">Loading…</div> : rows.length === 0 ? (
        <div className="empty">No staff assigned to this warehouse.</div>
      ) : (
        <table>
          <thead><tr><th>Employee</th><th>Role</th><th>Status</th>{canManage && <th />}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.employeeName || r.employeeId}</td>
                <td>{r.role}</td>
                <td><span className={`badge ${r.isActive ? 'success' : 'neutral'}`}><span className="dot" />{r.isActive ? 'Active' : 'Inactive'}</span></td>
                {canManage && (
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-ghost" onClick={() => toggle(r)}>{r.isActive ? 'Deactivate' : 'Reactivate'}</button>{' '}
                    <button className="btn-ghost" onClick={() => remove(r)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canManage && warehouseId && (
        <form onSubmit={add} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, minWidth: 240 }}>
            <label>Employee</label>
            <select className="select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              <option value="">Select…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.jobTitle ? ` — ${e.jobTitle}` : ''}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Role</label>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              {WH_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" type="submit" disabled={saving || !employeeId}>{saving ? 'Adding…' : 'Assign'}</button>
        </form>
      )}
    </div>
  );
}

function useList(path, companyId, warehouseId, statusFilter) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  async function load() {
    setError(null);
    try {
      const query = {};
      if (companyId) query.companyId = companyId;
      if (warehouseId) query.warehouseId = warehouseId;
      if (statusFilter) query.status = statusFilter;
      setRows(await apiRequest(path, { query }));
    } catch (err) {
      setRows([]);
      setError(errText(err, 'Unable to load.'));
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, companyId, warehouseId, statusFilter]);
  return { rows, error, reload: load };
}

function ReceiptsPanel({ companyId, companies, warehouses, canManage }) {
  const [status, setStatus] = useState('');
  const { rows, error, reload } = useList('/inventory/goods-receipts', companyId, '', status);
  const [showCreate, setShowCreate] = useState(false);
  const [open, setOpen] = useState(null);

  async function act(id, action) {
    try {
      await apiRequest(`/inventory/goods-receipts/${id}/${action}`, { method: 'POST' });
      reload();
    } catch (err) { alert(errText(err, 'Action failed.')); }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <select className="select" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['draft', 'received', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {canManage && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New goods receipt</button>}
      </div>
      {error && <div className="banner error">{error}</div>}
      {rows === null ? <div className="loading">Loading…</div> : rows.length === 0 ? <div className="empty">No goods receipts.</div> : (
        <table>
          <thead><tr><th>Number</th><th>Warehouse</th><th>Ref</th><th>Lines</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr>
                  <td className="mono">{r.receiptNumber}</td>
                  <td className="mono">{r.warehouseCode}</td>
                  <td>{r.reference || '—'}</td>
                  <td>{r.lines.length}</td>
                  <td><span className={`badge ${badge[r.status] || 'neutral'}`}><span className="dot" />{r.status}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide' : 'Lines'}</button>
                    {canManage && r.status === 'draft' && (
                      <>
                        {' '}<button className="btn btn-secondary" onClick={() => act(r.id, 'receive')}>Receive</button>
                        {' '}<button className="btn-ghost" onClick={() => act(r.id, 'cancel')}>Cancel</button>
                      </>
                    )}
                  </td>
                </tr>
                {open === r.id && (
                  <tr><td colSpan={6} style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                    <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
                      {r.lines.map((l) => (
                        <li key={l.id}><span className="mono">{l.productCode}</span> {l.productName} — qty {l.quantity}{l.batchNumber ? ` · batch ${l.batchNumber}` : ''}{l.expiryDate ? ` · exp ${String(l.expiryDate).slice(0, 10)}` : ''}</li>
                      ))}
                    </ul>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
      {showCreate && (
        <ReceiptModal companyId={companyId} companies={companies} warehouses={warehouses}
          onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); reload(); }} />
      )}
    </div>
  );
}

function ReceiptModal({ companyId, companies, warehouses, onClose, onDone }) {
  const [cid, setCid] = useState(companyId || companies[0]?.id || '');
  const whs = warehouses.filter((w) => w.companyId === cid);
  const [warehouseId, setWarehouseId] = useState(whs[0]?.id || '');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState([{ barcode: '', quantity: '' }]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await apiRequestWithMeta('/products', { pageSize: 500, ...(cid ? { 'filter[companyId]': cid } : {}) });
        setProducts(items);
      } catch { setProducts([]); }
    })();
  }, [cid]);
  useEffect(() => { if (!warehouseId && whs[0]) setWarehouseId(whs[0].id); }, [whs, warehouseId]);

  function setLine(i, patch) { setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l))); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/inventory/goods-receipts', {
        method: 'POST',
        body: {
          companyId: cid,
          warehouseId,
          reference: reference.trim() || undefined,
          lines: lines.filter((l) => l.productId && l.quantity).map((l) => ({ productId: l.productId, quantity: Number(l.quantity), batchNumber: l.batchNumber || undefined, expiryDate: l.expiryDate || undefined })),
        },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to create goods receipt.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 620, maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2>New goods receipt</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Company *</label>
              <select className="select" value={cid} onChange={(e) => setCid(e.target.value)} required>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Warehouse *</label>
              <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                <option value="">Select…</option>
                {whs.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Reference (PO number etc.)</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="fs-title">Lines</div>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="field" style={{ margin: 0, flex: 2 }}>
                <label>Product</label>
                <select className="select" value={l.productId || ''} onChange={(e) => setLine(i, { productId: e.target.value })}>
                  <option value="">Select…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.productCode} — {p.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0, maxWidth: 90 }}>
                <label>Qty</label>
                <input className="input" type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
              </div>
              <div className="field" style={{ margin: 0, maxWidth: 130 }}>
                <label>Batch</label>
                <input className="input" value={l.batchNumber || ''} onChange={(e) => setLine(i, { batchNumber: e.target.value })} />
              </div>
              <div className="field" style={{ margin: 0, maxWidth: 150 }}>
                <label>Expiry</label>
                <input className="input" type="date" value={l.expiryDate || ''} onChange={(e) => setLine(i, { expiryDate: e.target.value })} />
              </div>
              <button type="button" className="btn-ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={() => setLines((ls) => [...ls, { barcode: '', quantity: '' }])} style={{ marginBottom: 16 }}>+ Add line</button>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !warehouseId}>{saving ? 'Saving…' : 'Create draft'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PicksPanel({ companyId, companies, warehouses, canManage }) {
  const [status, setStatus] = useState('');
  const { rows, error, reload } = useList('/inventory/pick-lists', companyId, '', status);
  const [showCreate, setShowCreate] = useState(false);
  const [open, setOpen] = useState(null);

  async function act(id, action) {
    try {
      await apiRequest(`/inventory/pick-lists/${id}/${action}`, { method: 'POST', body: action === 'pick' ? {} : undefined });
      reload();
    } catch (err) { alert(errText(err, 'Action failed.')); }
  }
  const nextAction = (s) => ({ pending: 'pick', picking: 'pick', picked: 'pack', packed: 'dispatch' }[s]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <select className="select" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['pending', 'picking', 'picked', 'packed', 'dispatched', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {canManage && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New pick list</button>}
      </div>
      {error && <div className="banner error">{error}</div>}
      {rows === null ? <div className="loading">Loading…</div> : rows.length === 0 ? <div className="empty">No pick lists.</div> : (
        <table>
          <thead><tr><th>Number</th><th>Warehouse</th><th>Order / ref</th><th>Assignee</th><th>Lines</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr>
                  <td className="mono">{r.pickNumber}</td>
                  <td className="mono">{r.warehouseCode}</td>
                  <td>{r.reference || (r.orderId ? 'order' : '—')}</td>
                  <td>{r.assignedToName || '—'}</td>
                  <td>{r.lines.length}</td>
                  <td><span className={`badge ${badge[r.status] || 'neutral'}`}><span className="dot" />{r.status}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide' : 'Lines'}</button>
                    {canManage && nextAction(r.status) && (
                      <>{' '}<button className="btn btn-secondary" onClick={() => act(r.id, nextAction(r.status))}>{nextAction(r.status)}</button></>
                    )}
                    {canManage && !['dispatched', 'cancelled'].includes(r.status) && (
                      <>{' '}<button className="btn-ghost" onClick={() => act(r.id, 'cancel')}>Cancel</button></>
                    )}
                  </td>
                </tr>
                {open === r.id && (
                  <tr><td colSpan={7} style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                    <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
                      {r.lines.map((l) => (
                        <li key={l.id}><span className="mono">{l.productCode}</span> {l.productName} — requested {l.quantityRequested}, picked {l.quantityPicked}</li>
                      ))}
                    </ul>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
      {showCreate && (
        <PickModal companyId={companyId} companies={companies} warehouses={warehouses}
          onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); reload(); }} />
      )}
    </div>
  );
}

function PickModal({ companyId, companies, warehouses, onClose, onDone }) {
  const [cid, setCid] = useState(companyId || companies[0]?.id || '');
  const whs = warehouses.filter((w) => w.companyId === cid);
  const [warehouseId, setWarehouseId] = useState(whs[0]?.id || '');
  const [orderId, setOrderId] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!warehouseId && whs[0]) setWarehouseId(whs[0].id); }, [whs, warehouseId]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/inventory/pick-lists', {
        method: 'POST',
        body: { companyId: cid, warehouseId, orderId: orderId.trim() || undefined, reference: reference.trim() || undefined },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to create pick list. Supply an order ID (its items become the lines).'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h2>New pick list</h2>
        <p style={{ marginTop: -4, color: '#5b6a85' }}>Enter an order ID — its items become the pick lines.</p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Company *</label>
              <select className="select" value={cid} onChange={(e) => setCid(e.target.value)}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Warehouse *</label>
              <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                <option value="">Select…</option>
                {whs.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Order ID</label>
            <input className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="orders.id (UUID)" />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !warehouseId}>{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CountsPanel({ companyId, companies, warehouses, canManage }) {
  const [status, setStatus] = useState('');
  const { rows, error, reload } = useList('/inventory/stock-counts', companyId, '', status);
  const [showCreate, setShowCreate] = useState(false);
  const [open, setOpen] = useState(null);

  async function act(id, action) {
    try {
      await apiRequest(`/inventory/stock-counts/${id}/${action}`, { method: 'POST' });
      reload();
    } catch (err) { alert(errText(err, 'Action failed.')); }
  }
  async function setCount(id, lineId, val) {
    try {
      await apiRequest(`/inventory/stock-counts/${id}/lines/${lineId}`, { method: 'PATCH', body: { countedQuantity: Number(val) } });
      reload();
    } catch (err) { alert(errText(err, 'Update failed.')); }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <select className="select" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['open', 'counting', 'reconciled', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {canManage && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New stock count</button>}
      </div>
      {error && <div className="banner error">{error}</div>}
      {rows === null ? <div className="loading">Loading…</div> : rows.length === 0 ? <div className="empty">No stock counts.</div> : (
        <table>
          <thead><tr><th>Number</th><th>Warehouse</th><th>Ref</th><th>Lines</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr>
                  <td className="mono">{r.countNumber}</td>
                  <td className="mono">{r.warehouseCode}</td>
                  <td>{r.reference || '—'}</td>
                  <td>{r.lines.length}</td>
                  <td><span className={`badge ${badge[r.status] || 'neutral'}`}><span className="dot" />{r.status}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide' : 'Lines'}</button>
                    {canManage && !['reconciled', 'cancelled'].includes(r.status) && (
                      <>
                        {' '}<button className="btn btn-secondary" onClick={() => act(r.id, 'reconcile')}>Reconcile</button>
                        {' '}<button className="btn-ghost" onClick={() => act(r.id, 'cancel')}>Cancel</button>
                      </>
                    )}
                  </td>
                </tr>
                {open === r.id && (
                  <tr><td colSpan={6} style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                    <table style={{ margin: '8px 0' }}>
                      <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>System</th><th style={{ textAlign: 'right' }}>Counted</th><th style={{ textAlign: 'right' }}>Variance</th></tr></thead>
                      <tbody>
                        {r.lines.map((l) => (
                          <tr key={l.id}>
                            <td><span className="mono">{l.productCode}</span> {l.productName}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>{l.systemQuantity}</td>
                            <td style={{ textAlign: 'right' }}>
                              {['reconciled', 'cancelled'].includes(r.status) || !canManage ? (l.countedQuantity ?? '—') : (
                                <input className="input" type="number" min="0" defaultValue={l.countedQuantity ?? ''} style={{ width: 90 }}
                                  onBlur={(e) => { if (e.target.value !== '' && Number(e.target.value) !== l.countedQuantity) setCount(r.id, l.id, e.target.value); }} />
                              )}
                            </td>
                            <td className="mono" style={{ textAlign: 'right', color: l.variance < 0 ? 'var(--error)' : l.variance > 0 ? 'var(--warning)' : undefined }}>
                              {l.variance === null || l.variance === undefined ? '—' : (l.variance > 0 ? `+${l.variance}` : l.variance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
      {showCreate && (
        <CountModal companyId={companyId} companies={companies} warehouses={warehouses}
          onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); reload(); }} />
      )}
    </div>
  );
}

function CountModal({ companyId, companies, warehouses, onClose, onDone }) {
  const [cid, setCid] = useState(companyId || companies[0]?.id || '');
  const whs = warehouses.filter((w) => w.companyId === cid);
  const [warehouseId, setWarehouseId] = useState(whs[0]?.id || '');
  const [reference, setReference] = useState('');
  const [scope, setScope] = useState('full');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!warehouseId && whs[0]) setWarehouseId(whs[0].id); }, [whs, warehouseId]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/inventory/stock-counts', {
        method: 'POST',
        body: { companyId: cid, warehouseId, reference: reference.trim() || undefined, scope },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to create stock count.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h2>New stock count</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Company *</label>
              <select className="select" value={cid} onChange={(e) => setCid(e.target.value)}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Warehouse *</label>
              <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                <option value="">Select…</option>
                {whs.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Scope</label>
            <select className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="full">Full — snapshot every product with a balance here</option>
              <option value="partial">Partial — add lines after</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Cycle count — Aisle A" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !warehouseId}>{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
