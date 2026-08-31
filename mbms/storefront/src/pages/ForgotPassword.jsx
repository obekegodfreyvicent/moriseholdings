import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { apiRequest } from '../lib/api';
import Logo from '../components/Logo';

export function ForgotPasswordPage() {
  const t = useT();
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(null); // { message, devResetToken? }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest('/customer-portal/auth/forgot-password', { method: 'POST', body: { identifier: identifier.trim() } });
      setSent(res);
    } catch (err) {
      setError(err.apiError?.message || t('auth.requestFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sf-login-wrap">
      <div className="sf-login-box">
        <div className="sf-login-langbar"><LanguageSwitcher /></div>
        <div className="sf-login-mark"><Logo size={34} /></div>
        <h1>{t('auth.forgotTitle')}</h1>
        <div className="sf-login-sub">{t('auth.forgotSubtitle')}</div>
        {error && <div className="sf-banner sf-banner-error">{error}</div>}

        {sent ? (
          <>
            <div className="sf-banner sf-banner-info">{sent.message}</div>
            {sent.devResetToken && (
              <div className="sf-card" style={{ marginTop: 8 }}>
                <strong style={{ fontSize: 13 }}>{t('auth.devSeamTitle')}</strong>
                <p style={{ fontSize: 12, color: 'var(--sf-text-muted)' }}>{t('auth.devSeamNote')}</p>
                <Link className="sf-btn sf-btn-primary sf-btn-block" to={`/reset-password?token=${encodeURIComponent(sent.devResetToken)}`}>
                  {t('auth.resetNow')}
                </Link>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="sf-field">
              <label>{t('auth.identifierLabel')}</label>
              <input className="sf-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
            </div>
            <button className="sf-btn sf-btn-primary sf-btn-block" type="submit" disabled={busy}>
              {busy ? t('auth.sending') : t('auth.sendResetLink')}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
          <Link to="/login">{t('auth.backToSignIn')}</Link>
        </p>
      </div>
    </div>
  );
}
