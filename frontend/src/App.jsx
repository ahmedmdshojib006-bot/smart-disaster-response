// ============================================================
// src/App.jsx — Root Application Component & Route Definitions
//
// All client-side routes are defined here using React Router v6.
// Authenticated routes are wrapped in <ProtectedRoute> which
// handles login redirect and role-based access control.
//
// Route Summary:
//   /                  → Redirects to correct dashboard by role
//   /login             → Login page (redirect away if logged in)
//   /register          → Register page (redirect away if logged in)
//   /dashboard/admin   → Admin only
//   /dashboard/volunteer → Volunteer only
//   /dashboard/ngo     → NGO only
//   /dashboard/citizen → Citizen only
//   /dashboard/donor   → Donor only
//   /unauthorized      → Shown when role check fails
//   *                  → 404 Not Found
// ============================================================

import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';

// Contexts
import { useAuth } from './context/AuthContext.jsx';

// Route Guards
import { ProtectedRoute, RoleRedirect } from './components/ProtectedRoute.jsx';

// Pages
import LoginPage        from './pages/LoginPage.jsx';
import RegisterPage     from './pages/RegisterPage.jsx';
import DashboardAdmin   from './pages/DashboardAdmin.jsx';
import DashboardVolunteer from './pages/DashboardVolunteer.jsx';
import DashboardNGO     from './pages/DashboardNGO.jsx';
import DashboardCitizen from './pages/DashboardCitizen.jsx';
import DashboardDonor   from './pages/DashboardDonor.jsx';

// ── PUBLIC ONLY ROUTE ────────────────────────────────────────
// Wraps Login and Register: if the user is already authenticated,
// redirect them to "/" rather than showing the auth forms again.
function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // While checking auth, show a loading screen (same as ProtectedRoute)
  if (loading) {
    return <div className="loading-screen"><p>Loading...</p></div>;
  }

  // Already logged in? Go home (RoleRedirect will pick the right dashboard)
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// ── UNAUTHORIZED PAGE ────────────────────────────────────────
// Shown when a user tries to access a route their role forbids.
function UnauthorizedPage() {
  return (
    <div className="error-page">
      <h1>🔒</h1>
      <h1 style={{ fontSize: '2rem' }}>Access Denied</h1>
      <p>You do not have permission to view this page.</p>
      <p>
        <Link to="/">← Go to your dashboard</Link>
      </p>
    </div>
  );
}

// ── 404 NOT FOUND PAGE ───────────────────────────────────────
function NotFoundPage() {
  return (
    <div className="error-page">
      <h1>404</h1>
      <p>Oops — this page does not exist.</p>
      <p>
        <Link to="/">← Back to safety</Link>
      </p>
    </div>
  );
}

// ── MAIN APP COMPONENT ───────────────────────────────────────
function App() {
  return (
    <Routes>
      {/*
        "/" — The root route.
        RoleRedirect reads the user's role and navigates them to
        the correct dashboard (e.g. /dashboard/admin for admins).
        ProtectedRoute ensures only authenticated users reach it.
      */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleRedirect />
          </ProtectedRoute>
        }
      />

      {/* ── Authentication Routes (redirect away if already logged in) ── */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />

      {/* ── Role-Protected Dashboard Routes ────────────────────── */}

      {/* Admin dashboard — only users with role "Admin" may enter */}
      <Route
        path="/dashboard/admin"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <DashboardAdmin />
          </ProtectedRoute>
        }
      />

      {/* Volunteer dashboard */}
      <Route
        path="/dashboard/volunteer"
        element={
          <ProtectedRoute allowedRoles={['Volunteer']}>
            <DashboardVolunteer />
          </ProtectedRoute>
        }
      />

      {/* NGO / Organization dashboard */}
      <Route
        path="/dashboard/ngo"
        element={
          <ProtectedRoute allowedRoles={['NGO']}>
            <DashboardNGO />
          </ProtectedRoute>
        }
      />

      {/* Citizen / Victim dashboard */}
      <Route
        path="/dashboard/citizen"
        element={
          <ProtectedRoute allowedRoles={['Citizen']}>
            <DashboardCitizen />
          </ProtectedRoute>
        }
      />

      {/* Donor dashboard */}
      <Route
        path="/dashboard/donor"
        element={
          <ProtectedRoute allowedRoles={['Donor']}>
            <DashboardDonor />
          </ProtectedRoute>
        }
      />

      {/* ── Error / Utility Routes ──────────────────────────────── */}

      {/* Unauthorized — shown when role check fails in ProtectedRoute */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* 404 — catch all unmatched paths */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
