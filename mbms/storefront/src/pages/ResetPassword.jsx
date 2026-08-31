import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useT } from '../lib/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { apiRequest } from '../lib/api';
import Logo from '../components/Logo';

export function ResetPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest('/customer-portal/auth/reset-password', {
        method: 'POST',
        body: { token: token.trim(), newPassword: password },
      });
      navigate('/login', { state: { flash: res.message } });
    } catch (err) {
      setError(err.apiError?.message || t('auth.resetFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sf-login-wrap">
      <div className="sf-login-box">
        <div className="sf-login-langbar"><LanguageSwitcher /></div>
        <div className="sf-login-mark"><Logo size={34} /></div>
        <h1>{t('auth.resetTitle')}</h1>
        <div className="sf-login-sub">{t('auth.resetSubtitle')}</div>
        {error && <div className="sf-banner sf-banner-error">{error}</div>}
        <form onSubmit={onSubmit}>
          {!params.get('token') && (
            <div className="sf-field">
              <label>{t('auth.resetToken')}</label>
              <input className="sf-input" value={token} onChange={(e) => setToken(e.target.value)} required />
            </div>
          )}
          <div className="sf-field">
            <label>{t('auth.newPassword')}</label>
            <input className="sf-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoFocus />
          </div>
          <div className="sf-field">
            <label>{t('auth.confirmPassword')}</label>
            <input className="sf-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
          </div>
          <button className="sf-btn sf-btn-primary sf-btn-block" type="submit" disabled={busy || !token}>
            {busy ? t('auth.resetting') : t('auth.resetPassword')}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
          <Link to="/login">{t('auth.backToSignIn')}</Link>
        </p>
      </div>
    </div>
  );
}
