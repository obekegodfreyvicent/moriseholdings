import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useDisclaimer, acknowledgeDisclaimer } from '../lib/corporate';
import Logo from './Logo';

// Full-page disclaimer gate (30 August 2026). A signed-out visitor sees this
// FIRST — before the corporate landing page. The disclaimer statements are
// managed by admin staff in Admin » CMS / Site Builder; the "I Understand,
// Continue" button is held disabled for `holdSeconds` (10 by default, set
// server-side) with a live countdown, then the visitor may proceed. The
// acknowledgement is remembered per browser so a return visitor is not
// stopped again.
export function DisclaimerGate({ onAccept }) {
  const t = useT();
  const { items, holdSeconds, loaded } = useDisclaimer();
  const [remaining, setRemaining] = useState(holdSeconds);
  const started = useRef(false);

  // Start the countdown once the content (and its holdSeconds) has loaded.
  useEffect(() => {
    if (!loaded || started.current) return;
    started.current = true;
    setRemaining(holdSeconds);
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loaded, holdSeconds]);

  function accept() {
    acknowledgeDisclaimer();
    onAccept();
  }

  const ready = loaded && remaining === 0;

  return (
    <div className="mc-root">
      <nav className="mc-nav">
        <div className="mc-nav-inner">
          <span className="mc-wordmark">
            <span className="mc-wordmark-mark"><Logo size={22} /></span>
            <span>MORISE</span>
          </span>
          <div className="mc-nav-actions">
            <LanguageSwitcher compact />
          </div>
        </div>
      </nav>

      <div className="mc-gate">
        <div className="mc-gate-card">
          <div className="mc-gate-icon" aria-hidden="true">⚠</div>
          <h1>{t('corp.disclaimer.title')}</h1>

          {!loaded ? (
            <p className="mc-gate-loading">{t('common.loading')}</p>
          ) : (
            <ul className="mc-gate-list">
              {(items.length > 0
                ? items.map((i) => i.body)
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
          )}

          <button className="mc-btn mc-btn-solid mc-gate-btn" onClick={accept} disabled={!ready}>
            {ready
              ? t('corp.disclaimer.accept')
              : t('corp.disclaimer.continueIn', { n: remaining })}
          </button>

          {!ready && (
            <p className="mc-gate-hint">{t('corp.disclaimer.readHint')}</p>
          )}

          <p className="mc-gate-foot">
            <Link to="/login">{t('corp.cta.signIn')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
