import React from 'react';
import { Link } from 'react-router-dom';
import { CorporateLayout } from '../../components/CorporateLayout';
import { useT } from '../../lib/i18n';
import { LEADERSHIP } from '../../lib/corporate';

// Governance / Group leadership (screenshots/files(13)/5-board-of-directors.html).
// Uses the seeded staff personas from the backend as an illustrative
// leadership roster.
export function CorporateBoard() {
  const t = useT();
  return (
    <CorporateLayout active="morise">
      <div className="mc-wrap">
        <div className="mc-subnav">
          <Link to="/profile">{t('corp.profile.tabProfile')}</Link>
          <Link to="/governance/board" className="mc-active">
            {t('corp.profile.tabGovernance')}
          </Link>
          <Link to="/investors/overview">{t('corp.profile.tabOverview')}</Link>
          <Link to="/investors/news">{t('corp.nav.news')}</Link>
        </div>
        <div className="mc-crumbs">
          <Link to="/">{t('corp.crumb.home')}</Link> / {t('corp.profile.tabGovernance')} /{' '}
          <b>{t('corp.board.title')}</b>
        </div>
        <div className="mc-pagehead">
          <div className="mc-eyebrow">{t('corp.profile.tabGovernance')}</div>
          <h1>{t('corp.board.title')}</h1>
          <p>{t('corp.board.lead')}</p>
        </div>

        <div className="mc-board-grid" style={{ marginBottom: 56 }}>
          {LEADERSHIP.map((p) => (
            <div key={p.name} className="mc-board-card">
              <div className="mc-board-photo">{p.initials}</div>
              <h3>{p.name}</h3>
              <div className="mc-role">{p.role}</div>
              <div className="mc-since">{t('corp.board.since', { year: p.since })}</div>
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--ink-faint)', fontSize: 12.5, marginBottom: 56 }}>
          {t('corp.board.note')}
        </p>
      </div>
    </CorporateLayout>
  );
}
