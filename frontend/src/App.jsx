import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';

import { useAuth } from './context/AuthContext.jsx';

import { ProtectedRoute, RoleRedirect } from './components/ProtectedRoute.jsx';

import LoginPage        from './pages/LoginPage.jsx';
import RegisterPage     from './pages/RegisterPage.jsx';
import DashboardAdmin   from './pages/DashboardAdmin.jsx';
import DashboardVolunteer from './pages/DashboardVolunteer.jsx';
import DashboardNGO     from './pages/DashboardNGO.jsx';
import DashboardCitizen from './pages/DashboardCitizen.jsx';
import DashboardDonor   from './pages/DashboardDonor.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminUserManagement from './pages/AdminUserManagement.jsx';
import AdminAlertSender from './pages/AdminAlertSender.jsx';
import SheltersPage from './pages/SheltersPage.jsx';

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen"><p>Loading...</p></div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

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

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleRedirect />
          </ProtectedRoute>
        }
      />

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

      <Route
        path="/dashboard/admin"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <DashboardAdmin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/volunteer"
        element={
          <ProtectedRoute allowedRoles={['Volunteer']}>
            <DashboardVolunteer />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/ngo"
        element={
          <ProtectedRoute allowedRoles={['NGO']}>
            <DashboardNGO />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/citizen"
        element={
          <ProtectedRoute allowedRoles={['Citizen']}>
            <DashboardCitizen />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/donor"
        element={
          <ProtectedRoute allowedRoles={['Donor']}>
            <DashboardDonor />
          </ProtectedRoute>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminUserManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/alerts"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminAlertSender />
          </ProtectedRoute>
        }
      />

      <Route
        path="/shelters"
        element={
          <ProtectedRoute>
            <SheltersPage />
          </ProtectedRoute>
        }
      />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;

