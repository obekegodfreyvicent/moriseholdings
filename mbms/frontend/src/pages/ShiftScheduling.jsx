import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Admin » Shift Scheduling (28 August 2026). Build a roster (assign employees
// to shift templates per day), publish a date range in one step (which
// notifies affected employees), and see per-day coverage with clash flags.
// Roster writes reuse `attendance.manage`.

function iso(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function mondayOf(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function ShiftSchedulingPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('attendance.manage');

  const [companies, setCompanies] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [entries, setEntries] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [addCell, setAddCell] = useState(null); // { employeeId, date }
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = iso(days[0]);
  const to = iso(days[6]);

  useEffect(() => {
    Promise.all([
      apiRequestWithMeta('/organization/companies', { pageSize: 100 }).then((r) => r.items).catch(() => []),
      apiRequestWithMeta('/employees', { pageSize: 100 }).then((r) => r.items).catch(() => []),
      apiRequest('/attendance/shifts').catch(() => []),
    ]).then(([c, e, s]) => {
      setCompanies(c);
      setEmployees(e);
      setShifts(s);
    });
  }, []);

  async function load() {
    setError(null);
    const q = { from, to };
    if (companyId) q.companyId = companyId;
    try {
      const [ent, cov] = await Promise.all([
        apiRequest('/shift-scheduling/entries', { query: q }),
        apiRequest('/shift-scheduling/coverage', { query: q }),
      ]);
      setEntries(ent);
      setCoverage(cov);
    } catch (err) {
      setEntries([]);
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load the roster.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, from, to]);

  const shownEmployees = useMemo(
    () => employees.filter((e) => (companyId ? e.companyId === companyId : true) && (e.status ?? 'active') === 'active'),
    [employees, companyId],
  );
  const entryFor = (employeeId, date) =>
    (entries || []).find((x) => x.employeeId === employeeId && x.date.slice(0, 10) === iso(date));

  async function addEntry(shiftId) {
    if (!addCell) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/shift-scheduling/entries', {
        method: 'POST',
        body: { companyId: addCell.companyId, employeeId: addCell.employeeId, shiftId, date: iso(addCell.date) },
      });
      setAddCell(null);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Could not add the assignment.');
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id) {
    try {
      await apiRequest(`/shift-scheduling/entries/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Could not remove the assignment.');
    }
  }

  async function publish() {
    if (!companyId) {
      setError('Pick a company before publishing.');
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await apiRequest('/shift-scheduling/publish', { method: 'POST', body: { companyId, from, to } });
      setMsg(`Published ${r.published} assignment(s); ${r.employeesNotified} employee(s) notified.`);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Publish failed.');
    } finally {
      setBusy(false);
    }
  }

  const covByDay = useMemo(() => {
    const m = new Map();
    (coverage?.days || []).forEach((d) => m.set(d.date, d));
    return m;
  }, [coverage]);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Human Resources</div>
          <h1>Shift Scheduling</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" disabled={!companyId || busy} onClick={publish}>Publish this week</button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 240 }}>
          <label>Company</label>
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies in my scope</option>
            {(companies || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Prev</button>
          <strong style={{ fontSize: 13 }}>{from} – {to}</strong>
          <button className="btn btn-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next →</button>
          <button className="btn btn-secondary" onClick={() => setWeekStart(mondayOf(new Date()))}>This week</button>
        </div>
        {coverage && (
          <span style={{ fontSize: 13, color: coverage.totalClashes ? 'var(--error)' : '#7c8aa3' }}>
            {coverage.totalEntries} assignments · {coverage.totalClashes} clash{coverage.totalClashes === 1 ? '' : 'es'}
          </span>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}
      {msg && <div className="banner info">{msg}</div>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {entries === null ? (
          <div className="loading">Loading…</div>
        ) : shownEmployees.length === 0 ? (
          <div className="empty">No active employees{companyId ? ' in this company' : ''}.</div>
        ) : (
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Employee</th>
                {days.map((d) => (
                  <th key={iso(d)} style={{ textAlign: 'center' }}>
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}<br />
                    <span style={{ fontWeight: 400, fontSize: 11 }}>{d.getDate()}/{d.getMonth() + 1}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{emp.firstName} {emp.lastName}</td>
                  {days.map((d) => {
                    const e = entryFor(emp.id, d);
                    return (
                      <td key={iso(d)} style={{ textAlign: 'center' }}>
                        {e ? (
                          <span
                            className={`badge ${e.status === 'published' ? 'success' : 'warning'}`}
                            title={canManage ? 'Click to remove' : e.status}
                            style={{ cursor: canManage ? 'pointer' : 'default' }}
                            onClick={() => canManage && removeEntry(e.id)}
                          >
                            <span className="dot" />{e.shiftName || 'Shift'}
                          </span>
                        ) : canManage ? (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '2px 8px' }}
                            onClick={() => setAddCell({ companyId: emp.companyId, employeeId: emp.id, date: d })}
                          >
                            +
                          </button>
                        ) : (
                          <span style={{ color: '#c3ccdb' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td style={{ fontSize: 11, color: '#7c8aa3' }}>Coverage</td>
                {days.map((d) => {
                  const c = covByDay.get(iso(d));
                  return (
                    <td key={iso(d)} style={{ textAlign: 'center', fontSize: 11, color: '#7c8aa3' }}>
                      {c ? `${c.staffed}/${coverage.activeEmployees}` : '—'}
                      {c && c.clashes.length > 0 && <div style={{ color: 'var(--error)' }} title={c.clashes.join('; ')}>⚠ {c.clashes.length}</div>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {addCell && (
        <div className="modal-backdrop" onClick={() => setAddCell(null)}>
          <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <h2>Assign a shift</h2>
            <p style={{ marginTop: -4, color: '#5b6a85' }}>
              {(shownEmployees.find((e) => e.id === addCell.employeeId) || {}).firstName}{' '}
              {(shownEmployees.find((e) => e.id === addCell.employeeId) || {}).lastName} · {iso(addCell.date)}
            </p>
            {shifts.filter((s) => s.companyId === addCell.companyId).length === 0 ? (
              <div className="banner error">This company has no shift templates. Create one on the Attendance screen first.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {shifts.filter((s) => s.companyId === addCell.companyId).map((s) => (
                  <button key={s.id} className="btn btn-secondary" disabled={busy} onClick={() => addEntry(s.id)}>
                    {s.name} · {s.startTime}–{s.endTime}
                  </button>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setAddCell(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
