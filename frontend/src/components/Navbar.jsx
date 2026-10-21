import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    height: '60px',
    backgroundColor: '#1a237e',  
    color: '#ffffff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    position: 'sticky',
    top: 0,
    zIndex: 1000, 
  },
  brand: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#ffffff',
    textDecoration: 'none',
    letterSpacing: '-0.02em',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  userName: {
    fontSize: '0.9rem',
    opacity: 0.9,
  },
  roleBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '0.15rem 0.5rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  logoutBtn: {
    padding: '0.4rem 1rem',
    backgroundColor: 'transparent',
    border: '1.5px solid rgba(255,255,255,0.5)',
    borderRadius: '6px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'background 0.2s',
  },
  authLink: {
    color: '#ffffff',
    textDecoration: 'none',
    fontSize: '0.9rem',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1.5px solid rgba(255,255,255,0.4)',
  },
};

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.brand}>
        🚨 DisasterResponse
      </Link>

      <div style={styles.rightSection}>
        {isAuthenticated && user ? (
          <>
            <NotificationBell />

            <span style={styles.userName}>
              {user.name}
            </span>
            <span style={styles.roleBadge}>
              {user.role}
            </span>

            <Link
              to="/profile"
              style={{
                ...styles.authLink,
                fontSize: '0.85rem',
                padding: '0.35rem 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              👤 Profile
            </Link>

            <button
              onClick={handleLogout}
              style={styles.logoutBtn}
              onMouseEnter={e => e.target.style.backgroundColor = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={styles.authLink}>
              Login
            </Link>
            <Link
              to="/register"
              style={{
                ...styles.authLink,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
