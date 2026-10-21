import React, { useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance.js';
import { useSocket } from '../context/SocketContext.jsx';

export default function SOSRequestList({ refreshTrigger }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePhotoModal, setActivePhotoModal] = useState(null);

  const { socket } = useSocket();
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchMySOS = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axiosInstance.get('/api/sos/my');
      if (response.data.success) {
        setRequests(response.data.data);
      }
    } catch {
      setError('Could not load your emergency requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySOS();
  }, [refreshTrigger]);

  useEffect(() => {
    if (!socket) return;

    const handleSOSUpdate = (updatedSos) => {
      setRequests((prev) =>
        prev.map((item) => (item._id === updatedSos._id ? { ...item, ...updatedSos } : item))
      );
    };

    socket.on('sos:updated', handleSOSUpdate);
    return () => {
      socket.off('sos:updated', handleSOSUpdate);
    };
  }, [socket]);

  const handleCancel = async (id) => {
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel this emergency request? (Only cancel if you are in a safe location)'
    );
    if (!confirmCancel) return;

    try {
      const response = await axiosInstance.patch(`/api/sos/${id}/cancel`, {
        reason: 'Cancelled by citizen from dashboard',
      });
      if (response.data.success) {
        setRequests((prev) =>
          prev.map((item) => (item._id === id ? { ...item, status: 'Cancelled' } : item))
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel emergency request.');
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'Pending':
        return {
          label: '⏳ PENDING VERIFICATION',
          desc: 'Your emergency signal has been broadcast. Coordinators and volunteers are verifying and allocating teams.',
          bg: '#fffbeb',
          border: '#fde68a',
          color: '#b45309',
          badgeBg: '#fef3c7',
          step: 1,
        };
      case 'Assigned':
        return {
          label: '🤝 VOLUNTEER ASSIGNED',
          desc: 'A volunteer/relief unit has been assigned to your request and is preparing deployment.',
          bg: '#eff6ff',
          border: '#bfdbfe',
          color: '#1d4ed8',
          badgeBg: '#dbeafe',
          step: 2,
        };
      case 'In Progress':
        return {
          label: '🚒 RESCUE IN PROGRESS',
          desc: 'Responders are actively operating or en route to your GPS coordinates.',
          bg: '#faf5ff',
          border: '#e9d5ff',
          color: '#7e22ce',
          badgeBg: '#f3e8ff',
          step: 3,
        };
      case 'Completed':
        return {
          label: '✅ OPERATION COMPLETED (SUCCESSFUL)',
          desc: 'Help was successfully delivered or rescue operation concluded safely.',
          bg: '#f0fdf4',
          border: '#bbf7d0',
          color: '#15803d',
          badgeBg: '#dcfce7',
          step: 4,
        };
      case 'Cancelled':
        return {
          label: '❌ CANCELLED',
          desc: 'This request was cancelled.',
          bg: '#f8fafc',
          border: '#cbd5e1',
          color: '#64748b',
          badgeBg: '#e2e8f0',
          step: 0,
        };
      default:
        return {
          label: status,
          desc: '',
          bg: '#f8fafc',
          border: '#e2e8f0',
          color: '#334155',
          badgeBg: '#f1f5f9',
          step: 1,
        };
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
        Loading your emergency requests...
      </div>
    );
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', color: '#1a237e', margin: 0 }}>
            📋 Emergency Request Tracker ({requests.length})
          </h2>
          <p style={{ color: '#666', fontSize: '0.88rem', margin: '0.2rem 0 0 0' }}>
            Live status of your submitted distress signals
          </p>
        </div>
        <button
          type="button"
          onClick={fetchMySOS}
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '0.45rem 0.9rem',
            fontSize: '0.85rem',
            cursor: 'pointer',
            color: '#334155',
            fontWeight: 600,
          }}
        >
          🔄 Refresh Status
        </button>
      </div>

      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div
          style={{
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '10px',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛡️</div>
          <p style={{ fontWeight: '700', fontSize: '1.05rem', color: '#334155', margin: '0 0 0.3rem 0' }}>
            No Active Emergency Requests
          </p>
          <p style={{ fontSize: '0.88rem', margin: 0 }}>
            If you need rescue, water, food, or medicines, submit the SOS form above. Your request status will appear here in real time.
          </p>
        </div>
      ) : (
        requests.map((sos) => {
          const cfg = getStatusConfig(sos.status);
          const lat = sos.location?.latitude;
          const lng = sos.location?.longitude;
          const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
          const photoSrc = sos.photoUrl ? `${apiBase}${sos.photoUrl}` : null;
          const canCancel = sos.status === 'Pending' || sos.status === 'Assigned';

          return (
            <div
              key={sos._id}
              style={{
                border: `2px solid ${cfg.border}`,
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                background: '#ffffff',
                boxShadow: '0 3px 12px rgba(0,0,0,0.06)',
              }}
            >
              <div
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  borderRadius: '8px',
                  padding: '0.9rem 1.2rem',
                  marginBottom: '1.2rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.8rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: cfg.badgeBg,
                        color: cfg.color,
                        padding: '0.35rem 0.85rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        border: `1px solid ${cfg.color}30`,
                      }}
                    >
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      Submitted: {new Date(sos.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.86rem', color: cfg.color, marginTop: '0.4rem', fontWeight: 500 }}>
                    {cfg.desc}
                  </div>
                </div>

                {canCancel && (
                  <button
                    type="button"
                    onClick={() => handleCancel(sos._id)}
                    style={{
                      background: '#ffffff',
                      color: '#c62828',
                      border: '1px solid #fca5a5',
                      padding: '0.45rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel SOS
                  </button>
                )}
              </div>

              {sos.status !== 'Cancelled' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    margin: '1rem 0 1.5rem 0',
                    padding: '0.8rem 1rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  {[
                    { step: 1, label: 'Submitted & Pending' },
                    { step: 2, label: 'Team Assigned' },
                    { step: 3, label: 'Rescue In Progress' },
                    { step: 4, label: 'Successfully Completed' },
                  ].map((s, idx) => {
                    const isDone = cfg.step >= s.step;
                    const isCurrent = cfg.step === s.step;
                    return (
                      <div
                        key={s.step}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          color: isCurrent ? '#1a237e' : isDone ? '#16a34a' : '#94a3b8',
                          fontWeight: isCurrent || isDone ? 700 : 500,
                        }}
                      >
                        <span>{isDone ? '✓' : '○'}</span>
                        <span>{s.label}</span>
                        {idx < 3 && <span style={{ color: '#cbd5e1', margin: '0 0.3rem' }}>➔</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.88rem', color: '#334155', marginRight: '0.5rem' }}>
                  Requested Needs:
                </strong>
                {sos.needs?.map((need) => (
                  <span
                    key={need}
                    style={{
                      display: 'inline-block',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      marginRight: '0.4rem',
                      marginBottom: '0.4rem',
                      textTransform: 'capitalize',
                    }}
                  >
                    {need === 'rescue' && '🛟 '}
                    {need === 'food' && '🍞 '}
                    {need === 'water' && '💧 '}
                    {need === 'medicine' && '💊 '}
                    {need}
                  </span>
                ))}
              </div>

              {sos.description && (
                <div
                  style={{
                    background: '#f8fafc',
                    borderLeft: '4px solid #1a237e',
                    padding: '0.75rem 1rem',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    color: '#334155',
                    marginBottom: '1rem',
                  }}
                >
                  "{sos.description}"
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.8rem',
                  fontSize: '0.88rem',
                  color: '#475569',
                  background: '#f8fafc',
                  padding: '1rem',
                  borderRadius: '8px',
                }}
              >
                <div>
                  👥 <strong>People in need:</strong> {sos.numberOfPeople} Person(s)
                </div>
                <div>
                  📍 <strong>GPS Coordinates:</strong>{' '}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1a237e', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    {lat?.toFixed(5)}, {lng?.toFixed(5)} ↗
                  </a>
                </div>
                {sos.location?.address && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    🏢 <strong>Landmark / Address:</strong> {sos.location.address}
                  </div>
                )}
                {sos.assignedVolunteer && (
                  <div>
                    🤝 <strong>Assigned Team:</strong> {sos.assignedVolunteer.name} ({sos.assignedVolunteer.email})
                  </div>
                )}
              </div>

              {photoSrc && (
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Attached Photo:
                  </span>
                  <img
                    src={photoSrc}
                    alt="SOS Evidence"
                    onClick={() => setActivePhotoModal(photoSrc)}
                    style={{
                      width: '120px',
                      height: '85px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
                    Click image to expand
                  </span>
                </div>
              )}
            </div>
          );
        })
      )}

      {activePhotoModal && (
        <div
          onClick={() => setActivePhotoModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            <img
              src={activePhotoModal}
              alt="Enlarged SOS scene"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px' }}
            />
            <button
              onClick={() => setActivePhotoModal(null)}
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                background: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
