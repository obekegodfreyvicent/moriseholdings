import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useT, useI18n } from '../lib/i18n';
import { apiRequest, apiRequestWithMeta } from '../lib/api';
import { statusBadgeClass } from '../lib/format';

const CATEGORY_VALUES = ['delivery_issue', 'billing', 'product', 'other'];

export function SupportPage() {
  const t = useT();
  const { tStatus, tPriority } = useI18n();
  const [tickets, setTickets] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState(null);

  const [category, setCategory] = useState('delivery_issue');
  const [priority, setPriority] = useState('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [relatedOrderId, setRelatedOrderId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiRequestWithMeta('/customer-portal/support-tickets', { pageSize: 100 })
      .then(({ items }) => setTickets(items))
      .catch((err) => setError(err.apiError?.message || t('support.loadFailed')));
  }

  useEffect(() => {
    load();
    apiRequestWithMeta('/customer-portal/orders', { pageSize: 20 }).then(({ items }) => setOrders(items));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    apiRequest(`/customer-portal/support-tickets/${selectedId}`).then(setDetail);
  }, [selectedId]);

  async function submitTicket(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await apiRequest('/customer-portal/support-tickets', {
        method: 'POST',
        body: { category, priority, subject, description, relatedOrderId: relatedOrderId || undefined },
      });
      setSubject('');
      setDescription('');
      setRelatedOrderId('');
      load();
      setSelectedId(ticket.id);
    } catch (err) {
      setError(err.apiError?.message || t('support.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    const updated = await apiRequest(`/customer-portal/support-tickets/${selectedId}/messages`, { method: 'POST', body: { message: reply } });
    setDetail(updated);
    setReply('');
    load();
  }

  return (
    <Layout>
      <div className="sf-pagehead">
        <div>
          <span className="sf-crumb">{t('nav.support')}</span>
          <h1>{t('support.heading')}</h1>
        </div>
      </div>

      {error && <div className="sf-banner sf-banner-error">{error}</div>}

      <div className="sf-grid-2">
        <div className="sf-card">
          {!tickets ? (
            <div className="sf-loading">{t('common.loading')}</div>
          ) : tickets.length === 0 ? (
            <div className="sf-empty">{t('support.noTickets')}</div>
          ) : (
            <table className="sf-table">
              <thead>
                <tr>
                  <th>{t('support.ticketNo')}</th>
                  <th>{t('support.subject')}</th>
                  <th>{t('support.priority')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((tk) => (
                  <tr key={tk.id} className="clickable" style={tk.id === selectedId ? { background: 'var(--sf-neutral-bg)' } : undefined} onClick={() => setSelectedId(tk.id)}>
                    <td>{tk.ticketNumber}</td>
                    <td>{tk.subject}</td>
                    <td>
                      <span className={`sf-badge ${tk.priority === 'high' ? 'sf-badge-error' : tk.priority === 'medium' ? 'sf-badge-warning' : 'sf-badge-neutral'}`}>
                        {tPriority(tk.priority)}
                      </span>
                    </td>
                    <td>
                      <span className={`sf-badge ${statusBadgeClass(tk.status)}`}>{tStatus(tk.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {detail && (
            <>
              <hr className="sf-divider" />
              <strong>
                {detail.ticketNumber} — {detail.subject}
              </strong>
              <div className="sf-thread">
                {detail.messages.map((m) => (
                  <div key={m.id} className={`sf-message ${m.authorType}`}>
                    <div className="sf-message-meta">{m.authorType === 'customer' ? t('support.you') : t('support.moriseSupport')} · {new Date(m.createdAt).toLocaleString()}</div>
                    {m.message}
                  </div>
                ))}
              </div>
              {detail.status !== 'closed' && (
                <form onSubmit={sendReply} className="sf-row">
                  <input className="sf-input" placeholder={t('support.writeReply')} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <button className="sf-btn sf-btn-primary" type="submit">
                    {t('support.send')}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="sf-card">
          <strong>{t('support.newTicket')}</strong>
          <form onSubmit={submitTicket}>
            <div className="sf-row" style={{ gap: 14, marginTop: 12 }}>
              <div className="sf-field" style={{ flex: 1 }}>
                <label>{t('support.categoryRequired')}</label>
                <select className="sf-select" value={category} onChange={(e) => setCategory(e.target.value)} required>
                  {CATEGORY_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {t(`support.cat.${v}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sf-field" style={{ flex: 1 }}>
                <label>{t('support.priority')}</label>
                <select className="sf-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">{t('priority.low')}</option>
                  <option value="medium">{t('priority.medium')}</option>
                  <option value="high">{t('priority.high')}</option>
                </select>
              </div>
            </div>
            <div className="sf-field">
              <label>{t('support.subjectRequired')}</label>
              <input className="sf-input" placeholder={t('support.briefSummary')} value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div className="sf-field">
              <label>{t('support.relatedOrder')}</label>
              <select className="sf-select" value={relatedOrderId} onChange={(e) => setRelatedOrderId(e.target.value)}>
                <option value="">{t('support.none')}</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="sf-field">
              <label>{t('support.descriptionRequired')}</label>
              <textarea className="sf-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <button className="sf-btn sf-btn-primary sf-btn-block" type="submit" disabled={submitting}>
              {submitting ? t('support.submitting') : t('support.submitTicket')}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
