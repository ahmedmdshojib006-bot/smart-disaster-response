import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import axiosInstance from '../api/axiosInstance.js';

function timeAgo(dateInput) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

const typeColors = {
  sos: { bg: '#ffebee', text: '#c62828', label: 'SOS' },
  weather: { bg: '#fff9c4', text: '#f57f17', label: 'Weather' },
  evacuation: { bg: '#fff3e0', text: '#e65100', label: 'Evacuation' },
  general: { bg: '#e3f2fd', text: '#1565c0', label: 'General' },
};

function getTypeStyle(type) {
  return typeColors[type?.toLowerCase()] || typeColors.general;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [activeModal, setActiveModal] = useState(null);
  const [sosDetails, setSosDetails] = useState(null);
  const [loadingSOS, setLoadingSOS] = useState(false);
  const [sosStatusUpdate, setSosStatusUpdate] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const wrapperRef = useRef(null);
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/notifications');
      const data = res.data.notifications || res.data || [];
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.isRead).length);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => setIsOpen((prev) => !prev);

  const handleMarkRead = async (id) => {
    try {
      await axiosInstance.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id || n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await axiosInstance.patch('/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleNotificationClick = async (notif) => {
    const id = notif._id || notif.id;
    if (!notif.isRead) {
      handleMarkRead(id);
    }
    setIsOpen(false);
    setStatusMsg('');
    setActiveModal(notif);

    if (notif.type === 'sos' || notif.relatedId) {
      setLoadingSOS(true);
      setSosDetails(null);
      try {
        let sosId = notif.relatedId;
        if (!sosId) {
          const match = notif.message?.match(/#([a-zA-Z0-9]+)/);
          if (match && match[1]) {
            const allRes = await axiosInstance.get('/api/sos');
            const found = allRes.data?.data?.find(s => s._id.endsWith(match[1]));
            if (found) sosId = found._id;
          }
        }
        if (sosId) {
          const res = await axiosInstance.get(`/api/sos/${sosId}`);
          if (res.data?.data) {
            setSosDetails(res.data.data);
            setSosStatusUpdate(res.data.data.status);
          }
        }
      } catch {
      } finally {
        setLoadingSOS(false);
      }
    }
  };

  const handleUpdateSOSStatus = async () => {
    if (!sosDetails || !sosStatusUpdate) return;
    setUpdatingStatus(true);
    setStatusMsg('');
    try {
      const res = await axiosInstance.patch(`/api/sos/${sosDetails._id}/status`, {
        status: sosStatusUpdate,
      });
      if (res.data?.success) {
        setSosDetails(res.data.data);
        setStatusMsg(`Status updated to "${sosStatusUpdate}"`);
      }
    } catch (err) {
      setStatusMsg(err.response?.data?.message || 'Status update failed.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.35rem',
          position: 'relative',
          padding: '4px',
          lineHeight: 1,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
        }}
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#f44336',
              color: '#fff',
              borderRadius: '50%',
              fontSize: '0.65rem',
              fontWeight: '700',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '360px',
            maxHeight: '440px',
            overflowY: 'auto',
            background: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
            zIndex: 2000,
            border: '1px solid #e0e0e0',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.8rem 1rem',
              borderBottom: '1px solid #f0f0f0',
              fontWeight: '700',
              fontSize: '0.95rem',
              color: '#1a237e',
              position: 'sticky',
              top: 0,
              background: '#fff',
              zIndex: 1,
            }}
          >
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1565c0',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                }}
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>Loading...</p>
          ) : notifications.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>No notifications yet</p>
          ) : (
            notifications.map((notif) => {
              const typeStyle = getTypeStyle(notif.type);
              const id = notif._id || notif.id;
              return (
                <div
                  key={id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #f5f5f5',
                    cursor: 'pointer',
                    background: notif.isRead ? '#fff' : '#f0f4ff',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: notif.isRead ? '600' : '700',
                      color: notif.isRead ? '#333' : '#000',
                      marginBottom: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{notif.title || 'Notification'}</span>
                    {!notif.isRead && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: '#555',
                      marginBottom: '4px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {notif.message || notif.body || ''}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        background: typeStyle.bg,
                        color: typeStyle.text,
                      }}
                    >
                      {typeStyle.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                      {notif.createdAt ? timeAgo(notif.createdAt) : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeModal && (
        <div
          onClick={() => setActiveModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 12,
              padding: '1.8rem',
              maxWidth: 580,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setActiveModal(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: '1rem',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 12,
                  background: getTypeStyle(activeModal.type).bg,
                  color: getTypeStyle(activeModal.type).text,
                  textTransform: 'uppercase',
                }}
              >
                {getTypeStyle(activeModal.type).label}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {activeModal.createdAt ? new Date(activeModal.createdAt).toLocaleString() : ''}
              </span>
            </div>

            <h3 style={{ color: '#1e293b', fontSize: '1.3rem', margin: '0 0 0.8rem 0' }}>
              {activeModal.title}
            </h3>

            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6, background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0', margin: '0 0 1.2rem 0' }}>
              {activeModal.message}
            </p>

            {loadingSOS && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                Loading live SOS emergency details...
              </div>
            )}

            {sosDetails && (
              <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '1.2rem', marginTop: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>
                    🚨 Emergency Incident Details
                  </h4>
                  <span
                    style={{
                      background:
                        sosDetails.status === 'Completed'
                          ? '#e8f5e9'
                          : sosDetails.status === 'In Progress'
                          ? '#f3e5f5'
                          : sosDetails.status === 'Assigned'
                          ? '#e3f2fd'
                          : '#fff8e1',
                      color:
                        sosDetails.status === 'Completed'
                          ? '#2e7d32'
                          : sosDetails.status === 'In Progress'
                          ? '#7b1fa2'
                          : sosDetails.status === 'Assigned'
                          ? '#1565c0'
                          : '#f57f17',
                      padding: '0.3rem 0.8rem',
                      borderRadius: 16,
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      border: '1px solid currentColor',
                    }}
                  >
                    ● Status: {sosDetails.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Reported by:</span>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>
                      {sosDetails.victim?.name || 'Citizen in distress'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>People in group:</span>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>
                      👥 {sosDetails.numberOfPeople} Person(s)
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Urgent Needs:</span>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: 4 }}>
                    {sosDetails.needs?.map((need) => (
                      <span
                        key={need}
                        style={{
                          background: '#fee2e2',
                          color: '#b91c1c',
                          padding: '0.2rem 0.6rem',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          fontWeight: 700,
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
                </div>

                <div style={{ background: '#f1f5f9', padding: '0.8rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.88rem' }}>
                  <div style={{ color: '#475569', marginBottom: 4 }}>
                    📍 <strong>Coordinates:</strong> {sosDetails.location?.latitude?.toFixed(5)}, {sosDetails.location?.longitude?.toFixed(5)}
                  </div>
                  {sosDetails.location?.address && (
                    <div style={{ color: '#475569', marginBottom: 6 }}>
                      🏢 <strong>Landmark:</strong> {sosDetails.location.address}
                    </div>
                  )}
                  <a
                    href={`https://www.google.com/maps?q=${sosDetails.location?.latitude},${sosDetails.location?.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: 4,
                      background: '#1a237e',
                      color: 'white',
                      padding: '0.4rem 0.9rem',
                      borderRadius: 6,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    🗺️ Open Live GPS in Google Maps ↗
                  </a>
                </div>

                {sosDetails.photoUrl && (
                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>Incident Photo:</span>
                    <img
                      src={`${apiBase}${sosDetails.photoUrl}`}
                      alt="SOS scene"
                      style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                )}

                {['Admin', 'Volunteer', 'NGO'].includes(user?.role) && (
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '1rem', borderRadius: 8, marginTop: '1rem' }}>
                    <label style={{ display: 'block', fontWeight: 600, color: '#1e293b', fontSize: '0.88rem', marginBottom: 6 }}>
                      Update Emergency Status:
                    </label>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        value={sosStatusUpdate}
                        onChange={(e) => setSosStatusUpdate(e.target.value)}
                        style={{ padding: '0.5rem 0.8rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.9rem', background: 'white' }}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Assigned">Assigned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleUpdateSOSStatus}
                        disabled={updatingStatus}
                        style={{
                          background: '#1a237e',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          opacity: updatingStatus ? 0.7 : 1,
                        }}
                      >
                        {updatingStatus ? 'Updating...' : 'Update Status'}
                      </button>
                    </div>
                    {statusMsg && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: statusMsg.includes('failed') ? '#c62828' : '#2e7d32', fontWeight: 600 }}>
                        {statusMsg}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
