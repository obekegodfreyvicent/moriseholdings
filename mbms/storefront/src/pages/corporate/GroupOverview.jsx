import React from 'react';
import { Link } from 'react-router-dom';
import { CorporateLayout } from '../../components/CorporateLayout';
import { useT } from '../../lib/i18n';
import { figure } from '../../lib/format';
import { useGroupOverview } from '../../lib/corporate';

// Group Overview (screenshots/files(13)/6-net-asset-value.html reworked).
// The reference is a "Net Asset Value" page; this build has no valuation
// data, so the same layout is used to present the group's real operating
// footprint — companies, branches, catalogue — with an illustrative trend
// line and a per-subsidiary breakdown table.
export function CorporateGroupOverview() {
  const t = useT();
  const { data, error } = useGroupOverview();
  const fig = data?.figures;
  const totalProducts = fig?.products || 0;

  return (
    <CorporateLayout active="overview">
      <div className="mc-wrap">
        <div className="mc-subnav">
          <Link to="/profile">{t('corp.profile.tabProfile')}</Link>
          <Link to="/governance/board">{t('corp.profile.tabGovernance')}</Link>
          <Link to="/investors/overview" className="mc-active">
            {t('corp.profile.tabOverview')}
          </Link>
          <Link to="/investors/news">{t('corp.nav.news')}</Link>
        </div>
        <div className="mc-crumbs">
          <Link to="/">{t('corp.crumb.home')}</Link> / <b>{t('corp.profile.tabOverview')}</b>
        </div>
        <div className="mc-pagehead mc-noborder">
          <div className="mc-eyebrow">{t('corp.overview.eyebrow')}</div>
          <h1>{t('corp.profile.tabOverview')}</h1>
          <p>{t('corp.overview.lead')}</p>
        </div>

        {error && <div className="mc-error">{error}</div>}
        {!error && !data && <div className="mc-loading">{t('common.loading')}</div>}

        {data && (
          <>
            <div className="mc-headline">
              <div className="mc-hval mc-mono">{figure(fig.branches)}</div>
              <div className="mc-hdelta mc-mono">
                {t('corp.overview.acrossN', { n: figure(fig.subsidiaries) })}
              </div>
              <div className="mc-hdate">{t('corp.overview.asOf')}</div>
            </div>

            <div className="mc-chart-block">
              <svg className="mc-chart-svg" viewBox="0 0 800 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={t('corp.overview.chartAlt')}>
                <line x1="0" y1="190" x2="800" y2="190" stroke="#DEDACB" strokeWidth="1" />
                <line x1="0" y1="130" x2="800" y2="130" stroke="#DEDACB" strokeWidth="1" />
                <line x1="0" y1="70" x2="800" y2="70" stroke="#DEDACB" strokeWidth="1" />
                <polyline
                  fill="none"
                  stroke="#8A6A34"
                  strokeWidth="2.5"
                  points="0,168 114,160 228,150 342,120 456,124 570,96 684,80 800,60"
                />
                <circle cx="800" cy="60" r="4" fill="#8A6A34" />
                <text x="0" y="212" fontSize="11" fill="#93907F" fontFamily="IBM Plex Mono">2023</text>
                <text x="740" y="212" fontSize="11" fill="#93907F" fontFamily="IBM Plex Mono">2026</text>
              </svg>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '10px 0 0' }}>
                {t('corp.overview.chartNote')}
              </p>
            </div>

            <div className="mc-section-tight">
              <h2 style={{ fontSize: 22, marginBottom: 22 }}>{t('corp.overview.breakdownTitle')}</h2>
              <div className="mc-bd-table">
                <div className="mc-bd-row mc-head">
                  <span>{t('corp.overview.colCompany')}</span>
                  <span className="mc-val">{t('corp.fig.branches')}</span>
                  <span className="mc-val">{t('corp.company.catalogueItems')}</span>
                  <span className="mc-pct">{t('corp.overview.colShare')}</span>
                </div>
                {data.subsidiaries.map((s) => (
                  <div key={s.id} className="mc-bd-row">
                    <span className="mc-cname">
                      <Link to={`/companies/${s.id}`} style={{ textDecoration: 'none' }}>
                        {s.name}
                      </Link>
                    </span>
                    <span className="mc-val mc-mono">{figure(s.branchCount)}</span>
                    <span className="mc-val mc-mono">{figure(s.productCount)}</span>
                    <span className="mc-pct mc-mono">
                      {totalProducts ? `${Math.round((s.productCount / totalProducts) * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
                <div className="mc-bd-row">
                  <span className="mc-cname">{t('corp.overview.groupTotal')}</span>
                  <span className="mc-val mc-mono">{figure(fig.branches)}</span>
                  <span className="mc-val mc-mono">{figure(fig.products)}</span>
                  <span className="mc-pct mc-mono">100%</span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 14 }}>
                {t('corp.overview.tableNote', { categories: figure(fig.categories) })}
              </p>
            </div>
          </>
        )}
      </div>
    </CorporateLayout>
  );
}
