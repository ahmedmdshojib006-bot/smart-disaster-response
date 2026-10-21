import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}

export function RoleRedirect() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const roleDashboards = {
    Admin:     '/dashboard/admin',
    Volunteer: '/dashboard/volunteer',
    NGO:       '/dashboard/ngo',
    Citizen:   '/dashboard/citizen',
    Donor:     '/dashboard/donor',
  };

  const destination = roleDashboards[user.role] || '/unauthorized';

  return <Navigate to={destination} replace />;
}

export default ProtectedRoute;
