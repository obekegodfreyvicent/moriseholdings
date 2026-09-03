import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { IdCard } from '../components/IdCard';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Admin » Human Resources » Staff ID Cards (3 September 2026). Every actively
// registered administration staff member carries one automatic identity
// card. Cards are issued automatically when an employee record is created;
// this screen lets an administrator run the bulk sweep for anyone still
// missing one, and issue / reissue / revoke / restore or correct a single
// card. Reads need employee.idcard.manage or employee.idcard.viewAll;
// writes need employee.idcard.manage.

const SMALL_BTN = { padding: '4px 10px', fontSize: 12 };

export function StaffIdCardsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('employee.idcard.manage');

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [editCard, setEditCard] = useState(null);

  useEffect(() => {
    apiRequestWithMeta('/organization/companies', { pageSize: 100 })
      .then(({ items }) => setCompanies(items))
      .catch(() => setCompanies([]));
  }, []);

  async function load() {
    setError(null);
    try {
      const query = { pageSize: 100 };
      if (companyId) query['filter[companyId]'] = companyId;
      if (status) query['filter[status]'] = status;
      if (search.trim()) query['filter[search]'] = search.trim();
      const [{ items }, sum] = await Promise.all([
        apiRequestWithMeta('/staff-id-cards', query),
        apiRequest('/staff-id-cards/summary', { query: companyId ? { 'filter[companyId]': companyId } : {} }),
      ]);
      setRows(items);
      setSummary(sum);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Unable to load staff ID cards.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, status]);

  async function runGenerate() {
    if (!window.confirm('Issue an identification card for every active staff member that does not have one, and expire any card past its date?')) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest('/staff-id-cards/generate', {
        method: 'POST',
        body: companyId ? { companyId } : {},
      });
      setNotice(
        `Generated ${res.generated} new card${res.generated === 1 ? '' : 's'}` +
          (res.expired ? `, expired ${res.expired} past its date` : '') +
          `. ${res.activeStaff} active staff in view.`,
      );
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function act(card, action) {
    let body = {};
    if (action === 'revoke') {
      const reason = window.prompt('Reason for revoking this card?');
      if (!reason || !reason.trim()) return;
      body = { reason: reason.trim() };
    } else if (action === 'reissue') {
      if (!window.confirm(`Reissue ${card.cardNumber}? A new card number and a fresh 3-year expiry are assigned.`)) return;
    } else if (action === 'restore') {
      if (!window.confirm(`Restore ${card.cardNumber} to active?`)) return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/staff-id-cards/${card.id}/${action}`, { method: 'POST', body });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : `${action} failed.`);
    } finally {
      setBusy(false);
    }
  }

  const withCards = useMemo(() => new Set((rows || []).map((c) => c.employee.id)), [rows]);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Human Resources</div>
          <h1>Staff ID Cards</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-secondary" disabled={busy} onClick={() => setIssueOpen(true)}>+ Issue a card</button>{' '}
            <button className="btn btn-primary" disabled={busy} onClick={runGenerate}>Generate missing cards</button>
          </div>
        )}
      </div>

      {summary && (
        <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          <Stat label="Active staff" value={summary.activeStaff} />
          <Stat label="Cards issued" value={summary.cardsIssued} />
          <Stat label="Missing" value={summary.missing} tone={summary.missing > 0 ? 'warn' : undefined} />
          <Stat label="Active" value={summary.active} />
          <Stat label="Revoked" value={summary.revoked} />
          <Stat label="Expired" value={summary.expired} />
          <Stat label="Expiring ≤ 30d" value={summary.expiringWithin30Days} tone={summary.expiringWithin30Days > 0 ? 'warn' : undefined} />
        </div>
      )}

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 240 }}>
          <label>Company</label>
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies in my scope</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 150 }}>
          <label>Status</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 200, flex: 1 }}>
          <label>Search</label>
          <input
            className="input"
            placeholder="Name, staff no., card no., job title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <button className="btn btn-secondary" onClick={load}>Search</button>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner info">{notice}</div>}

      {rows === null ? (
        <div className="card"><div className="loading">Loading…</div></div>
      ) : rows.length === 0 ? (
        <div className="card"><div className="empty">No identification cards match this view.</div></div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
          {rows.map((card) => (
            <div key={card.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <IdCard card={card} />
              {canManage && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 340 }}>
                  <button className="btn btn-secondary" style={SMALL_BTN} disabled={busy} onClick={() => setEditCard(card)}>Edit</button>
                  <button className="btn btn-secondary" style={SMALL_BTN} disabled={busy} onClick={() => act(card, 'reissue')}>Reissue</button>
                  {card.status === 'active' ? (
                    <button className="btn btn-secondary" style={SMALL_BTN} disabled={busy} onClick={() => act(card, 'revoke')}>Revoke</button>
                  ) : card.status === 'revoked' ? (
                    <button className="btn btn-secondary" style={SMALL_BTN} disabled={busy} onClick={() => act(card, 'restore')}>Restore</button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {issueOpen && (
        <IssueModal
          companies={companies}
          excludeEmployeeIds={withCards}
          onClose={() => setIssueOpen(false)}
          onDone={() => { setIssueOpen(false); load(); }}
        />
      )}
      {editCard && (
        <EditModal card={editCard} onClose={() => setEditCard(null)} onDone={() => { setEditCard(null); load(); }} />
      )}
    </Layout>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone === 'warn' ? 'var(--warning, #D98C00)' : 'var(--navy, #1E3A5F)' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#7c8aa3' }}>{label}</div>
    </div>
  );
}

function IssueModal({ companies, excludeEmployeeIds, onClose, onDone }) {
  const [companyId, setCompanyId] = useState('');
  const [employees, setEmployees] = useState(null);
  const [employeeId, setEmployeeId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [validYears, setValidYears] = useState(3);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmployees(null);
    setEmployeeId('');
    const query = { pageSize: 100, 'filter[status]': 'active' };
    if (companyId) query['filter[companyId]'] = companyId;
    apiRequestWithMeta('/employees', query)
      .then(({ items }) => setEmployees(items.filter((e) => !excludeEmployeeIds.has(e.id))))
      .catch(() => setEmployees([]));
  }, [companyId, excludeEmployeeIds]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/staff-id-cards', {
        method: 'POST',
        body: { employeeId, photoUrl: photoUrl.trim() || undefined, validYears: Number(validYears) },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Issue failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2>Issue an identification card</h2>
        <p style={{ color: '#5b6a85', fontSize: 13, marginTop: -4 }}>
          Only active staff without a card are listed. New employees get a card automatically — use this for someone who was skipped.
        </p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Company</label>
            <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">All companies in my scope</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Employee <span className="req">*</span></label>
            <select className="select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              <option value="">{employees === null ? 'Loading…' : employees.length === 0 ? 'Everyone already has a card' : '— select —'}</option>
              {(employees || []).map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} · {e.employeeNumber}{e.jobTitle ? ` · ${e.jobTitle}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Photo URL</label>
            <input className="input" placeholder="https://… (optional — falls back to initials)" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Valid for (years)</label>
            <input className="input" type="number" min={1} max={10} value={validYears} onChange={(e) => setValidYears(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !employeeId}>{saving ? 'Issuing…' : 'Issue card'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditModal({ card, onClose, onDone }) {
  const [photoUrl, setPhotoUrl] = useState(card.photoUrl || '');
  const [expiresOn, setExpiresOn] = useState((card.expiresOn || '').slice(0, 10));
  const [backNotes, setBackNotes] = useState(card.backNotes || '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/staff-id-cards/${card.id}`, {
        method: 'PATCH',
        body: {
          photoUrl: photoUrl.trim(),
          expiresOn: expiresOn || undefined,
          backNotes: backNotes.trim(),
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.apiError.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2>{card.cardNumber} — {card.employee.fullName}</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Photo URL <span style={{ color: '#8592a8', fontWeight: 400 }}>(front)</span></label>
            <input className="input" placeholder="https://… (leave blank for initials)" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Expires on <span style={{ color: '#8592a8', fontWeight: 400 }}>(front)</span></label>
            <input className="input" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            <div style={{ fontSize: 11.5, color: '#7c8aa3', marginTop: 4 }}>
              Setting a future date on an expired card reactivates it. A revoked card stays revoked until restored.
            </div>
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Back note <span style={{ color: '#8592a8', fontWeight: 400 }}>(back)</span></label>
            <textarea className="input" rows={2} maxLength={500} placeholder="Optional note printed on the card back" value={backNotes} onChange={(e) => setBackNotes(e.target.value)} />
            <div style={{ fontSize: 11.5, color: '#7c8aa3', marginTop: 4 }}>
              National ID, emergency contact and the issuer address are taken automatically from the employee and company records.
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
