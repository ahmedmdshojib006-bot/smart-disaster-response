import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import axiosInstance from '../api/axiosInstance.js';

function DashboardNGO() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchQuickStats = async () => {
      try {
        const res = await axiosInstance.get('/api/resources/stats');
        if (res.data?.stats) {
          setStats(res.data.stats);
        }
      } catch (e) {
        // Non-critical
      }
    };
    fetchQuickStats();
  }, []);

  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-content" style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div className="dashboard-card" style={{ marginBottom: '1.5rem', background: '#fff', borderRadius: '10px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
          <h1 style={{ fontSize: '1.6rem', color: '#1a237e', marginBottom: '0.5rem' }}>
            Welcome, {user?.name}!
            <span className="role-badge NGO" style={{ marginLeft: '0.5rem' }}>{user?.role}</span>
          </h1>
          <p style={{ color: '#555', margin: 0, lineHeight: 1.5 }}>
            As an NGO representative, you play a central coordination role — managing
            relief resources, tracking stockpiles, and delivering supplies to affected communities.
          </p>
        </div>

        {/* ── Module 2 Member-3 Resource Management Quick Action Card ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#fff',
            borderRadius: '12px',
            padding: '1.75rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                Module 2: Member-3 Implementation
              </span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.5rem 0 0.25rem 0' }}>
                📦 Relief Resource Inventory & Distribution
              </h2>
              <p style={{ opacity: 0.9, fontSize: '0.9rem', maxWidth: '650px', margin: 0 }}>
                Track stock levels of food, water, medicine, and blankets, log deliveries to shelters, and monitor low-stock warnings in real time.
              </p>
            </div>

            <Link
              to="/resources"
              style={{
                backgroundColor: '#ffffff',
                color: '#1e3a8a',
                padding: '0.7rem 1.4rem',
                borderRadius: '8px',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              Open Resource Tracker →
            </Link>
          </div>

          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <div>
                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>Available Stock</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{stats.totalAvailableStock?.toLocaleString()} units</div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>Distributed Supplies</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{stats.totalDistributedStock?.toLocaleString()} units</div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>Beneficiaries Served</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{stats.totalBeneficiariesReached?.toLocaleString()} citizens</div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>Low Stock Alerts</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: (stats.lowStockCount || 0) > 0 ? '#fef08a' : '#fff' }}>
                  {stats.lowStockCount || 0} items
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-card" style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.1rem', color: '#333', marginBottom: '1rem' }}>
            🏢 NGO / Organization Responsibilities
          </h2>
          <ul style={{ paddingLeft: '1.3rem', lineHeight: 2, color: '#444' }}>
            <li>
              <strong>Manage resource inventory:</strong> Log incoming donations of food, water, medicine, and blankets in the{' '}
              <Link to="/resources" style={{ color: '#2563eb', fontWeight: 600 }}>Resource Management console</Link>.
            </li>
            <li>
              <strong>Distribute relief items:</strong> Log relief deliveries to registered shelters and communities with transparent beneficiary counts.
            </li>
            <li>
              <strong>Coordinate with shelters:</strong> View capacity and facilities on the{' '}
              <Link to="/shelters" style={{ color: '#2563eb', fontWeight: 600 }}>Shelters page</Link>.
            </li>
            <li>Assign tasks to volunteers and track operational progress in real time.</li>
            <li>Avoid duplication of relief efforts through centralized inventory tracking.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default DashboardNGO;
