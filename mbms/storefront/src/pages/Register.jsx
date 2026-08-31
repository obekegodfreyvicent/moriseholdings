import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { GoogleButton } from '../components/GoogleButton';
import Logo from '../components/Logo';
import { apiRequest } from '../lib/api';

export function RegisterPage() {
  const { customer, register, loading } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    password: '',
    confirm: '',
    companyId: '',
    homeBranchId: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    apiRequest('/customer-portal/auth/companies')
      .then((rows) => {
        setCompanies(rows);
        if (rows.length === 1) setForm((f) => ({ ...f, companyId: rows[0].id }));
      })
      .catch(() => setCompanies([]));
  }, []);

  // Group catalogue (29 August 2026): once a company is chosen, offer its
  // branches as an optional "home branch".
  useEffect(() => {
    if (!form.companyId) {
      setBranches([]);
      return;
    }
    apiRequest('/customer-portal/auth/branches', { query: { companyId: form.companyId } })
      .then((rows) => setBranches(Array.isArray(rows) ? rows : []))
      .catch(() => setBranches([]));
    setForm((f) => ({ ...f, homeBranchId: '' }));
  }, [form.companyId]);

  if (customer) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    try {
      await register({
        name: form.name.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim() || undefined,
        password: form.password,
        companyId: form.companyId,
        homeBranchId: form.homeBranchId || undefined,
      });
      navigate('/');
    } catch (err) {
      setError(err.apiError?.message || t('auth.registerFailed'));
    }
  }

  return (
    <div className="sf-login-wrap">
      <div className="sf-login-box" style={{ maxWidth: 460 }}>
        <div className="sf-login-langbar"><LanguageSwitcher /></div>
        <div className="sf-login-mark"><Logo size={34} /></div>
        <h1>{t('auth.registerTitle')}</h1>
        <div className="sf-login-sub">{t('auth.registerSubtitle')}</div>
        {error && <div className="sf-banner sf-banner-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="sf-field">
            <label>{t('auth.businessName')}</label>
            <input className="sf-input" value={form.name} onChange={set('name')} required />
          </div>
          <div className="sf-field">
            <label>{t('common.email')}</label>
            <input className="sf-input" type="email" value={form.contactEmail} onChange={set('contactEmail')} required />
          </div>
          <div className="sf-field">
            <label>{t('auth.phoneOptional')}</label>
            <input className="sf-input" value={form.contactPhone} onChange={set('contactPhone')} placeholder="+256 7XX XXX XXX" />
          </div>
          <div className="sf-field">
            <label>{t('auth.buyingFrom')}</label>
            <select className="sf-select" value={form.companyId} onChange={set('companyId')} required>
              <option value="">{t('auth.selectCompany')}</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {branches.length > 0 && (
            <div className="sf-field">
              <label>{t('auth.homeBranchOptional')}</label>
              <select className="sf-select" value={form.homeBranchId} onChange={set('homeBranchId')}>
                <option value="">{t('auth.noHomeBranch')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="sf-field">
            <label>{t('common.password')}</label>
            <input className="sf-input" type="password" value={form.password} onChange={set('password')} minLength={8} required />
          </div>
          <div className="sf-field">
            <label>{t('auth.confirmPassword')}</label>
            <input className="sf-input" type="password" value={form.confirm} onChange={set('confirm')} minLength={8} required />
          </div>
          <button className="sf-btn sf-btn-primary sf-btn-block" type="submit" disabled={loading || !form.companyId}>
            {loading ? t('auth.creating') : t('auth.createAccount')}
          </button>
        </form>
        <p style={{ fontSize: 12, color: 'var(--sf-text-muted)', marginTop: 10 }}>{t('auth.starterTermsNote')}</p>

        <div className="sf-auth-divider"><span>{t('auth.or')}</span></div>
        <GoogleButton onError={setError} />

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
          {t('auth.haveAccount')} <Link to="/login">{t('common.signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
