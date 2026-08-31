import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CorporateLayout } from '../../components/CorporateLayout';
import { useT } from '../../lib/i18n';
import { figure } from '../../lib/format';
import { useGroupOverview, metaFor, bannerFor, useFaqs, subscribeNewsletter } from '../../lib/corporate';

// Holding-company landing page (29 August 2026). Signed-out visitors to "/"
// see this; a signed-in customer sees their dashboard instead (see App.jsx
// RootPage). Structure and look follow screenshots/files(13)/1-homepage.html:
// hero, four-cell figure strip, Companies grid, a letter-to-shareholders
// band and a Related row.
export function CorporateHome() {
  const t = useT();
  const { data, error } = useGroupOverview();
  const fig = data?.figures;

  return (
    <CorporateLayout active="morise">
      <header className="mc-hero">
        <div className="mc-hero-inner">
          <div className="mc-eyebrow-light">{t('corp.home.eyebrow')}</div>
          <h1>{t('corp.home.heroTitle')}</h1>
          <p>{t('corp.home.heroSubtitle')}</p>
          <div className="mc-hero-actions">
            <Link to="/companies" className="mc-btn mc-btn-ghost-light">
              {t('corp.home.ctaCompanies')}
            </Link>
            <Link to="/login" className="mc-btn mc-btn-ghost-light">
              {t('corp.cta.customerSignIn')}
            </Link>
            <Link to="/register" className="mc-btn mc-btn-ghost-light">
              {t('corp.cta.createAccount')}
            </Link>
          </div>
        </div>
      </header>

      <div className="mc-infostrip">
        <div className="mc-info-cell">
          <div className="mc-ilabel">{t('corp.fig.subsidiaries')}</div>
          <div className="mc-ival">{fig ? figure(fig.subsidiaries) : '—'}</div>
          <Link to="/companies">{t('corp.home.viewCompanies')}</Link>
        </div>
        <div className="mc-info-cell">
          <div className="mc-ilabel">{t('corp.fig.branches')}</div>
          <div className="mc-ival">{fig ? figure(fig.branches) : '—'}</div>
          <div className="mc-idelta">{t('corp.home.acrossUganda')}</div>
        </div>
        <div className="mc-info-cell">
          <div className="mc-ilabel">{t('corp.fig.catalogue')}</div>
          <div className="mc-ival">{fig ? figure(fig.products) : '—'}</div>
          <Link to="/login">{t('corp.home.shopGroup')}</Link>
        </div>
        <div className="mc-info-cell">
          <div className="mc-ilabel">{t('corp.fig.reporting')}</div>
          <div className="mc-ival">FY 2026</div>
          <Link to="/investors/overview">{t('corp.home.groupOverview')}</Link>
        </div>
      </div>

      <section className="mc-wrap mc-section">
        <div className="mc-section-head">
          <div>
            <div className="mc-eyebrow">{t('corp.home.portfolioEyebrow')}</div>
            <h2>{t('corp.nav.companies')}</h2>
          </div>
          <Link to="/profile">{t('corp.home.ourApproach')}</Link>
        </div>

        {error && <div className="mc-error">{error}</div>}
        {!error && !data && <div className="mc-loading">{t('common.loading')}</div>}

        {data && (
          <div className="mc-co-grid">
            {data.subsidiaries.map((s) => {
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
        )}
      </section>

      <div className="mc-letter">
        <div className="mc-letter-inner">
          <div className="mc-eyebrow">{t('corp.home.letterEyebrow')}</div>
          <blockquote>{t('corp.home.letterQuote')}</blockquote>
          <div className="mc-letter-sig">{t('corp.home.letterSig')}</div>
        </div>
      </div>

      <section className="mc-wrap mc-section">
        <div className="mc-section-head">
          <div>
            <div className="mc-eyebrow">{t('corp.home.aboutEyebrow')}</div>
            <h2>{t('corp.home.relatedTitle')}</h2>
          </div>
        </div>
        <div className="mc-related-grid">
          <div className="mc-related-card">
            <div className="mc-co-photo mc-co-photo-sm" />
            <h4>{t('corp.home.rel1Title')}</h4>
            <p>{t('corp.home.rel1Desc')}</p>
            <Link to="/profile">{t('corp.readMore')}</Link>
          </div>
          <div className="mc-related-card">
            <div className="mc-co-photo mc-co-photo-sm" />
            <h4>{t('corp.home.rel2Title')}</h4>
            <p>{t('corp.home.rel2Desc')}</p>
            <Link to="/governance/board">{t('corp.readMore')}</Link>
          </div>
          <div className="mc-related-card">
            <div className="mc-co-photo mc-co-photo-sm" />
            <h4>{t('corp.home.rel3Title')}</h4>
            <p>{t('corp.home.rel3Desc')}</p>
            <Link to="/investors/overview">{t('corp.readMore')}</Link>
          </div>
        </div>
      </section>

      <NewsletterSection />
      <FaqSection />
    </CorporateLayout>
  );
}

// Newsletter sign-up — posts to the public, rate-limited
// /customer-portal/public/newsletter; sign-ups are listed in Admin » CMS /
// Site Builder.
function NewsletterSection() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | done | error

  async function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setState('busy');
    try {
      await subscribeNewsletter(email.trim());
      setState('done');
      setEmail('');
    } catch {
      setState('error');
    }
  }

  return (
    <section className="mc-newsletter">
      <div className="mc-wrap mc-newsletter-inner">
        <div>
          <div className="mc-eyebrow-light">{t('corp.home.newsletterEyebrow')}</div>
          <h2>{t('corp.home.newsletterTitle')}</h2>
          <p>{t('corp.home.newsletterSubtitle')}</p>
        </div>
        <form className="mc-newsletter-form" onSubmit={submit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('corp.home.newsletterPlaceholder')}
            aria-label={t('corp.home.newsletterPlaceholder')}
            disabled={state === 'busy' || state === 'done'}
          />
          <button type="submit" className="mc-btn mc-btn-accent" disabled={state === 'busy' || state === 'done'}>
            {state === 'busy' ? t('corp.home.newsletterBusy') : t('corp.home.newsletterCta')}
          </button>
          {state === 'done' && <span className="mc-newsletter-msg ok">{t('corp.home.newsletterDone')}</span>}
          {state === 'error' && <span className="mc-newsletter-msg err">{t('corp.home.newsletterError')}</span>}
        </form>
      </div>
    </section>
  );
}

// FAQ — items managed in Admin » CMS / Site Builder; hidden when there are
// none. Simple expand/collapse.
function FaqSection() {
  const t = useT();
  const faqs = useFaqs();
  const [open, setOpen] = useState(null);

  if (faqs.length === 0) return null;

  return (
    <section className="mc-wrap mc-section" id="faq">
      <div className="mc-section-head">
        <div>
          <div className="mc-eyebrow">{t('corp.home.faqEyebrow')}</div>
          <h2>{t('corp.home.faqTitle')}</h2>
        </div>
        <Link to="/contacts">{t('corp.home.faqAsk')}</Link>
      </div>
      <div className="mc-faq">
        {faqs.map((f) => (
          <div className={`mc-faq-item ${open === f.id ? 'mc-open' : ''}`} key={f.id}>
            <button className="mc-faq-q" onClick={() => setOpen(open === f.id ? null : f.id)} aria-expanded={open === f.id}>
              <span>{f.question}</span>
              <span className="mc-faq-toggle" aria-hidden="true">{open === f.id ? '–' : '+'}</span>
            </button>
            {open === f.id && <div className="mc-faq-a">{f.answer}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
