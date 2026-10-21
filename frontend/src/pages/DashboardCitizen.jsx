import React, { useState, useRef } from 'react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import SOSRequestForm from '../components/SOSRequestForm.jsx';
import SOSRequestList from '../components/SOSRequestList.jsx';
import '../styles/sos.css';

function DashboardCitizen() {
  const { user } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const formRef = useRef(null);
  const listRef = useRef(null);

  const handleSOSSubmitted = () => {
    setRefreshTrigger((prev) => prev + 1);
    if (listRef.current) {
      setTimeout(() => {
        listRef.current.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  };

  const scrollToForm = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-content">
        <div className="sos-emergency-banner">
          <div className="sos-emergency-banner-text">
            <h2>🚨 IN IMMEDIATE DANGER? DISPATCH AN SOS ALERT</h2>
            <p>
              If you are trapped, need rescue, food, clean water, or urgent medicine,
              submit your GPS location below. Teams are standing by 24/7.
            </p>
          </div>
          <button
            type="button"
            className="sos-emergency-btn-trigger"
            onClick={scrollToForm}
          >
            <span>🆘</span> Request Help Now
          </button>
        </div>

        <div className="dashboard-card">
          <h1 style={{ fontSize: '1.6rem', color: '#1a237e', marginBottom: '0.5rem' }}>
            Welcome, {user?.name}!
            <span className="role-badge Citizen">{user?.role}</span>
          </h1>
          <p style={{ color: '#555' }}>
            You are connected to the Smart Disaster Response Network. Use this dashboard to
            send instant distress signals with your real-time location and track ongoing relief operations.
          </p>
        </div>

        <div ref={formRef}>
          <SOSRequestForm onSOSSubmitted={handleSOSSubmitted} />
        </div>

        <div ref={listRef} className="dashboard-card">
          <SOSRequestList refreshTrigger={refreshTrigger} />
        </div>

        <div className="dashboard-card hotlines-card">
          <h3 style={{ fontSize: '1.15rem', color: '#1e293b', marginBottom: '0.5rem' }}>
            📞 National Emergency Hotlines (Bangladesh)
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
            If you have direct phone connectivity, you can also dial these toll-free disaster and emergency hotlines:
          </p>
          <div className="hotlines-grid">
            <div className="hotline-item">
              <span style={{ fontSize: '0.85rem', color: '#475569' }}>National Emergency</span>
              <div className="hotline-number">999</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Police / Fire / Ambulance</span>
            </div>
            <div className="hotline-item">
              <span style={{ fontSize: '0.85rem', color: '#475569' }}>Disaster Information</span>
              <div className="hotline-number">1090</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Flood & Cyclone Early Warning</span>
            </div>
            <div className="hotline-item">
              <span style={{ fontSize: '0.85rem', color: '#475569' }}>Red Crescent Relief</span>
              <div className="hotline-number">16167</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Disaster Relief Helpline</span>
            </div>
            <div className="hotline-item">
              <span style={{ fontSize: '0.85rem', color: '#475569' }}>Govt. Help Desk</span>
              <div className="hotline-number">333</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Citizen Services & Relief</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardCitizen;
