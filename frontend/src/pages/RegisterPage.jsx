// ============================================================
// src/pages/RegisterPage.jsx — User Registration Page
//
// Multi-field form with client-side field-level validation.
// Roles available: Volunteer, NGO, Citizen, Donor (no Admin).
// On success: calls AuthContext.login() and redirects home.
// ============================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/auth.css';

// Available roles for registration.
// Admin is intentionally excluded — admins are created server-side only.
const ROLES = ['Volunteer', 'NGO', 'Citizen', 'Donor'];

function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // ── Form State ───────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
  });

  const [loading, setLoading] = useState(false);

  // errors: an object mapping field names to error messages
  // e.g. { name: 'Name is required', email: 'Invalid email' }
  const [errors, setErrors] = useState({});

  // serverError: a string for backend-returned errors
  const [serverError, setServerError] = useState(null);

  // ── Input Change Handler ─────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear the specific field error as user corrects it
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (serverError) setServerError(null);
  };

  // ── Client-Side Validation ───────────────────────────────────
  // Validates all fields and returns an errors object.
  // An empty object means all fields are valid.
  const validate = () => {
    const newErrors = {};

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Full name must be at least 2 characters.';
    }

    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }

    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!formData.role) {
      newErrors.role = 'Please select a role.';
    }

    return newErrors;
  };

  // ── Form Submit Handler ──────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate before sending to backend
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setServerError(null);

    try {
      const response = await axiosInstance.post('/api/auth/register', {
        name:     formData.name.trim(),
        email:    formData.email.trim().toLowerCase(),
        password: formData.password,
        role:     formData.role,
      });

      // Expected response shape: { user: {...}, token: 'jwt...' }
      const { user, token } = response.data;

      // Save user and token to AuthContext
      login(user, token);

      // Redirect — RoleRedirect will send to the right dashboard
      navigate('/');
    } catch (err) {
      const resData = err.response?.data;
      const msg =
        (Array.isArray(resData?.errors) ? resData.errors.join(', ') : null) ||
        resData?.message ||
        resData?.error ||
        (err.code === 'ERR_NETWORK' || !err.response
          ? 'Cannot connect to backend server. Make sure the backend server is running on port 5000.'
          : 'Registration failed. Please try again.');
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <h1>🚨 Join the Platform</h1>
          <p>Create your Disaster Response account</p>
        </div>

        {/* Server-level error banner */}
        {serverError && (
          <div className="server-error" role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Jane Doe"
              className={errors.name ? 'error' : ''}
              disabled={loading}
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className={errors.email ? 'error' : ''}
              autoComplete="email"
              disabled={loading}
            />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimum 8 characters"
              className={errors.password ? 'error' : ''}
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your password"
              className={errors.confirmPassword ? 'error' : ''}
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.confirmPassword && (
              <p className="field-error">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Role Selection */}
          <div className="form-group">
            <label htmlFor="role">I am a...</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={errors.role ? 'error' : ''}
              disabled={loading}
            >
              <option value="">— Select your role —</option>
              {ROLES.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            {errors.role && <p className="field-error">{errors.role}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Footer Link */}
        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in here</Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
