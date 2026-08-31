import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Money } from '../components/Money';

const STATUS_BADGE = {
  planned: 'neutral',
  active: 'success',
  on_hold: 'neutral',
  completed: 'success',
  closed: 'error',
};

const STATUS_LABEL = {
  planned: 'Planned',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  closed: 'Closed',
};

const NEXT_ACTIONS = {
  planned: [{ action: 'activate', label: 'Activate' }],
  active: [
    { action: 'hold', label: 'Put On Hold' },
    { action: 'complete', label: 'Mark Complete' },
  ],
  on_hold: [
    { action: 'resume', label: 'Resume' },
    { action: 'complete', label: 'Mark Complete' },
  ],
  completed: [{ action: 'close', label: 'Close Project' }],
  closed: [],
};

export function ProjectsPage() {
  const { hasRole, hasPermission } = useAuth();
  // Sprint 12 permission model (see mbms/README.md, "Sprint 12"):
  // project.manage — Super Administrator, Managing Director, Finance
  // Manager (budget allocation and profitability review are financial
  // record-keeping, the same reasoning already given for accounting.manage
  // and asset.manage).
  const canManage = hasRole('Super Administrator', 'Managing Director', 'Finance Manager') || hasPermission('project.manage');

  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null);

  async function load() {
    setError(null);
    try {
      const { items } = await apiRequestWithMeta('/projects', { pageSize: 100 });
      setProjects(items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load projects.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Projects</div>
          <h1>Projects</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Project
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
        {projects === null ? (
          <div className="loading">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="empty">No projects registered yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th className="num">Budget</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.projectCode}</td>
                  <td className="rowlink">{p.name}</td>
                  <td className="num"><Money value={p.budget} /></td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[p.status] ?? 'neutral'}`}>
                      <span className="dot" />
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn-ghost" onClick={() => setDetailTarget(p)}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {detailTarget && (
        <ProjectDetailModal
          projectId={detailTarget.id}
          canManage={canManage}
          onClose={() => setDetailTarget(null)}
          onChanged={load}
        />
      )}
    </Layout>
  );
}

// ---------------------------------------------------------------- Create
function CreateProjectModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerEmployeeId, setManagerEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: {
          companyId,
          branchId: branchId || undefined,
          departmentId: departmentId || undefined,
          projectCode,
          name,
          description: description || undefined,
          managerEmployeeId: managerEmployeeId || undefined,
          startDate,
          plannedEndDate: plannedEndDate || undefined,
          budget: budget ? Number(budget) : undefined,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to register project.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>Register Project</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Company ID <span className="req">*</span>
            </label>
            <input className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="uuid" required />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                Project Code <span className="req">*</span>
              </label>
              <input className="input" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} placeholder="e.g. PRJ-0003" required />
            </div>
            <div className="field">
              <label>
                Name <span className="req">*</span>
              </label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Manager Employee ID</label>
              <input className="input" value={managerEmployeeId} onChange={(e) => setManagerEmployeeId(e.target.value)} placeholder="uuid (optional)" />
            </div>
            <div className="field">
              <label>Branch ID</label>
              <input className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="uuid (optional)" />
            </div>
            <div className="field">
              <label>Department ID</label>
              <input className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} placeholder="uuid (optional)" />
            </div>
            <div className="field">
              <label>
                Start Date <span className="req">*</span>
              </label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Planned End Date</label>
              <input className="input" type="date" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Budget</label>
              <input className="input" type="number" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Register Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Detail
function ProjectDetailModal({ projectId, canManage, onClose, onChanged }) {
  const [project, setProject] = useState(null);
  const [team, setTeam] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [milestones, setMilestones] = useState(null);
  const [profitability, setProfitability] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAddTeamMember, setShowAddTeamMember] = useState(false);

  async function loadAll() {
    setError(null);
    try {
      const [p, t, tk, ms, prof] = await Promise.all([
        apiRequest(`/projects/${projectId}`),
        apiRequest(`/projects/${projectId}/team`),
        apiRequest(`/projects/${projectId}/tasks`),
        apiRequest(`/projects/${projectId}/milestones`),
        apiRequest(`/projects/${projectId}/profitability`),
      ]);
      setProject(p);
      setTeam(t);
      setTasks(tk);
      setMilestones(ms);
      setProfitability(prof);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load project detail.');
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function runTransition(action) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/${action}`, { method: 'POST' });
      await loadAll();
      onChanged();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to update project status.');
    } finally {
      setBusy(false);
    }
  }

  async function updateTaskStatus(taskId, status) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: { status } });
      await loadAll();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to update task.');
    } finally {
      setBusy(false);
    }
  }

  async function completeMilestone(milestoneId) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/milestones/${milestoneId}/complete`, { method: 'POST' });
      await loadAll();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to complete milestone.');
    } finally {
      setBusy(false);
    }
  }

  async function removeTeamMember(employeeId) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/team/remove`, { method: 'POST', body: { employeeId } });
      await loadAll();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to remove team member.');
    } finally {
      setBusy(false);
    }
  }

  if (!project) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          {error ? <div className="banner error">{error}</div> : <div className="loading">Loading…</div>}
        </div>
      </div>
    );
  }

  const nextActions = NEXT_ACTIONS[project.status] ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto', maxWidth: 720 }}>
        <h2>
          {project.projectCode} — {project.name}
        </h2>
        <p style={{ opacity: 0.75, fontSize: '0.9em', marginTop: -4 }}>{project.description || 'No description.'}</p>
        {error && <div className="banner error">{error}</div>}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span className={`badge ${STATUS_BADGE[project.status] ?? 'neutral'}`}>
            <span className="dot" />
            {STATUS_LABEL[project.status] ?? project.status}
          </span>
          {canManage &&
            nextActions.map((a) => (
              <button key={a.action} className="btn btn-secondary" disabled={busy} onClick={() => runTransition(a.action)}>
                {a.label}
              </button>
            ))}
        </div>

        {profitability && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">Profitability</div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>
                <div className="hint">Budget</div>
                <div><Money value={profitability.budget} /></div>
              </div>
              <div>
                <div className="hint">Actual Cost (paid expenses)</div>
                <div><Money value={profitability.actualCost} /></div>
              </div>
              <div>
                <div className="hint">Budget Variance</div>
                <div><Money value={profitability.budgetVariance} /></div>
              </div>
              <div>
                <div className="hint">Revenue</div>
                <div><Money value={profitability.revenueAmount} /></div>
              </div>
              <div>
                <div className="hint">Margin</div>
                <div><Money value={profitability.margin} /></div>
              </div>
              <div>
                <div className="hint">Margin %</div>
                <div className="mono">{profitability.marginPercent ?? '—'}</div>
              </div>
            </div>
          </div>
        )}

        <div className="fs-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Team</span>
          {canManage && (
            <button className="btn-ghost" onClick={() => setShowAddTeamMember(!showAddTeamMember)}>
              {showAddTeamMember ? 'Cancel' : '+ Add'}
            </button>
          )}
        </div>
        {team && team.length === 0 ? (
          <div className="empty">No team members yet.</div>
        ) : (
          <table style={{ marginBottom: 12 }}>
            <tbody>
              {(team ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.employeeId}</td>
                  <td>{m.role || '—'}</td>
                  <td>
                    {canManage && (
                      <button className="btn-ghost" disabled={busy} onClick={() => removeTeamMember(m.employeeId)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {showAddTeamMember && (
          <AddTeamMemberForm
            projectId={projectId}
            onAdded={() => {
              setShowAddTeamMember(false);
              loadAll();
            }}
          />
        )}

        <div className="fs-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Tasks</span>
          {canManage && (
            <button className="btn-ghost" onClick={() => setShowAddTask(!showAddTask)}>
              {showAddTask ? 'Cancel' : '+ Add'}
            </button>
          )}
        </div>
        {tasks && tasks.length === 0 ? (
          <div className="empty">No tasks yet.</div>
        ) : (
          <table style={{ marginBottom: 12 }}>
            <tbody>
              {(tasks ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>
                    {canManage ? (
                      <select className="select" value={t.status} disabled={busy} onChange={(e) => updateTaskStatus(t.id, e.target.value)}>
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    ) : (
                      t.status
                    )}
                  </td>
                  <td className="mono">{t.dueDate ? t.dueDate.slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {showAddTask && (
          <AddTaskForm
            projectId={projectId}
            onAdded={() => {
              setShowAddTask(false);
              loadAll();
            }}
          />
        )}

        <div className="fs-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Milestones</span>
          {canManage && (
            <button className="btn-ghost" onClick={() => setShowAddMilestone(!showAddMilestone)}>
              {showAddMilestone ? 'Cancel' : '+ Add'}
            </button>
          )}
        </div>
        {milestones && milestones.length === 0 ? (
          <div className="empty">No milestones yet.</div>
        ) : (
          <table style={{ marginBottom: 12 }}>
            <tbody>
              {(milestones ?? []).map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="mono">{m.dueDate ? m.dueDate.slice(0, 10) : '—'}</td>
                  <td>
                    <span className={`badge ${m.status === 'completed' ? 'success' : 'neutral'}`}>
                      <span className="dot" />
                      {m.status}
                    </span>
                  </td>
                  <td>
                    {canManage && m.status !== 'completed' && (
                      <button className="btn-ghost" disabled={busy} onClick={() => completeMilestone(m.id)}>
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {showAddMilestone && (
          <AddMilestoneForm
            projectId={projectId}
            onAdded={() => {
              setShowAddMilestone(false);
              loadAll();
            }}
          />
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AddTeamMemberForm({ projectId, onAdded }) {
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/team`, { method: 'POST', body: { employeeId, role: role || undefined } });
      onAdded();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to add team member.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ marginBottom: 12 }}>
      {error && <div className="banner error">{error}</div>}
      <div className="formgrid" style={{ marginBottom: 8 }}>
        <div className="field">
          <label>Employee ID *</label>
          <input className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
        </div>
        <div className="field">
          <label>Role</label>
          <input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Site Coordinator" />
        </div>
      </div>
      <button type="submit" className="btn btn-secondary" disabled={saving}>
        {saving ? 'Adding…' : 'Add Member'}
      </button>
    </form>
  );
}

function AddTaskForm({ projectId, onAdded }) {
  const [name, setName] = useState('');
  const [assignedToEmployeeId, setAssignedToEmployeeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: { name, assignedToEmployeeId: assignedToEmployeeId || undefined, dueDate: dueDate || undefined },
      });
      onAdded();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to add task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ marginBottom: 12 }}>
      {error && <div className="banner error">{error}</div>}
      <div className="formgrid" style={{ marginBottom: 8 }}>
        <div className="field">
          <label>Task Name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Assigned To (Employee ID)</label>
          <input className="input" value={assignedToEmployeeId} onChange={(e) => setAssignedToEmployeeId(e.target.value)} />
        </div>
        <div className="field">
          <label>Due Date</label>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn btn-secondary" disabled={saving}>
        {saving ? 'Adding…' : 'Add Task'}
      </button>
    </form>
  );
}

function AddMilestoneForm({ projectId, onAdded }) {
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/milestones`, { method: 'POST', body: { name, dueDate: dueDate || undefined } });
      onAdded();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to add milestone.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ marginBottom: 12 }}>
      {error && <div className="banner error">{error}</div>}
      <div className="formgrid" style={{ marginBottom: 8 }}>
        <div className="field">
          <label>Milestone Name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Due Date</label>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn btn-secondary" disabled={saving}>
        {saving ? 'Adding…' : 'Add Milestone'}
      </button>
    </form>
  );
}
