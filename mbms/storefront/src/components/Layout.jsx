import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/cart';
import { useT } from '../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useSocialLinks, useSocialContent, socialIcon, socialLabel } from '../lib/corporate';
import Logo from './Logo';

const NAV = [
  { to: '/', key: 'nav.home' },
  { to: '/shop', key: 'nav.shop' },
  { to: '/subsidiaries', key: 'nav.subsidiaries' },
  { to: '/orders', key: 'nav.orders' },
  { to: '/invoices', key: 'nav.invoices' },
  { to: '/support', key: 'nav.support' },
  { to: '/account', key: 'nav.account' },
];

export function Layout({ children }) {
  const { customer, logout } = useAuth();
  const { count } = useCart();
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const social = useSocialLinks();
  const socialContent = useSocialContent();

  function onSearch(e) {
    e.preventDefault();
    if (search.trim()) navigate(`/shop?search=${encodeURIComponent(search.trim())}`);
  }

  const initials = (customer?.name || '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="sf-shell">
      <header className="sf-topbar">
        <Link to="/" className="sf-brand">
          <span className="sf-brand-mark"><Logo size={22} /></span>
          <span className="sf-brand-name">{t('header.brand')}</span>
        </Link>
        <form className="sf-search" onSubmit={onSearch}>
          <input placeholder={t('header.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <div className="sf-topbar-actions">
          <LanguageSwitcher compact />
          <Link to="/cart" className="sf-cart-btn">
            🧾 <span className="sf-cart-label">{t('header.cart')}</span>
            {count > 0 && <span className="sf-cart-badge">{count}</span>}
          </Link>
          <div className="sf-account-menu">
            <button className="sf-account-btn" onClick={() => setMenuOpen((v) => !v)}>
              <span className="sf-account-avatar">{initials || 'C'}</span>
              <span className="sf-account-name-wrap">
                <span className="sf-account-name">{customer?.name}</span>
                {customer?.companyName && (
                  <span className="sf-account-belongs-mini">
                    {customer.companyName}
                    {customer.homeBranchName ? ` · ${customer.homeBranchName}` : ''}
                  </span>
                )}
              </span>
              <span className="sf-caret">▾</span>
            </button>
            {menuOpen && (
              <div className="sf-account-dropdown" onMouseLeave={() => setMenuOpen(false)}>
                {customer?.companyName && (
                  <div className="sf-account-dropdown-head">
                    {t('header.buyingThrough')}
                    <strong>
                      {customer.companyName}
                      {customer.homeBranchName ? ` · ${customer.homeBranchName}` : ''}
                    </strong>
                  </div>
                )}
                <Link to="/account" onClick={() => setMenuOpen(false)}>
                  {t('header.myAccount')}
                </Link>
                <button onClick={logout}>{t('header.signOut')}</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <nav className="sf-nav">
        {NAV.map((item) => (
          <Link key={item.to} to={item.to} className={`sf-nav-link ${location.pathname === item.to ? 'active' : ''}`}>
            {t(item.key)}
          </Link>
        ))}
      </nav>
      <main className="sf-content">{children}</main>
      <footer className="sf-footer">
        <div className="sf-footer-inner">
          <span className="sf-footer-copy">{t('landing.footerCopyright', { year: new Date().getFullYear() })}</span>
          {social.length > 0 && (
            <div className="sf-social">
              <span className="sf-social-label">{t('corp.footer.followUs')}</span>
              {socialContent.tagline && <span className="sf-social-tagline">{socialContent.tagline}</span>}
              {social.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="sf-social-link"
                  aria-label={socialLabel(l)}
                  title={socialLabel(l)}
                >
                  <span aria-hidden="true">{socialIcon(l.platform)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
