import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

const STATUS_SEQUENCE = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered'];
const NEXT_LABEL = { placed: 'Confirm', confirmed: 'Mark Packed', packed: 'Dispatch', out_for_delivery: 'Mark Delivered' };

// Sprint 16 (Customer Storefront) — staff side: view and advance a
// customer order through fulfillment. The customer's own equivalent is the
// storefront app's My Orders screen, backed by the same OrdersService.
export function OrdersPage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Sales Manager', 'Branch Manager') || hasPermission('sales.order.manage');

  const [orders, setOrders] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError(null);
    try {
      const { items } = await apiRequestWithMeta('/sales/orders', { pageSize: 100, 'filter[status]': statusFilter || undefined });
      setOrders(items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load orders.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function advance(order) {
    setBusyId(order.id);
    setError(null);
    try {
      await apiRequest(`/sales/orders/${order.id}/advance-status`, { method: 'POST' });
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to advance order.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(order) {
    setBusyId(order.id);
    setError(null);
    try {
      await apiRequest(`/sales/orders/${order.id}/cancel`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to cancel order.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Sales</div>
          <h1>Orders</h1>
        </div>
        <div className="actions">
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Status: All</option>
            {STATUS_SEQUENCE.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
            <option value="cancelled">cancelled</option>
          </select>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
        {orders === null ? (
          <div className="loading">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="empty">No orders to show.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.orderNumber}</td>
                  <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td><Money value={o.totalAmount} /></td>
                  <td>
                    <span
                      className={`badge ${
                        o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'error' : 'warning'
                      }`}
                    >
                      <span className="dot" />
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    {canManage && o.status !== 'cancelled' && o.status !== 'delivered' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-ghost" disabled={busyId === o.id} onClick={() => advance(o)}>
                          {busyId === o.id ? 'Working…' : NEXT_LABEL[o.status]}
                        </button>
                        {(o.status === 'placed' || o.status === 'confirmed') && (
                          <button className="btn-ghost" disabled={busyId === o.id} onClick={() => cancel(o)} style={{ color: 'var(--error, #b91c1c)' }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
