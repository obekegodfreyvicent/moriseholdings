import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';

// "Continue with Google" — offline seam. A production build renders Google's
// Identity Services button and sends the verified ID token; this build asks
// for the Google account e-mail directly and the backend trusts it.
export function GoogleButton({ onError }) {
  const { googleSignIn, loading } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);

  async function go(e) {
    e.preventDefault();
    setErr(null);
    try {
      await googleSignIn({ email: email.trim(), name: name.trim() || undefined });
      navigate('/');
    } catch (e2) {
      const m = e2.apiError?.message || t('auth.googleFailed');
      setErr(m);
      onError?.(m);
    }
  }

  return (
    <>
      <button type="button" className="sf-btn sf-btn-secondary sf-btn-block" onClick={() => setOpen(true)} disabled={loading}>
        <span aria-hidden style={{ fontWeight: 700, marginRight: 8, color: '#4285F4' }}>G</span>
        {t('auth.continueWithGoogle')}
      </button>
      {open && (
        <div className="sf-disclaimer-backdrop" onClick={() => setOpen(false)}>
          <div className="sf-disclaimer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h2>{t('auth.continueWithGoogle')}</h2>
            <p style={{ fontSize: 13, color: 'var(--sf-text-muted)' }}>{t('auth.googleSeamNote')}</p>
            {err && <div className="sf-banner sf-banner-error">{err}</div>}
            <form onSubmit={go}>
              <div className="sf-field">
                <label>{t('auth.googleEmail')}</label>
                <input className="sf-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <div className="sf-field">
                <label>{t('auth.nameOptional')}</label>
                <input className="sf-input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <button className="sf-btn sf-btn-primary sf-btn-block" type="submit" disabled={loading}>
                {loading ? t('common.signingIn') : t('auth.continue')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
