import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Sprint 16 (Customer Storefront) — staff side: view and reply to a
// customer's support ticket. The customer's own equivalent is the
// storefront app's Support screen, backed by the same SupportService.
export function SupportTicketsPage() {
  const { hasRole, hasPermission } = useAuth();
  // Matches the backend's actual support.ticket.manage grant (seed.ts) —
  // Super Administrator and Customer Service Officer hold it naturally,
  // plus IT Administrator, seeded in place of a Customer Service Officer
  // demo user (see seed.ts's own comment on that grant).
  const canManage = hasRole('Super Administrator', 'Customer Service Officer', 'IT Administrator') || hasPermission('support.ticket.manage');

  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  async function load() {
    setError(null);
    try {
      const { items } = await apiRequestWithMeta('/support/tickets', { pageSize: 100 });
      setTickets(items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load support tickets.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setShowOriginal(false);
    apiRequest(`/support/tickets/${selectedId}`).then(setDetail);
  }, [selectedId]);

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const updated = await apiRequest(`/support/tickets/${selectedId}/messages`, { method: 'POST', body: { message: reply } });
      setDetail(updated);
      setReply('');
      load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    setBusy(true);
    try {
      const updated = await apiRequest(`/support/tickets/${selectedId}/resolve`, { method: 'POST' });
      setDetail(updated);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Support</div>
          <h1>Support Tickets</h1>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          {tickets === null ? (
            <div className="loading">Loading…</div>
          ) : tickets.length === 0 ? (
            <div className="empty">No support tickets to show.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="rowlink" onClick={() => setSelectedId(t.id)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{t.ticketNumber}</td>
                    <td>{t.subject}</td>
                    <td>
                      <span className={`badge ${t.priority === 'high' ? 'error' : t.priority === 'medium' ? 'warning' : 'neutral'}`}>
                        <span className="dot" />
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'resolved' ? 'success' : t.status === 'closed' ? 'neutral' : 'warning'}`}>
                        <span className="dot" />
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          {!detail ? (
            <div className="empty">Select a ticket to view the conversation.</div>
          ) : (
            <>
              <h2 style={{ marginTop: 0 }}>
                {detail.ticketNumber} — {detail.subject}
              </h2>
              {/* Content localisation (27 August 2026): customer-submitted text
                  is stored in English; when the customer wrote in another
                  language their exact wording is kept and shown here on demand. */}
              {detail.sourceLanguage && detail.sourceLanguage !== 'en' && (
                <div style={{ fontSize: 11, marginBottom: 6 }}>
                  <span className="badge neutral">Submitted in: {detail.sourceLanguage}</span>{' '}
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => setShowOriginal((v) => !v)}>
                    {showOriginal ? 'Hide original' : "Show customer's original"}
                  </button>
                </div>
              )}
              <p style={{ opacity: 0.75, fontSize: 13 }}>
                {showOriginal && detail.descriptionOriginal ? detail.descriptionOriginal : detail.description}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
                {detail.messages.map((m) => (
                  <div key={m.id} style={{ fontSize: 13, padding: 8, borderRadius: 6, background: m.authorType === 'staff' ? 'var(--bg, #f2f5fa)' : 'transparent', border: '1px solid var(--border, #eee)' }}>
                    <div style={{ opacity: 0.6, fontSize: 11, marginBottom: 2 }}>
                      {m.authorType === 'staff' ? 'Staff' : 'Customer'} · {new Date(m.createdAt).toLocaleString()}
                      {m.sourceLanguage && m.sourceLanguage !== 'en' ? ` · orig. ${m.sourceLanguage}` : ''}
                    </div>
                    {showOriginal && m.messageOriginal ? m.messageOriginal : m.message}
                  </div>
                ))}
              </div>
              {canManage && detail.status !== 'closed' && (
                <>
                  <form onSubmit={sendReply} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input className="input" placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                      Send
                    </button>
                  </form>
                  {detail.status !== 'resolved' && (
                    <button className="btn btn-secondary" onClick={resolve} disabled={busy}>
                      Mark Resolved
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
