import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

const STATUS_BADGE = { present: 'success', late: 'warning', absent: 'error', half_day: 'neutral' };

export function AttendancePage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Human Resources Manager') || hasPermission('attendance.manage');

  const [records, setRecords] = useState(null);
  const [shifts, setShifts] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);

  async function load() {
    setError(null);
    try {
      const [r, s] = await Promise.all([
        apiRequest('/attendance/records'),
        apiRequest('/attendance/shifts'),
      ]);
      setRecords(r);
      setShifts(s);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load attendance data.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function clockAction(action) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/attendance/${action}`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError(`Unable to ${action.replace('-', ' ')}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Attendance</div>
          <h1>Attendance</h1>
        </div>
        <div className="actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" disabled={busy} onClick={() => clockAction('clock-in')}>
            Clock In
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => clockAction('clock-out')}>
            Clock Out
          </button>
          {canManage && (
            <button className="btn btn-primary" onClick={() => setShowShiftModal(true)}>
              + New Shift
            </button>
          )}
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      <div className="banner info">
        Clock In/Clock Out act on your own linked employee record. If your account isn't linked to an employee
        record, ask HR to record your attendance instead.
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">Recent Records</div>
          {records === null ? (
            <div className="loading">Loading…</div>
          ) : records.length === 0 ? (
            <div className="empty">No attendance records yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Status</th>
                  <th>Late (min)</th>
                  <th>Overtime (min)</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date?.slice(0, 10)}</td>
                    <td className="mono">{r.clockInTime ? new Date(r.clockInTime).toLocaleTimeString() : '—'}</td>
                    <td className="mono">{r.clockOutTime ? new Date(r.clockOutTime).toLocaleTimeString() : '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[r.status] ?? 'neutral'}`}>
                        <span className="dot" />
                        {r.status}
                      </span>
                    </td>
                    <td className="num mono">{r.lateMinutes}</td>
                    <td className="num mono">{r.overtimeMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-head">Shifts</div>
          {shifts === null ? (
            <div className="loading">Loading…</div>
          ) : shifts.length === 0 ? (
            <div className="empty">No shifts defined yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Grace (min)</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="mono">{s.startTime}</td>
                    <td className="mono">{s.endTime}</td>
                    <td className="num mono">{s.graceMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showShiftModal && <CreateShiftModal onClose={() => setShowShiftModal(false)} onCreated={load} />}
    </Layout>
  );
}

function CreateShiftModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/attendance/shifts', { method: 'POST', body: { companyId, name, startTime, endTime, graceMinutes: Number(graceMinutes) } });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create shift.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Shift</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Company ID <span className="req">*</span>
            </label>
            <input className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="uuid" required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Name <span className="req">*</span>
            </label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Day Shift" required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Start Time</label>
              <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="field">
              <label>End Time</label>
              <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
            <div className="field">
              <label>Grace (minutes)</label>
              <input className="input" type="number" min="0" value={graceMinutes} onChange={(e) => setGraceMinutes(e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
