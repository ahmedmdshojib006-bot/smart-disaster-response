import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/auth.css';

const ROLES = ['Volunteer', 'NGO', 'Citizen', 'Donor'];

function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    serviceArea: '',
    availability: 'Available',
    phone: '',
  });

  const [selectedSkills, setSelectedSkills] = useState([]);
  const [customSkill, setCustomSkill] = useState('');

  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState({});

  const [serverError, setServerError] = useState(null);

  const AVAILABLE_SKILLS = [
    'First Aid',
    'Search & Rescue',
    'Medical Support',
    'Food & Water Distribution',
    'Logistics & Transport',
    'Shelter Management',
    'Boat Operations',
    'Counseling / Mental Health',
  ];

  const toggleSkill = (skill) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleAddCustomSkill = (e) => {
    e.preventDefault();
    if (customSkill.trim() && !selectedSkills.includes(customSkill.trim())) {
      setSelectedSkills(prev => [...prev, customSkill.trim()]);
      setCustomSkill('');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (serverError) setServerError(null);
  };

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

    if (formData.role === 'Volunteer') {
      if (!formData.serviceArea || formData.serviceArea.trim().length < 2) {
        newErrors.serviceArea = 'Please specify your service area (e.g. Dhaka, Feni, Sylhet).';
      }
      if (selectedSkills.length === 0) {
        newErrors.skills = 'Please select at least one skill or capability.';
      }
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setServerError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
      };

      if (formData.role === 'Volunteer') {
        payload.serviceArea = formData.serviceArea.trim();
        payload.availability = formData.availability;
        payload.skills = selectedSkills;
        payload.phone = formData.phone.trim();
      }

      const response = await axiosInstance.post('/api/auth/register', payload);

      const { user, token } = response.data;

      login(user, token);

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
        <div className="auth-header">
          <h1>🚨 Join the Platform</h1>
          <p>Create your Disaster Response account</p>
        </div>

        {serverError && (
          <div className="server-error" role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
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

          {formData.role === 'Volunteer' && (
            <div
              className="volunteer-registration-section"
              style={{
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '10px',
                padding: '1.2rem',
                marginBottom: '1.2rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.8rem' }}>
                <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>🦺</span>
                <strong style={{ color: '#1e293b', fontSize: '0.95rem' }}>
                  Volunteer Profile & Capabilities
                </strong>
              </div>

              <div className="form-group">
                <label htmlFor="serviceArea">Service Area / District *</label>
                <input
                  type="text"
                  id="serviceArea"
                  name="serviceArea"
                  value={formData.serviceArea}
                  onChange={handleChange}
                  placeholder="e.g. Dhaka (Mirpur), Sylhet, Feni"
                  className={errors.serviceArea ? 'error' : ''}
                  disabled={loading}
                />
                {errors.serviceArea && <p className="field-error">{errors.serviceArea}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="availability">Availability Status</label>
                <select
                  id="availability"
                  name="availability"
                  value={formData.availability}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="Available">🟢 Available (Ready for deployment)</option>
                  <option value="Busy">🟡 Busy (On active assignment)</option>
                  <option value="Unavailable">🔴 Unavailable (Off duty)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone / Emergency Contact</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+88017xxxxxxxx"
                  disabled={loading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Skills & Capabilities *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.5rem 0' }}>
                  {AVAILABLE_SKILLS.map(skill => {
                    const isSelected = selectedSkills.includes(skill);
                    return (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        style={{
                          background: isSelected ? '#1a237e' : '#fff',
                          color: isSelected ? '#fff' : '#334155',
                          border: isSelected ? '1px solid #1a237e' : '1px solid #cbd5e1',
                          borderRadius: '16px',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: isSelected ? '600' : 'normal',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}{skill}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    placeholder="Other skill (e.g. Cooking, Boat driver)"
                    style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSkill(e);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSkill}
                    style={{
                      background: '#e2e8f0',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.5rem 0.8rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    Add
                  </button>
                </div>
                {errors.skills && <p className="field-error">{errors.skills}</p>}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in here</Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
