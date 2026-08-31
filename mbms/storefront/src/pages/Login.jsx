import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { GoogleButton } from '../components/GoogleButton';
import Logo from '../components/Logo';

export function LoginPage() {
  const { customer, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const flash = location.state?.flash;

  if (customer) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await login(identifier, password);
      navigate('/');
    } catch (err) {
      setError(err.apiError?.message || t('login.failed'));
    }
  }

  return (
    <div className="sf-login-wrap">
      <div className="sf-login-box">
        <div className="sf-login-langbar">
          <LanguageSwitcher />
        </div>
        <div className="sf-login-mark"><Logo size={34} /></div>
        <h1>{t('login.title')}</h1>
        <div className="sf-login-sub">{t('login.subtitle')}</div>
        {flash && <div className="sf-banner sf-banner-info">{flash}</div>}
        {error && <div className="sf-banner sf-banner-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="sf-field">
            <label>{t('auth.identifierLabel')}</label>
            <input className="sf-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={t('auth.identifierPlaceholder')} required />
          </div>
          <div className="sf-field">
            <label>{t('common.password')}</label>
            <input className="sf-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div style={{ textAlign: 'right', marginBottom: 10 }}>
            <Link to="/forgot-password" style={{ fontSize: 13 }}>{t('auth.forgotPassword')}</Link>
          </div>
          <button className="sf-btn sf-btn-primary sf-btn-block" type="submit" disabled={loading}>
            {loading ? t('common.signingIn') : t('common.signIn')}
          </button>
        </form>

        <div className="sf-auth-divider"><span>{t('auth.or')}</span></div>
        <GoogleButton onError={setError} />

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
          {t('auth.noAccount')} <Link to="/register">{t('auth.createAccount')}</Link>
        </p>
      </div>
    </div>
  );
}
