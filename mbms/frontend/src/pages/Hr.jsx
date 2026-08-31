import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';

// Admin » HR Dashboard (28 August 2026). Read-only oversight of headcount,
// attendance, recruitment pipeline and upcoming contract / probation / leave
// events, aggregated from the employee, attendance, leave and recruitment
// modules. Visible to any holder of an HR "viewAll" permission.

const LEAVE_LABEL = { annual: 'Annual', sick: 'Sick', maternity: 'Maternity', paternity: 'Paternity', emergency: 'Emergency' };
const STAGE_LABEL = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview scheduled',
  interviewed: 'Interviewed',
  offered: 'Offered',
};

function Kpi({ label, value, hint, tone }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: '#7c8aa3', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function BreakdownCard({ title, rows, unit = 'staff' }) {
  return (
    <div className="card">
      <strong>{title}</strong>
      {rows.length === 0 ? (
        <div className="empty">No data.</div>
      ) : (
        <table style={{ marginTop: 8 }}>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.name}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{r.count.toLocaleString()} {unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function HrDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiRequest('/hr/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load the HR dashboard.'));
  }, []);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Human Resources</div>
          <h1>HR Dashboard</h1>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {!data ? (
        <div className="card"><div className="loading">Loading…</div></div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: '#7c8aa3', marginTop: -6 }}>
            {data.scope === 'group' ? 'Group-wide' : 'Your companies'} · attendance over the last {data.attendanceWindowDays} days ·
            events in the next {data.upcomingWindowDays} days
          </p>

          <h2 style={{ fontSize: 15, marginTop: 18 }}>Headcount</h2>
          <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
            <Kpi label="Active employees" value={data.headcount.active.toLocaleString()} />
            <Kpi label="Inactive" value={data.headcount.inactive.toLocaleString()} tone={data.headcount.inactive ? 'warning' : undefined} />
            <Kpi label="Companies" value={data.headcount.byCompany.length} />
            <Kpi label="Departments staffed" value={data.headcount.byDepartment.filter((d) => d.id).length} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 18 }}>
            <BreakdownCard title="By company" rows={data.headcount.byCompany} />
            <BreakdownCard title="By branch" rows={data.headcount.byBranch} />
            <BreakdownCard title="By department" rows={data.headcount.byDepartment} />
            <BreakdownCard title="By contract type" rows={data.headcount.byContractType.map((r) => ({ name: r.contractType, count: r.count }))} />
          </div>

          <h2 style={{ fontSize: 15 }}>Attendance ({data.attendanceWindowDays} days)</h2>
          <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
            <Kpi label="Records" value={data.attendance.totalRecords.toLocaleString()} />
            <Kpi label="Absence rate" value={`${data.attendance.absenceRatePercent}%`} tone={data.attendance.absenceRatePercent >= 5 ? 'error' : undefined}
              hint={`${data.attendance.byStatus.absent} absent`} />
            <Kpi label="Late rate" value={`${data.attendance.lateRatePercent}%`} tone={data.attendance.lateRatePercent >= 10 ? 'warning' : undefined}
              hint={`${data.attendance.byStatus.late} late arrivals`} />
            <Kpi label="Present / half-day" value={`${data.attendance.byStatus.present} / ${data.attendance.byStatus.half_day}`} />
          </div>

          <h2 style={{ fontSize: 15 }}>Recruitment</h2>
          <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 10 }}>
            <Kpi label="Open vacancies" value={data.recruitment.openVacancies} />
            <Kpi label="Positions open" value={data.recruitment.positionsOpen} />
            <Kpi label="Awaiting approval" value={data.recruitment.pendingApproval} tone={data.recruitment.pendingApproval ? 'warning' : undefined} />
            <Kpi label="Candidates in pipeline" value={data.recruitment.pipelineTotal} />
          </div>
          <div className="card" style={{ marginBottom: 18 }}>
            <strong>Pipeline by stage</strong>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              {Object.entries(data.recruitment.pipeline).map(([stage, n]) => (
                <span key={stage} className="badge neutral" style={{ fontSize: 12 }}>
                  <span className="dot" />{STAGE_LABEL[stage] || stage}: {n}
                </span>
              ))}
            </div>
          </div>

          <h2 style={{ fontSize: 15 }}>Upcoming ({data.upcomingWindowDays} days)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <div className="card">
              <strong>Contracts ending</strong>
              {data.upcoming.contractsEnding.length === 0 ? <div className="empty">None.</div> : (
                <table style={{ marginTop: 8 }}>
                  <tbody>
                    {data.upcoming.contractsEnding.map((e) => (
                      <tr key={e.employeeId}>
                        <td>{e.name}<div style={{ fontSize: 11, color: '#7c8aa3' }}>{e.jobTitle || '—'}</div></td>
                        <td className="mono" style={{ textAlign: 'right' }}>{new Date(e.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card">
              <strong>Probation ending</strong>
              {data.upcoming.probationEnding.length === 0 ? <div className="empty">None.</div> : (
                <table style={{ marginTop: 8 }}>
                  <tbody>
                    {data.upcoming.probationEnding.map((e) => (
                      <tr key={e.employeeId}>
                        <td>{e.name}<div style={{ fontSize: 11, color: '#7c8aa3' }}>{e.jobTitle || '—'}</div></td>
                        <td className="mono" style={{ textAlign: 'right' }}>{new Date(e.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card">
              <strong>Leave starting</strong>
              {data.upcoming.leaveStarting.length === 0 ? <div className="empty">None.</div> : (
                <table style={{ marginTop: 8 }}>
                  <tbody>
                    {data.upcoming.leaveStarting.map((l) => (
                      <tr key={l.leaveId}>
                        <td>{l.name}<div style={{ fontSize: 11, color: '#7c8aa3' }}>{LEAVE_LABEL[l.leaveType] || l.leaveType} · {l.days}d</div></td>
                        <td className="mono" style={{ textAlign: 'right' }}>{new Date(l.startDate).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
