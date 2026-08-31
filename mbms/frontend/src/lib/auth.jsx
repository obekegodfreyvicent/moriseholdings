import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest, clearSession, getAccessToken, getRefreshToken, getStoredUser, storeSession } from './api';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Keep local state in sync if another tab logs out.
    const onStorage = () => setUser(getStoredUser());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // On load, re-fetch the signed-in user's effective permission codes so the
  // Admin app can HIDE nav items / screens they have not been granted (a
  // session stored before this field existed, or a grant changed since
  // login, is picked up here). Permissions are also enforced server-side.
  useEffect(() => {
    if (!getStoredUser()) return;
    apiRequest('/identity/users/me')
      .then((me) => {
        setUser((prev) => {
          if (!prev) return prev;
          const next = { ...prev, permissions: me.permissions ?? prev.permissions ?? [] };
          storeSession(getAccessToken(), getRefreshToken(), next);
          return next;
        });
      })
      .catch(() => {
        /* offline / 401 handled elsewhere — leave stored user as-is */
      });
  }, []);

  async function login(email, password) {
    setLoading(true);
    try {
      const data = await apiRequest('/identity/auth/login', { method: 'POST', body: { email, password } });
      storeSession(data.access_token, data.refresh_token, data.user);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    clearSession();
    setUser(null);
  }

  function hasRole(...roles) {
    return !!user && roles.some((r) => user.roles.includes(r));
  }

  // Effective-permission check (role permissions + direct grants), any-of.
  // Holders of identity.user.manage (platform admins) implicitly pass.
  function hasPermission(...codes) {
    if (!user) return false;
    const held = Array.isArray(user.permissions) ? user.permissions : [];
    if (held.includes('identity.user.manage')) return true;
    return codes.some((c) => held.includes(c));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
