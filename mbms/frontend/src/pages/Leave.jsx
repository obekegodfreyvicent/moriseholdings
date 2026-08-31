import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

const STATUS_BADGE = { submitted: 'neutral', approved: 'success', rejected: 'error', cancelled: 'neutral' };

export function LeavePage() {
  const { hasRole, hasPermission } = useAuth();
  const canApprove = hasRole(
    'Super Administrator',
    'Human Resources Manager',
    'Branch Manager',
    'Sales Manager',
    'Procurement Manager',
    'Operations Manager',
    'Project Manager',
    'Inventory Manager',
    'Warehouse Manager',
  ) || hasPermission('leave.approve');

  const [applications, setApplications] = useState(null);
  const [balances, setBalances] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);

  async function load() {
    setError(null);
    try {
      const [apps, bal] = await Promise.all([
        apiRequest('/leave/applications'),
        apiRequest('/leave/balances').catch(() => []),
      ]);
      setApplications(apps);
      setBalances(bal);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load leave data.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id, action) {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest(`/leave/applications/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError(`Unable to ${action} this application.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Leave</div>
          <h1>Leave Management</h1>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setShowSubmit(true)}>
            + Apply for Leave
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {balances && balances.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">My Leave Balances ({new Date().getFullYear()})</div>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th className="num">Entitled</th>
                <th className="num">Used</th>
                <th className="num">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id}>
                  <td style={{ textTransform: 'capitalize' }}>{b.leaveType}</td>
                  <td className="num mono">{b.entitledDays}</td>
                  <td className="num mono">{b.usedDays}</td>
                  <td className="num mono">{b.entitledDays - b.usedDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-head">Applications</div>
        {applications === null ? (
          <div className="loading">Loading…</div>
        ) : applications.length === 0 ? (
          <div className="empty">No leave applications to show.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th className="num">Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td style={{ textTransform: 'capitalize' }}>{a.leaveType}</td>
                  <td>{a.startDate?.slice(0, 10)}</td>
                  <td>{a.endDate?.slice(0, 10)}</td>
                  <td className="num mono">{a.daysRequested}</td>
                  <td>{a.reason || '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[a.status] ?? 'neutral'}`}>
                      <span className="dot" />
                      {a.status}
                    </span>
                  </td>
                  <td>
                    {a.status === 'submitted' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canApprove && (
                          <>
                            <button className="btn-ghost" disabled={busyId === a.id} onClick={() => act(a.id, 'approve')}>
                              Approve
                            </button>
                            <button className="btn-ghost" disabled={busyId === a.id} onClick={() => setRejectTarget(a)}>
                              Reject
                            </button>
                          </>
                        )}
                        <button className="btn-ghost" disabled={busyId === a.id} onClick={() => act(a.id, 'cancel')}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showSubmit && <SubmitLeaveModal onClose={() => setShowSubmit(false)} onSubmitted={load} />}
      {rejectTarget && <RejectLeaveModal application={rejectTarget} onClose={() => setRejectTarget(null)} onRejected={load} />}
    </Layout>
  );
}

const LEAVE_TYPES = ['annual', 'sick', 'maternity', 'paternity', 'emergency'];

function SubmitLeaveModal({ onClose, onSubmitted }) {
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/leave/applications', { method: 'POST', body: { leaveType, startDate, endDate, reason: reason || undefined } });
      onSubmitted();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to submit leave application.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Apply for Leave</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Leave Type <span className="req">*</span>
            </label>
            <select className="select" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t} style={{ textTransform: 'capitalize' }}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                Start Date <span className="req">*</span>
              </label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>
                End Date <span className="req">*</span>
              </label>
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Reason</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RejectLeaveModal({ application, onClose, onRejected }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/leave/applications/${application.id}/reject`, { method: 'POST', body: { reason: reason || undefined } });
      onRejected();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to reject this application.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Reject Leave Application</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Reason</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
