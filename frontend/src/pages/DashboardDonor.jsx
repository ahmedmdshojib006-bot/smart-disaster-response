import React from 'react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function DashboardDonor() {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-content">
        <div className="dashboard-card">
          <h1 style={{ fontSize: '1.6rem', color: '#1a237e', marginBottom: '0.5rem' }}>
            Welcome, {user?.name}!
            <span className="role-badge Donor">{user?.role}</span>
          </h1>
          <p style={{ color: '#555' }}>
            Your generosity makes a real difference. Explore active relief campaigns
            and see exactly how your donations are being used on the ground.
          </p>
        </div>

        <div className="dashboard-card">
          <h2 style={{ fontSize: '1.1rem', color: '#333', marginBottom: '1rem' }}>
            💰 What You Can Do Here
          </h2>
          <ul style={{ paddingLeft: '1.3rem', lineHeight: 2, color: '#444' }}>
            <li>Browse active disaster relief campaigns</li>
            <li>Make monetary donations to specific campaigns or general relief funds</li>
            <li>Track how your donations are allocated and spent</li>
            <li>View impact reports and progress updates from NGOs</li>
            <li>Download tax receipts and donation history</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default DashboardDonor;
