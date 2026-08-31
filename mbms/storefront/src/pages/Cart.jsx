import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useT } from '../lib/i18n';
import { apiRequest } from '../lib/api';
import { useCart } from '../lib/cart';
import { money, figure } from '../lib/format';

const DELIVERY_FEE = 30_000;
const VAT_RATE = 0.18;

const METHODS = [
  { value: 'mobile_money', icon: '📱', key: 'method.mobileMoney' },
  { value: 'card', icon: '💳', key: 'method.card' },
  { value: 'bank_transfer', icon: '🏦', key: 'method.bankTransfer' },
];

export function CartPage() {
  const t = useT();
  const { items, groups, setQuantity, removeItem, subtotal, clear } = useCart();
  const [addresses, setAddresses] = useState([]);
  const [deliveryAddressId, setDeliveryAddressId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [method, setMethod] = useState('mobile_money');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);

  const [codeInput, setCodeInput] = useState('');
  const [applied, setApplied] = useState(null); // { code, discountAmount }
  const [codeMsg, setCodeMsg] = useState(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const navigate = useNavigate();

  // Group catalogue (29 August 2026): a discount code belongs to one Morise
  // subsidiary, so it can only be applied when the whole cart is from a
  // single company. A multi-company cart is checked out as one order per
  // company.
  const singleCompany = groups.length <= 1;

  useEffect(() => {
    apiRequest('/customer-portal/delivery-addresses').then((rows) => {
      setAddresses(rows);
      const def = rows.find((a) => a.isDefault) || rows[0];
      if (def) setDeliveryAddressId(def.id);
    });
  }, []);

  function codeMessage(res, fallbackKey) {
    if (res?.messageKey) return t(`cart.${res.messageKey}`, res.messageParams || {});
    return res?.message || t(fallbackKey);
  }

  useEffect(() => {
    if (!applied || !singleCompany) return;
    let cancelled = false;
    apiRequest('/customer-portal/discount-codes/validate', {
      method: 'POST',
      body: { code: applied.code, subtotal },
    })
      .then((res) => {
        if (cancelled) return;
        if (res.valid) setApplied({ code: res.code, discountAmount: res.discountAmount });
        else {
          setApplied(null);
          setCodeMsg(codeMessage(res, 'cart.discountRemoved'));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, singleCompany]);

  const discountAmount = applied && singleCompany ? applied.discountAmount : 0;

  // Estimated grand total: delivery + VAT are charged per order (one per
  // company), so estimate them per group.
  const estTotal = groups.reduce((sum, g) => {
    const gDiscount = groups.length === 1 ? discountAmount : 0;
    const disc = Math.max(0, g.subtotal - gDiscount);
    return sum + disc + DELIVERY_FEE + Math.round(disc * VAT_RATE);
  }, 0);

  async function applyCode() {
    const code = codeInput.trim();
    if (!code) return;
    setCheckingCode(true);
    setCodeMsg(null);
    try {
      const res = await apiRequest('/customer-portal/discount-codes/validate', {
        method: 'POST',
        body: { code, subtotal },
      });
      if (res.valid) {
        setApplied({ code: res.code, discountAmount: res.discountAmount });
        setCodeInput('');
        setCodeMsg(null);
      } else {
        setApplied(null);
        setCodeMsg(codeMessage(res, 'cart.discountInvalid'));
      }
    } catch (err) {
      setCodeMsg(err.apiError?.message || t('cart.discountInvalid'));
    } finally {
      setCheckingCode(false);
    }
  }

  function removeCode() {
    setApplied(null);
    setCodeMsg(null);
  }

  async function placeOrder() {
    setPlacing(true);
    setError(null);
    try {
      // One order per subsidiary group — the backend rejects a mixed-company
      // order, and each subsidiary invoices + posts to its own books.
      const placed = [];
      for (const g of groups) {
        const order = await apiRequest('/customer-portal/orders', {
          method: 'POST',
          body: {
            items: g.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            deliveryAddressId: deliveryAddressId || undefined,
            requestedDeliveryDate: deliveryDate || undefined,
            paymentMethodPreference: method,
            discountCode: groups.length === 1 && applied ? applied.code : undefined,
          },
        });
        placed.push(order.orderNumber);
      }
      clear();
      navigate('/orders', { state: { justPlaced: placed } });
    } catch (err) {
      setError(err.apiError?.message || t('cart.placeFailed'));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Layout>
      <div className="sf-pagehead">
        <div>
          <span className="sf-crumb">{t('cart.crumb')}</span>
          <h1>{t('cart.heading')}</h1>
          {items.length > 0 && (
            <p className="sf-shop-sub">
              {t('cart.groupLead', { items: figure(items.length), companies: figure(groups.length) })}
            </p>
          )}
        </div>
      </div>

      {error && <div className="sf-banner sf-banner-error">{error}</div>}

      {items.length === 0 ? (
        <div className="sf-card">
          <div className="sf-empty">
            {t('cart.emptyLead')} <a href="/shop">{t('cart.browseCatalog')}</a> {t('cart.toAddProducts')}
          </div>
        </div>
      ) : (
        <div className="sf-grid-2">
          <div className="sf-card">
            {groups.map((g) => (
              <div key={g.companyId || 'unknown'} className="sf-cart-group">
                <div className="sf-cart-group-head">
                  <strong>{g.companyName || t('cart.unknownCompany')}</strong>
                  {g.items[0]?.branchName && (
                    <span className="sf-cart-group-branch">{t('cart.fulfilledBy', { branch: g.items[0].branchName })}</span>
                  )}
                </div>
                <table className="sf-table" style={{ marginTop: 6 }}>
                  <thead>
                    <tr>
                      <th>{t('common.product')}</th>
                      <th>{t('common.qty')}</th>
                      <th>{t('common.unitPrice')}</th>
                      <th>{t('common.subtotal')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((i) => (
                      <tr key={i.productId}>
                        <td>{i.name}</td>
                        <td>
                          <div className="sf-qty-stepper">
                            <button onClick={() => setQuantity(i.productId, i.quantity - 1)}>−</button>
                            <span>{figure(i.quantity)}</span>
                            <button onClick={() => setQuantity(i.productId, i.quantity + 1)}>+</button>
                          </div>
                        </td>
                        <td>{money(i.unitPrice)}</td>
                        <td>{money(i.unitPrice * i.quantity)}</td>
                        <td>
                          <button
                            className="sf-btn sf-btn-secondary"
                            style={{ padding: '4px 8px', color: 'var(--sf-error)' }}
                            onClick={() => removeItem(i.productId)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="sf-row-between" style={{ fontSize: 13, marginTop: 4 }}>
                  <span>{t('cart.companySubtotal', { name: g.companyName || '' })}</span>
                  <strong>{money(g.subtotal)}</strong>
                </div>
              </div>
            ))}

            <hr className="sf-divider" />
            <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--sf-text-muted)' }}>{t('cart.deliveryAddress')}</strong>
            <div className="sf-field" style={{ marginTop: 10 }}>
              <label>{t('cart.deliveryBranch')}</label>
              <select className="sf-select" value={deliveryAddressId} onChange={(e) => setDeliveryAddressId(e.target.value)}>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.addressLine}
                  </option>
                ))}
              </select>
            </div>
            <div className="sf-field">
              <label>{t('cart.requestedDeliveryDate')}</label>
              <input className="sf-input" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
          </div>

          <div className="sf-card">
            <strong>{t('cart.orderSummary')}</strong>

            {singleCompany ? (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--sf-text-muted)' }}>{t('cart.discountCode')}</label>
                {applied ? (
                  <div className="sf-row-between" style={{ marginTop: 6, alignItems: 'center' }}>
                    <span>
                      <strong className="sf-mono">{applied.code}</strong> — {t('cart.discountApplied')}
                    </span>
                    <button className="sf-btn sf-btn-secondary" style={{ padding: '4px 10px' }} onClick={removeCode}>
                      {t('cart.discountRemove')}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input
                      className="sf-input"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder={t('cart.discountPlaceholder')}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCode())}
                    />
                    <button className="sf-btn sf-btn-secondary" onClick={applyCode} disabled={checkingCode || !codeInput.trim()}>
                      {checkingCode ? t('cart.discountChecking') : t('cart.discountApply')}
                    </button>
                  </div>
                )}
                {codeMsg && <p style={{ fontSize: 12, color: 'var(--sf-error)', marginTop: 6 }}>{codeMsg}</p>}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--sf-text-muted)', marginTop: 12 }}>{t('cart.discountSingleCompanyOnly')}</p>
            )}

            <div style={{ marginTop: 12, fontSize: 14 }}>
              <div className="sf-row-between" style={{ marginBottom: 8 }}>
                <span>{t('common.subtotal')}</span>
                <strong>{money(subtotal)}</strong>
              </div>
              {discountAmount > 0 && (
                <div className="sf-row-between" style={{ marginBottom: 8, color: 'var(--sf-success, #2E7D4F)' }}>
                  <span>{t('cart.discount')} ({applied.code})</span>
                  <strong>− {money(discountAmount)}</strong>
                </div>
              )}
              <div className="sf-row-between" style={{ marginBottom: 8 }}>
                <span>{t('cart.deliveryFeePerOrder', { count: figure(groups.length) })}</span>
                <strong>{money(DELIVERY_FEE * groups.length)}</strong>
              </div>
              <div className="sf-row-between" style={{ marginBottom: 8 }}>
                <span>{t('cart.vat')}</span>
                <strong>{money(estTotal - subtotal + discountAmount - DELIVERY_FEE * groups.length)}</strong>
              </div>
              <hr className="sf-divider" />
              <div className="sf-row-between" style={{ fontSize: 16 }}>
                <strong>{t('cart.estimatedTotal')}</strong>
                <strong>{money(estTotal)}</strong>
              </div>
            </div>

            <hr className="sf-divider" />
            <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--sf-text-muted)' }}>{t('cart.paymentMethod')}</strong>
            <div className="sf-method-row">
              {METHODS.map((m) => (
                <button key={m.value} className={`sf-method-btn ${method === m.value ? 'active' : ''}`} onClick={() => setMethod(m.value)}>
                  {m.icon} {t(m.key)}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--sf-text-muted)' }}>
              {groups.length > 1 ? t('cart.splitNote', { count: figure(groups.length) }) : t('cart.methodNote')}
            </p>

            <button className="sf-btn sf-btn-primary sf-btn-block" disabled={placing || !items.length} onClick={placeOrder}>
              {placing
                ? t('cart.placingOrder')
                : groups.length > 1
                ? `${t('cart.placeOrders', { count: figure(groups.length) })} — ${money(estTotal)}`
                : `${t('cart.placeOrder')} — ${money(estTotal)}`}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
