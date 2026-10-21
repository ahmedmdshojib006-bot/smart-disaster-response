import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import '../styles/auth.css';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) return setError('Email is required.');
    setLoading(true);
    try {
      const res = await axiosInstance.post('/api/auth/forgot-password', { email });
      if (res.data.resetToken) {
        setGeneratedToken(res.data.resetToken);
        setResetToken(res.data.resetToken);
      }
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!resetToken) return setError('Reset token is required.');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await axiosInstance.post('/api/auth/reset-password', {
        token: resetToken,
        newPassword,
      });
      setSuccess('Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🔑 Reset Password</h1>
          <p>{step === 1 ? 'Enter your email to receive a reset token' : 'Enter the reset token and your new password'}</p>
        </div>

        {error && <div className="server-error">{error}</div>}
        {success && (
          <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 8, padding: '0.75rem 1rem', color: '#2e7d32', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {success}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestReset}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Generating Token...' : 'Get Reset Token'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            {generatedToken && (
              <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
                <strong>Generated Reset Token:</strong>
                <div style={{ fontFamily: 'monospace', fontSize: '1.25rem', color: '#e65100', marginTop: 4, letterSpacing: '2px', fontWeight: 700 }}>
                  {generatedToken}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
                  Valid for 15 minutes. It has been automatically filled below.
                </div>
              </div>
            )}
            <div className="form-group">
              <label>Reset Token</label>
              <input
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Enter reset token"
                required
              />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link to="/login" style={{ color: '#1a237e', fontWeight: 600 }}>← Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
