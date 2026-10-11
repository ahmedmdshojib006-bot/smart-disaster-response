// ============================================================
// src/pages/DashboardAdmin.jsx — Admin Dashboard (Placeholder)
//
// This is a placeholder page. Your team will build full admin
// features (user management, SOS review, alert broadcasting)
// as separate components that you import into this layout.
// ============================================================

import React from 'react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function DashboardAdmin() {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      {/* Top navigation bar */}
      <Navbar />

      <div className="dashboard-content">
        {/* Welcome Card */}
        <div className="dashboard-card">
          <h1 style={{ fontSize: '1.6rem', color: '#1a237e', marginBottom: '0.5rem' }}>
            Welcome back, {user?.name}!
            <span className="role-badge Admin">{user?.role}</span>
          </h1>
          <p style={{ color: '#555' }}>
            You are logged in as a platform Administrator. From this dashboard you have
            full oversight of the disaster response system.
          </p>
        </div>

        {/* Responsibilities Card */}
        <div className="dashboard-card">
          <h2 style={{ fontSize: '1.1rem', color: '#333', marginBottom: '1rem' }}>
            🛠️ Admin Responsibilities
          </h2>
          <ul style={{ paddingLeft: '1.3rem', lineHeight: 2, color: '#444' }}>
            <li>Manage user accounts — approve, deactivate, or change roles</li>
            <li>Review and respond to all incoming SOS requests</li>
            <li>Broadcast weather warnings and evacuation alerts to affected users</li>
            <li>Monitor volunteer task assignments and completion status</li>
            <li>View platform-wide statistics and disaster event logs</li>
            <li>Configure shelter locations and resource inventories</li>
          </ul>
        </div>

        {/* Placeholder Notice */}
        <div
          className="dashboard-card"
          style={{
            borderLeft: '4px solid #1565c0',
            background: '#e3f2fd',
          }}
        >
          <p style={{ color: '#1565c0', fontWeight: '600', margin: 0 }}>
            📌 This dashboard is a placeholder — your team will build full features here.
            Add sections for user tables, SOS lists, and alert forms as your project grows.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DashboardAdmin;
