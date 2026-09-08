import { useEffect, useState } from 'react';
import { apiRequest } from './api';

// Corporate site (29 August 2026) — shared data for the pre-login
// holding-company pages. The subsidiary list, branches, ownership and group
// figures come live from GET /customer-portal/public/overview (public, no
// token). The descriptive copy below (sector label, one-line blurb, head
// office city) is presentation only — it is keyed by the seeded subsidiary
// name and has a generic fallback, so an unknown subsidiary still renders.

export const HOLDING_NAME = 'Morise Holdings Limited';

export const SUBSIDIARY_META = {
  'Morise Agro Ltd': {
    sector: 'Agricultural inputs & fuel',
    blurb: 'Seed, fertiliser, agro-chemicals and fuel supplied to farms and agri-businesses across Uganda.',
    city: 'Kira, Wakiso',
  },
  'Morise Logistics Ltd': {
    sector: 'Road freight & delivery',
    blurb: 'Scheduled road freight, distribution and last-mile delivery for group companies and third-party clients.',
    city: 'Jinja',
  },
  'Morise Clearing & Forwarding Ltd': {
    sector: 'Customs & freight forwarding',
    blurb: 'Customs clearance, air / ocean / road forwarding and bonded warehousing at Uganda’s main border posts and Entebbe.',
    city: 'Kampala',
  },
  'Morise Warehouse Management Ltd': {
    sector: 'Storage & handling',
    blurb: 'Multi-branch ambient and cold storage, cross-docking and inventory handling across five regional warehouses.',
    city: 'Kampala (Industrial Area)',
  },
  'Morise Collateral Management Ltd': {
    sector: 'Collateral management',
    blurb: 'Field inspection, physical stock verification and chain-of-custody monitoring of goods pledged as collateral, for banks and financiers across client sites.',
    city: 'Kampala (Nakasero)',
  },
  'Morise Milling Ltd': {
    sector: 'Grain milling',
    blurb: 'Grain procurement over the weighbridge, milling of maize, wheat, sorghum and millet, packaging and distribution of flour and by-products across five regional mills.',
    city: 'Kampala (Industrial Area)',
  },
  'Morise Research & Consultancy Ltd': {
    sector: 'Research & consultancy',
    blurb: 'Social and market research, monitoring & evaluation, and technical consultancy for government, NGO, private-sector and institutional clients, with field teams across four regions.',
    city: 'Kampala (Kololo)',
  },
};

export function metaFor(name) {
  return (
    SUBSIDIARY_META[name] || {
      sector: 'Group subsidiary',
      blurb: 'A wholly-owned operating company within the Morise Holdings group.',
      city: 'Uganda',
    }
  );
}

// Brand banners (31 August 2026) — the SVGs in brand/banners/, mirrored into
// each app's public/brand/banners/ and served at /brand/banners/*.svg.
// See brand/README.md for the full set.
export const GROUP_HERO_BANNER = '/brand/banners/group-hero.svg';
export const PROMO_STRIP_BANNER = '/brand/banners/promo-strip.svg';

const SUBSIDIARY_BANNER = {
  'Morise Agro Ltd': '/brand/banners/subsidiary-agro.svg',
  'Morise Logistics Ltd': '/brand/banners/subsidiary-logistics.svg',
  'Morise Clearing & Forwarding Ltd': '/brand/banners/subsidiary-clearing-forwarding.svg',
  'Morise Warehouse Management Ltd': '/brand/banners/subsidiary-warehouse.svg',
  'Morise Collateral Management Ltd': '/brand/banners/subsidiary-collateral.svg',
  'Morise Milling Ltd': '/brand/banners/subsidiary-milling.svg',
  'Morise Research & Consultancy Ltd': '/brand/banners/subsidiary-research-consultancy.svg',
};

// A subsidiary's own banner, with the group hero as a safe fallback for a
// name we don't have artwork for.
export function bannerFor(name) {
  return SUBSIDIARY_BANNER[name] || GROUP_HERO_BANNER;
}

// Group leadership — the seeded senior staff personas (see backend
// prisma/seed.ts). Shown on the Governance / Board page. Demo data.
export const LEADERSHIP = [
  { name: 'Okurut Mathias', role: 'Managing Director', since: '2016', initials: 'OM' },
  { name: 'Obeke Godfrey', role: 'Group IT & Systems', since: '2018', initials: 'OG' },
  { name: 'Alan Smith', role: 'Group Finance Manager', since: '2019', initials: 'AS' },
  { name: 'Mary Nakato', role: 'Group Human Resources', since: '2019', initials: 'MN' },
  { name: 'Peter Kintu', role: 'Branch Manager — Agro', since: '2020', initials: 'PK' },
  { name: 'Grace Namuli', role: 'Sales Manager — Agro', since: '2021', initials: 'GN' },
  { name: 'Robert Kato', role: 'Procurement Manager', since: '2021', initials: 'RK' },
  { name: 'Susan Nassuna', role: 'Group Auditor (non-executive)', since: '2018', initials: 'SN' },
];

// News / press — illustrative group announcements for the News page. Demo
// content; there is no press-release store in this build.
export const NEWS = [
  { date: '9 Sep 2026', tag: 'Portfolio', title: 'Morise Research & Consultancy Ltd incorporated as a wholly-owned subsidiary with field offices in four regions' },
  { date: '3 Sep 2026', tag: 'Portfolio', title: 'Morise Milling Ltd incorporated as a wholly-owned subsidiary with five regional mills' },
  { date: '29 Aug 2026', tag: 'Digital', title: 'Group storefront opens across all four subsidiaries' },
  { date: '28 Aug 2026', tag: 'Operations', title: 'Warehouse Management rolls out shift scheduling and payroll' },
  { date: '27 Aug 2026', tag: 'Governance', title: 'Delegated administration model adopted group-wide' },
  { date: '19 Aug 2026', tag: 'Portfolio', title: 'Morise Warehouse Management Ltd incorporated as a wholly-owned subsidiary' },
  { date: '18 Aug 2026', tag: 'Portfolio', title: 'Morise Clearing & Forwarding Ltd incorporated with six border offices' },
  { date: '12 Aug 2026', tag: 'Financial', title: 'Consolidated chart of accounts and inter-company reporting go live' },
];

export function useGroupOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    apiRequest('/customer-portal/public/overview')
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.apiError?.message || 'Unable to load group information.'));
    return () => {
      alive = false;
    };
  }, []);

  return { data, error, loading: !data && !error };
}

// Social media channels (29 August 2026) — added in Admin » CMS / Site
// Builder, shown in the footer. Public, no token; visible channels only, in
// the admin-set order. Fails soft: an empty list just renders no row.
const SOCIAL_ICON = {
  facebook: 'f',
  x: '𝕏',
  instagram: 'ig',
  linkedin: 'in',
  youtube: '▶',
  tiktok: '♪',
  whatsapp: '⌾',
  telegram: '✈',
  other: '↗',
};

export function socialIcon(platform) {
  return SOCIAL_ICON[platform] || SOCIAL_ICON.other;
}

export function socialLabel(link) {
  if (link.label) return link.label;
  const p = link.platform;
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Link';
}

export function useSocialLinks() {
  const [links, setLinks] = useState([]);

  useEffect(() => {
    let alive = true;
    apiRequest('/customer-portal/public/social-links')
      .then((d) => alive && Array.isArray(d) && setLinks(d))
      .catch(() => {
        /* footer just renders no social row */
      });
    return () => {
      alive = false;
    };
  }, []);

  return links;
}

// Shared social content (2 September 2026) — the one display name + tagline
// Admin » CMS / Site Builder pushes to every channel. The footer shows the
// tagline above the channel row. Empty object when nothing is set / hidden.
export function useSocialContent() {
  const [content, setContent] = useState({});

  useEffect(() => {
    let alive = true;
    apiRequest('/customer-portal/public/social-content')
      .then((d) => alive && d && typeof d === 'object' && setContent(d))
      .catch(() => {
        /* footer just omits the tagline */
      });
    return () => {
      alive = false;
    };
  }, []);

  return content;
}

// Landing-page FAQ (29 August 2026) — added in Admin » CMS / Site Builder,
// shown in the landing page's FAQ section. Public, no token; visible items
// only, in the admin-set order.
export function useFaqs() {
  const [faqs, setFaqs] = useState([]);

  useEffect(() => {
    let alive = true;
    apiRequest('/customer-portal/public/faqs')
      .then((d) => alive && Array.isArray(d) && setFaqs(d))
      .catch(() => {
        /* FAQ section just doesn't render */
      });
    return () => {
      alive = false;
    };
  }, []);

  return faqs;
}

// Landing-page newsletter sign-up (29 August 2026). Public, rate-limited,
// idempotent. Resolves true on success, throws on a real failure.
export async function subscribeNewsletter(email) {
  const res = await apiRequest('/customer-portal/public/newsletter', {
    method: 'POST',
    body: { email, source: 'landing' },
  });
  return res?.subscribed === true;
}

// Site disclaimer (30 August 2026) — the statements a signed-out visitor
// acknowledges on the full-page gate before the landing page, plus how many
// seconds the "continue" button is held (server-controlled). Public, no
// token. Fails soft: an empty list lets the gate fall through immediately.
export const DISCLAIMER_ACK_KEY = 'storefront.disclaimer_acknowledged';

export function disclaimerAcknowledged() {
  try {
    return localStorage.getItem(DISCLAIMER_ACK_KEY) === '1';
  } catch {
    return false;
  }
}

export function acknowledgeDisclaimer() {
  try {
    localStorage.setItem(DISCLAIMER_ACK_KEY, '1');
  } catch {
    /* best-effort */
  }
}

export function useDisclaimer() {
  const [state, setState] = useState({ items: [], holdSeconds: 10, loaded: false });

  useEffect(() => {
    let alive = true;
    apiRequest('/customer-portal/public/disclaimer')
      .then((d) => {
        if (!alive) return;
        setState({
          items: Array.isArray(d?.items) ? d.items : [],
          holdSeconds: Number.isFinite(d?.holdSeconds) ? d.holdSeconds : 10,
          loaded: true,
        });
      })
      .catch(() => alive && setState((s) => ({ ...s, loaded: true })));
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
