import React from 'react';
import { Link } from 'react-router-dom';
import { CorporateLayout } from '../../components/CorporateLayout';
import { useT } from '../../lib/i18n';
import { useGroupOverview, HOLDING_NAME } from '../../lib/corporate';

// Contacts (screenshots/files(13)/8-contacts.html): three contact cards, a
// (non-submitting, demo) message form, and the registered-office block —
// the address comes live from the holding company on the overview endpoint.
export function CorporateContacts() {
  const t = useT();
  const { data } = useGroupOverview();
  const holding = data?.holdingCompany;

  function onSubmit(e) {
    e.preventDefault();
    // Demo build — no message is sent. Account holders raise support
    // tickets from inside the portal instead.
    alert(t('corp.contacts.formAlert'));
  }

  return (
    <CorporateLayout active="contacts">
      <div className="mc-wrap">
        <div className="mc-crumbs">
          <Link to="/">{t('corp.crumb.home')}</Link> / <b>{t('corp.nav.contacts')}</b>
        </div>
        <div className="mc-pagehead mc-noborder">
          <div className="mc-eyebrow">{t('corp.contacts.eyebrow')}</div>
          <h1>{t('corp.nav.contacts')}</h1>
        </div>

        <div className="mc-contact-grid">
          <div className="mc-contact-card">
            <div className="mc-ctag">{t('corp.contacts.tagAccounts')}</div>
            <h3>{t('corp.contacts.accountsTitle')}</h3>
            <p>{t('corp.contacts.accountsBody')}</p>
          </div>
          <div className="mc-contact-card">
            <div className="mc-ctag">{t('corp.contacts.tagMedia')}</div>
            <h3>{t('corp.contacts.mediaTitle')}</h3>
            <p>{holding?.contactEmail || 'press@morise.example'}</p>
          </div>
          <div className="mc-contact-card">
            <div className="mc-ctag">{t('corp.contacts.tagGeneral')}</div>
            <h3>{t('corp.contacts.generalTitle')}</h3>
            <p>
              {holding?.contactPhone || '+256 (0) 414 000 000'}
              <br />
              {holding?.contactEmail || 'info@morise.example'}
            </p>
          </div>
        </div>

        <div className="mc-formblock">
          <form onSubmit={onSubmit}>
            <h2>{t('corp.contacts.formTitle')}</h2>
            <div className="mc-field">
              <label>{t('corp.contacts.fName')}</label>
              <input type="text" placeholder="Jane Nakawesi" />
            </div>
            <div className="mc-field">
              <label>{t('corp.contacts.fEmail')}</label>
              <input type="email" placeholder="jane@example.com" />
            </div>
            <div className="mc-field">
              <label>{t('corp.contacts.fSubject')}</label>
              <input type="text" placeholder={t('corp.contacts.fSubjectPh')} />
            </div>
            <div className="mc-field">
              <label>{t('corp.contacts.fMessage')}</label>
              <textarea placeholder={t('corp.contacts.fMessagePh')} />
            </div>
            <button type="submit" className="mc-btn mc-btn-solid">
              {t('corp.contacts.send')}
            </button>
            <p className="mc-form-note">{t('corp.contacts.formNote')}</p>
          </form>

          <div className="mc-addr-block">
            <div className="mc-alabel">{t('corp.contacts.regOffice')}</div>
            <div className="mc-aval">{holding?.name || HOLDING_NAME}</div>
            <p>{holding?.address || 'Kira, Mulawa, Wakiso District, Uganda'}</p>
            <div className="mc-map-swatch" />
          </div>
        </div>
      </div>
    </CorporateLayout>
  );
}
