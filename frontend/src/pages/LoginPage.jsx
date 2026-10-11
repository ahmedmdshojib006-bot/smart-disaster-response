// ============================================================
// src/pages/LoginPage.jsx — User Login Page
//
// Presents an email + password form.
// On success: calls AuthContext.login() and redirects home.
// On failure: shows a readable error message.
// ============================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/auth.css';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // ── Form State ───────────────────────────────────────────────
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // loading: true while the API request is in flight
  const [loading, setLoading] = useState(false);

  // error: a string shown in the red error banner; null = no error
  const [error, setError] = useState(null);

  // ── Input Change Handler ─────────────────────────────────────
  // A single handler for all inputs: reads the `name` attribute
  // to know which field to update.
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear previous errors when user starts typing again
    if (error) setError(null);
  };

  // ── Client-Side Validation ───────────────────────────────────
  // Returns an error message string, or null if everything is valid.
  const validate = () => {
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      return 'Please enter a valid email address.';
    }
    if (!formData.password) {
      return 'Password is required.';
    }
    return null; // null means "no error"
  };

  // ── Form Submit Handler ──────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent the browser from reloading the page

    // Run client-side validation first
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // POST credentials to the backend login endpoint
      const response = await axiosInstance.post('/api/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      // Expected response shape: { user: {...}, token: 'jwt...' }
      const { user, token } = response.data;

      // Save to AuthContext (also saves token to localStorage)
      login(user, token);

      // Redirect to "/" — App.jsx's RoleRedirect will send the user
      // to the correct dashboard based on their role.
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
        {/* Header */}
        <div className="auth-header">
          <h1>🚨 Welcome Back</h1>
          <p>Sign in to the Disaster Response Platform</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="server-error" role="alert">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email Field */}
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

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Footer Link */}
        <div className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link to="/register">Create one here</Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
