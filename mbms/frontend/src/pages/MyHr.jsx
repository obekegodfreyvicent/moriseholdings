import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, ApiRequestError } from '../lib/api';

// My HR — employee self-service (28 August 2026). Six screens, all scoped to
// the Employee record linked to the signed-in user. If the account has no
// linked employee record, each screen shows a friendly notice.

const LEAVE_LABEL = { annual: 'Annual', sick: 'Sick', maternity: 'Maternity', paternity: 'Paternity', emergency: 'Emergency' };
const ATT_BADGE = { present: 'success', late: 'warning', absent: 'error', half_day: 'neutral' };
const LEAVE_BADGE = { submitted: 'warning', approved: 'success', rejected: 'error', cancelled: 'neutral' };
const ADV_BADGE = { requested: 'warning', approved: 'neutral', recovering: 'neutral', recovered: 'success', rejected: 'error', cancelled: 'neutral' };
const REVIEW_BADGE = { self_assessment_pending: 'warning', manager_review_pending: 'neutral', completed: 'success' };

function useMyHr(path) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);
  const reload = () => {
    setError(null);
    apiRequest(path)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 404) setData(null); // not linked
        else setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load.');
      });
  };
  useEffect(reload, [path]);
  return { data, error, reload };
}

function Shell({ title, children }) {
  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">My HR</div>
          <h1>{title}</h1>
        </div>
      </div>
      {children}
    </Layout>
  );
}

function NotLinked() {
  return (
    <div className="card">
      <div className="empty">Your account is not linked to an employee record yet. Ask HR to link it, then this screen will show your details.</div>
    </div>
  );
}

// ------------------------------- Clock In / Out -------------------------------

export function MyClockPage() {
  const { data, error, reload } = useMyHr('/my-hr/attendance');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function clock(action) {
    setBusy(true);
    setMsg(null);
    try {
      await apiRequest(`/attendance/${action}`, { method: 'POST', body: {} });
      setMsg(action === 'clock-in' ? 'Clocked in.' : 'Clocked out.');
      reload();
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.apiError.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Clock In / Out">
      {error && <div className="banner error">{error}</div>}
      {msg && <div className="banner info">{msg}</div>}
      {data === undefined ? (
        <div className="card"><div className="loading">Loading…</div></div>
      ) : data === null ? (
        <NotLinked />
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <strong>Today</strong>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              {data.today ? (
                <>
                  <span className={`badge ${ATT_BADGE[data.today.status]}`}><span className="dot" />{data.today.status}</span>
                  <span style={{ fontSize: 13 }}>In: <strong>{data.today.clockInTime ? new Date(data.today.clockInTime).toLocaleTimeString() : '—'}</strong></span>
                  <span style={{ fontSize: 13 }}>Out: <strong>{data.today.clockOutTime ? new Date(data.today.clockOutTime).toLocaleTimeString() : '—'}</strong></span>
                  {data.today.lateMinutes > 0 && <span style={{ fontSize: 13, color: 'var(--warning)' }}>{data.today.lateMinutes} min late</span>}
                </>
              ) : (
                <span style={{ color: '#7c8aa3' }}>You have not clocked in today.</span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" disabled={busy || (data.today && data.today.clockInTime)} onClick={() => clock('clock-in')}>Clock in</button>
                <button className="btn btn-secondary" disabled={busy || !data.today || !data.today.clockInTime || data.today.clockOutTime} onClick={() => clock('clock-out')}>Clock out</button>
              </div>
            </div>
          </div>

          <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
            <div className="kpi"><div className="label">Present (30d)</div><div className="value">{data.last30.present}</div></div>
            <div className="kpi"><div className="label">Late (30d)</div><div className="value" style={{ color: data.last30.late ? 'var(--warning)' : undefined }}>{data.last30.late}</div></div>
            <div className="kpi"><div className="label">Absent (30d)</div><div className="value" style={{ color: data.last30.absent ? 'var(--error)' : undefined }}>{data.last30.absent}</div></div>
            <div className="kpi"><div className="label">Half-day (30d)</div><div className="value">{data.last30.halfDay}</div></div>
          </div>

          <div className="card">
            <strong>My attendance</strong>
            {data.records.length === 0 ? <div className="empty">No records.</div> : (
              <table style={{ marginTop: 8 }}>
                <thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th style={{ textAlign: 'right' }}>Late (min)</th><th style={{ textAlign: 'right' }}>Overtime (min)</th></tr></thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{new Date(r.date).toLocaleDateString()}</td>
                      <td><span className={`badge ${ATT_BADGE[r.status]}`}><span className="dot" />{r.status}</span></td>
                      <td className="mono">{r.clockInTime ? new Date(r.clockInTime).toLocaleTimeString() : '—'}</td>
                      <td className="mono">{r.clockOutTime ? new Date(r.clockOutTime).toLocaleTimeString() : '—'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{r.lateMinutes || 0}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{r.overtimeMinutes || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

// --------------------------------- My Leave ---------------------------------

export function MyLeavePage() {
  const { data, error, reload } = useMyHr('/my-hr/leave');
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState(null);

  async function cancel(id) {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await apiRequest(`/leave/applications/${id}/cancel`, { method: 'POST' });
      reload();
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.apiError.message : 'Cancel failed.');
    }
  }

  return (
    <Shell title="My Leave">
      {error && <div className="banner error">{error}</div>}
      {msg && <div className="banner error">{msg}</div>}
      {data === undefined ? (
        <div className="card"><div className="loading">Loading…</div></div>
      ) : data === null ? (
        <NotLinked />
      ) : (
        <>
          <div className="pagehead" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: '#7c8aa3' }}>Balances for {data.year}</div>
            <div className="actions"><button className="btn btn-primary" onClick={() => setShow(true)}>+ Apply for leave</button></div>
          </div>
          <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
            {data.balances.map((b) => (
              <div className="kpi" key={b.leaveType}>
                <div className="label">{LEAVE_LABEL[b.leaveType]}</div>
                <div className="value">{b.remainingDays}<span style={{ fontSize: 13, color: '#7c8aa3', fontWeight: 400 }}> / {b.entitledDays}</span></div>
                <div style={{ fontSize: 11, color: '#7c8aa3' }}>{b.usedDays} used</div>
              </div>
            ))}
          </div>
          <div className="card">
            <strong>My requests</strong>
            {data.applications.length === 0 ? <div className="empty">No leave requests.</div> : (
              <table style={{ marginTop: 8 }}>
                <thead><tr><th>Type</th><th>From</th><th>To</th><th style={{ textAlign: 'right' }}>Days</th><th>Reason</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {data.applications.map((a) => (
                    <tr key={a.id}>
                      <td>{LEAVE_LABEL[a.leaveType]}</td>
                      <td className="mono">{new Date(a.startDate).toLocaleDateString()}</td>
                      <td className="mono">{new Date(a.endDate).toLocaleDateString()}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{a.daysRequested}</td>
                      <td style={{ color: '#5b6a85', fontSize: 13 }}>{a.reason || '—'}{a.status === 'rejected' && a.rejectionReason ? ` · ${a.rejectionReason}` : ''}</td>
                      <td><span className={`badge ${LEAVE_BADGE[a.status]}`}><span className="dot" />{a.status}</span></td>
                      <td style={{ textAlign: 'right' }}>{a.status === 'submitted' && <button className="btn btn-secondary" onClick={() => cancel(a.id)}>Cancel</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {show && <ApplyLeaveModal leaveTypes={data.leaveTypes} onClose={() => setShow(false)} onDone={() => { setShow(false); reload(); }} />}
        </>
      )}
    </Shell>
  );
}

function ApplyLeaveModal({ leaveTypes, onClose, onDone }) {
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStart] = useState('');
  const [endDate, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/leave/applications', { method: 'POST', body: { leaveType, startDate, endDate, reason: reason.trim() || undefined } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Could not submit the request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2>Apply for leave</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Type</label>
            <select className="select" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
              {leaveTypes.map((t) => <option key={t} value={t}>{LEAVE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field"><label>From <span className="req">*</span></label><input className="input" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required /></div>
            <div className="field"><label>To <span className="req">*</span></label><input className="input" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} required /></div>
          </div>
          <div className="field" style={{ marginBottom: 16 }}><label>Reason</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --------------------------------- My Shifts ---------------------------------

export function MyShiftsPage() {
  const { data, error } = useMyHr('/my-hr/shifts');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Shell title="My Shifts">
      {error && <div className="banner error">{error}</div>}
      {data === undefined ? (
        <div className="card"><div className="loading">Loading…</div></div>
      ) : data === null ? (
        <NotLinked />
      ) : (
        <div className="card">
          <strong>My roster</strong>
          {data.length === 0 ? <div className="empty">No shifts rostered.</div> : (
            <table style={{ marginTop: 8 }}>
              <thead><tr><th>Date</th><th>Day</th><th>Shift</th><th>Hours</th><th>Status</th></tr></thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} style={s.date.slice(0, 10) === today ? { background: '#EEF4FF' } : undefined}>
                    <td className="mono">{new Date(s.date).toLocaleDateString()}</td>
                    <td>{new Date(s.date).toLocaleDateString(undefined, { weekday: 'long' })}</td>
                    <td>{s.shiftName || '—'}</td>
                    <td className="mono">{s.shiftStart && s.shiftEnd ? `${s.shiftStart}–${s.shiftEnd}` : '—'}</td>
                    <td><span className={`badge ${s.status === 'published' ? 'success' : 'warning'}`}><span className="dot" />{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ fontSize: 12, color: '#7c8aa3', marginTop: 8 }}>Planned shifts are not final until published by your supervisor.</p>
        </div>
      )}
    </Shell>
  );
}

// ------------------------------ My Performance ------------------------------

export function MyPerformancePage() {
  const { data, error, reload } = useMyHr('/my-hr/performance');
  const [editing, setEditing] = useState(null);

  return (
    <Shell title="My Performance">
      {error && <div className="banner error">{error}</div>}
      {data === undefined ? (
        <div className="card"><div className="loading">Loading…</div></div>
      ) : data === null ? (
        <NotLinked />
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <strong>My objectives</strong>
            {data.objectives.length === 0 ? <div className="empty">No objectives set.</div> : (
              <table style={{ marginTop: 8 }}>
                <thead><tr><th>Objective</th><th>Target</th><th style={{ textAlign: 'right' }}>Weight</th><th>Status</th></tr></thead>
                <tbody>
                  {data.objectives.map((o) => (
                    <tr key={o.id}>
                      <td>{o.title}{o.description && <div style={{ fontSize: 12, color: '#7c8aa3' }}>{o.description}</div>}</td>
                      <td>{o.targetValue || '—'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{o.weight != null ? `${o.weight}%` : '—'}</td>
                      <td><span className={`badge ${o.status === 'achieved' ? 'success' : o.status === 'not_achieved' ? 'error' : 'neutral'}`}><span className="dot" />{o.status.replace('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <strong>My reviews</strong>
            {data.reviews.length === 0 ? <div className="empty">No performance reviews.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                {data.reviews.map((r) => (
                  <div key={r.id} style={{ border: '1px solid #E4E9F2', borderRadius: 8, padding: 14 }}>
                    <div className="sf-row-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{r.cycleName || 'Review'}</strong>
                      <span className={`badge ${REVIEW_BADGE[r.status]}`}><span className="dot" />{r.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      <div><span style={{ color: '#7c8aa3' }}>My self-assessment:</span> {r.selfAssessment || <em style={{ color: '#7c8aa3' }}>not submitted</em>}</div>
                      {r.status === 'completed' && (
                        <>
                          <div style={{ marginTop: 6 }}><span style={{ color: '#7c8aa3' }}>Manager assessment:</span> {r.managerAssessment || '—'}</div>
                          <div style={{ marginTop: 6 }}><span style={{ color: '#7c8aa3' }}>Rating:</span> <strong>{r.managerRating ?? '—'} / 5</strong>{r.promotionRecommended ? ' · promotion recommended' : ''}</div>
                          {r.trainingRecommendation && <div style={{ marginTop: 6 }}><span style={{ color: '#7c8aa3' }}>Training:</span> {r.trainingRecommendation}</div>}
                        </>
                      )}
                    </div>
                    {r.status === 'self_assessment_pending' && (
                      <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => setEditing(r)}>Submit self-assessment</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {editing && <SelfAssessmentModal review={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
        </>
      )}
    </Shell>
  );
}

function SelfAssessmentModal({ review, onClose, onDone }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/performance/reviews/${review.id}/self-assessment`, { method: 'POST', body: { selfAssessment: text } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Could not submit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h2>Self-assessment — {review.cycleName || 'Review'}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Your assessment of the period</label>
            <textarea className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !text.trim()}>{saving ? 'Submitting…' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------------- My Payslips -------------------------------

export function MyPayslipsPage() {
  const { data, error } = useMyHr('/my-hr/payslips');
  const [open, setOpen] = useState(null);

  return (
    <Shell title="My Payslips">
      {error && <div className="banner error">{error}</div>}
      {data === undefined ? (
        <div className="card"><div className="loading">Loading…</div></div>
      ) : data === null ? (
        <NotLinked />
      ) : (
        <div className="card">
          {data.length === 0 ? (
            <div className="empty">No payslips yet — a payslip appears here once a payroll run that includes you has been approved.</div>
          ) : (
            <table>
              <thead><tr><th>Period</th><th>Status</th><th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>PAYE</th><th style={{ textAlign: 'right' }}>NSSF</th><th style={{ textAlign: 'right' }}>Net</th><th /></tr></thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>{p.periodLabel}</td>
                    <td>
                      {p.status === 'paid' ? (
                        <span className="badge success" title={p.paidAt ? `Paid ${new Date(p.paidAt).toLocaleDateString()}` : 'Paid'}>Paid{p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString()}` : ''}</span>
                      ) : (
                        <span className="badge warning" title={p.approvedAt ? `Approved ${new Date(p.approvedAt).toLocaleDateString()}` : 'Approved'}>Approved · awaiting payment</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}><Money value={p.grossSalary} /></td>
                    <td style={{ textAlign: 'right' }}><Money value={p.paye} /></td>
                    <td style={{ textAlign: 'right' }}><Money value={p.nssfEmployee} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}><Money value={p.netPay} /></td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-secondary" onClick={() => setOpen(p)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {open && (
            <div className="modal-backdrop" onClick={() => setOpen(null)}>
              <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
                <h2>Payslip — {open.periodLabel}</h2>
                <p style={{ marginTop: 4 }}>
                  {open.status === 'paid' ? (
                    <span className="badge success">Paid{open.paidAt ? ` on ${new Date(open.paidAt).toLocaleDateString()}` : ''}</span>
                  ) : (
                    <span className="badge warning">Approved{open.approvedAt ? ` on ${new Date(open.approvedAt).toLocaleDateString()}` : ''} · awaiting payment</span>
                  )}
                </p>
                <table style={{ marginTop: 8 }}>
                  <tbody>
                    <tr><td>Gross salary</td><td style={{ textAlign: 'right' }}><Money value={open.grossSalary} /></td></tr>
                    <tr><td>PAYE</td><td style={{ textAlign: 'right' }}>− <Money value={open.paye} /></td></tr>
                    <tr><td>NSSF (employee 5%)</td><td style={{ textAlign: 'right' }}>− <Money value={open.nssfEmployee} /></td></tr>
                    {Number(open.advanceRecovery) > 0 && <tr><td>Salary advance recovery</td><td style={{ textAlign: 'right' }}>− <Money value={open.advanceRecovery} /></td></tr>}
                    {Number(open.otherDeductions) > 0 && <tr><td>Other deductions</td><td style={{ textAlign: 'right' }}>− <Money value={open.otherDeductions} /></td></tr>}
                    <tr style={{ borderTop: '2px solid #E4E9F2', fontWeight: 700 }}><td>Net pay</td><td style={{ textAlign: 'right' }}><Money value={open.netPay} /></td></tr>
                  </tbody>
                </table>
                <p style={{ fontSize: 12, color: '#7c8aa3', marginTop: 8 }}>Employer NSSF (10%, not deducted from you): <Money value={open.nssfEmployer} /></p>
                <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setOpen(null)}>Close</button></div>
              </div>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

// ---------------------------- My Salary Advances ----------------------------

export function MySalaryAdvancesPage() {
  const { data, error, reload } = useMyHr('/my-hr/salary-advances');
  const [show, setShow] = useState(false);

  return (
    <Shell title="My Salary Advances">
      {error && <div className="banner error">{error}</div>}
      {data === undefined ? (
        <div className="card"><div className="loading">Loading…</div></div>
      ) : data === null ? (
        <NotLinked />
      ) : (
        <>
          <div className="pagehead" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: '#7c8aa3' }}>An approved advance is recovered from your pay in instalments.</div>
            <div className="actions"><button className="btn btn-primary" onClick={() => setShow(true)}>+ Request advance</button></div>
          </div>
          <div className="card">
            {data.length === 0 ? <div className="empty">No salary advances.</div> : (
              <table>
                <thead><tr><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Instal.</th><th style={{ textAlign: 'right' }}>Recovered</th><th style={{ textAlign: 'right' }}>Outstanding</th><th>Reason</th><th>Status</th></tr></thead>
                <tbody>
                  {data.map((a) => (
                    <tr key={a.id}>
                      <td style={{ textAlign: 'right' }}><Money value={a.amount} /></td>
                      <td className="mono" style={{ textAlign: 'right' }}>{a.installments}</td>
                      <td style={{ textAlign: 'right' }}><Money value={a.amountRecovered} /></td>
                      <td style={{ textAlign: 'right' }}><Money value={a.outstanding} /></td>
                      <td style={{ color: '#5b6a85', fontSize: 13 }}>{a.reason || '—'}{a.status === 'rejected' && a.rejectionReason ? ` · ${a.rejectionReason}` : ''}</td>
                      <td><span className={`badge ${ADV_BADGE[a.status]}`}><span className="dot" />{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {show && <RequestAdvanceModal onClose={() => setShow(false)} onDone={() => { setShow(false); reload(); }} />}
        </>
      )}
    </Shell>
  );
}

function RequestAdvanceModal({ onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState('3');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/my-hr/salary-advances', { method: 'POST', body: { amount: amount.trim(), installments: Number(installments), reason: reason.trim() || undefined } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Could not submit the request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2>Request a salary advance</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field"><label>Amount (UGX) <span className="req">*</span></label><input className="input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
            <div className="field"><label>Instalments</label><input className="input" type="number" min="1" max="24" value={installments} onChange={(e) => setInstallments(e.target.value)} /></div>
          </div>
          <div className="field" style={{ marginBottom: 16 }}><label>Reason</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit request'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
