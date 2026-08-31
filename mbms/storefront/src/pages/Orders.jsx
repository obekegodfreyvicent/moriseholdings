import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useT, useI18n } from '../lib/i18n';
import { apiRequest, apiRequestWithMeta } from '../lib/api';
import { money, statusBadgeClass } from '../lib/format';

export function OrdersPage() {
  const t = useT();
  const { tStatus } = useI18n();
  const location = useLocation();
  const [orders, setOrders] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Group catalogue (29 August 2026): a multi-subsidiary cart is placed as
  // one order per company, so `justPlaced` can be a list of order numbers.
  const justPlaced = location.state?.justPlaced
    ? Array.isArray(location.state.justPlaced)
      ? location.state.justPlaced
      : [location.state.justPlaced]
    : null;

  useEffect(() => {
    apiRequestWithMeta('/customer-portal/orders', { pageSize: 100, 'filter[status]': statusFilter || undefined })
      .then(({ items }) => {
        setOrders(items);
        const preselect = justPlaced ? items.find((o) => justPlaced.includes(o.orderNumber)) : items[0];
        if (preselect) setSelectedId(preselect.id);
      })
      .catch((err) => setError(err.apiError?.message || t('orders.loadFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    apiRequest(`/customer-portal/orders/${selectedId}`).then(setDetail);
  }, [selectedId]);

  async function reorderLast() {
    if (!orders || orders.length === 0) return;
    // Re-adds the most recent order's items to the cart, matching the
    // mockup's "Reorder Last" button — a client-side cart operation, not a
    // server call.
    const last = await apiRequest(`/customer-portal/orders/${orders[0].id}`);
    const cart = JSON.parse(localStorage.getItem('storefront.cart') || '[]');
    for (const item of last.items) {
      const existing = cart.find((c) => c.productId === item.productId);
      if (existing) existing.quantity += item.quantity;
      else
        cart.push({
          productId: item.productId,
          name: item.productName,
          unitPrice: Number(item.unitPrice),
          quantity: item.quantity,
          companyId: last.companyId || null,
          companyName: last.companyName || null,
          branchId: null,
          branchName: null,
        });
    }
    localStorage.setItem('storefront.cart', JSON.stringify(cart));
    window.location.href = '/cart';
  }

  return (
    <Layout>
      <div className="sf-pagehead">
        <div>
          <span className="sf-crumb">{t('orders.crumb')}</span>
          <h1>{t('orders.title')}</h1>
        </div>
        <button className="sf-btn sf-btn-secondary" onClick={reorderLast}>
          {t('orders.reorderLast')}
        </button>
      </div>

      {error && <div className="sf-banner sf-banner-error">{error}</div>}
      {justPlaced && (
        <div className="sf-banner sf-banner-success">
          {justPlaced.length > 1
            ? t('orders.placedMany', { count: justPlaced.length, list: justPlaced.join(', ') })
            : t('orders.placedOne', { order: justPlaced[0] })}
        </div>
      )}

      <div className="sf-toolbar">
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sf-text-muted)' }}>{t('orders.filterLabel')}</span>
        <select className="sf-select" style={{ width: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t('orders.statusAll')}</option>
          <option value="placed">{t('orders.step.placed')}</option>
          <option value="confirmed">{t('orders.step.confirmed')}</option>
          <option value="packed">{t('orders.step.packed')}</option>
          <option value="out_for_delivery">{t('orders.step.out_for_delivery')}</option>
          <option value="delivered">{t('orders.step.delivered')}</option>
          <option value="cancelled">{t('orders.cancelled')}</option>
        </select>
      </div>

      {!orders ? (
        <div className="sf-loading">{t('common.loading')}</div>
      ) : orders.length === 0 ? (
        <div className="sf-card"><div className="sf-empty">{t('orders.noOrders')}</div></div>
      ) : (
        <div className="sf-grid-2">
          <div className="sf-card">
            <table className="sf-table">
              <thead>
                <tr>
                  <th>{t('orders.orderNo')}</th>
                  <th>{t('orders.soldBy')}</th>
                  <th>{t('common.date')}</th>
                  <th>{t('common.total')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="clickable" style={o.id === selectedId ? { background: 'var(--sf-neutral-bg)' } : undefined} onClick={() => setSelectedId(o.id)}>
                    <td>{o.orderNumber}</td>
                    <td>{o.companyName || '—'}</td>
                    <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td>{money(o.totalAmount)}</td>
                    <td>
                      <span className={`sf-badge ${statusBadgeClass(o.status)}`}>{tStatus(o.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sf-card">
            {!detail ? (
              <div className="sf-loading">{t('orders.selectOrder')}</div>
            ) : (
              <>
                <strong>{t('orders.tracking', { order: detail.orderNumber })}</strong>
                {detail.status === 'cancelled' ? (
                  <div className="sf-banner sf-banner-error" style={{ marginTop: 12 }}>
                    {detail.cancellationReason
                      ? t('orders.cancelledReason', { reason: detail.cancellationReason })
                      : t('orders.cancelled')}
                  </div>
                ) : (
                  <div className="sf-tracker">
                    {(() => {
                      const completedCount = detail.trackerSteps.filter((t) => t.completed).length;
                      const currentIdx = completedCount - 1;
                      const allDone = completedCount === detail.trackerSteps.length;
                      return detail.trackerSteps.map((s, idx) => {
                        const isCurrent = !allDone && idx === currentIdx;
                        return (
                          <div key={s.step} className={`sf-tracker-step ${s.completed ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                            <div className="sf-tracker-dot">{s.completed && !isCurrent ? '✓' : idx + 1}</div>
                            <div className="sf-tracker-label">{t(`orders.step.${s.step}`)}</div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--sf-text-muted)' }}>{t('orders.items')}</strong>
                <table className="sf-table" style={{ marginTop: 8 }}>
                  <tbody>
                    {detail.items.map((i) => (
                      <tr key={i.id}>
                        <td>
                          {i.productName} × {i.quantity}
                        </td>
                        <td style={{ textAlign: 'right' }}>{money(i.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(detail.status === 'placed' || detail.status === 'confirmed') && (
                  <button
                    className="sf-btn sf-btn-secondary"
                    style={{ marginTop: 14, color: 'var(--sf-error)' }}
                    onClick={async () => {
                      await apiRequest(`/customer-portal/orders/${detail.id}/cancel`, { method: 'POST', body: {} });
                      const refreshed = await apiRequest(`/customer-portal/orders/${detail.id}`);
                      setDetail(refreshed);
                      setOrders((prev) => prev.map((o) => (o.id === refreshed.id ? refreshed : o)));
                    }}
                  >
                    {t('orders.cancelOrder')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
