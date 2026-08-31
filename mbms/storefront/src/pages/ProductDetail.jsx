import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useT } from '../lib/i18n';
import { apiRequest } from '../lib/api';
import { useCart } from '../lib/cart';
import { money, figure } from '../lib/format';

const CATEGORY_ICONS = {
  'Agro Inputs': '🌾',
  Fuel: '⛽',
  Packaging: '🧵',
  Warehouse: '📦',
  Logistics: '🚜',
  'Freight Services': '🚚',
  'Warehousing Services': '🏬',
};

export function ProductDetailPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    apiRequest(`/customer-portal/catalog/products/${id}`)
      .then(setProduct)
      .catch((err) => setError(err.apiError?.message || t('productDetail.notFound')));
  }, [id]);

  if (error) return <Layout><div className="sf-banner sf-banner-error">{error}</div></Layout>;
  if (!product) return <Layout><div className="sf-loading">{t('common.loading')}</div></Layout>;

  function addToCart() {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Layout>
      <div className="sf-pagehead">
        <div>
          <span className="sf-crumb">{t('productDetail.crumb', { category: product.categoryName || t('shop.general') })}</span>
          <h1>{product.name}</h1>
        </div>
      </div>

      <div className="sf-grid-2">
        <div className="sf-card sf-product-thumb" style={{ height: 320, fontSize: 80 }}>
          {CATEGORY_ICONS[product.categoryNameEn || product.categoryName] || '🛒'}
        </div>

        <div className="sf-card">
          <span className="sf-badge sf-badge-success">{t('productDetail.inStock')}</span>

          <div className="sf-sold-by">
            <div>
              <span className="sf-sold-by-label">{t('productDetail.soldBy')}</span>
              <strong>{product.companyName}</strong>
            </div>
            {product.branchName && (
              <div>
                <span className="sf-sold-by-label">{t('productDetail.fulfilledFrom')}</span>
                <strong>{product.branchName}</strong>
                {product.branchAddress && <span className="sf-branch-addr"> — {product.branchAddress}</span>}
              </div>
            )}
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--sf-navy)', marginTop: 10 }}>{money(product.unitPrice)}</div>
          <div style={{ fontSize: 12, color: 'var(--sf-text-muted)', marginBottom: 14 }}>
            {t('productDetail.productCode', { code: product.productCode, unit: product.unitOfMeasure || t('productDetail.unit') })}
          </div>

          {product.description && (
            <>
              <hr className="sf-divider" />
              <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--sf-text-muted)' }}>{t('productDetail.description')}</strong>
              <p style={{ fontSize: 14 }}>{product.description}</p>
            </>
          )}

          <hr className="sf-divider" />
          <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--sf-text-muted)' }}>{t('productDetail.quantity')}</strong>
          <div className="sf-row" style={{ marginTop: 10, marginBottom: 16 }}>
            <div className="sf-qty-stepper">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
              <span>{figure(quantity)}</span>
              <button onClick={() => setQuantity((q) => q + 1)}>+</button>
            </div>
            {product.stockQuantity != null && (
              <span style={{ fontSize: 12, color: 'var(--sf-text-muted)' }}>{t('productDetail.available', { count: figure(product.stockQuantity) })}</span>
            )}
          </div>

          <div className="sf-row">
            <button className="sf-btn sf-btn-primary" onClick={addToCart}>
              {added
                ? t('productDetail.added')
                : product.branchName
                ? t('productDetail.addFromBranch', { branch: product.branchName })
                : t('common.addToCart')}
            </button>
            <button className="sf-btn sf-btn-secondary" onClick={() => navigate('/support')}>
              {t('productDetail.requestQuotation')}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
