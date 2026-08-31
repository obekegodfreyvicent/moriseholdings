import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { apiRequest, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  // Subsidiary lifecycle (27 August 2026): the Managing Director manages
  // subsidiaries and everything under them.
  const canManage = hasRole('Super Administrator', 'IT Administrator', 'Managing Director');

  async function del(path, label) {
    if (!window.confirm(`Delete ${label}?`)) return;
    try {
      await apiRequest(path, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Delete failed.');
    }
  }

  const [tree, setTree] = useState(null);
  const [branches, setBranches] = useState(null);
  const [departments, setDepartments] = useState(null);
  const [policies, setPolicies] = useState(null);
  const [error, setError] = useState(null);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddPolicy, setShowAddPolicy] = useState(false);

  async function load() {
    if (!id) return;
    setError(null);
    try {
      const [hierarchy, branchList, deptList, policyList] = await Promise.all([
        apiRequest(`/organization/companies/${id}/hierarchy`),
        apiRequest(`/organization/companies/${id}/branches`),
        apiRequest(`/organization/companies/${id}/departments`),
        apiRequest(`/organization/companies/${id}/policies`),
      ]);
      setTree(hierarchy);
      setBranches(branchList);
      setDepartments(deptList);
      setPolicies(policyList);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load this company.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function renderNode(node, isRoot) {
    return (
      <li key={node.id}>
        <div className={`node${isRoot ? ' root' : ''}`} onClick={() => navigate(`/companies/${node.id}`)}>
          {isRoot ? '\u{1F3E2} ' : ''}
          {node.name}
        </div>
        {node.subsidiaries.length > 0 && (
          <ul className="tree">{node.subsidiaries.map((child) => renderNode(child, false))}</ul>
        )}
      </li>
    );
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Companies</div>
          <h1>{tree?.name ?? 'Company'}</h1>
        </div>
        {canManage && tree?.parentCompanyId && (
          <div className="actions" style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  await apiRequest(`/organization/companies/${id}/${tree.status === 'active' ? 'deactivate' : 'activate'}`, { method: 'POST' });
                  await load();
                } catch (err) {
                  setError(err instanceof ApiRequestError ? err.apiError.message : 'Action failed.');
                }
              }}
            >
              {tree.status === 'active' ? 'Deactivate Subsidiary' : 'Activate Subsidiary'}
            </button>
            <button
              className="btn btn-secondary"
              style={{ color: 'var(--error, #c0392b)' }}
              onClick={async () => {
                if (!window.confirm(`Permanently delete "${tree.name}"? Only works if it is completely empty.`)) return;
                try {
                  await apiRequest(`/organization/companies/${id}`, { method: 'DELETE' });
                  navigate('/companies');
                } catch (err) {
                  setError(err instanceof ApiRequestError ? err.apiError.message : 'Delete failed.');
                }
              }}
            >
              Delete Subsidiary
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      {tree && (
        <div className="grid-2">
          <div className="card">
            <div className="card-head">Group Ownership Structure</div>
            <div className="card-body">
              <ul className="tree">{renderNode(tree, true)}</ul>
            </div>
          </div>

          <div className="card">
            <div className="card-head">{tree.name} — Details</div>
            <div className="card-body">
              <div className="formsection">
                <div className="fs-title">Registration</div>
                <div className="formgrid">
                  <div className="field">
                    <label>Registered Address</label>
                    <div className="input" style={{ background: '#F4F6FA' }}>
                      {tree.address ?? '—'}
                    </div>
                  </div>
                  <div className="field">
                    <label>Currency</label>
                    <div className="input" style={{ background: '#F4F6FA' }}>
                      {tree.currency}
                    </div>
                  </div>
                </div>
              </div>

              <div className="formsection">
                <div className="fs-title">
                  Branches
                  {canManage && (
                    <button
                      className="btn-ghost"
                      style={{ float: 'right', fontWeight: 700 }}
                      onClick={() => setShowAddBranch(true)}
                    >
                      + Add
                    </button>
                  )}
                </div>
                {branches && branches.length > 0 ? (
                  <table>
                    <tbody>
                      {branches.map((b) => (
                        <tr key={b.id}>
                          <td>{b.name}</td>
                          <td>
                            <span className={`badge ${b.status === 'active' ? 'success' : 'neutral'}`}>
                              <span className="dot" />
                              {b.status}
                            </span>
                          </td>
                          {canManage && (
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--error, #c0392b)' }} onClick={() => del(`/organization/branches/${b.id}`, `branch "${b.name}"`)}>
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="hint">No branches registered for this company yet.</div>
                )}
              </div>

              <div className="formsection">
                <div className="fs-title">
                  Departments
                  {canManage && (
                    <button
                      className="btn-ghost"
                      style={{ float: 'right', fontWeight: 700 }}
                      onClick={() => setShowAddDept(true)}
                    >
                      + Add
                    </button>
                  )}
                </div>
                {departments && departments.length > 0 ? (
                  <table>
                    <tbody>
                      {departments.map((d) => (
                        <tr key={d.id}>
                          <td>{d.name}</td>
                          {canManage && (
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--error, #c0392b)' }} onClick={() => del(`/organization/departments/${d.id}`, `department "${d.name}"`)}>
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="hint">No departments registered for this company yet.</div>
                )}
              </div>

              <div className="formsection">
                <div className="fs-title">
                  Policies
                  {canManage && (
                    <button
                      className="btn-ghost"
                      style={{ float: 'right', fontWeight: 700 }}
                      onClick={() => setShowAddPolicy(true)}
                    >
                      + Add
                    </button>
                  )}
                </div>
                {policies && policies.length > 0 ? (
                  <table>
                    <tbody>
                      {policies.map((p) => (
                        <tr key={p.id}>
                          <td>
                            {p.name}
                            {p.policyType && <span className="hint"> — {p.policyType}</span>}
                          </td>
                          <td>
                            <span className={`badge ${p.status === 'active' ? 'success' : 'neutral'}`}>
                              <span className="dot" />
                              {p.status}
                            </span>
                          </td>
                          {canManage && (
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--error, #c0392b)' }} onClick={() => del(`/organization/policies/${p.id}`, `policy "${p.name}"`)}>
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="hint">No policies configured for this company yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddBranch && id && (
        <SimpleCreateModal
          title="New Branch"
          onClose={() => setShowAddBranch(false)}
          onSubmit={async (name) => {
            await apiRequest(`/organization/companies/${id}/branches`, { method: 'POST', body: { name } });
            await load();
          }}
        />
      )}
      {showAddDept && id && (
        <SimpleCreateModal
          title="New Department"
          onClose={() => setShowAddDept(false)}
          onSubmit={async (name) => {
            await apiRequest(`/organization/companies/${id}/departments`, { method: 'POST', body: { name } });
            await load();
          }}
        />
      )}
      {showAddPolicy && id && <NewPolicyModal companyId={id} onClose={() => setShowAddPolicy(false)} onCreated={load} />}
    </Layout>
  );
}

function NewPolicyModal({ companyId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [policyType, setPolicyType] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/organization/companies/${companyId}/policies`, {
        method: 'POST',
        body: { name, policyType: policyType || undefined, description: description || undefined, effectiveDate: effectiveDate || undefined },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create policy.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Company Policy</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Name <span className="req">*</span>
            </label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Type</label>
              <input className="input" value={policyType} onChange={(e) => setPolicyType(e.target.value)} placeholder="e.g. HR, Finance, IT" />
            </div>
            <div className="field">
              <label>Effective Date</label>
              <input className="input" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
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
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SimpleCreateModal({ title, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(name);
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>
              Name <span className="req">*</span>
            </label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
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
