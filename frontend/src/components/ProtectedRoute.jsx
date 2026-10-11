// ============================================================
// src/components/ProtectedRoute.jsx — Route Guards
//
// Two components are exported here:
//
// 1. ProtectedRoute — wraps a page and enforces:
//    a) User must be logged in (redirect to /login if not)
//    b) User must have one of the allowedRoles (redirect to /unauthorized if not)
//
// 2. RoleRedirect — sends the logged-in user to the correct
//    dashboard based on their role (used on the "/" route).
//
// Usage:
//   <ProtectedRoute allowedRoles={['Admin']}>
//     <DashboardAdmin />
//   </ProtectedRoute>
// ============================================================

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// ── PROTECTED ROUTE ──────────────────────────────────────────
// Props:
//   children    — the page component to render if access is granted
//   allowedRoles — optional array of roles that may access this route
//                  e.g. ['Admin'] or ['Admin', 'NGO']
//                  If omitted, any authenticated user can access the page.
export function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth();

  // ── CASE 1: Still checking if saved session is valid ─────────
  // Show a neutral loading screen instead of incorrectly redirecting.
  if (loading) {
    return (
      <div className="loading-screen">
        <p>Checking authentication...</p>
      </div>
    );
  }

  // ── CASE 2: Not logged in ─────────────────────────────────────
  // Redirect to /login. The `replace` prop replaces the current history
  // entry so pressing "Back" doesn't bring the user back to the protected page.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ── CASE 3: Logged in but wrong role ─────────────────────────
  // If allowedRoles is specified, check that the user's role is in the list.
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // ── CASE 4: All checks pass — render the protected page ──────
  return children;
}

// ── ROLE REDIRECT ────────────────────────────────────────────
// After login (on the "/" route), redirect each user to their
// role-specific dashboard automatically.
export function RoleRedirect() {
  const { user, isAuthenticated, loading } = useAuth();

  // While checking auth status, show loading screen
  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // If somehow not authenticated at the "/" route, go to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Map each role to its dashboard URL
  const roleDashboards = {
    Admin:     '/dashboard/admin',
    Volunteer: '/dashboard/volunteer',
    NGO:       '/dashboard/ngo',
    Citizen:   '/dashboard/citizen',
    Donor:     '/dashboard/donor',
  };

  // Look up the dashboard for this user's role.
  // If the role is unrecognised (shouldn't happen), go to /unauthorized.
  const destination = roleDashboards[user.role] || '/unauthorized';

  return <Navigate to={destination} replace />;
}

export default ProtectedRoute;
