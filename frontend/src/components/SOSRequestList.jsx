// ============================================================
// src/components/SOSRequestList.jsx — SOS Requests List & Tracking
// Displays victim's submitted SOS requests with live status updates.
// ============================================================

import React, { useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance.js';
import { useSocket } from '../context/SocketContext.jsx';

function SOSRequestList({ refreshTrigger }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePhotoModal, setActivePhotoModal] = useState(null);

  const socket = useSocket();
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchMySOS = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axiosInstance.get('/api/sos/my');
      if (response.data.success) {
        setRequests(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching my SOS list:', err);
      setError('Could not load your emergency requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySOS();
  }, [refreshTrigger]);

  // Real-time status update listener via Socket.IO
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

  if (loading && requests.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
        Loading your emergency requests...
      </div>
    );
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#1a237e' }}>
          📋 Your Emergency Requests ({requests.length})
        </h2>
        <button
          type="button"
          onClick={fetchMySOS}
          style={{
            background: 'none',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem',
            cursor: 'pointer',
            color: '#475569',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '0.8rem', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div
          style={{
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '10px',
            padding: '2rem',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛡️</div>
          <p style={{ fontWeight: '600' }}>No active emergency requests.</p>
          <p style={{ fontSize: '0.88rem' }}>
            If you or people near you need urgent food, water, medicine, or rescue, use the form
            above to dispatch an SOS alert.
          </p>
        </div>
      ) : (
        requests.map((sos) => {
          const lat = sos.location?.latitude;
          const lng = sos.location?.longitude;
          const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
          const photoSrc = sos.photoUrl ? `${apiBase}${sos.photoUrl}` : null;
          const canCancel = sos.status === 'Pending' || sos.status === 'Assigned';

          return (
            <div key={sos._id} className="sos-card">
              <div className="sos-card-header">
                <div>
                  <span style={{ fontWeight: '700', fontSize: '1.05rem', color: '#1e293b' }}>
                    SOS #{sos._id.slice(-6).toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: '0.8rem' }}>
                    {new Date(sos.createdAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`sos-status-pill ${sos.status.replace(/\s+/g, '')}`}>
                    {sos.status}
                  </span>
                  {canCancel && (
                    <button
                      type="button"
                      className="sos-cancel-btn"
                      onClick={() => handleCancel(sos._id)}
                    >
                      Cancel SOS
                    </button>
                  )}
                </div>
              </div>

              {/* Needs Tags */}
              <div style={{ marginBottom: '0.8rem' }}>
                <strong style={{ fontSize: '0.88rem', color: '#333', marginRight: '0.5rem' }}>
                  Needs:
                </strong>
                {sos.needs?.map((need) => (
                  <span key={need} className="sos-need-tag">
                    {need === 'rescue' && '🛟 '}
                    {need === 'food' && '🍞 '}
                    {need === 'water' && '💧 '}
                    {need === 'medicine' && '💊 '}
                    {need}
                  </span>
                ))}
              </div>

              {/* Description if present */}
              {sos.description && (
                <div
                  style={{
                    background: '#f8fafc',
                    borderLeft: '3px solid #1a237e',
                    padding: '0.6rem 0.9rem',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    color: '#334155',
                    marginBottom: '0.8rem',
                  }}
                >
                  "{sos.description}"
                </div>
              )}

              {/* Meta details */}
              <div className="sos-meta-grid">
                <div>
                  👥 <strong>People in need:</strong> {sos.numberOfPeople}
                </div>
                <div>
                  📍 <strong>GPS:</strong>{' '}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1a237e', textDecoration: 'underline' }}
                  >
                    {lat?.toFixed(5)}, {lng?.toFixed(5)} ↗
                  </a>
                </div>
                {sos.location?.address && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    🏢 <strong>Landmark:</strong> {sos.location.address}
                  </div>
                )}
                {sos.assignedVolunteer && (
                  <div>
                    🤝 <strong>Assigned Team:</strong> {sos.assignedVolunteer.name}
                  </div>
                )}
              </div>

              {/* Optional Photo Thumbnail */}
              {photoSrc && (
                <div style={{ marginTop: '1rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#555', display: 'block', marginBottom: '0.3rem' }}>
                    Attached Photo:
                  </strong>
                  <img
                    src={photoSrc}
                    alt="SOS Attachment"
                    onClick={() => setActivePhotoModal(photoSrc)}
                    style={{
                      width: '100px',
                      height: '75px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                    (Click to view full photo)
                  </span>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Lightbox Modal */}
      {activePhotoModal && (
        <div
          onClick={() => setActivePhotoModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
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
              alt="SOS Enlarge"
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

export default SOSRequestList;
