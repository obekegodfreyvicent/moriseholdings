import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useT } from '../lib/i18n';
import { apiRequest } from '../lib/api';
import { useCart } from '../lib/cart';
import { money } from '../lib/format';
import { bannerFor, PROMO_STRIP_BANNER } from '../lib/corporate';

const CATEGORY_ICONS = {
  'Agro Inputs': '🌾',
  Fuel: '⛽',
  Packaging: '🧵',
  Warehouse: '📦',
  Logistics: '🚜',
  'Freight Services': '🚚',
  'Warehousing Services': '🏬',
};

export function ShopPage() {
  const t = useT();
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [group, setGroup] = useState(null); // { holdingCompanyName, subsidiaries: [...] }
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const [companyId, setCompanyId] = useState(searchParams.get('companyId') || '');
  const [branchId, setBranchId] = useState(searchParams.get('branchId') || '');
  const [sort, setSort] = useState('name');
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [addedId, setAddedId] = useState(null);

  useEffect(() => {
    Promise.all([
      apiRequest('/customer-portal/catalog/categories'),
      apiRequest('/customer-portal/catalog/subsidiaries'),
    ])
      .then(([c, g]) => {
        setCategories(c);
        setGroup(g);
      })
      .catch((err) => setError(err.apiError?.message || t('shop.loadFailed')));
  }, []);

  useEffect(() => {
    setProducts(null);
    apiRequest('/customer-portal/catalog/products', { query: { search, companyId, branchId } })
      .then(setProducts)
      .catch((err) => setError(err.apiError?.message || t('shop.loadFailed')));
  }, [search, companyId, branchId]);

  // Branch options follow the chosen subsidiary.
  const branchOptions = useMemo(() => {
    if (!group || !companyId) return [];
    const sub = group.subsidiaries.find((s) => s.id === companyId);
    return sub ? sub.branches : [];
  }, [group, companyId]);

  const visible = useMemo(() => {
    if (!products) return [];
    let list = activeCategory ? products.filter((p) => p.categoryId === activeCategory) : products;
    list = [...list].sort((a, b) => {
      if (sort === 'price-asc') return Number(a.unitPrice) - Number(b.unitPrice);
      if (sort === 'price-desc') return Number(b.unitPrice) - Number(a.unitPrice);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [products, activeCategory, sort]);

  // Only show category pills that exist in the currently-filtered company set.
  const categoryPills = useMemo(() => {
    if (!companyId) return categories;
    return categories.filter((c) => c.companyId === companyId);
  }, [categories, companyId]);

  function quickAdd(p) {
    addItem(p, 1);
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1200);
  }

  const activeSubName = companyId && group ? group.subsidiaries.find((s) => s.id === companyId)?.name : null;

  return (
    <Layout>
      <img
        className="sf-shop-banner"
        src={activeSubName ? bannerFor(activeSubName) : PROMO_STRIP_BANNER}
        alt={activeSubName || (group ? group.holdingCompanyName : 'Morise')}
      />

      <div className="sf-pagehead">
        <div>
          <span className="sf-crumb">{t('shop.crumb')}</span>
          <h1>{t('shop.heading')}</h1>
          {group && (
            <p className="sf-shop-sub">
              {t('shop.groupLead', {
                holding: group.holdingCompanyName,
                count: group.subsidiaries.length,
              })}{' '}
              <a onClick={() => navigate('/subsidiaries')} style={{ cursor: 'pointer' }}>
                {t('shop.viewSubsidiaries')}
              </a>
            </p>
          )}
        </div>
      </div>

      {error && <div className="sf-banner sf-banner-error">{error}</div>}

      <div className="sf-toolbar" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="sf-field" style={{ margin: 0, minWidth: 200 }}>
          <label>{t('shop.filterCompany')}</label>
          <select
            className="sf-select"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setBranchId('');
              setActiveCategory(null);
            }}
          >
            <option value="">{t('shop.allCompanies')}</option>
            {group?.subsidiaries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.productCount})
              </option>
            ))}
          </select>
        </div>
        <div className="sf-field" style={{ margin: 0, minWidth: 180 }}>
          <label>{t('shop.filterBranch')}</label>
          <select className="sf-select" value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!companyId}>
            <option value="">{t('shop.allBranches')}</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sf-field" style={{ margin: 0, minWidth: 160 }}>
          <label>{t('shop.sortLabel')}</label>
          <select className="sf-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">{t('shop.sortName')}</option>
            <option value="price-asc">{t('shop.sortPriceAsc')}</option>
            <option value="price-desc">{t('shop.sortPriceDesc')}</option>
          </select>
        </div>
      </div>

      <div className="sf-pill-row">
        <button className={`sf-pill ${!activeCategory ? 'active' : ''}`} onClick={() => setActiveCategory(null)}>
          {t('shop.allCategories')}
        </button>
        {categoryPills.map((c) => (
          <button key={c.id} className={`sf-pill ${activeCategory === c.id ? 'active' : ''}`} onClick={() => setActiveCategory(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      {!products ? (
        <div className="sf-loading">{t('common.loading')}</div>
      ) : visible.length === 0 ? (
        <div className="sf-empty">{t('shop.noProducts')}</div>
      ) : (
        <div className="sf-product-grid">
          {visible.map((p) => (
            <div key={p.id} className="sf-product-card">
              <div className="sf-product-thumb" onClick={() => navigate(`/shop/${p.id}`)} style={{ cursor: 'pointer' }}>
                {CATEGORY_ICONS[p.categoryNameEn || p.categoryName] || '🛒'}
              </div>
              <div className="sf-product-body">
                <span className="sf-product-seller">
                  <span className="sf-seller-company">{p.companyName}</span>
                  {p.branchName && <span className="sf-seller-branch"> · {p.branchName}</span>}
                </span>
                <span className="sf-product-category">{p.categoryName || t('shop.general')}</span>
                <span className="sf-product-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/shop/${p.id}`)}>
                  {p.name}
                </span>
                <span className="sf-product-price">{money(p.unitPrice)}</span>
                <button className="sf-btn sf-btn-primary sf-btn-block" onClick={() => quickAdd(p)}>
                  {addedId === p.id ? t('shop.added') : t('common.addToCart')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
