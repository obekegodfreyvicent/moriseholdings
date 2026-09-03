import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useT } from '../lib/i18n';
import { apiRequest, apiRequestWithMeta, downloadFile } from '../lib/api';
import { money, figure, statusBadgeClass } from '../lib/format';
import { useI18n } from '../lib/i18n';

export function InvoicesPage() {
  const t = useT();
  const { tStatus } = useI18n();
  const [invoices, setInvoices] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([apiRequestWithMeta('/customer-portal/invoices', { pageSize: 100 }), apiRequest('/customer-portal/invoices/summary')])
      .then(([inv, s]) => {
        setInvoices(inv.items);
        setSummary(s);
      })
      .catch((err) => setError(err.apiError?.message || t('invoices.loadFailed')));
  }, []);

  return (
    <Layout>
      <div className="sf-pagehead">
        <div>
          <span className="sf-crumb">{t('nav.invoices')}</span>
          <h1>{t('invoices.heading')}</h1>
        </div>
        <div className="sf-row">
          <button className="sf-btn sf-btn-secondary" onClick={() => downloadFile('/customer-portal/invoices/statement/pdf')}>
            {t('invoices.downloadStatement')}
          </button>
          <button className="sf-btn sf-btn-primary" onClick={() => navigate('/invoices/pay')}>
            {t('invoices.payOutstanding')}
          </button>
        </div>
      </div>

      {error && <div className="sf-banner sf-banner-error">{error}</div>}

      {summary && (
        <div className="sf-kpi-grid">
          <div className="sf-kpi">
            <div className="sf-kpi-label">{t('invoices.totalOutstanding')}</div>
            <div className="sf-kpi-value">{money(summary.totalOutstanding)}</div>
            {summary.overdueCount > 0 && (
              <div className="sf-kpi-hint warn">{t('invoices.overdueCount', { count: figure(summary.overdueCount) })}</div>
            )}
          </div>
          <div className="sf-kpi">
            <div className="sf-kpi-label">{t('invoices.count')}</div>
            <div className="sf-kpi-value">{figure(summary.invoiceCount)}</div>
          </div>
          <div className="sf-kpi">
            <div className="sf-kpi-label">{t('invoices.paymentTerms')}</div>
            <div className="sf-kpi-value" style={{ fontSize: 16 }}>
              {t('invoices.net30')}
            </div>
          </div>
        </div>
      )}

      <div className="sf-card">
        {!invoices ? (
          <div className="sf-loading">{t('common.loading')}</div>
        ) : invoices.length === 0 ? (
          <div className="sf-empty">{t('invoices.noInvoices')}</div>
        ) : (
          <table className="sf-table">
            <thead>
              <tr>
                <th>{t('invoices.invoiceNo')}</th>
                <th>{t('common.date')}</th>
                <th>{t('invoices.dueDate')}</th>
                <th>{t('common.amount')}</th>
                <th>{t('common.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.invoiceNumber}
                    {i.eStamped && (
                      <span
                        className="sf-badge sf-badge-success"
                        title={t('invoices.estamp.tooltip', { number: i.stampNumber || '' })}
                        style={{ marginLeft: 8, fontSize: 11 }}
                      >
                        {t('invoices.estamp.badge')}
                      </span>
                    )}
                  </td>
                  <td>{new Date(i.createdAt).toLocaleDateString()}</td>
                  <td>{new Date(i.dueDate).toLocaleDateString()}</td>
                  <td>{money(i.amount)}</td>
                  <td>
                    <span className={`sf-badge ${statusBadgeClass(i.status)}`}>{tStatus(i.status)}</span>
                  </td>
                  <td>
                    <a href="#" onClick={(e) => { e.preventDefault(); downloadFile(`/customer-portal/invoices/${i.id}/pdf`); }}>
                      {t('invoices.downloadPdf')}
                    </a>
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
