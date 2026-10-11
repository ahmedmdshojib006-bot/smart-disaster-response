// ============================================================
// src/pages/DashboardVolunteer.jsx — Volunteer Dashboard (Placeholder)
// ============================================================

import React from 'react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function DashboardVolunteer() {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-content">
        {/* Welcome Card */}
        <div className="dashboard-card">
          <h1 style={{ fontSize: '1.6rem', color: '#1a237e', marginBottom: '0.5rem' }}>
            Welcome, {user?.name}!
            <span className="role-badge Volunteer">{user?.role}</span>
          </h1>
          <p style={{ color: '#555' }}>
            Thank you for volunteering. Your efforts are vital in helping affected communities
            during disasters. Check your tasks below and stay ready.
          </p>
        </div>

        {/* Responsibilities Card */}
        <div className="dashboard-card">
          <h2 style={{ fontSize: '1.1rem', color: '#333', marginBottom: '1rem' }}>
            🙋 Volunteer Responsibilities
          </h2>
          <ul style={{ paddingLeft: '1.3rem', lineHeight: 2, color: '#444' }}>
            <li>View tasks assigned to you by NGOs or Admins</li>
            <li>Respond to SOS requests in your area</li>
            <li>Update task status as you complete each step</li>
            <li>Coordinate with NGO teams on resource delivery</li>
            <li>Report on-the-ground conditions back to the platform</li>
          </ul>
        </div>

        {/* Placeholder Notice */}
        <div
          className="dashboard-card"
          style={{ borderLeft: '4px solid #2e7d32', background: '#e8f5e9' }}
        >
          <p style={{ color: '#2e7d32', fontWeight: '600', margin: 0 }}>
            📌 This dashboard is a placeholder — your team will build full features here.
            Add a task list, map view, and SOS feed as your project grows.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DashboardVolunteer;
