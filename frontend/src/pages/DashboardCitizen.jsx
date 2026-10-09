// ============================================================
// src/pages/DashboardCitizen.jsx — Citizen / Victim Dashboard (Placeholder)
// ============================================================

import React from 'react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function DashboardCitizen() {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-content">
        {/* Welcome Card */}
        <div className="dashboard-card">
          <h1 style={{ fontSize: '1.6rem', color: '#1a237e', marginBottom: '0.5rem' }}>
            Hello, {user?.name}!
            <span className="role-badge Citizen">{user?.role}</span>
          </h1>
          <p style={{ color: '#555' }}>
            We are here to help. Use this platform to request assistance, find
            shelter, and receive real-time emergency alerts in your area.
          </p>
        </div>

        {/* Responsibilities / Features Card */}
        <div className="dashboard-card">
          <h2 style={{ fontSize: '1.1rem', color: '#333', marginBottom: '1rem' }}>
            🏠 What You Can Do Here
          </h2>
          <ul style={{ paddingLeft: '1.3rem', lineHeight: 2, color: '#444' }}>
            <li>Submit an SOS request if you need immediate assistance</li>
            <li>View nearby shelter locations and available capacity</li>
            <li>Receive real-time weather warnings and evacuation alerts</li>
            <li>Track the status of your submitted SOS requests</li>
            <li>Find contact information for local relief teams</li>
          </ul>
        </div>

        {/* Placeholder Notice */}
        <div
          className="dashboard-card"
          style={{ borderLeft: '4px solid #e65100', background: '#fff3e0' }}
        >
          <p style={{ color: '#e65100', fontWeight: '600', margin: 0 }}>
            📌 This dashboard is a placeholder — your team will build full features here.
            Add SOS submission forms, shelter maps, and alert feeds.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DashboardCitizen;
