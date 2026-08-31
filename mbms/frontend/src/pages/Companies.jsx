import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function CompaniesPage() {
  const { hasRole } = useAuth();
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const canViewAll = hasRole('Super Administrator', 'Managing Director', 'Group CEO', 'IT Administrator');
  // Subsidiary lifecycle (27 August 2026): the Managing Director can create,
  // activate/deactivate and delete subsidiaries.
  const canManage = hasRole('Super Administrator', 'IT Administrator', 'Managing Director');

  async function rowAction(id, action) {
    setError(null);
    try {
      await apiRequest(`/organization/companies/${id}${action}`, action === '' ? { method: 'DELETE' } : { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Action failed.');
    }
  }

  async function load() {
    setError(null);
    try {
      if (canViewAll) {
        const { items } = await apiRequestWithMeta('/organization/companies', { pageSize: 100 });
        setCompanies(items);
      } else {
        // Scoped roles can't call the group-wide list endpoint (403) — fall
        // back to fetching only the companies in their own scope directly,
        // same restriction the API enforces server-side.
        setCompanies([]);
      }
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load companies.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Companies</div>
          <h1>Companies</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Company
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      {!canViewAll && (
        <div className="banner info">
          <span>&#128274;</span> Your role is scoped to specific companies — open a company you have access to
          directly, or ask an administrator for the group-wide view.
        </div>
      )}

      <div className="card">
        {companies === null ? (
          <div className="loading">Loading…</div>
        ) : companies.length === 0 ? (
          <div className="empty">No companies to show.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Type</th>
                <th>Currency</th>
                <th>Status</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} onClick={() => (window.location.href = `/companies/${c.id}`)}>
                  <td>
                    <Link className="rowlink" to={`/companies/${c.id}`}>
                      {c.name}
                    </Link>
                  </td>
                  <td>
                    {c.parentCompanyId
                      ? c.relationshipType === 'associate'
                        ? `Associate${c.ownershipPercent != null ? ` (${c.ownershipPercent}%)` : ''}`
                        : `Subsidiary${c.ownershipPercent != null ? ` (${c.ownershipPercent}%)` : ''}`
                      : 'Holding Company'}
                  </td>
                  <td>{c.currency}</td>
                  <td>
                    <span className={`badge ${c.status === 'active' ? 'success' : 'neutral'}`}>
                      <span className="dot" />
                      {c.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td onClick={(e) => e.stopPropagation()}>
                      {c.parentCompanyId ? (
                        <div className="row" style={{ gap: 6 }}>
                          <button
                            className="btn-ghost"
                            style={{ fontSize: 12 }}
                            onClick={() => rowAction(c.id, c.status === 'active' ? '/deactivate' : '/activate')}
                          >
                            {c.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="btn-ghost"
                            style={{ fontSize: 12, color: 'var(--error, #c0392b)' }}
                            onClick={() => {
                              if (window.confirm(`Delete "${c.name}"? This only works if it has no branches, departments, staff or records.`))
                                rowAction(c.id, '');
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="hint">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateCompanyModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </Layout>
  );
}

function CreateCompanyModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [parentCompanyId, setParentCompanyId] = useState('');
  const [relationshipType, setRelationshipType] = useState('subsidiary');
  const [ownershipPercent, setOwnershipPercent] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [financialYearStart, setFinancialYearStart] = useState('2026-01-01');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/organization/companies', {
        method: 'POST',
        body: {
          name,
          currency,
          financialYearStart,
          logoUrl: logoUrl || undefined,
          ...(parentCompanyId
            ? {
                parentCompanyId,
                relationshipType,
                ownershipPercent: ownershipPercent ? Number(ownershipPercent) : undefined,
              }
            : {}),
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create company.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Company</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Name <span className="req">*</span>
            </label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Parent Company ID (leave blank for the root holding company)</label>
            <input
              className="input"
              value={parentCompanyId}
              onChange={(e) => setParentCompanyId(e.target.value)}
              placeholder="uuid, optional"
            />
          </div>
          {parentCompanyId && (
            <div className="formgrid" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>Relationship</label>
                <select className="select" value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)}>
                  <option value="subsidiary">Subsidiary</option>
                  <option value="associate">Associate / Affiliate</option>
                </select>
              </div>
              <div className="field">
                <label>Ownership %</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={ownershipPercent}
                  onChange={(e) => setOwnershipPercent(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
          )}
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Logo URL</label>
            <input
              className="input"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://... (optional)"
            />
          </div>
          <div className="formgrid">
            <div className="field">
              <label>Currency</label>
              <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
            </div>
            <div className="field">
              <label>Financial Year Start</label>
              <input
                className="input"
                type="date"
                value={financialYearStart}
                onChange={(e) => setFinancialYearStart(e.target.value)}
              />
            </div>
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
