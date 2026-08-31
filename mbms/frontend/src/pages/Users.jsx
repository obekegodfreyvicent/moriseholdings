import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function UsersPage() {
  const { hasRole } = useAuth();
  // User lifecycle (create / activate / lock / scope) stays with the
  // platform admin roles; the three business grantors (MD, Branch Manager,
  // HR Manager) reach this screen only to delegate roles/permissions.
  const canAdministerUsers = hasRole('Super Administrator', 'IT Administrator');
  const [users, setUsers] = useState(null);
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setError(null);
    try {
      const [{ items }, roleList] = await Promise.all([
        apiRequestWithMeta('/identity/users', { pageSize: 50 }),
        // Full catalogue — only needed for the "New User" modal, and only
        // platform admins can read it; a grantor without identity.role.view
        // still gets their delegatable set from /delegatable-grants below.
        apiRequest('/identity/roles').catch(() => []),
      ]);
      setUsers(items);
      setRoles(roleList);
      if (items.length > 0) setSelected((prev) => prev ?? items[0]);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load users.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function refreshSelected(id) {
    const updated = await apiRequest(`/identity/users/${id}`);
    setSelected(updated);
    setUsers((prev) => prev?.map((u) => (u.id === id ? updated : u)) ?? prev);
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Admin / Backend</div>
          <h1>Users & Settings</h1>
        </div>
        {canAdministerUsers && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New User
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <p style={{ fontSize: 13, color: '#5b6b85', marginTop: -4 }}>
        Every admin user may only view, create, update, delete and execute what has been granted to
        them. Roles and permissions can only be granted or revoked by the Managing Director
        (group-wide), a Branch Manager (operational permissions, own branch) or an HR Manager (HR
        permissions, own scope). The lists below show only what you are authorised to delegate to the
        selected user.
      </p>

      <div className="grid-2">
        <div className="card">
          {users === null ? (
            <div className="loading">Loading…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelected(u)}
                    style={selected?.id === u.id ? { background: '#EAF0FB' } : {}}
                  >
                    <td className="rowlink">
                      {u.firstName} {u.lastName}
                    </td>
                    <td>{u.email}</td>
                    <td>{u.roles.map((r) => r.name).join(', ') || '—'}</td>
                    <td>
                      <span
                        className={`badge ${u.status === 'active' ? 'success' : u.status === 'locked' ? 'warning' : 'neutral'}`}
                      >
                        <span className="dot" />
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          {selected ? (
            <UserDetailPanel
              key={selected.id}
              user={selected}
              canAdministerUsers={canAdministerUsers}
              onChanged={() => refreshSelected(selected.id)}
            />
          ) : (
            <div className="empty">Select a user to manage their role and scope.</div>
          )}
        </div>
      </div>

      {showCreate && canAdministerUsers && (
        <CreateUserModal roles={roles} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </Layout>
  );
}

function UserDetailPanel({ user, canAdministerUsers, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [grants, setGrants] = useState(null);
  const [roleId, setRoleId] = useState('');
  const [permissionId, setPermissionId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  // Delegated-administration model: the backend returns exactly the roles and
  // permissions the signed-in admin may grant/revoke on THIS user, and
  // whether the user is inside their delegation scope at all.
  useEffect(() => {
    let alive = true;
    setGrants(null);
    apiRequest(`/identity/users/${user.id}/delegatable-grants`)
      .then((g) => alive && setGrants(g))
      .catch(
        () =>
          alive &&
          setGrants({
            canDelegate: false,
            reason: 'You are not authorised to delegate roles or permissions.',
            roles: [],
            permissions: [],
            canDelegateToTarget: false,
          }),
      );
    return () => {
      alive = false;
    };
  }, [user.id]);

  const grantRoles = grants?.roles ?? [];
  const grantPermissions = grants?.permissions ?? [];
  const canDelegate = !!grants?.canDelegate && !!grants?.canDelegateToTarget;

  useEffect(() => {
    if (grantRoles.length && !grantRoles.some((r) => r.id === roleId)) setRoleId(grantRoles[0].id);
    if (grantPermissions.length && !grantPermissions.some((p) => p.id === permissionId))
      setPermissionId(grantPermissions[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grants]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Action failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card-head">
        {user.firstName} {user.lastName} — Role & Scope Assignment
      </div>
      <div className="card-body">
        {error && <div className="banner error">{error}</div>}
        {grants && !grants.canDelegate && (
          <div className="banner warning">{grants.reason}</div>
        )}
        {grants && grants.canDelegate && !grants.canDelegateToTarget && (
          <div className="banner warning">
            This user is outside your delegation scope. You can see their roles and permissions but
            cannot change them — ask the Managing Director or the branch/HR manager who covers this
            user.
          </div>
        )}

        {canAdministerUsers && (
          <div className="formsection">
            <div className="fs-title">Account Status</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => apiRequest(`/identity/users/${user.id}/activate`, { method: 'POST' }))}>
                Activate
              </button>
              <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => apiRequest(`/identity/users/${user.id}/deactivate`, { method: 'POST' }))}>
                Deactivate
              </button>
              <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => apiRequest(`/identity/users/${user.id}/lock`, { method: 'POST' }))}>
                Lock
              </button>
              <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => apiRequest(`/identity/users/${user.id}/unlock`, { method: 'POST' }))}>
                Unlock
              </button>
            </div>
          </div>
        )}

        <div className="formsection">
          <div className="fs-title">Assign Role {grants && !grants.canDelegate ? '' : `(${grantRoles.length} you may delegate)`}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select className="select" value={roleId} disabled={!canDelegate || grantRoles.length === 0} onChange={(e) => setRoleId(e.target.value)}>
              {grantRoles.length === 0 && <option value="">— none available to you —</option>}
              {grantRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              disabled={busy || !roleId || !canDelegate}
              onClick={() => run(() => apiRequest(`/identity/users/${user.id}/roles`, { method: 'POST', body: { roleId } }))}
            >
              Assign
            </button>
          </div>
          <div className="formsection" style={{ marginTop: 10 }}>
            {user.roles.map((r) => (
              <span key={r.id} className="badge neutral" style={{ marginRight: 6, marginBottom: 6, display: 'inline-flex' }}>
                <span className="dot" />
                {r.name}
                <button
                  disabled={busy || !canDelegate}
                  onClick={() => run(() => apiRequest(`/identity/users/${user.id}/roles/${r.id}`, { method: 'DELETE' }))}
                  style={{ border: 'none', background: 'none', cursor: canDelegate ? 'pointer' : 'not-allowed', marginLeft: 4, color: 'inherit' }}
                  title="Remove role"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="formsection">
          <div className="fs-title">Direct Permissions (in addition to role permissions)</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select className="select" value={permissionId} disabled={!canDelegate || grantPermissions.length === 0} onChange={(e) => setPermissionId(e.target.value)}>
              {grantPermissions.length === 0 && <option value="">— none available to you —</option>}
              {grantPermissions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.domain}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              disabled={busy || !permissionId || !canDelegate}
              onClick={() => run(() => apiRequest(`/identity/users/${user.id}/permissions`, { method: 'POST', body: { permissionId } }))}
            >
              Grant
            </button>
          </div>
          <div className="formsection" style={{ marginTop: 10 }}>
            {(user.directPermissions ?? []).map((p) => (
              <span key={p.id} className="badge neutral" style={{ marginRight: 6, marginBottom: 6, display: 'inline-flex' }}>
                <span className="dot" />
                {p.code}
                <button
                  disabled={busy || !canDelegate}
                  onClick={() => run(() => apiRequest(`/identity/users/${user.id}/permissions/${p.id}`, { method: 'DELETE' }))}
                  style={{ border: 'none', background: 'none', cursor: canDelegate ? 'pointer' : 'not-allowed', marginLeft: 4, color: 'inherit' }}
                  title="Revoke permission"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="formsection" style={canAdministerUsers ? undefined : { display: 'none' }}>
          <div className="fs-title">Company / Branch / Department Scope</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="input"
              placeholder="Company UUID *"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            />
            <input
              className="input"
              placeholder="Branch UUID (optional)"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            />
            <input
              className="input"
              placeholder="Department UUID (optional)"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            />
            <button
              className="btn btn-primary"
              disabled={busy || !companyId}
              onClick={() =>
                run(() =>
                  apiRequest(`/identity/users/${user.id}/scopes`, {
                    method: 'POST',
                    body: { companyId, branchId: branchId || undefined, departmentId: departmentId || undefined },
                  }),
                )
              }
            >
              Add
            </button>
          </div>
          <table style={{ marginTop: 10 }}>
            <tbody>
              {user.scopes.map((s) => (
                <tr key={s.id}>
                  <td className="mono">
                    {s.companyId}
                    {s.branchId ? ` / ${s.branchId.slice(0, 8)}…` : ''}
                    {s.departmentId ? ` / ${s.departmentId.slice(0, 8)}…` : ''}
                  </td>
                  <td>
                    <button
                      className="btn-ghost"
                      onClick={() => run(() => apiRequest(`/identity/users/${user.id}/scopes/${s.id}`, { method: 'DELETE' }))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function CreateUserModal({ roles, onClose, onCreated }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/identity/users', {
        method: 'POST',
        body: { firstName, lastName, email, password, ...(roleId ? { roleId } : {}) },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New User</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>First Name *</label>
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Last Name *</label>
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Email *</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Temporary Password *</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <div className="hint" style={{ marginTop: 4 }}>
              At least 8 characters, with an uppercase letter, a lowercase letter and a digit.
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Role</label>
            <select className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">— none yet —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
