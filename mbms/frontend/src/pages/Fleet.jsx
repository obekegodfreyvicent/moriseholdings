import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Fleet & Vehicle Management (2 September 2026): vehicle register, driver
// assignment, fuel / odometer logs, service schedules & records, statutory
// renewals, accident records, a rolled-up vehicle-expense log, and five
// fleet reports.

function errText(err, fallback) {
  return err instanceof ApiRequestError ? err.apiError.message : fallback;
}
const STATUS_BADGE = { active: 'success', in_service: 'warning', off_road: 'neutral', sold: 'neutral', written_off: 'error' };
const FUEL_TYPES = ['diesel', 'petrol', 'electric', 'hybrid', 'lpg', 'cng'];
const OWNERSHIP = ['owned', 'leased', 'financed', 'hired'];
const RENEWAL_TYPES = ['road_licence', 'inspection_certificate', 'psv_permit', 'insurance', 'road_worthiness', 'other'];
const SEVERITY = ['minor', 'moderate', 'major', 'total_loss'];
const EXPENSE_CATEGORIES = ['fuel', 'service', 'repair', 'licence', 'insurance', 'tyres', 'toll', 'fine', 'parking', 'other'];
const REPORTS = [
  ['fleet-register', 'Fleet register'],
  ['fuel-consumption', 'Fuel consumption'],
  ['expenses', 'Vehicle expenses'],
  ['renewals-due', 'Renewals due'],
  ['service-due', 'Service due'],
];

export function FleetPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('fleet.manage');

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [tab, setTab] = useState('vehicles');
  const [vehicles, setVehicles] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    apiRequestWithMeta('/organization/companies', { pageSize: 100 })
      .then(({ items }) => setCompanies(items))
      .catch(() => setCompanies([]));
  }, []);

  async function load() {
    setError(null);
    try {
      const query = {};
      if (companyId) query.companyId = companyId;
      setVehicles(await apiRequest('/fleet/vehicles', { query }));
    } catch (err) {
      setVehicles([]);
      setError(errText(err, 'Unable to load vehicles.'));
    }
  }
  useEffect(() => {
    if (tab === 'vehicles') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companyId]);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Admin / Backend</div>
          <h1>Fleet</h1>
        </div>
        {canManage && tab === 'vehicles' && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Register vehicle</button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 240 }}>
          <label>Company</label>
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies in my scope</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="tabs" style={{ display: 'flex', gap: 6 }}>
          {[['vehicles', 'Vehicles'], ['reports', 'Reports']].map(([k, label]) => (
            <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {tab === 'vehicles' && (
        <div className="card">
          {vehicles === null ? <div className="loading">Loading…</div> : vehicles.length === 0 ? (
            <div className="empty">No vehicles registered.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Reg. no.</th><th>Vehicle</th><th>Ownership</th><th>Driver</th><th className="num">Odometer</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{v.registrationNumber}</td>
                    <td className="rowlink"><button className="linkbtn" onClick={() => setDetailId(v.id)}>{v.make} {v.model}{v.year ? ` (${v.year})` : ''}</button></td>
                    <td>{v.ownershipType}{v.ownerName ? ` — ${v.ownerName}` : ''}</td>
                    <td>{v.activeDriverName || '—'}</td>
                    <td className="num mono">{v.currentOdometer.toLocaleString()} {v.odometerUnit}</td>
                    <td><span className={`badge ${STATUS_BADGE[v.status] || 'neutral'}`}><span className="dot" />{v.status}</span></td>
                    <td style={{ textAlign: 'right' }}><button className="btn-ghost" onClick={() => setDetailId(v.id)}>Manage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'reports' && <FleetReports companyId={companyId} />}

      {showCreate && (
        <CreateVehicleModal companies={companies} defaultCompanyId={companyId}
          onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />
      )}
      {detailId && (
        <VehicleDetailModal vehicleId={detailId} canManage={canManage}
          onClose={() => setDetailId(null)} onChanged={load} />
      )}
    </Layout>
  );
}

function CreateVehicleModal({ companies, defaultCompanyId, onClose, onDone }) {
  const [f, setF] = useState({
    companyId: defaultCompanyId || companies[0]?.id || '', registrationNumber: '', make: '', model: '',
    year: '', fuelType: 'diesel', ownershipType: 'owned', ownerName: '', currentOdometer: '', assetId: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/fleet/vehicles', {
        method: 'POST',
        body: {
          companyId: f.companyId, registrationNumber: f.registrationNumber, make: f.make, model: f.model,
          year: f.year ? Number(f.year) : undefined,
          fuelType: f.fuelType, ownershipType: f.ownershipType,
          ownerName: f.ownerName || undefined,
          currentOdometer: f.currentOdometer ? Number(f.currentOdometer) : undefined,
          assetId: f.assetId || undefined,
        },
      });
      onDone();
    } catch (err) {
      setError(errText(err, 'Unable to register vehicle.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 560, maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2>Register vehicle</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Company *</label>
            <select className="select" value={f.companyId} onChange={set('companyId')} required>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field"><label>Registration no. *</label><input className="input" value={f.registrationNumber} onChange={set('registrationNumber')} required placeholder="e.g. UAX 123A" /></div>
            <div className="field"><label>Make *</label><input className="input" value={f.make} onChange={set('make')} required /></div>
            <div className="field"><label>Model *</label><input className="input" value={f.model} onChange={set('model')} required /></div>
            <div className="field"><label>Year</label><input className="input" type="number" value={f.year} onChange={set('year')} /></div>
            <div className="field"><label>Fuel</label>
              <select className="select" value={f.fuelType} onChange={set('fuelType')}>{FUEL_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="field"><label>Ownership</label>
              <select className="select" value={f.ownershipType} onChange={set('ownershipType')}>{OWNERSHIP.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="field"><label>Owner (lessor / financier)</label><input className="input" value={f.ownerName} onChange={set('ownerName')} placeholder="if not owned" /></div>
            <div className="field"><label>Current odometer</label><input className="input" type="number" min="0" value={f.currentOdometer} onChange={set('currentOdometer')} /></div>
            <div className="field"><label>Linked asset ID</label><input className="input" value={f.assetId} onChange={set('assetId')} placeholder="uuid (optional)" /></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !f.companyId}>{saving ? 'Saving…' : 'Register'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const SUBTABS = [
  ['summary', 'Summary'],
  ['drivers', 'Drivers'],
  ['fuel', 'Fuel'],
  ['odometer', 'Odometer'],
  ['service', 'Service'],
  ['renewals', 'Renewals'],
  ['accidents', 'Accidents'],
  ['expenses', 'Expenses'],
];

function VehicleDetailModal({ vehicleId, canManage, onClose, onChanged }) {
  const [sub, setSub] = useState('summary');
  const [vehicle, setVehicle] = useState(null);
  const [data, setData] = useState({});
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // {kind}

  async function loadVehicle() {
    try { setVehicle(await apiRequest(`/fleet/vehicles/${vehicleId}`)); } catch { /* ignore */ }
  }
  async function loadSub(k) {
    setError(null);
    const path = {
      summary: 'summary', drivers: 'assignments', fuel: 'fuel', odometer: 'odometer',
      renewals: 'renewals', accidents: 'accidents', expenses: 'expenses',
    }[k];
    try {
      if (k === 'service') {
        const [schedules, records] = await Promise.all([
          apiRequest(`/fleet/vehicles/${vehicleId}/service-schedules`),
          apiRequest(`/fleet/vehicles/${vehicleId}/service-records`),
        ]);
        setData((d) => ({ ...d, service: { schedules, records } }));
      } else {
        const res = await apiRequest(`/fleet/vehicles/${vehicleId}/${path}`);
        setData((d) => ({ ...d, [k]: res }));
      }
    } catch (err) {
      setError(errText(err, 'Unable to load.'));
    }
  }

  useEffect(() => {
    loadVehicle();
    apiRequestWithMeta('/employees', { pageSize: 200 }).then(({ items }) => setEmployees(items)).catch(() => setEmployees([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);
  useEffect(() => {
    loadSub(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, vehicleId]);

  function refresh() {
    loadVehicle();
    loadSub(sub);
    if (sub !== 'summary') loadSub('summary');
    onChanged && onChanged();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 780, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 2 }}>
          <span className="mono">{vehicle?.registrationNumber || '…'}</span>{vehicle ? ` — ${vehicle.make} ${vehicle.model}` : ''}
        </h2>
        {vehicle && (
          <p style={{ marginTop: 0, color: '#5b6a85' }}>
            {vehicle.ownershipType}{vehicle.ownerName ? ` (${vehicle.ownerName})` : ''} · {vehicle.currentOdometer.toLocaleString()} {vehicle.odometerUnit}
            {vehicle.assetNumber ? ` · asset ${vehicle.assetNumber}` : ''}
            {vehicle.lastLocationText ? ` · last seen: ${vehicle.lastLocationText}` : ''}
          </p>
        )}
        {error && <div className="banner error">{error}</div>}

        <div className="tabs" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0 14px' }}>
          {SUBTABS.map(([k, label]) => (
            <button key={k} className={`btn ${sub === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSub(k)}>{label}</button>
          ))}
        </div>

        {canManage && sub !== 'summary' && (
          <button className="btn btn-primary btn-sm" style={{ marginBottom: 12 }} onClick={() => setModal({ kind: sub })}>
            + {({ drivers: 'Assign driver', fuel: 'Log fuel', odometer: 'Log odometer', service: 'Add schedule / record', renewals: 'Add renewal', accidents: 'Add accident', expenses: 'Add expense' })[sub]}
          </button>
        )}

        <SubView sub={sub} data={data} canManage={canManage} onAction={refresh} />

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      {modal && (
        <ActionModal
          kind={modal.kind} vehicleId={vehicleId} employees={employees}
          schedules={data.service?.schedules || []}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); refresh(); }}
        />
      )}
    </div>
  );
}

function SubView({ sub, data, canManage, onAction }) {
  if (sub === 'summary') {
    const s = data.summary;
    if (!s) return <div className="loading">Loading…</div>;
    return (
      <div className="formgrid">
        <div className="field"><label>Active driver</label><div>{s.activeDriver ? `${s.activeDriver.driverName} (since ${String(s.activeDriver.since).slice(0, 10)})` : '—'}</div></div>
        <div className="field"><label>Odometer</label><div>{s.currentOdometer.toLocaleString()} {s.odometerUnit}</div></div>
        <div className="field"><label>Next renewal</label><div>{s.nextRenewal ? `${s.nextRenewal.renewalType} — ${String(s.nextRenewal.expiryDate).slice(0, 10)}${s.nextRenewal.expired ? ' (EXPIRED)' : ''}` : '—'}</div></div>
        <div className="field"><label>Services due</label><div>{s.servicesDue.length ? s.servicesDue.map((x) => x.name).join(', ') : 'none'}</div></div>
        <div className="field"><label>YTD expense</label><div><Money value={s.ytdExpense.total} /> <span className="muted" style={{ fontSize: 12 }}>({Object.entries(s.ytdExpense.byCategory).map(([k, v]) => `${k} ${Number(v).toLocaleString()}`).join(', ') || '—'})</span></div></div>
        <div className="field"><label>Fuel economy</label><div>{s.fuelEconomy.litresPer100Km != null ? `${s.fuelEconomy.litresPer100Km} L/100km · ${s.fuelEconomy.kmPerLitre} km/L · cost/km ${s.fuelEconomy.costPerKm}` : `not enough full-to-full fills (${s.fuelEconomy.segments} segments)`}</div></div>
      </div>
    );
  }
  if (sub === 'drivers') {
    const rows = data.drivers;
    if (!rows) return <div className="loading">Loading…</div>;
    return rows.length === 0 ? <div className="empty">No driver assignments.</div> : (
      <table><thead><tr><th>Driver</th><th>From</th><th>To</th><th>Status</th></tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id}><td>{a.driverName || a.driverEmployeeId}</td><td className="mono">{String(a.startDate).slice(0, 10)}</td><td className="mono">{a.endDate ? String(a.endDate).slice(0, 10) : '—'}</td><td><span className={`badge ${a.status === 'active' ? 'success' : 'neutral'}`}><span className="dot" />{a.status}</span></td></tr>)}</tbody>
      </table>
    );
  }
  if (sub === 'fuel') {
    const rows = data.fuel;
    if (!rows) return <div className="loading">Loading…</div>;
    return rows.length === 0 ? <div className="empty">No fuel logs.</div> : (
      <table><thead><tr><th>Date</th><th>Station</th><th className="num">Litres</th><th className="num">Cost</th><th className="num">Odometer</th><th>Full?</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td className="mono">{String(r.logDate).slice(0, 10)}</td><td>{r.fuelStation || '—'}</td><td className="num">{r.litres}</td><td className="num"><Money value={r.cost} /></td><td className="num mono">{r.odometer != null ? r.odometer.toLocaleString() : '—'}</td><td>{r.filledToFull ? 'yes' : 'no'}</td></tr>)}</tbody>
      </table>
    );
  }
  if (sub === 'odometer') {
    const rows = data.odometer;
    if (!rows) return <div className="loading">Loading…</div>;
    return rows.length === 0 ? <div className="empty">No odometer readings.</div> : (
      <table><thead><tr><th>Date</th><th className="num">Odometer</th><th>Source</th><th>Note</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td className="mono">{String(r.readingDate).slice(0, 10)}</td><td className="num mono">{r.odometer.toLocaleString()}</td><td>{r.source}</td><td>{r.note || '—'}</td></tr>)}</tbody>
      </table>
    );
  }
  if (sub === 'service') {
    const s = data.service;
    if (!s) return <div className="loading">Loading…</div>;
    return (
      <>
        <h4 style={{ margin: '4px 0' }}>Schedules</h4>
        {s.schedules.length === 0 ? <p className="muted">None.</p> : (
          <table><thead><tr><th>Name</th><th className="num">Every</th><th className="num">Next due (odo)</th><th>Next due (date)</th><th>State</th></tr></thead>
            <tbody>{s.schedules.map((x) => <tr key={x.id}><td>{x.name}</td><td className="num">{[x.intervalKm ? `${x.intervalKm} km` : null, x.intervalDays ? `${x.intervalDays} d` : null].filter(Boolean).join(' / ')}</td><td className="num mono">{x.nextDueOdometer ?? '—'}</td><td className="mono">{x.nextDueDate ? String(x.nextDueDate).slice(0, 10) : '—'}</td><td><span className={`badge ${x.dueState === 'due' ? 'warning' : x.dueState === 'inactive' ? 'neutral' : 'success'}`}><span className="dot" />{x.dueState}</span></td></tr>)}</tbody>
          </table>
        )}
        <h4 style={{ margin: '14px 0 4px' }}>Records</h4>
        {s.records.length === 0 ? <p className="muted">None.</p> : (
          <table><thead><tr><th>Date</th><th>Kind</th><th>Description</th><th className="num">Odometer</th><th className="num">Cost</th><th>Provider</th></tr></thead>
            <tbody>{s.records.map((r) => <tr key={r.id}><td className="mono">{String(r.serviceDate).slice(0, 10)}</td><td>{r.kind}</td><td>{r.description}</td><td className="num mono">{r.odometer != null ? r.odometer.toLocaleString() : '—'}</td><td className="num">{r.cost != null ? <Money value={r.cost} /> : '—'}</td><td>{r.provider || '—'}</td></tr>)}</tbody>
          </table>
        )}
      </>
    );
  }
  if (sub === 'renewals') {
    const rows = data.renewals;
    if (!rows) return <div className="loading">Loading…</div>;
    return rows.length === 0 ? <div className="empty">No renewals.</div> : (
      <table><thead><tr><th>Type</th><th>Reference</th><th>Expiry</th><th className="num">Cost</th><th>State</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{r.renewalType}</td><td className="mono">{r.reference || '—'}</td><td className="mono">{String(r.expiryDate).slice(0, 10)}</td><td className="num">{r.cost != null ? <Money value={r.cost} /> : '—'}</td><td><span className={`badge ${r.expired ? 'error' : 'success'}`}><span className="dot" />{r.expired ? 'expired' : 'valid'}</span></td></tr>)}</tbody>
      </table>
    );
  }
  if (sub === 'accidents') {
    const rows = data.accidents;
    if (!rows) return <div className="loading">Loading…</div>;
    return rows.length === 0 ? <div className="empty">No accident records.</div> : (
      <table><thead><tr><th>Date</th><th>Severity</th><th>Description</th><th className="num">Est. cost</th><th>Third party</th><th>Resolved</th>{canManage && <th />}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td className="mono">{String(r.accidentDate).slice(0, 10)}</td>
            <td><span className={`badge ${r.severity === 'minor' ? 'neutral' : r.severity === 'total_loss' ? 'error' : 'warning'}`}><span className="dot" />{r.severity}</span></td>
            <td>{r.description}</td>
            <td className="num">{r.estimatedCost != null ? <Money value={r.estimatedCost} /> : '—'}</td>
            <td>{r.thirdPartyInvolved ? 'yes' : 'no'}</td>
            <td>{r.resolved ? 'yes' : 'no'}</td>
            {canManage && <td style={{ textAlign: 'right' }}>{!r.resolved && (
              <button className="btn-ghost" onClick={async () => { try { await apiRequest(`/fleet/accidents/${r.id}`, { method: 'PATCH', body: { resolved: true } }); onAction(); } catch (err) { alert(errText(err, 'Failed.')); } }}>Resolve</button>
            )}</td>}
          </tr>
        ))}</tbody>
      </table>
    );
  }
  if (sub === 'expenses') {
    const rows = data.expenses;
    if (!rows) return <div className="loading">Loading…</div>;
    return rows.length === 0 ? <div className="empty">No vehicle expenses.</div> : (
      <table><thead><tr><th>Date</th><th>Category</th><th className="num">Amount</th><th>Reference</th><th>Source</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td className="mono">{String(r.expenseDate).slice(0, 10)}</td><td>{r.category}</td><td className="num"><Money value={r.amount} /></td><td>{r.reference || '—'}</td><td className="muted">{r.sourceType || 'manual'}</td></tr>)}</tbody>
      </table>
    );
  }
  return null;
}

function ActionModal({ kind, vehicleId, employees, schedules, onClose, onDone }) {
  const [f, setF] = useState({
    driverEmployeeId: '', startDate: new Date().toISOString().slice(0, 10),
    readingDate: new Date().toISOString().slice(0, 10), odometer: '',
    logDate: new Date().toISOString().slice(0, 10), litres: '', cost: '', fuelStation: '', filledToFull: true,
    svcMode: 'record', name: '', intervalKm: '', intervalDays: '',
    serviceDate: new Date().toISOString().slice(0, 10), scheduleId: '', svcKind: 'service', description: '', provider: '',
    renewalType: 'road_licence', reference: '', expiryDate: '', renewalCost: '',
    accidentDate: new Date().toISOString().slice(0, 10), severity: 'minor', accidentDesc: '', thirdParty: false, estimatedCost: '',
    expenseDate: new Date().toISOString().slice(0, 10), category: 'fuel', amount: '', expRef: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const base = `/fleet/vehicles/${vehicleId}`;
      if (kind === 'drivers') {
        await apiRequest(`${base}/assignments`, { method: 'POST', body: { driverEmployeeId: f.driverEmployeeId, startDate: f.startDate } });
      } else if (kind === 'odometer') {
        await apiRequest(`${base}/odometer`, { method: 'POST', body: { readingDate: f.readingDate, odometer: Number(f.odometer) } });
      } else if (kind === 'fuel') {
        await apiRequest(`${base}/fuel`, { method: 'POST', body: { logDate: f.logDate, litres: Number(f.litres), cost: Number(f.cost), odometer: f.odometer ? Number(f.odometer) : undefined, fuelStation: f.fuelStation || undefined, filledToFull: f.filledToFull } });
      } else if (kind === 'service') {
        if (f.svcMode === 'schedule') {
          await apiRequest(`${base}/service-schedules`, { method: 'POST', body: { name: f.name, intervalKm: f.intervalKm ? Number(f.intervalKm) : undefined, intervalDays: f.intervalDays ? Number(f.intervalDays) : undefined } });
        } else {
          await apiRequest(`${base}/service-records`, { method: 'POST', body: { serviceDate: f.serviceDate, scheduleId: f.scheduleId || undefined, kind: f.svcKind, description: f.description, odometer: f.odometer ? Number(f.odometer) : undefined, cost: f.cost ? Number(f.cost) : undefined, provider: f.provider || undefined } });
        }
      } else if (kind === 'renewals') {
        await apiRequest(`${base}/renewals`, { method: 'POST', body: { renewalType: f.renewalType, reference: f.reference || undefined, expiryDate: f.expiryDate, cost: f.renewalCost ? Number(f.renewalCost) : undefined } });
      } else if (kind === 'accidents') {
        await apiRequest(`${base}/accidents`, { method: 'POST', body: { accidentDate: f.accidentDate, severity: f.severity, description: f.accidentDesc, thirdPartyInvolved: f.thirdParty, estimatedCost: f.estimatedCost ? Number(f.estimatedCost) : undefined } });
      } else if (kind === 'expenses') {
        await apiRequest(`${base}/expenses`, { method: 'POST', body: { expenseDate: f.expenseDate, category: f.category, amount: Number(f.amount), reference: f.expRef || undefined } });
      }
      onDone();
    } catch (err) {
      setError(errText(err, 'Action failed.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 500, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2>{({ drivers: 'Assign driver', odometer: 'Log odometer', fuel: 'Log fuel', service: 'Service', renewals: 'Add renewal', accidents: 'Add accident record', expenses: 'Add vehicle expense' })[kind]}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          {kind === 'drivers' && (
            <>
              <div className="field" style={{ marginBottom: 12 }}><label>Driver *</label>
                <select className="select" value={f.driverEmployeeId} onChange={set('driverEmployeeId')} required>
                  <option value="">Select…</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.jobTitle ? ` — ${e.jobTitle}` : ''}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 16 }}><label>From *</label><input className="input" type="date" value={f.startDate} onChange={set('startDate')} required /></div>
            </>
          )}
          {kind === 'odometer' && (
            <>
              <div className="field" style={{ marginBottom: 12 }}><label>Date *</label><input className="input" type="date" value={f.readingDate} onChange={set('readingDate')} required /></div>
              <div className="field" style={{ marginBottom: 16 }}><label>Odometer *</label><input className="input" type="number" min="0" value={f.odometer} onChange={set('odometer')} required /></div>
            </>
          )}
          {kind === 'fuel' && (
            <>
              <div className="formgrid" style={{ marginBottom: 12 }}>
                <div className="field"><label>Date *</label><input className="input" type="date" value={f.logDate} onChange={set('logDate')} required /></div>
                <div className="field"><label>Litres *</label><input className="input" type="number" step="0.01" min="0.01" value={f.litres} onChange={set('litres')} required /></div>
                <div className="field"><label>Cost *</label><input className="input" type="number" min="1" value={f.cost} onChange={set('cost')} required /></div>
                <div className="field"><label>Odometer</label><input className="input" type="number" min="0" value={f.odometer} onChange={set('odometer')} /></div>
                <div className="field"><label>Station</label><input className="input" value={f.fuelStation} onChange={set('fuelStation')} /></div>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}><input type="checkbox" checked={f.filledToFull} onChange={set('filledToFull')} /> Filled to full</label>
            </>
          )}
          {kind === 'service' && (
            <>
              <div className="field" style={{ marginBottom: 12 }}><label>What</label>
                <select className="select" value={f.svcMode} onChange={set('svcMode')}>
                  <option value="record">Record a service / repair</option>
                  <option value="schedule">Create a service schedule</option>
                </select>
              </div>
              {f.svcMode === 'schedule' ? (
                <div className="formgrid" style={{ marginBottom: 16 }}>
                  <div className="field"><label>Name *</label><input className="input" value={f.name} onChange={set('name')} required placeholder="e.g. 10,000 km service" /></div>
                  <div className="field"><label>Every (km)</label><input className="input" type="number" min="1" value={f.intervalKm} onChange={set('intervalKm')} /></div>
                  <div className="field"><label>Every (days)</label><input className="input" type="number" min="1" value={f.intervalDays} onChange={set('intervalDays')} /></div>
                </div>
              ) : (
                <div className="formgrid" style={{ marginBottom: 16 }}>
                  <div className="field"><label>Date *</label><input className="input" type="date" value={f.serviceDate} onChange={set('serviceDate')} required /></div>
                  <div className="field"><label>Kind</label>
                    <select className="select" value={f.svcKind} onChange={set('svcKind')}><option value="service">service</option><option value="repair">repair</option></select>
                  </div>
                  <div className="field"><label>Schedule</label>
                    <select className="select" value={f.scheduleId} onChange={set('scheduleId')}>
                      <option value="">— none —</option>
                      {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Odometer</label><input className="input" type="number" min="0" value={f.odometer} onChange={set('odometer')} /></div>
                  <div className="field"><label>Cost</label><input className="input" type="number" min="0" value={f.cost} onChange={set('cost')} /></div>
                  <div className="field"><label>Provider</label><input className="input" value={f.provider} onChange={set('provider')} /></div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description *</label><input className="input" value={f.description} onChange={set('description')} required /></div>
                </div>
              )}
            </>
          )}
          {kind === 'renewals' && (
            <div className="formgrid" style={{ marginBottom: 16 }}>
              <div className="field"><label>Type *</label>
                <select className="select" value={f.renewalType} onChange={set('renewalType')}>{RENEWAL_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
              <div className="field"><label>Reference</label><input className="input" value={f.reference} onChange={set('reference')} /></div>
              <div className="field"><label>Expiry *</label><input className="input" type="date" value={f.expiryDate} onChange={set('expiryDate')} required /></div>
              <div className="field"><label>Cost</label><input className="input" type="number" min="0" value={f.renewalCost} onChange={set('renewalCost')} /></div>
            </div>
          )}
          {kind === 'accidents' && (
            <div className="formgrid" style={{ marginBottom: 16 }}>
              <div className="field"><label>Date *</label><input className="input" type="date" value={f.accidentDate} onChange={set('accidentDate')} required /></div>
              <div className="field"><label>Severity *</label>
                <select className="select" value={f.severity} onChange={set('severity')}>{SEVERITY.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
              <div className="field"><label>Est. cost</label><input className="input" type="number" min="0" value={f.estimatedCost} onChange={set('estimatedCost')} /></div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={f.thirdParty} onChange={set('thirdParty')} /> Third party involved</label>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description *</label><textarea className="input" rows={2} value={f.accidentDesc} onChange={set('accidentDesc')} required /></div>
            </div>
          )}
          {kind === 'expenses' && (
            <div className="formgrid" style={{ marginBottom: 16 }}>
              <div className="field"><label>Date *</label><input className="input" type="date" value={f.expenseDate} onChange={set('expenseDate')} required /></div>
              <div className="field"><label>Category *</label>
                <select className="select" value={f.category} onChange={set('category')}>{EXPENSE_CATEGORIES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
              <div className="field"><label>Amount *</label><input className="input" type="number" min="1" value={f.amount} onChange={set('amount')} required /></div>
              <div className="field"><label>Reference</label><input className="input" value={f.expRef} onChange={set('expRef')} /></div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FleetReports({ companyId }) {
  const [report, setReport] = useState('fleet-register');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [days, setDays] = useState('30');
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
      if (['fuel-consumption', 'expenses'].includes(report)) { if (from) query.from = from; if (to) query.to = to; }
      if (report === 'renewals-due') query.days = days;
      setData(await apiRequest(`/fleet/reports/${report}`, { query }));
    } catch (err) {
      setError(errText(err, 'Unable to run report.'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, companyId]);

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label>Report</label>
          <select className="select" value={report} onChange={(e) => setReport(e.target.value)}>
            {REPORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        {['fuel-consumption', 'expenses'].includes(report) && (
          <>
            <div className="field" style={{ margin: 0 }}><label>From</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label>To</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </>
        )}
        {report === 'renewals-due' && (
          <div className="field" style={{ margin: 0, maxWidth: 110 }}><label>Window (days)</label><input className="input" type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} onBlur={run} /></div>
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
  if (report === 'fleet-register') {
    return (
      <table><thead><tr><th>Reg. no.</th><th>Vehicle</th><th>Fuel</th><th>Ownership</th><th className="num">Odometer</th><th>Status</th></tr></thead>
        <tbody>{data.map((v) => <tr key={v.vehicleId}><td className="mono">{v.registrationNumber}</td><td>{v.make} {v.model}{v.year ? ` (${v.year})` : ''}</td><td>{v.fuelType}</td><td>{v.ownershipType}</td><td className="num mono">{v.currentOdometer.toLocaleString()}</td><td>{v.status}</td></tr>)}</tbody>
      </table>
    );
  }
  if (report === 'fuel-consumption') {
    return (
      <>
        <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 14 }}>
          <div className="kpi"><div className="label">Total litres</div><div className="value">{Number(data.totals.litres).toLocaleString()}</div></div>
          <div className="kpi"><div className="label">Total fuel cost</div><div className="value"><Money value={data.totals.cost} /></div></div>
        </div>
        {data.lines.length === 0 ? <div className="empty">No fuel logs in range.</div> : (
          <table><thead><tr><th>Reg. no.</th><th className="num">Fills</th><th className="num">Litres</th><th className="num">Cost</th><th className="num">Distance</th><th className="num">L/100km</th><th className="num">Cost/km</th></tr></thead>
            <tbody>{data.lines.map((l) => <tr key={l.vehicleId}><td className="mono">{l.registrationNumber}</td><td className="num">{l.fills}</td><td className="num">{l.litres}</td><td className="num"><Money value={l.cost} /></td><td className="num mono">{l.distance.toLocaleString()}</td><td className="num">{l.litresPer100Km ?? '—'}</td><td className="num">{l.costPerKm ?? '—'}</td></tr>)}</tbody>
          </table>
        )}
      </>
    );
  }
  if (report === 'expenses') {
    return (
      <>
        <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 14 }}>
          <div className="kpi"><div className="label">Total</div><div className="value"><Money value={data.totals.total} /></div></div>
          <div className="kpi"><div className="label">By category</div><div className="value" style={{ fontSize: 13 }}>{Object.entries(data.totals.byCategory).map(([k, v]) => `${k} ${Number(v).toLocaleString()}`).join(' · ') || '—'}</div></div>
        </div>
        {data.lines.length === 0 ? <div className="empty">No expenses in range.</div> : (
          <table><thead><tr><th>Reg. no.</th><th className="num">Total</th><th>By category</th><th className="num">Cost/km</th></tr></thead>
            <tbody>{data.lines.map((l) => <tr key={l.vehicleId}><td className="mono">{l.registrationNumber}</td><td className="num"><Money value={l.total} /></td><td style={{ fontSize: 12 }}>{Object.entries(l.byCategory).map(([k, v]) => `${k}: ${Number(v).toLocaleString()}`).join(' · ')}</td><td className="num">{l.costPerKm ?? '—'}</td></tr>)}</tbody>
          </table>
        )}
      </>
    );
  }
  if (report === 'renewals-due') {
    return data.renewals.length === 0 ? <div className="empty">Nothing due within {data.windowDays} days.</div> : (
      <table><thead><tr><th>Reg. no.</th><th>Type</th><th>Reference</th><th>Expiry</th><th>State</th></tr></thead>
        <tbody>{data.renewals.map((r) => <tr key={r.id}><td className="mono">{r.registrationNumber}</td><td>{r.renewalType}</td><td className="mono">{r.reference || '—'}</td><td className="mono">{String(r.expiryDate).slice(0, 10)}</td><td><span className={`badge ${r.expired ? 'error' : 'warning'}`}><span className="dot" />{r.expired ? 'expired' : 'due'}</span></td></tr>)}</tbody>
      </table>
    );
  }
  if (report === 'service-due') {
    return data.due.length === 0 ? <div className="empty">No services due.</div> : (
      <table><thead><tr><th>Reg. no.</th><th>Schedule</th><th className="num">Current odo</th><th className="num">Next due (odo)</th><th>Next due (date)</th></tr></thead>
        <tbody>{data.due.map((s) => <tr key={s.id}><td className="mono">{s.registrationNumber}</td><td>{s.name}</td><td className="num mono">{s.currentOdometer.toLocaleString()}</td><td className="num mono">{s.nextDueOdometer ?? '—'}</td><td className="mono">{s.nextDueDate ? String(s.nextDueDate).slice(0, 10) : '—'}</td></tr>)}</tbody>
      </table>
    );
  }
  return null;
}
