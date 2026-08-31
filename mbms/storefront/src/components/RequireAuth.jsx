import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function RequireAuth({ children }) {
  const { customer } = useAuth();
  if (!customer) return <Navigate to="/login" replace />;
  return children;
}
