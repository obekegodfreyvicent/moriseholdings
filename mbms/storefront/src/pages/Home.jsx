import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useT, useI18n } from '../lib/i18n';
import { apiRequest, apiRequestWithMeta } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, figure, statusBadgeClass } from '../lib/format';

export function HomePage() {
  const t = useT();
  const { tStatus } = useI18n();
  const { customer } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [outstandingInvoices, setOutstandingInvoices] = useState(null);
  const [banners, setBanners] = useState([]);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiRequest('/customer-portal/promo-banners')
      .then((rows) => setBanners(Array.isArray(rows) ? rows : []))
      .catch(() => setBanners([]));
    apiRequest('/customer-portal/catalog/subsidiaries')
      .then(setGroup)
      .catch(() => setGroup(null));
  }, []);

  useEffect(() => {
    Promise.all([apiRequest('/customer-portal/dashboard-summary'), apiRequestWithMeta('/customer-portal/invoices', { pageSize: 100 })])
      .then(([s, inv]) => {
        setSummary(s);
        setOutstandingInvoices(
          inv.items
            .filter((i) => i.status !== 'paid')
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 3),
        );
      })
      .catch((err) => setError(err.apiError?.message || t('home.loadFailed')));
  }, []);

  if (error) return <Layout><div className="sf-banner sf-banner-error">{error}</div></Layout>;
  if (!summary) return <Layout><div className="sf-loading">{t('common.loading')}</div></Layout>;

  return (
    <Layout>
      <div className="sf-hero">
        <div>
          <h2>{t('home.welcome', { name: customer?.name || '' })}</h2>
          <p>{t('home.heroSubtitle')}</p>
        </div>
        <button className="sf-btn sf-btn-accent" onClick={() => navigate('/shop')}>
          {t('home.placeNewOrder')}
        </button>
      </div>

      {banners.map((b) => (
        <div
          key={b.id}
          className="sf-card"
          style={{ background: 'var(--sf-accent-soft, #EEF4FF)', borderLeft: '4px solid var(--sf-accent, #2E5395)', marginBottom: 14 }}
        >
          <div className="sf-row-between" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 15 }}>{b.heading}</strong>
              {b.body && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--sf-text-muted)' }}>{b.body}</p>}
            </div>
            {b.linkUrl && (
              <a className="sf-btn sf-btn-secondary" href={b.linkUrl}>
                {b.linkLabel || t('common.viewAll')}
              </a>
            )}
          </div>
        </div>
      ))}

      <div className="sf-kpi-grid">
        <div className="sf-kpi">
          <div className="sf-kpi-label">{t('home.accountBalance')}</div>
          <div className="sf-kpi-value">{money(summary.accountBalance)}</div>
          {summary.overdueInvoiceCount > 0 && (
            <div className="sf-kpi-hint warn">{t('home.invoicesOverdue', { count: figure(summary.overdueInvoiceCount) })}</div>
          )}
        </div>
        <div className="sf-kpi">
          <div className="sf-kpi-label">{t('home.ordersInProgress')}</div>
          <div className="sf-kpi-value">{figure(summary.ordersInProgress)}</div>
        </div>
        <div className="sf-kpi">
          <div className="sf-kpi-label">{t('home.openTickets')}</div>
          <div className="sf-kpi-value">{figure(summary.openTickets)}</div>
        </div>
        <div className="sf-kpi">
          <div className="sf-kpi-label">{t('home.creditLimit')}</div>
          <div className="sf-kpi-value">{summary.creditLimit ? money(summary.creditLimit) : '—'}</div>
          {summary.creditUtilizedPercent !== null && (
            <div className="sf-kpi-hint">{t('home.creditUtilized', { percent: figure(summary.creditUtilizedPercent) })}</div>
          )}
        </div>
      </div>

      {group && group.subsidiaries.length > 0 && (
        <div className="sf-card" style={{ marginBottom: 14 }}>
          <div className="sf-row-between">
            <strong>{t('home.subsidiariesTitle', { holding: group.holdingCompanyName })}</strong>
            <Link to="/subsidiaries">{t('common.viewAll')}</Link>
          </div>
          <p style={{ fontSize: 13, color: 'var(--sf-text-muted)', margin: '4px 0 10px' }}>{t('home.subsidiariesNote')}</p>
          <div className="sf-home-subs">
            {group.subsidiaries.map((s) => (
              <button
                key={s.id}
                className="sf-home-sub-chip"
                disabled={s.productCount === 0}
                onClick={() => navigate(`/shop?companyId=${s.id}`)}
              >
                <strong>{s.name}</strong>
                <span>{t('subs.counts', { branches: figure(s.branchCount), products: figure(s.productCount) })}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sf-grid-2">
        <div className="sf-card">
          <div className="sf-row-between">
            <strong>{t('home.recentOrders')}</strong>
            <Link to="/orders">{t('common.viewAll')}</Link>
          </div>
          {summary.recentOrders.length === 0 ? (
            <div className="sf-empty">{t('home.noOrders')}</div>
          ) : (
            <table className="sf-table">
              <thead>
                <tr>
                  <th>{t('home.orderNo')}</th>
                  <th>{t('common.date')}</th>
                  <th>{t('common.total')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentOrders.map((o) => (
                  <tr key={o.id} className="clickable" onClick={() => navigate('/orders')}>
                    <td>{o.orderNumber}</td>
                    <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td>{money(o.totalAmount)}</td>
                    <td>
                      <span className={`sf-badge ${statusBadgeClass(o.status)}`}>{tStatus(o.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="sf-card">
          <div className="sf-row-between">
            <strong>{t('home.outstandingInvoices')}</strong>
            <Link to="/invoices/pay">{t('home.payNowLink')}</Link>
          </div>
          {outstandingInvoices && outstandingInvoices.length === 0 ? (
            <div className="sf-empty">{t('home.nothingOutstanding')}</div>
          ) : (
            <>
              <table className="sf-table">
                <tbody>
                  {(outstandingInvoices || []).map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.invoiceNumber} · {t('home.dueShort', { date: new Date(i.dueDate).toLocaleDateString() })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: i.status === 'overdue' ? 'var(--sf-error)' : undefined }}>
                        {money(i.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="sf-btn sf-btn-primary sf-btn-block" style={{ marginTop: 12 }} onClick={() => navigate('/invoices/pay')}>
                {t('home.payOutstandingBalance')}
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
