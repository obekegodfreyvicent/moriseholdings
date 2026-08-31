import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useT } from '../lib/i18n';
import { apiRequest, apiRequestWithMeta } from '../lib/api';
import { money } from '../lib/format';

const METHODS = [
  { value: 'mobile_money', icon: '📱', key: 'method.mobileMoney' },
  { value: 'card', icon: '💳', key: 'method.card' },
  { value: 'bank_transfer', icon: '🏦', key: 'method.bankTransfer' },
];
const METHOD_KEY = { mobile_money: 'method.mobileMoney', card: 'method.card', bank_transfer: 'method.bankTransfer' };

export function MakePaymentPage() {
  const t = useT();
  const [invoices, setInvoices] = useState(null);
  const [payments, setPayments] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [method, setMethod] = useState('mobile_money');
  const [reference, setReference] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [paying, setPaying] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  function load() {
    Promise.all([apiRequestWithMeta('/customer-portal/invoices', { pageSize: 100 }), apiRequestWithMeta('/customer-portal/payments', { pageSize: 5 })])
      .then(([inv, pay]) => {
        const unpaid = inv.items.filter((i) => i.status !== 'paid');
        setInvoices(unpaid);
        setPayments(pay.items);
        setSelected(new Set(unpaid.filter((i) => i.status === 'overdue').map((i) => i.id)));
      })
      .catch((err) => setError(err.apiError?.message || t('invoices.loadFailed')));
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const amountToPay = (invoices || []).filter((i) => selected.has(i.id)).reduce((sum, i) => sum + Number(i.amount), 0);

  async function confirmPayment() {
    setPaying(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest('/customer-portal/payments', {
        method: 'POST',
        body: { invoiceIds: Array.from(selected), method, reference: reference || undefined },
      });
      setSuccess(t('payment.success', { amount: money(amountToPay) }));
      setSelected(new Set());
      load();
    } catch (err) {
      setError(err.apiError?.message || t('payment.failed'));
    } finally {
      setPaying(false);
    }
  }

  return (
    <Layout>
      <div className="sf-pagehead">
        <div>
          <span className="sf-crumb">{t('payment.crumb')}</span>
          <h1>{t('payment.title')}</h1>
        </div>
      </div>

      {error && <div className="sf-banner sf-banner-error">{error}</div>}
      {success && <div className="sf-banner sf-banner-success">{success}</div>}

      {!invoices ? (
        <div className="sf-loading">{t('common.loading')}</div>
      ) : (
        <div className="sf-grid-2">
          <div className="sf-card">
            <strong>{t('payment.selectInvoices')}</strong>
            {invoices.length === 0 ? (
              <div className="sf-empty">{t('payment.allCaughtUp')}</div>
            ) : (
              <table className="sf-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th></th>
                    <th>{t('invoices.invoiceNo')}</th>
                    <th>{t('invoices.dueDate')}</th>
                    <th>{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id} className="clickable" onClick={() => toggle(i.id)}>
                      <td>
                        <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td>{i.invoiceNumber}</td>
                      <td>{new Date(i.dueDate).toLocaleDateString()}</td>
                      <td>{money(i.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <hr className="sf-divider" />
            <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--sf-text-muted)' }}>{t('payment.recentPayments')}</strong>
            {!payments || payments.length === 0 ? (
              <div className="sf-empty">{t('payment.noPayments')}</div>
            ) : (
              <table className="sf-table" style={{ marginTop: 8 }}>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td>
                        {t(METHOD_KEY[p.method] || 'method.mobileMoney')} {p.reference ? `· ${p.reference}` : ''}
                      </td>
                      <td style={{ textAlign: 'right' }}>{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="sf-card">
            <strong>{t('payment.details')}</strong>
            <div className="sf-row-between" style={{ margin: '12px 0' }}>
              <span>{t('payment.amountToPay')}</span>
              <strong style={{ fontSize: 18 }}>{money(amountToPay)}</strong>
            </div>

            <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--sf-text-muted)' }}>{t('payment.method')}</strong>
            <div className="sf-method-row">
              {METHODS.map((m) => (
                <button key={m.value} className={`sf-method-btn ${method === m.value ? 'active' : ''}`} onClick={() => setMethod(m.value)}>
                  {m.icon} {t(m.key)}
                </button>
              ))}
            </div>

            <div className="sf-field">
              <label>{method === 'mobile_money' ? t('payment.mobileMoneyNumber') : method === 'card' ? t('payment.cardReference') : t('payment.bankReference')}</label>
              <input className="sf-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="+256 700 224 981" />
            </div>

            <button className="sf-btn sf-btn-primary sf-btn-block" disabled={paying || amountToPay === 0} onClick={confirmPayment}>
              {paying ? `${t('payment.confirm')}…` : `${t('payment.confirm')} — ${money(amountToPay)}`}
            </button>
            <p style={{ fontSize: 12, color: 'var(--sf-text-muted)', marginTop: 10 }}>{t('payment.simulatedNote')}</p>
          </div>
        </div>
      )}
    </Layout>
  );
}
