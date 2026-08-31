import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CorporateLayout } from '../components/CorporateLayout';
import { useT } from '../lib/i18n';
import { apiRequest } from '../lib/api';

// Public storefront content page (28 August 2026; restyled 29 August 2026).
// Renders a published CMS content block by slug at /page/:slug — usable
// before sign-in (About / Terms / Delivery from the corporate site's
// utility bar and footer). Uses the same CorporateLayout chrome and mc-*
// styling as the rest of the pre-login corporate mini-site.
export function ContentPage() {
  const t = useT();
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPage(null);
    setError(null);
    apiRequest(`/customer-portal/content/${encodeURIComponent(slug)}`)
      .then(setPage)
      .catch((err) => setError(err.apiError?.message || t('page.notFound')));
  }, [slug]);

  return (
    <CorporateLayout>
      <div className="mc-wrap mc-section">
        <div className="mc-crumbs">
          <Link to="/">{t('corp.crumb.home')}</Link> / <b>{page ? page.title : '…'}</b>
        </div>

        {error && <div className="mc-error">{error}</div>}
        {!error && !page && <div className="mc-loading">{t('common.loading')}</div>}

        {page && (
          <article className="mc-article" style={{ marginTop: 20 }}>
            <h1>{page.title}</h1>
            {page.publishedAt && (
              <p className="mc-updated">
                {t('page.updated', { date: new Date(page.publishedAt).toLocaleDateString() })}
              </p>
            )}
            <div className="mc-body">{page.body}</div>
          </article>
        )}
      </div>
    </CorporateLayout>
  );
}
