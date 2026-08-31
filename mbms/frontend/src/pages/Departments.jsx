import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Admin » Departments (28 August 2026). The dedicated management screen for
// the department structure that already exists as a data entity — list every
// department across the companies in scope, with headcount, and create /
// rename / delete. Writes require organization.company.manage; the delete is
// blocked while staff are still assigned.

export function DepartmentsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('organization.company.manage');

  const [companies, setCompanies] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [editRow, setEditRow] = useState(null);

  useEffect(() => {
    apiRequestWithMeta('/organization/companies', { pageSize: 100 })
      .then(({ items }) => setCompanies(items))
      .catch(() => setCompanies([]));
  }, []);

  async function load() {
    setError(null);
    try {
      const data = await apiRequest('/organization/departments', { query: companyId ? { companyId } : {} });
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load departments.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function del(row) {
    if (!window.confirm(`Delete "${row.name}"${row.companyName ? ` (${row.companyName})` : ''}?`)) return;
    setError(null);
    try {
      await apiRequest(`/organization/departments/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Delete failed.');
    }
  }

  const totalStaff = useMemo(() => (rows || []).reduce((s, r) => s + (r.employeeCount || 0), 0), [rows]);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Human Resources</div>
          <h1>Departments</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New department</button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 260 }}>
          <label>Company</label>
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies in my scope</option>
            {(companies || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {rows && (
          <span style={{ fontSize: 13, color: '#7c8aa3' }}>
            {rows.length} department{rows.length === 1 ? '' : 's'} · {totalStaff} staff assigned
          </span>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
        {rows === null ? (
          <div className="loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No departments.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Company</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Employees</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.companyName || '—'}</td>
                  <td style={{ color: '#5b6a85', fontSize: 13 }}>{r.description || '—'}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{(r.employeeCount || 0).toLocaleString()}</td>
                  {canManage && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary" onClick={() => setEditRow(r)}>Rename</button>{' '}
                      <button className="btn btn-secondary" onClick={() => del(r)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <DepartmentModal companies={companies || []} onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); load(); }} />
      )}
      {editRow && (
        <DepartmentModal row={editRow} companies={companies || []} onClose={() => setEditRow(null)} onDone={() => { setEditRow(null); load(); }} />
      )}
    </Layout>
  );
}

function DepartmentModal({ row, companies, onClose, onDone }) {
  const editing = !!row;
  const [companyId, setCompanyId] = useState(row?.companyId || '');
  const [name, setName] = useState(row?.name || '');
  const [description, setDescription] = useState(row?.description || '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await apiRequest(`/organization/departments/${row.id}`, {
          method: 'PATCH',
          body: { name: name.trim(), description: description.trim() || null },
        });
      } else {
        await apiRequest(`/organization/companies/${companyId}/departments`, {
          method: 'POST',
          body: { name: name.trim(), description: description.trim() || undefined },
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? `Rename ${row.name}` : 'New department'}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          {!editing && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Company <span className="req">*</span></label>
              <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
                <option value="">— select —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Name <span className="req">*</span></label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Description</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || (!editing && !companyId)}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
