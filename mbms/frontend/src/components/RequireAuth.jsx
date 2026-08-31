import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { canSeeCurrentPath } from '../lib/capabilities';

// Visibility model (27 August 2026): besides requiring a session, a route the
// signed-in user has not been granted is not reachable by typing its URL —
// they are sent to the dashboard, the one screen everyone can see. The nav
// already hides the same routes (see Layout.jsx / capabilities.js), and the
// API enforces every call regardless.
export function RequireAuth({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (!canSeeCurrentPath(pathname, user)) return <Navigate to="/dashboard" replace />;
  return children;
}
