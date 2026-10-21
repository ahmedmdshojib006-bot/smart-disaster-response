import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/auth.css';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const validate = () => {
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      return 'Please enter a valid email address.';
    }
    if (!formData.password) {
      return 'Password is required.';
    }
    return null; 
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.post('/api/auth/login', {
        email: formData.email.trim().toLowerCase(),
        password: formData.password.trim(),
      });

      const { user, token } = response.data;

      login(user, token);

      navigate('/');
    } catch (err) {
      const resData = err.response?.data;
      const msg =
        resData?.message ||
        resData?.error ||
        (err.code === 'ERR_NETWORK' || !err.response
          ? 'Cannot connect to backend server. Make sure the backend server is running on port 5000.'
          : 'Login failed. Please check your credentials and try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🚨 Welcome Back</h1>
          <p>Sign in to the Disaster Response Platform</p>
        </div>

        {error && (
          <div className="server-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  padding: '4px',
                  color: '#666',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: '0.4rem' }}>
              <Link to="/forgot-password" style={{ color: '#1a237e', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link to="/register">Create one here</Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
