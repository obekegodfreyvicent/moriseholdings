import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useSocialLinks, useSocialContent, socialIcon, socialLabel, useDisclaimer } from '../lib/corporate';
import Logo from './Logo';

// Shared chrome for the pre-login corporate site (29 August 2026): the
// utility bar + main nav + footer, plus a "Read disclaimer" re-opener.
// First-visit acknowledgement is handled up front by the full-page
// DisclaimerGate (30 August 2026); this modal just lets a visitor re-read
// the (admin-managed) statements from the demo strip or footer.

const NAV = [
  { key: 'morise', to: '/profile', label: 'Morise' },
  { key: 'companies', to: '/companies', label: 'Companies' },
  { key: 'overview', to: '/investors/overview', label: 'Group Overview' },
  { key: 'news', to: '/investors/news', label: 'News' },
  { key: 'contacts', to: '/contacts', label: 'Contacts' },
];

export function CorporateLayout({ active, children }) {
  const t = useT();
  const social = useSocialLinks();
  const socialContent = useSocialContent();
  const { items: disclaimerItems } = useDisclaimer();
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const year = new Date().getFullYear();

  return (
    <div className="mc-root">
      <div className="mc-utility">
        <div className="mc-utility-inner">
          <Link to="/investors/news">{t('corp.util.news')}</Link>
          <Link to="/contacts">{t('corp.util.contacts')}</Link>
          <Link to="/page/about">{t('corp.util.about')}</Link>
          <Link to="/page/terms">{t('corp.util.faqs')}</Link>
        </div>
      </div>

      <nav className="mc-nav">
        <div className="mc-nav-inner">
          <Link to="/" className="mc-wordmark">
            <span className="mc-wordmark-mark"><Logo size={22} /></span>
            <span>MORISE</span>
          </Link>
          <div className="mc-navlinks">
            {NAV.map((n) => (
              <Link key={n.key} to={n.to} className={active === n.key ? 'mc-active' : undefined}>
                {t(`corp.nav.${n.key}`)}
              </Link>
            ))}
          </div>
          <div className="mc-nav-actions">
            <LanguageSwitcher compact />
            <Link to="/login" className="mc-btn mc-btn-solid">
              {t('corp.cta.signIn')}
            </Link>
          </div>
        </div>
      </nav>

      <div className="mc-demostrip">
        <span>{t('corp.demoStrip')}</span>
        <button className="mc-btn mc-btn-link" onClick={() => setShowDisclaimer(true)}>
          {t('corp.readDisclaimer')}
        </button>
      </div>

      {children}

      <footer className="mc-footer">
        <div className="mc-wrap mc-footer-inner">
          <div className="mc-footer-addr">
            {t('corp.footer.line1')}
            <br />
            {t('corp.footer.line2')}
            <br />
            {t('corp.footer.line3', { year })}
          </div>
          <div className="mc-footer-links">
            <Link to="/page/about">{t('corp.footer.about')}</Link>
            <Link to="/page/terms">{t('corp.footer.terms')}</Link>
            <Link to="/page/delivery">{t('corp.footer.delivery')}</Link>
            <button onClick={() => setShowDisclaimer(true)}>{t('corp.footer.disclaimer')}</button>
          </div>
        </div>
        {social.length > 0 && (
          <div className="mc-wrap mc-social">
            <span className="mc-social-label">{t('corp.footer.followUs')}</span>
            {socialContent.tagline && <span className="mc-social-tagline">{socialContent.tagline}</span>}
            {social.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mc-social-link"
                aria-label={socialLabel(l)}
              >
                <span className="mc-social-icon" aria-hidden="true">{socialIcon(l.platform)}</span>
                {socialLabel(l)}
              </a>
            ))}
          </div>
        )}
      </footer>

      {showDisclaimer && (
        <div className="mc-modal-backdrop" onClick={() => setShowDisclaimer(false)}>
          <div className="mc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mc-modal-icon">⚠</div>
            <h2>{t('corp.disclaimer.title')}</h2>
            <ul>
              {(disclaimerItems.length > 0
                ? disclaimerItems.map((i) => i.body)
                : [
                    t('corp.disclaimer.b1'),
                    t('corp.disclaimer.b2'),
                    t('corp.disclaimer.b3'),
                    t('corp.disclaimer.b4'),
                    t('corp.disclaimer.b5'),
                  ]
              ).map((body, idx) => (
                <li key={idx}>{body}</li>
              ))}
            </ul>
            <button className="mc-btn mc-btn-solid" onClick={() => setShowDisclaimer(false)}>
              {t('corp.disclaimer.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
