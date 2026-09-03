import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useT } from '../lib/i18n';
import { apiRequest, downloadFile } from '../lib/api';
import { money } from '../lib/format';

// Dedicated "confirm your delivery" page (3 September 2026) — a focused
// confirmation button / link the customer is sent to (from the Home prompt,
// an Orders-row link, or a shared /orders/:id/confirm URL). It appears for
// any order an administrator has marked `delivered`; a Morise Logistics
// delivery record is not required. On a "received in good condition"
// confirmation MBMS automatically issues a Morise e-Stamp on the order's
// invoice.
export function ConfirmDeliveryPage() {
  const { id } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const [order, setOrder] = useState(undefined); // undefined = loading, null = not found
  const [delivery, setDelivery] = useState(null); // optional Morise Logistics record
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [problemMode, setProblemMode] = useState(false);
  const [condition, setCondition] = useState('damaged');
  const [note, setNote] = useState('');

  function loadOrder() {
    return apiRequest(`/customer-portal/orders/${id}`).then(setOrder).catch(() => setOrder(null));
  }

  useEffect(() => {
    loadOrder();
    apiRequest(`/customer-portal/orders/${id}/delivery`).then(setDelivery).catch(() => setDelivery(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await loadOrder();
    } catch (err) {
      setError(err.apiError?.message || t('orders.ack.failed'));
    } finally {
      setBusy(false);
    }
  }

  const confirmedGood =
    (result && result.eStamp) ||
    (order && order.customerReceiptConfirmedAt && order.customerReceiptCondition === 'good');
  const confirmedProblem =
    (result && result.exceptionOpened) ||
    (order && order.customerReceiptConfirmedAt && order.customerReceiptCondition && order.customerReceiptCondition !== 'good');
  const canConfirm = order && order.status === 'delivered' && !order.customerReceiptConfirmedAt;
  const stampNumber =
    (result && result.eStamp && result.eStamp.stampNumber) || (order && order.invoice && order.invoice.stampNumber);
  const stampInvoiceId =
    (result && result.eStamp && result.eStamp.invoiceId) || (order && order.invoice && order.invoice.id);

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
          {order.deliveredAt && (
            <div style={{ fontSize: 13, color: 'var(--sf-text-muted)', marginTop: 4 }}>
              {t('orders.ack.deliveredOn', { date: new Date(order.deliveredAt).toLocaleDateString() })}
              {delivery?.driver?.name ? ` ${t('orders.ack.byDriver', { driver: delivery.driver.name })}` : ''}
            </div>
          )}
        </div>
      )}

      <div className="sf-card">
        {order === undefined ? (
          <div className="sf-loading">{t('common.loading')}</div>
        ) : order === null || order.status !== 'delivered' ? (
          <div className="sf-empty">{t('confirm.nothingToConfirm')}</div>
        ) : confirmedGood ? (
          <div>
            <div className="sf-banner sf-banner-success">
              {t('orders.ack.confirmed', {
                date: new Date(order.customerReceiptConfirmedAt || Date.now()).toLocaleDateString(),
              })}
              {stampNumber && ' ' + t('orders.ack.estampAdded', {
                number: stampNumber,
                invoice: order.invoice ? order.invoice.invoiceNumber : '',
              })}
            </div>
            <div className="sf-row" style={{ gap: 10 }}>
              {stampInvoiceId && (
                <button
                  className="sf-btn sf-btn-secondary"
                  onClick={() => downloadFile(`/customer-portal/invoices/${stampInvoiceId}/pdf`)}
                >
                  {t('confirm.downloadStamped')}
                </button>
              )}
              <button className="sf-btn sf-btn-primary" onClick={() => navigate('/orders')}>
                {t('confirm.backToOrders')}
              </button>
            </div>
          </div>
        ) : confirmedProblem ? (
          <div>
            <div className="sf-banner sf-banner-warning">
              {t('orders.ack.reported', {
                condition: t(`orders.ack.condition.${order.customerReceiptCondition || condition}`),
                date: new Date(order.customerReceiptConfirmedAt || Date.now()).toLocaleDateString(),
              })}
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
