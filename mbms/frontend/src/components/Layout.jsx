import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { apiRequest, apiRequestWithMeta } from '../lib/api';
import { canSeeRoute } from '../lib/capabilities';
import Logo from './Logo';

// Admin navigation redesign (27 August 2026) — the sidebar was a flat list
// of 21 links; it is now four collapsible categories matching the agreed
// screen taxonomy (see the four reference screenshots in
// Morise/screenshots/ and the root README). Items marked `stub: true` have
// no backend service in the current slice and route to <ComingSoon>; every
// previously working page is still reachable, just regrouped.
const NAV_GROUPS = [
  {
    key: 'admin',
    label: 'Admin / Backend',
    items: [
      { to: '/dashboard', icon: '⌗', label: 'Dashboard' },
      { to: '/companies', icon: '\u{1F3E2}', label: 'Companies & Holdings' },
      { to: '/products', icon: '\u{1F4E6}', label: 'Product Manager' },
      { to: '/orders', icon: '\u{1F6D2}', label: 'Order Management' },
      { to: '/inventory', icon: '\u{1F5C4}', label: 'Inventory' },
      { to: '/fleet', icon: '\u{1F69B}', label: 'Fleet' },
      { to: '/alerts', icon: '\u{1F514}', label: 'Alerts' },
      { to: '/customers', icon: '\u{1F91D}', label: 'Customers (CRM)' },
      { to: '/support-tickets', icon: '\u{1F3AB}', label: 'Support Tickets' },
      { to: '/marketing', icon: '\u{1F4E3}', label: 'Marketing & Promos' },
      { to: '/cms', icon: '\u{1F9F1}', label: 'CMS / Site Builder' },
      { to: '/users', icon: '\u{1F465}', label: 'Users & Settings' },
      { to: '/audit', icon: '\u{1F50E}', label: 'Activity Log' },
    ],
  },
  {
    key: 'hr',
    label: 'Human Resources',
    items: [
      { to: '/hr', icon: '\u{1F4CA}', label: 'HR Dashboard' },
      { to: '/employees', icon: '\u{1F464}', label: 'Employees' },
      { to: '/departments', icon: '\u{1F3EC}', label: 'Departments' },
      { to: '/attendance', icon: '\u{23F1}', label: 'Attendance' },
      { to: '/leave', icon: '\u{1F3D6}', label: 'Leave Requests' },
      { to: '/shift-scheduling', icon: '\u{1F4C5}', label: 'Shift Scheduling' },
      { to: '/recruitment', icon: '\u{1F4E3}', label: 'Recruitment' },
      { to: '/payroll', icon: '\u{1F4B0}', label: 'Payroll' },
    ],
  },
  {
    key: 'my-hr',
    label: 'My HR',
    items: [
      { to: '/profile', icon: '\u{1F464}', label: 'My Profile' },
      { to: '/my/clock', icon: '\u{23F1}', label: 'Clock In / Out' },
      { to: '/my/leave', icon: '\u{1F3D6}', label: 'My Leave' },
      { to: '/my/shifts', icon: '\u{1F4C5}', label: 'My Shifts' },
      { to: '/my/performance', icon: '\u{1F3AF}', label: 'My Performance' },
      { to: '/my/payslips', icon: '\u{1F9FE}', label: 'My Payslips' },
      { to: '/my/salary-advances', icon: '\u{1F4B5}', label: 'My Salary Advances' },
    ],
  },
  {
    key: 'finance',
    label: 'Financial & Accounting',
    items: [
      { to: '/finance', icon: '\u{1F4B2}', label: 'Financial & Accounting' },
      { to: '/executive', icon: '\u{1F9E9}', label: 'Executive Q&A' },
      { to: '/accounting', icon: '\u{1F4D2}', label: 'General Ledger & Journals' },
      { to: '/accounts-payable', icon: '\u{1F4E4}', label: 'Accounts Payable' },
      { to: '/expenses', icon: '\u{1F9FE}', label: 'Expenses' },
      { to: '/assets', icon: '\u{1F3D7}', label: 'Assets' },
      { to: '/projects', icon: '\u{1F4CB}', label: 'Projects' },
      { to: '/reports', icon: '\u{1F4C4}', label: 'Reports' },
      { to: '/suppliers', icon: '\u{1F69A}', label: 'Suppliers' },
      { to: '/inter-company', icon: '\u{1F501}', label: 'Inter-Company' },
    ],
  },
];

const NAV_OPEN_KEY = 'mbms.nav.open';

function readOpenGroups(pathname) {
  try {
    const saved = JSON.parse(localStorage.getItem(NAV_OPEN_KEY));
    if (Array.isArray(saved)) return new Set(saved);
  } catch {
    // ignore malformed / unavailable storage
  }
  const active = NAV_GROUPS.find((g) => g.items.some((i) => pathname.startsWith(i.to)));
  return new Set([active ? active.key : NAV_GROUPS[0].key]);
}

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Responsiveness pass (19 August 2026): the sidebar was always a fixed
  // 220px column with no mobile behavior at all — on a narrow viewport it
  // either squeezed .content to nothing or overflowed the page. Below the
  // 900px breakpoint (see app.css) it now renders as an off-canvas drawer,
  // toggled by this hamburger button and closed automatically on
  // navigation, the same collapse/auto-close pattern most admin shells use.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => readOpenGroups(location.pathname));

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Keep the category that owns the current route expanded, even if the user
  // had collapsed it before navigating into it via a link elsewhere.
  useEffect(() => {
    const active = NAV_GROUPS.find((g) => g.items.some((i) => location.pathname.startsWith(i.to)));
    if (active && !openGroups.has(active.key)) {
      setOpenGroups((prev) => {
        const next = new Set(prev);
        next.add(active.key);
        persistOpenGroups(next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function persistOpenGroups(set) {
    try {
      localStorage.setItem(NAV_OPEN_KEY, JSON.stringify([...set]));
    } catch {
      // storage unavailable — collapse state is best-effort only
    }
  }

  function toggleGroup(key) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persistOpenGroups(next);
      return next;
    });
  }

  const initials = user ? `${user.first_name[0]}${user.last_name[0]}` : '';

  return (
    <div className="app">
      <div className="topbar">
        <button
          className="hamburger"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          title="Menu"
        >
          &#9776;
        </button>
        <div className="logo">
          <div className="mark"><Logo size={20} /></div>
          <span className="logotext">Morise Holdings Limited</span>
        </div>
        <div className="spacer" />
        <NotificationBell />
        <button
          className="user"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          title="Sign out"
        >
          <div className="avatar">{initials}</div>
          <span className="username">
            {user?.first_name} {user?.last_name}
          </span>
          <span style={{ opacity: 0.6 }}>&#8964;</span>
        </button>
      </div>
      <div className="shell">
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <div className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          {NAV_GROUPS.map((group) => {
            // Visibility model (27 August 2026): an item the signed-in user
            // has not been granted is not rendered at all — not shown
            // disabled, not shown greyed. A category with no visible item
            // disappears with it.
            const visibleItems = group.items.filter((item) => canSeeRoute(item.to, user));
            if (visibleItems.length === 0) return null;
            const isOpen = openGroups.has(group.key);
            return (
              <div key={group.key} className="navgroup">
                <button
                  type="button"
                  className={`navgroup-header${isOpen ? ' open' : ''}`}
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={isOpen}
                >
                  <span className="navgroup-label">{group.label}</span>
                  <span className="navgroup-caret">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div className="navgroup-items">
                    {visibleItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`navitem${location.pathname.startsWith(item.to) ? ' active' : ''}`}
                      >
                        <span className="ic">{item.icon}</span>
                        <span className="navitem-label">{item.label}</span>
                        {item.stub && <span className="navitem-soon">soon</span>}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="content">
          <div className="inner">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Sprint 14 — morise.docx, Section 39 ("Notifications and Alerts"),
// "Workflow notifications" specifically: an in-app feed only, polled every
// 20s for the unread count (no WebSocket/push infrastructure exists in
// this proof-of-concept, the same class of gap already noted for real
// email/push delivery).
function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);

  async function loadCount() {
    try {
      const data = await apiRequest('/notifications/unread-count');
      setCount(data.count);
    } catch {
      // Silent — a failed poll shouldn't disrupt the rest of the UI.
    }
  }

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 20_000);
    return () => clearInterval(interval);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      const { items } = await apiRequestWithMeta('/notifications', { pageSize: 10 });
      setItems(items);
    }
  }

  async function markRead(id) {
    setBusy(true);
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'POST' });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      loadCount();
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await apiRequest('/notifications/read-all', { method: 'POST' });
      setItems((prev) => (prev ?? []).map((n) => ({ ...n, isRead: true })));
      setCount(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'relative', marginRight: 8 }}>
      <button
        className="btn-ghost"
        onClick={toggleOpen}
        title="Notifications"
        style={{ position: 'relative', fontSize: 18, padding: '6px 10px' }}
      >
        {'\u{1F514}'}
        {count > 0 && (
          <span
            className="badge error"
            style={{ position: 'absolute', top: -4, right: -4, fontSize: 10, padding: '1px 5px', minWidth: 16 }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div
          className="card"
          style={{ position: 'absolute', right: 0, top: '110%', width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 50 }}
        >
          <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Notifications</span>
            <button className="btn-ghost" disabled={busy || count === 0} onClick={markAllRead} style={{ fontSize: 12 }}>
              Mark all read
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {items === null ? (
              <div className="loading">Loading…</div>
            ) : items.length === 0 ? (
              <div className="empty">No notifications yet.</div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border, #eee)',
                    cursor: n.isRead ? 'default' : 'pointer',
                    opacity: n.isRead ? 0.55 : 1,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: n.isRead ? 400 : 700 }}>{n.title}</div>
                  {n.message && <div style={{ opacity: 0.75, marginTop: 2 }}>{n.message}</div>}
                  <div style={{ opacity: 0.5, fontSize: 11, marginTop: 4 }}>{n.createdAt?.slice(0, 16).replace('T', ' ')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
