import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest, clearSession, getStoredCustomer, storeSession } from './api';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(() => getStoredCustomer());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onStorage = () => setCustomer(getStoredCustomer());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function adopt(data) {
    storeSession(data.access_token, data.refresh_token, data.customer);
    setCustomer(data.customer);
    return data.customer;
  }

  async function login(identifier, password) {
    setLoading(true);
    try {
      return adopt(await apiRequest('/customer-portal/auth/login', { method: 'POST', body: { identifier, password } }));
    } finally {
      setLoading(false);
    }
  }

  async function register(body) {
    setLoading(true);
    try {
      return adopt(await apiRequest('/customer-portal/auth/register', { method: 'POST', body }));
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn(body) {
    setLoading(true);
    try {
      return adopt(await apiRequest('/customer-portal/auth/google', { method: 'POST', body }));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    clearSession();
    setCustomer(null);
  }

  return (
    <AuthContext.Provider value={{ customer, loading, login, register, googleSignIn, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
