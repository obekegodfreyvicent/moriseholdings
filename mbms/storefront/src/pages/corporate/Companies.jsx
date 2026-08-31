import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CorporateLayout } from '../../components/CorporateLayout';
import { useT } from '../../lib/i18n';
import { figure } from '../../lib/format';
import { useGroupOverview, metaFor, bannerFor } from '../../lib/corporate';

// Companies directory (screenshots/files(13)/3-companies-directory.html) —
// every subsidiary with a sector-filter chip bar, live from the group
// overview endpoint.
export function CorporateCompanies() {
  const t = useT();
  const { data, error } = useGroupOverview();
  const [sector, setSector] = useState('all');

  const sectors = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.subsidiaries.map((s) => metaFor(s.name).sector))].sort();
  }, [data]);

  const shown = useMemo(() => {
    if (!data) return [];
    return sector === 'all'
      ? data.subsidiaries
      : data.subsidiaries.filter((s) => metaFor(s.name).sector === sector);
  }, [data, sector]);

  return (
    <CorporateLayout active="companies">
      <div className="mc-wrap">
        <div className="mc-crumbs">
          <Link to="/">{t('corp.crumb.home')}</Link> / <b>{t('corp.nav.companies')}</b>
        </div>
        <div className="mc-pagehead">
          <div className="mc-eyebrow">{t('corp.home.portfolioEyebrow')}</div>
          <h1>{t('corp.nav.companies')}</h1>
          <p>{t('corp.companies.lead')}</p>
        </div>

        {error && <div className="mc-error">{error}</div>}
        {!error && !data && <div className="mc-loading">{t('common.loading')}</div>}

        {data && (
          <>
            <div className="mc-filterbar">
              <button
                className={`mc-fchip ${sector === 'all' ? 'mc-active' : ''}`}
                onClick={() => setSector('all')}
              >
                {t('corp.companies.allSectors')}
              </button>
              {sectors.map((s) => (
                <button
                  key={s}
                  className={`mc-fchip ${sector === s ? 'mc-active' : ''}`}
                  onClick={() => setSector(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mc-co-grid" style={{ marginBottom: 60 }}>
              {shown.map((s) => {
                const m = metaFor(s.name);
                return (
                  <Link key={s.id} to={`/companies/${s.id}`} className="mc-co-card">
                    <img className="mc-co-photo" src={bannerFor(s.name)} alt={s.name} loading="lazy" />
                    <div className="mc-co-body">
                      <div className="mc-co-sector">{m.sector}</div>
                      <h3>{s.name}</h3>
                      <p>{m.blurb}</p>
                      <div className="mc-stake">
                        <span>{t('corp.whollyOwned')}</span>
                        <span>
                          {s.ownershipPercent != null
                            ? t('corp.ownedPct', { pct: figure(s.ownershipPercent) })
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </CorporateLayout>
  );
}
