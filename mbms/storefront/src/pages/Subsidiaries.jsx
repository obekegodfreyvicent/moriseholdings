import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useT } from '../lib/i18n';
import { apiRequest } from '../lib/api';
import { figure } from '../lib/format';
import { bannerFor, GROUP_HERO_BANNER } from '../lib/corporate';

// Group catalogue (29 August 2026): "which companies make up this
// storefront" — every Morise subsidiary whose products are in the shop,
// with its branches. Mirrors the mockups' "Our subsidiaries" / subsidiary
// directory screen.
export function SubsidiariesPage() {
  const t = useT();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiRequest('/customer-portal/catalog/subsidiaries')
      .then(setGroup)
      .catch((err) => setError(err.apiError?.message || t('shop.loadFailed')));
  }, []);

  if (error) return <Layout><div className="sf-banner sf-banner-error">{error}</div></Layout>;
  if (!group) return <Layout><div className="sf-loading">{t('common.loading')}</div></Layout>;

  return (
    <Layout>
      <img className="sf-hero-banner" src={GROUP_HERO_BANNER} alt={group.holdingCompanyName} />

      <div className="sf-pagehead">
        <div>
          <span className="sf-crumb">{t('subs.crumb')}</span>
          <h1>{t('subs.heading')}</h1>
          <p className="sf-shop-sub">{t('subs.lead', { holding: group.holdingCompanyName })}</p>
        </div>
      </div>

      <div className="sf-subs-grid">
        {group.subsidiaries.map((s, idx) => (
          <div key={s.id} className="sf-card sf-sub-card">
            <img className="sf-sub-banner" src={bannerFor(s.name)} alt={s.name} loading="lazy" />
            <div className="sf-sub-index">{String(idx + 1).padStart(2, '0')}</div>
            <div className="sf-sub-body">
              <strong className="sf-sub-name">{s.name}</strong>
              {s.relationshipType && <span className="sf-badge sf-badge-neutral">{t(`subs.rel.${s.relationshipType}`)}</span>}
              <div className="sf-sub-counts">
                {t('subs.counts', { branches: figure(s.branchCount), products: figure(s.productCount) })}
              </div>
              {s.branches.length > 0 && (
                <ul className="sf-sub-branches">
                  {s.branches.map((b) => (
                    <li key={b.id}>
                      <span className="sf-branch-name">{b.name}</span>
                      {b.address && <span className="sf-branch-addr"> — {b.address}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="sf-btn sf-btn-secondary sf-btn-block"
                style={{ marginTop: 10 }}
                disabled={s.productCount === 0}
                onClick={() => navigate(`/shop?companyId=${s.id}`)}
              >
                {s.productCount === 0 ? t('subs.noProducts') : t('subs.shopThis', { name: s.name })}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
