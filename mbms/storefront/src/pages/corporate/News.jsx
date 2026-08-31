import React from 'react';
import { Link } from 'react-router-dom';
import { CorporateLayout } from '../../components/CorporateLayout';
import { useT } from '../../lib/i18n';
import { NEWS } from '../../lib/corporate';

// News / press releases (screenshots/files(13)/7-press-releases.html).
// Illustrative group announcements — there is no press-release store in
// this build.
export function CorporateNews() {
  const t = useT();
  return (
    <CorporateLayout active="news">
      <div className="mc-wrap">
        <div className="mc-subnav">
          <Link to="/profile">{t('corp.profile.tabProfile')}</Link>
          <Link to="/governance/board">{t('corp.profile.tabGovernance')}</Link>
          <Link to="/investors/overview">{t('corp.profile.tabOverview')}</Link>
          <Link to="/investors/news" className="mc-active">
            {t('corp.nav.news')}
          </Link>
        </div>
        <div className="mc-crumbs">
          <Link to="/">{t('corp.crumb.home')}</Link> / <b>{t('corp.nav.news')}</b>
        </div>
        <div className="mc-pagehead mc-pagehead-row mc-noborder">
          <div>
            <div className="mc-eyebrow">{t('corp.overview.eyebrow')}</div>
            <h1>{t('corp.news.title')}</h1>
          </div>
        </div>

        <div className="mc-pr-list" style={{ marginBottom: 48 }}>
          {NEWS.map((n) => (
            <div key={n.title} className="mc-pr-row">
              <div className="mc-pdate">{n.date}</div>
              <div className="mc-ptitle">{n.title}</div>
              <div className="mc-ptag">{n.tag}</div>
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--ink-faint)', fontSize: 12.5, marginBottom: 56 }}>
          {t('corp.news.note')}
        </p>
      </div>
    </CorporateLayout>
  );
}
