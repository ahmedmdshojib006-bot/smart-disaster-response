import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';

export default function ProfilePage() {
  const { user, login, token } = useAuth();
  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    address: '',
    bio: '',
    serviceArea: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
        bio: user.bio || '',
        serviceArea: user.serviceArea || '',
      });
    }
  }, [user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });

    if (!profileData.name || profileData.name.trim().length < 2) {
      return setProfileMsg({ type: 'error', text: 'Name must be at least 2 characters.' });
    }

    setProfileLoading(true);
    try {
      const res = await axiosInstance.put('/api/profile', profileData);
      login(res.data.user, token);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Update failed.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (passwordData.newPassword.length < 8) {
      return setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
    }

    setPasswordLoading(true);
    try {
      await axiosInstance.put('/api/profile/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.message || 'Password change failed.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const alertStyle = (type) => ({
    background: type === 'success' ? '#e8f5e9' : '#ffebee',
    border: `1px solid ${type === 'success' ? '#c8e6c9' : '#ffcdd2'}`,
    borderRadius: 8,
    padding: '0.75rem 1rem',
    color: type === 'success' ? '#2e7d32' : '#c62828',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  });

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    border: '2px solid #e0e0e0',
    borderRadius: 8,
    fontSize: '0.95rem',
    boxSizing: 'border-box',
    marginTop: 4,
  };

  const labelStyle = {
    display: 'block',
    fontWeight: 600,
    color: '#333',
    fontSize: '0.9rem',
    marginBottom: 4,
  };

  return (
    <div className="dashboard-page">
      <Navbar />
      <div className="dashboard-content">
        <h2 style={{ marginBottom: '1.5rem', color: '#1a237e' }}>👤 My Profile</h2>

        <div className="dashboard-card">
          <h3 style={{ marginBottom: '1.2rem', color: '#333' }}>Personal Information</h3>
          {profileMsg.text && <div style={alertStyle(profileMsg.type)}>{profileMsg.text}</div>}
          <form onSubmit={handleProfileSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={profileData.phone}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 01700000000"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Address / Region</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={profileData.address}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Your address"
                />
              </div>
              <div>
                <label style={labelStyle}>Service Area (for Volunteers / Responders)</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={profileData.serviceArea}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, serviceArea: e.target.value }))}
                  placeholder="e.g. Sylhet Sadar"
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Bio / Notes</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                value={profileData.bio}
                onChange={(e) => setProfileData((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder="Short description about yourself (max 500 characters)"
                maxLength={500}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={profileLoading}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#1a237e',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: profileLoading ? 0.7 : 1,
                }}
              >
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <span style={{ color: '#666', fontSize: '0.9rem' }}>
                Account Role: <strong style={{ color: '#1a237e' }}>{user?.role}</strong>
              </span>
            </div>
          </form>
        </div>

        <div className="dashboard-card">
          <h3 style={{ marginBottom: '1.2rem', color: '#333' }}>Change Password</h3>
          {passwordMsg.text && <div style={alertStyle(passwordMsg.type)}>{passwordMsg.text}</div>}
          <form onSubmit={handlePasswordSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={labelStyle}>Current Password</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Current password"
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>New Password</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Min 8 characters"
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Confirm New Password</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Repeat new password"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={passwordLoading}
              style={{
                padding: '0.75rem 2rem',
                background: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: passwordLoading ? 0.7 : 1,
              }}
            >
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
