// ============================================================
// src/pages/DashboardNGO.jsx — NGO / Organization Dashboard (Placeholder)
// ============================================================

import React from 'react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function DashboardNGO() {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-content">
        {/* Welcome Card */}
        <div className="dashboard-card">
          <h1 style={{ fontSize: '1.6rem', color: '#1a237e', marginBottom: '0.5rem' }}>
            Welcome, {user?.name}!
            <span className="role-badge NGO">{user?.role}</span>
          </h1>
          <p style={{ color: '#555' }}>
            As an NGO representative, you play a central coordination role — managing
            resources and guiding volunteer teams on the ground.
          </p>
        </div>

        {/* Responsibilities Card */}
        <div className="dashboard-card">
          <h2 style={{ fontSize: '1.1rem', color: '#333', marginBottom: '1rem' }}>
            🏢 NGO / Organization Responsibilities
          </h2>
          <ul style={{ paddingLeft: '1.3rem', lineHeight: 2, color: '#444' }}>
            <li>Manage your organization&apos;s resource inventory (food, water, medicine)</li>
            <li>Assign tasks to volunteers and track their progress</li>
            <li>Coordinate with other NGOs to avoid duplication of effort</li>
            <li>Create and manage relief campaigns for donor contributions</li>
            <li>Communicate with affected citizens and distribute shelter information</li>
          </ul>
        </div>

        {/* Placeholder Notice */}
        <div
          className="dashboard-card"
          style={{ borderLeft: '4px solid #1565c0', background: '#e3f2fd' }}
        >
          <p style={{ color: '#1565c0', fontWeight: '600', margin: 0 }}>
            📌 This dashboard is a placeholder — your team will build full features here.
            Add resource tables, volunteer assignment panels, and campaign forms.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DashboardNGO;
