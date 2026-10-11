// ============================================================
// src/components/NotificationBell.jsx — Notification Bell
//
// Shows a bell icon with an unread count badge in the Navbar.
// Clicking it opens a dropdown list of notifications.
// Listens to Socket.IO for real-time new notifications.
// ============================================================

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import axiosInstance from '../api/axiosInstance.js';

// ── HELPER: Relative Time ────────────────────────────────────
// Converts a date string or Date object into a human-readable
// relative time string like "2 minutes ago" or "3 hours ago".
function timeAgo(dateInput) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;                    // Difference in milliseconds
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60)  return 'just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ── HELPER: Type Color Map ───────────────────────────────────
// Returns a background and text color pair for each notification type.
const typeColors = {
  sos:        { bg: '#ffebee', text: '#c62828', label: 'SOS' },
  weather:    { bg: '#fff9c4', text: '#f57f17', label: 'Weather' },
  evacuation: { bg: '#fff3e0', text: '#e65100', label: 'Evacuation' },
  general:    { bg: '#e3f2fd', text: '#1565c0', label: 'General' },
};

function getTypeStyle(type) {
  return typeColors[type?.toLowerCase()] || typeColors.general;
}

// ── INLINE STYLES ────────────────────────────────────────────
const styles = {
  wrapper: {
    position: 'relative',
    display: 'inline-block',
  },
  bellBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.4rem',
    position: 'relative',
    padding: '4px',
    lineHeight: 1,
    color: '#ffffff',
  },
  badge: {
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
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '340px',
    maxHeight: '440px',
    overflowY: 'auto',
    background: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
    zIndex: 2000,
    border: '1px solid #e0e0e0',
  },
  dropdownHeader: {
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
  },
  markAllBtn: {
    background: 'none',
    border: 'none',
    color: '#1565c0',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  emptyMsg: {
    padding: '2rem',
    textAlign: 'center',
    color: '#999',
    fontSize: '0.9rem',
  },
  notifItem: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #f5f5f5',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  notifTitle: {
    fontSize: '0.88rem',
    fontWeight: '600',
    color: '#222',
    marginBottom: '2px',
  },
  notifMsg: {
    fontSize: '0.82rem',
    color: '#555',
    marginBottom: '4px',
    // Clamp to 2 lines
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  notifMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  typeBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '1px 6px',
    borderRadius: '10px',
  },
  timeAgo: {
    fontSize: '0.75rem',
    color: '#aaa',
  },
};

function NotificationBell() {
  const { user } = useAuth();
  const { socket } = useSocket();

  // State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [isOpen, setIsOpen]               = useState(false);
  const [loading, setLoading]             = useState(false);

  // Ref to the wrapper div — used to detect clicks outside the dropdown
  const wrapperRef = useRef(null);

  // ── FETCH NOTIFICATIONS ON MOUNT ────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/notifications');
      const data = res.data.notifications || res.data || [];
      setNotifications(data);
      // Count how many notifications have not been read yet
      setUnreadCount(data.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch once on mount and whenever the logged-in user changes
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── REAL-TIME: Listen for new notifications via Socket.IO ───
  useEffect(() => {
    if (!socket) return; // No socket yet — skip

    const handleNewNotification = (newNotif) => {
      // Prepend the new notification to the top of the list
      setNotifications(prev => [newNotif, ...prev]);
      // Increase the unread badge count
      setUnreadCount(prev => prev + 1);
    };

    socket.on('notification:new', handleNewNotification);

    // Cleanup: remove listener when socket changes or component unmounts
    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  // ── CLICK OUTSIDE TO CLOSE DROPDOWN ─────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      // If the click is outside our wrapper div, close the dropdown
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── HANDLERS ─────────────────────────────────────────────────

  // Toggle the dropdown open/closed
  const handleOpen = () => setIsOpen(prev => !prev);

  // Mark a single notification as read
  const handleMarkRead = async (id) => {
    try {
      await axiosInstance.patch(`/api/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n._id === id || n.id === id) ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err.message);
    }
  };

  // Mark all notifications as read in one request
  const handleMarkAllRead = async () => {
    try {
      await axiosInstance.patch('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err.message);
    }
  };

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      {/* ── Bell Button ───────────────────────────── */}
      <button
        style={styles.bellBtn}
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        🔔
        {/* Only show the badge when there are unread notifications */}
        {unreadCount > 0 && (
          <span style={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ───────────────────────── */}
      {isOpen && (
        <div style={styles.dropdown}>
          {/* Header row */}
          <div style={styles.dropdownHeader}>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button style={styles.markAllBtn} onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <p style={styles.emptyMsg}>Loading...</p>
          ) : notifications.length === 0 ? (
            <p style={styles.emptyMsg}>No notifications yet</p>
          ) : (
            notifications.map((notif) => {
              const typeStyle = getTypeStyle(notif.type);
              const id = notif._id || notif.id;
              return (
                <div
                  key={id}
                  style={{
                    ...styles.notifItem,
                    background: notif.isRead ? '#fff' : '#f0f4ff',
                  }}
                  onClick={() => !notif.isRead && handleMarkRead(id)}
                  title={notif.isRead ? '' : 'Click to mark as read'}
                >
                  {/* Title — bold if unread */}
                  <div style={{
                    ...styles.notifTitle,
                    fontWeight: notif.isRead ? '500' : '700',
                  }}>
                    {notif.title || 'Notification'}
                  </div>

                  {/* Message snippet */}
                  <div style={styles.notifMsg}>
                    {notif.message || notif.body || ''}
                  </div>

                  {/* Type badge + time */}
                  <div style={styles.notifMeta}>
                    <span style={{
                      ...styles.typeBadge,
                      background: typeStyle.bg,
                      color: typeStyle.text,
                    }}>
                      {typeStyle.label}
                    </span>
                    <span style={styles.timeAgo}>
                      {notif.createdAt ? timeAgo(notif.createdAt) : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
