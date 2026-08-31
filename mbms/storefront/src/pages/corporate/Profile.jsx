import React from 'react';
import { Link } from 'react-router-dom';
import { CorporateLayout } from '../../components/CorporateLayout';
import { useT } from '../../lib/i18n';

// Profile / "Who we are" (screenshots/files(13)/4-profile.html): a subnav,
// an eyebrow headline, and label + content rows with an "approach" pillar
// grid.
export function CorporateProfile() {
  const t = useT();
  return (
    <CorporateLayout active="morise">
      <div className="mc-wrap">
        <div className="mc-subnav">
          <Link to="/profile" className="mc-active">
            {t('corp.profile.tabProfile')}
          </Link>
          <Link to="/governance/board">{t('corp.profile.tabGovernance')}</Link>
          <Link to="/investors/overview">{t('corp.profile.tabOverview')}</Link>
          <Link to="/investors/news">{t('corp.nav.news')}</Link>
        </div>
        <div className="mc-crumbs">
          <Link to="/">{t('corp.crumb.home')}</Link> / <b>{t('corp.profile.tabProfile')}</b>
        </div>
        <div className="mc-pagehead mc-noborder">
          <div className="mc-eyebrow">{t('corp.profile.eyebrow')}</div>
          <h1>{t('corp.profile.title')}</h1>
        </div>
      </div>

      <div className="mc-photo-strip" />

      <div className="mc-wrap">
        <div className="mc-cols">
          <div className="mc-slabel">{t('corp.profile.overviewLabel')}</div>
          <div>
            <h2>{t('corp.profile.overviewHeading')}</h2>
            <p>{t('corp.profile.overviewP1')}</p>
            <p>{t('corp.profile.overviewP2')}</p>
          </div>
        </div>

        <div className="mc-cols">
          <div className="mc-slabel">{t('corp.profile.approachLabel')}</div>
          <div>
            <h2>{t('corp.profile.approachHeading')}</h2>
            <p>{t('corp.profile.approachP1')}</p>
            <div className="mc-pillars">
              <div className="mc-pillar">
                <div className="mc-pnum">01</div>
                <h3>{t('corp.profile.pillar1Title')}</h3>
                <p>{t('corp.profile.pillar1Desc')}</p>
              </div>
              <div className="mc-pillar">
                <div className="mc-pnum">02</div>
                <h3>{t('corp.profile.pillar2Title')}</h3>
                <p>{t('corp.profile.pillar2Desc')}</p>
              </div>
              <div className="mc-pillar">
                <div className="mc-pnum">03</div>
                <h3>{t('corp.profile.pillar3Title')}</h3>
                <p>{t('corp.profile.pillar3Desc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mc-cols">
          <div className="mc-slabel">{t('corp.profile.historyLabel')}</div>
          <div>
            <h2>{t('corp.profile.historyHeading')}</h2>
            <p>{t('corp.profile.historyP1')}</p>
            <p>
              <Link to="/companies" className="mc-btn mc-btn-link">
                {t('corp.profile.seeCompanies')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </CorporateLayout>
  );
}
