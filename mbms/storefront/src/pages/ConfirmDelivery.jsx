import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useT } from '../lib/i18n';
import { apiRequest, downloadFile } from '../lib/api';
import { money } from '../lib/format';

// Dedicated "confirm your delivery" page (3 September 2026) — a focused
// confirmation button / link the customer can be sent to (from the Home
// prompt, an Orders-row link, or a shared /orders/:id/confirm URL). On a
// "received in good condition" confirmation MBMS automatically issues a
// Morise e-Stamp on the order's invoice.
export function ConfirmDeliveryPage() {
  const { id } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [delivery, setDelivery] = useState(undefined); // undefined = loading, null = none
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [problemMode, setProblemMode] = useState(false);
  const [condition, setCondition] = useState('damaged');
  const [note, setNote] = useState('');

  useEffect(() => {
    apiRequest(`/customer-portal/orders/${id}`).then(setOrder).catch(() => setOrder(null));
    apiRequest(`/customer-portal/orders/${id}/delivery`)
      .then((d) => setDelivery(d))
      .catch(() => setDelivery(null));
  }, [id]);

  async function submit(cond, text) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest(`/customer-portal/orders/${id}/delivery/acknowledge`, {
        method: 'POST',
        body: { condition: cond, note: text || undefined },
      });
      setResult(res);
      const fresh = await apiRequest(`/customer-portal/orders/${id}/delivery`);
      setDelivery(fresh);
    } catch (err) {
      setError(err.apiError?.message || t('orders.ack.failed'));
    } finally {
      setBusy(false);
    }
  }

  const alreadyDone = delivery && delivery.customerAckAt;
  const canConfirm = delivery && delivery.status === 'delivered' && !delivery.customerAckAt;

  return (
    <Layout>
      <div className="sf-pagehead">
        <div>
          <span className="sf-crumb">
            <Link to="/orders">{t('nav.orders')}</Link> / {t('confirm.crumb')}
          </span>
          <h1>{t('confirm.heading')}</h1>
        </div>
      </div>

      {error && <div className="sf-banner sf-banner-error">{error}</div>}

      {order && (
        <div className="sf-card" style={{ marginBottom: 14 }}>
          <div className="sf-row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <strong>{t('confirm.orderLine', { order: order.orderNumber, company: order.companyName || '—' })}</strong>
            <span>{money(order.totalAmount)}</span>
          </div>
          {delivery && delivery.deliveredAt && (
            <div style={{ fontSize: 13, color: 'var(--sf-text-muted)', marginTop: 4 }}>
              {t('orders.ack.deliveredOn', {
                date: new Date(delivery.deliveredAt).toLocaleDateString(),
                driver: delivery.driver?.name || '—',
              })}
            </div>
          )}
        </div>
      )}

      <div className="sf-card">
        {delivery === undefined ? (
          <div className="sf-loading">{t('common.loading')}</div>
        ) : !delivery || delivery.status !== 'delivered' ? (
          <div className="sf-empty">{t('confirm.nothingToConfirm')}</div>
        ) : result && result.eStamp ? (
          <div>
            <div className="sf-banner sf-banner-success">
              {t('orders.ack.confirmed', { date: new Date().toLocaleDateString() })}{' '}
              {t('orders.ack.estampAdded', {
                number: result.eStamp.stampNumber,
                invoice: result.eStamp.invoiceNumber,
              })}
            </div>
            <div className="sf-row" style={{ gap: 10 }}>
              <button
                className="sf-btn sf-btn-secondary"
                onClick={() => downloadFile(`/customer-portal/invoices/${result.eStamp.invoiceId}/pdf`)}
              >
                {t('confirm.downloadStamped')}
              </button>
              <button className="sf-btn sf-btn-primary" onClick={() => navigate('/orders')}>
                {t('confirm.backToOrders')}
              </button>
            </div>
          </div>
        ) : (result && result.exceptionOpened) || (alreadyDone && delivery.customerAckCondition !== 'good') ? (
          <div>
            <div className="sf-banner sf-banner-warning">
              {t('orders.ack.reported', {
                condition: t(`orders.ack.condition.${delivery.customerAckCondition || condition}`),
                date: new Date(delivery.customerAckAt || Date.now()).toLocaleDateString(),
              })}
            </div>
            <button className="sf-btn sf-btn-primary" onClick={() => navigate('/orders')}>
              {t('confirm.backToOrders')}
            </button>
          </div>
        ) : alreadyDone ? (
          <div>
            <div className="sf-banner sf-banner-success">
              {t('orders.ack.confirmed', { date: new Date(delivery.customerAckAt).toLocaleDateString() })}
              {delivery.eStamp && delivery.eStamp.stampNumber && (
                <>
                  {' '}
                  {t('orders.ack.estampAdded', {
                    number: delivery.eStamp.stampNumber,
                    invoice: delivery.eStamp.invoiceNumber,
                  })}
                </>
              )}
            </div>
            <button className="sf-btn sf-btn-primary" onClick={() => navigate('/orders')}>
              {t('confirm.backToOrders')}
            </button>
          </div>
        ) : canConfirm ? (
          <div>
            <p style={{ marginTop: 0 }}>{t('confirm.prompt')}</p>
            {!problemMode ? (
              <div className="sf-row" style={{ gap: 12, flexWrap: 'wrap' }}>
                <button className="sf-btn sf-btn-primary" disabled={busy} onClick={() => submit('good')}>
                  {t('confirm.confirmBtn')}
                </button>
                <button className="sf-btn sf-btn-secondary" disabled={busy} onClick={() => setProblemMode(true)}>
                  {t('orders.ack.problemBtn')}
                </button>
              </div>
            ) : (
              <div>
                <select
                  className="sf-select"
                  style={{ width: '100%', marginBottom: 8 }}
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                >
                  <option value="damaged">{t('orders.ack.condition.damaged')}</option>
                  <option value="incomplete">{t('orders.ack.condition.incomplete')}</option>
                  <option value="not_received">{t('orders.ack.condition.not_received')}</option>
                </select>
                <textarea
                  className="sf-input"
                  rows={3}
                  style={{ width: '100%', marginBottom: 8 }}
                  placeholder={t('orders.ack.notePlaceholder')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="sf-row" style={{ gap: 10 }}>
                  <button
                    className="sf-btn sf-btn-primary"
                    disabled={busy}
                    onClick={() => submit(condition, note.trim())}
                  >
                    {t('orders.ack.submitReport')}
                  </button>
                  <button className="sf-btn sf-btn-secondary" disabled={busy} onClick={() => setProblemMode(false)}>
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="sf-empty">{t('confirm.nothingToConfirm')}</div>
        )}
      </div>
    </Layout>
  );
}
