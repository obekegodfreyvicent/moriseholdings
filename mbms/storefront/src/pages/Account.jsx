import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useT } from '../lib/i18n';
import { apiRequest } from '../lib/api';
import { money } from '../lib/format';

export function AccountPage() {
  const t = useT();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [newAddress, setNewAddress] = useState({ label: '', addressLine: '' });
  const [addingAddress, setAddingAddress] = useState(false);

  function load() {
    apiRequest('/customer-portal/me').then(setProfile);
    apiRequest('/customer-portal/delivery-addresses').then(setAddresses);
  }

  useEffect(load, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiRequest('/customer-portal/me', {
        method: 'PATCH',
        body: { contactEmail: profile.contactEmail, contactPhone: profile.contactPhone, address: profile.address },
      });
      setProfile(updated);
      setSaved(true);
    } catch (err) {
      setError(err.apiError?.message || t('account.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function addAddress(e) {
    e.preventDefault();
    if (!newAddress.label || !newAddress.addressLine) return;
    setAddingAddress(true);
    try {
      await apiRequest('/customer-portal/delivery-addresses', { method: 'POST', body: newAddress });
      setNewAddress({ label: '', addressLine: '' });
      apiRequest('/customer-portal/delivery-addresses').then(setAddresses);
    } finally {
      setAddingAddress(false);
    }
  }

  if (!profile || !addresses) return <Layout><div className="sf-loading">{t('common.loading')}</div></Layout>;

  return (
    <Layout>
      <div className="sf-pagehead">
        <div>
          <span className="sf-crumb">{t('nav.account')}</span>
          <h1>{t('account.title')}</h1>
        </div>
      </div>

      {error && <div className="sf-banner sf-banner-error">{error}</div>}
      {saved && <div className="sf-banner sf-banner-success">{t('common.saved')}</div>}

      <div className="sf-card sf-account-belongs" style={{ marginBottom: 14 }}>
        <span className="sf-account-belongs-label">{t('account.youBuyThrough')}</span>
        <div className="sf-account-belongs-value">
          <strong>{profile.companyName || '—'}</strong>
          {profile.homeBranchName && <span> · {profile.homeBranchName}</span>}
          {profile.holdingCompanyName && profile.holdingCompanyName !== profile.companyName && (
            <span className="sf-account-belongs-holding"> — {t('account.partOf', { holding: profile.holdingCompanyName })}</span>
          )}
        </div>
        {profile.homeBranchAddress && <div className="sf-branch-addr">{profile.homeBranchAddress}</div>}
        <p className="sf-account-belongs-note">{t('account.groupShopNote')}</p>
      </div>

      <div className="sf-grid-2">
        <div className="sf-card">
          <strong>{t('account.companyInfo')}</strong>
          <form onSubmit={saveProfile} style={{ marginTop: 12 }}>
            <div className="sf-row" style={{ gap: 14 }}>
              <div className="sf-field" style={{ flex: 1 }}>
                <label>{t('account.companyName')}</label>
                <input className="sf-input" value={profile.name} disabled />
              </div>
              <div className="sf-field" style={{ flex: 1 }}>
                <label>{t('account.accountNumber')}</label>
                <input className="sf-input" value={profile.accountNumber || ''} disabled />
              </div>
            </div>
            <div className="sf-row" style={{ gap: 14 }}>
              <div className="sf-field" style={{ flex: 1 }}>
                <label>{t('common.email')}</label>
                <input className="sf-input" value={profile.contactEmail || ''} onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })} />
              </div>
              <div className="sf-field" style={{ flex: 1 }}>
                <label>{t('account.phone')}</label>
                <input className="sf-input" value={profile.contactPhone || ''} onChange={(e) => setProfile({ ...profile, contactPhone: e.target.value })} />
              </div>
            </div>
            <div className="sf-field">
              <label>{t('account.address')}</label>
              <input className="sf-input" value={profile.address || ''} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
            </div>
            <div className="sf-row" style={{ gap: 14 }}>
              <div className="sf-field" style={{ flex: 1 }}>
                <label>{t('account.creditLimit')}</label>
                <input className="sf-input" value={profile.creditLimit ? money(profile.creditLimit) : '—'} disabled />
              </div>
              <div className="sf-field" style={{ flex: 1 }}>
                <label>{t('account.paymentTerms')}</label>
                <input className="sf-input" value={profile.paymentTermsDays ? t('account.net', { days: profile.paymentTermsDays }) : '—'} disabled />
              </div>
            </div>
            <button className="sf-btn sf-btn-primary" type="submit" disabled={saving}>
              {saving ? t('account.saving') : t('account.saveChanges')}
            </button>
          </form>
        </div>

        <div className="sf-card">
          <strong>{t('account.deliveryAddresses')}</strong>
          <table className="sf-table" style={{ marginTop: 10 }}>
            <tbody>
              {addresses.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.label}
                    {a.isDefault ? ` ${t('account.default')}` : ''}
                  </td>
                  <td>{a.addressLine}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <hr className="sf-divider" />
          <form onSubmit={addAddress}>
            <div className="sf-field">
              <label>{t('account.label')}</label>
              <input className="sf-input" placeholder={t('account.labelPlaceholder')} value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} />
            </div>
            <div className="sf-field">
              <label>{t('account.address')}</label>
              <input className="sf-input" value={newAddress.addressLine} onChange={(e) => setNewAddress({ ...newAddress, addressLine: e.target.value })} />
            </div>
            <button className="sf-btn sf-btn-secondary sf-btn-block" type="submit" disabled={addingAddress}>
              {addingAddress ? t('account.adding') : t('account.addDeliveryAddress')}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
