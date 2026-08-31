import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { CorporateLayout } from '../../components/CorporateLayout';
import { useT } from '../../lib/i18n';
import { figure } from '../../lib/format';
import { useGroupOverview, metaFor, bannerFor } from '../../lib/corporate';

// Single portfolio company (screenshots/files(13)/2-portfolio-company.html):
// header + stat block, an "About" split, the branch network, and a CTA into
// the storefront filtered to that subsidiary.
export function CorporateCompanyDetail() {
  const t = useT();
  const { id } = useParams();
  const { data, error } = useGroupOverview();

  const sub = data?.subsidiaries.find((s) => s.id === id);
  const m = sub ? metaFor(sub.name) : null;

  return (
    <CorporateLayout active="companies">
      <div className="mc-wrap">
        <div className="mc-crumbs">
          <Link to="/">{t('corp.crumb.home')}</Link> / <Link to="/companies">{t('corp.nav.companies')}</Link> /{' '}
          <b>{sub ? sub.name : '…'}</b>
        </div>

        {error && <div className="mc-error">{error}</div>}
        {!error && !data && <div className="mc-loading">{t('common.loading')}</div>}
        {data && !sub && <div className="mc-error">{t('corp.company.notFound')}</div>}

        {sub && (
          <>
            <div className="mc-detail-head">
              <div>
                <div className="mc-co-sector">{m.sector}</div>
                <h1>{sub.name}</h1>
                <p>{m.blurb}</p>
              </div>
              <div className="mc-statblock">
                <div className="mc-stat-row">
                  <span className="mc-slabel">{t('corp.company.ownership')}</span>
                  <span className="mc-sval">
                    {sub.ownershipPercent != null ? `${figure(sub.ownershipPercent)}%` : '—'}
                  </span>
                </div>
                <div className="mc-stat-row">
                  <span className="mc-slabel">{t('corp.company.relationship')}</span>
                  <span className="mc-sval">{t('corp.whollyOwned')}</span>
                </div>
                <div className="mc-stat-row">
                  <span className="mc-slabel">{t('corp.company.headOffice')}</span>
                  <span className="mc-sval">{m.city}</span>
                </div>
                <div className="mc-stat-row">
                  <span className="mc-slabel">{t('corp.fig.branches')}</span>
                  <span className="mc-sval">{figure(sub.branchCount)}</span>
                </div>
                <div className="mc-stat-row">
                  <span className="mc-slabel">{t('corp.company.catalogueItems')}</span>
                  <span className="mc-sval">{figure(sub.productCount)}</span>
                </div>
                <div className="mc-stat-row">
                  <span className="mc-slabel">{t('corp.company.reporting')}</span>
                  <span className="mc-sval">{sub.currency}</span>
                </div>
              </div>
            </div>

            <img className="mc-photo-strip" src={bannerFor(sub.name)} alt={sub.name} />

            <section className="mc-section">
              <div className="mc-split">
                <div>
                  <h2>{t('corp.company.aboutHeading', { name: sub.name })}</h2>
                  <p>{m.blurb}</p>
                  <p>{t('corp.company.aboutGov')}</p>
                </div>
                <div>
                  <h2>{t('corp.company.branchNetwork')}</h2>
                  {sub.branches.length === 0 ? (
                    <p>{t('corp.company.noBranches')}</p>
                  ) : (
                    <div className="mc-branch-list">
                      {sub.branches.map((b) => (
                        <div key={b.id} className="mc-branch-row">
                          <div className="mc-bname">{b.name}</div>
                          {b.address && <div className="mc-baddr">{b.address}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ marginTop: 20 }}>
                    <Link
                      to={sub.productCount > 0 ? `/login` : `/companies`}
                      className="mc-btn mc-btn-solid"
                    >
                      {sub.productCount > 0
                        ? t('corp.company.shopThis', { name: sub.name })
                        : t('corp.company.backToCompanies')}
                    </Link>
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </CorporateLayout>
  );
}
