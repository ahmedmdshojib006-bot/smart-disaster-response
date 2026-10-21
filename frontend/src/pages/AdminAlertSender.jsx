import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosInstance from '../api/axiosInstance';

const ALERT_TYPES = [
  { value: 'weather', label: '🌦️ Weather Warning', color: '#f57f17' },
  { value: 'evacuation', label: '🚨 Evacuation Notice', color: '#b71c1c' },
  { value: 'general', label: '📢 General Alert', color: '#1565c0' },
];

const TARGET_ROLES = ['', 'Volunteer', 'NGO', 'Citizen', 'Donor', 'Admin'];

export default function AdminAlertSender() {
  const [form, setForm] = useState({
    type: 'weather',
    title: '',
    message: '',
    targetRole: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({ type: '', text: '' });
  const [sentAlerts, setSentAlerts] = useState([]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult({ type: '', text: '' });

    if (!form.title.trim()) {
      return setResult({ type: 'error', text: 'Alert title is required.' });
    }
    if (!form.message.trim()) {
      return setResult({ type: 'error', text: 'Alert message is required.' });
    }

    setLoading(true);
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        message: form.message.trim(),
      };
      if (form.targetRole) {
        payload.targetRole = form.targetRole;
      }

      const res = await axiosInstance.post('/api/admin/alerts', payload);
      setResult({
        type: 'success',
        text: `Alert broadcasted successfully to ${form.targetRole ? form.targetRole + 's' : 'all connected users'}!`,
      });
      setSentAlerts((prev) => [
        {
          ...res.data.notification,
          sentAt: new Date(),
          targetLabel: form.targetRole ? `${form.targetRole}s Only` : 'All Users (Broadcast)',
        },
        ...prev,
      ].slice(0, 10));

      setForm((prev) => ({
        ...prev,
        title: '',
        message: '',
      }));
    } catch (err) {
      setResult({
        type: 'error',
        text: err.response?.data?.message || 'Failed to send alert.',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedType = ALERT_TYPES.find((t) => t.value === form.type);

  const alertStyle = (type) => ({
    background: type === 'success' ? '#e8f5e9' : '#ffebee',
    border: `1px solid ${type === 'success' ? '#c8e6c9' : '#ffcdd2'}`,
    borderRadius: 8,
    padding: '0.75rem 1rem',
    color: type === 'success' ? '#2e7d32' : '#c62828',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  });

  return (
    <div className="dashboard-page">
      <Navbar />
      <div className="dashboard-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <h2 style={{ color: '#1a237e', margin: 0 }}>📡 Real-Time Alert Broadcast</h2>
            <p style={{ color: '#666', fontSize: '0.88rem', margin: '0.2rem 0 0 0' }}>
              Push emergency weather warnings, evacuation orders, and alerts over Socket.IO
            </p>
          </div>
          <Link to="/dashboard/admin" style={{ color: '#1a237e', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>

        <div className="dashboard-card">
          <h3 style={{ marginBottom: '1.2rem', color: '#1e293b' }}>Broadcast Dispatch Form</h3>
          {result.text && <div style={alertStyle(result.type)}>{result.text}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 700, color: '#334155', marginBottom: '0.6rem', fontSize: '0.92rem' }}>
                Select Alert Classification
              </label>
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                {ALERT_TYPES.map((t) => (
                  <label
                    key={t.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 1.2rem',
                      border: `2px solid ${form.type === t.value ? t.color : '#cbd5e1'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: form.type === t.value ? `${t.color}15` : 'white',
                      fontWeight: form.type === t.value ? 700 : 500,
                      color: form.type === t.value ? t.color : '#475569',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="radio"
                      name="alertType"
                      value={t.value}
                      checked={form.type === t.value}
                      onChange={handleChange('type')}
                      style={{ display: 'none' }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#334155', fontSize: '0.9rem', marginBottom: 4 }}>
                  Headline / Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={handleChange('title')}
                  placeholder={
                    form.type === 'weather'
                      ? 'Severe Cyclone Warning — Coastal Belt'
                      : form.type === 'evacuation'
                      ? 'Immediate Evacuation Notice — Lowland Sector 4'
                      : 'Urgent Relief Coordination Update'
                  }
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e0e0e0',
                    borderRadius: 8,
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#334155', fontSize: '0.9rem', marginBottom: 4 }}>
                  Target Audience
                </label>
                <select
                  value={form.targetRole}
                  onChange={handleChange('targetRole')}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e0e0e0',
                    borderRadius: 8,
                    fontSize: '0.95rem',
                    background: 'white',
                  }}
                >
                  <option value="">📣 Broadcast to All Users</option>
                  {TARGET_ROLES.filter((r) => r).map((r) => (
                    <option key={r} value={r}>
                      {r}s Only
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontWeight: 600, color: '#334155', fontSize: '0.9rem', marginBottom: 4 }}>
                Detailed Alert Message / Instructions *
              </label>
              <textarea
                value={form.message}
                onChange={handleChange('message')}
                placeholder="Specify emergency instructions, safety measures, shelter guidance, or priority tasks..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: 8,
                  fontSize: '0.95rem',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
                required
              />
            </div>

            <div
              style={{
                background: `${selectedType?.color}12`,
                border: `1px solid ${selectedType?.color}40`,
                borderRadius: 8,
                padding: '0.85rem 1.2rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ fontSize: '0.86rem', color: '#334155' }}>
                ⚡ <strong>Transmission Preview:</strong> This notification will immediately appear in the{' '}
                <strong style={{ color: selectedType?.color }}>Notification Bell</strong> of{' '}
                <strong>{form.targetRole ? `${form.targetRole}s` : 'all active users'}</strong> with real-time audio/visual alert.
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.85rem 2.2rem',
                background: selectedType?.color || '#1a237e',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              {loading ? 'Transmitting...' : `📡 Broadcast ${selectedType?.label}`}
            </button>
          </form>
        </div>

        {sentAlerts.length > 0 && (
          <div className="dashboard-card">
            <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Recently Dispatched Alerts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {sentAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.85rem 1rem',
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{alert.title}</div>
                    <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: 2 }}>{alert.message}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                      Target: <strong>{alert.targetLabel}</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {new Date(alert.sentAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
