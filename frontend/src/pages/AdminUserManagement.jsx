import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosInstance from '../api/axiosInstance';

const ROLES = ['Admin', 'Volunteer', 'NGO', 'Citizen', 'Donor'];

const roleBadgeColors = {
  Admin: { bg: '#fce4ec', color: '#c62828' },
  Volunteer: { bg: '#e8f5e9', color: '#2e7d32' },
  NGO: { bg: '#e3f2fd', color: '#1565c0' },
  Citizen: { bg: '#fff3e0', color: '#e65100' },
  Donor: { bg: '#f3e5f5', color: '#6a1b9a' },
};

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [roleChangeMap, setRoleChangeMap] = useState({});
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });
  const [deletingId, setDeletingId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (search) params.append('search', search);
      if (filterRole) params.append('role', filterRole);
      const res = await axiosInstance.get(`/api/admin/users?${params}`);
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch {
      setActionMsg({ type: 'error', text: 'Failed to fetch users.' });
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, page]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/api/admin/stats');
      setStats(res.data.stats);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [fetchUsers, fetchStats]);

  const handleRoleChange = async (userId) => {
    const newRole = roleChangeMap[userId];
    if (!newRole) return setActionMsg({ type: 'error', text: 'Please select a role first.' });
    try {
      await axiosInstance.put(`/api/admin/users/${userId}/role`, { role: newRole });
      setActionMsg({ type: 'success', text: `User role updated to ${newRole}.` });
      fetchUsers();
      fetchStats();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Role update failed.' });
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"?`)) return;
    setDeletingId(userId);
    try {
      await axiosInstance.delete(`/api/admin/users/${userId}`);
      setActionMsg({ type: 'success', text: 'User deleted successfully.' });
      fetchUsers();
      fetchStats();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Delete failed.' });
    } finally {
      setDeletingId(null);
    }
  };

  const alertStyle = (type) => ({
    background: type === 'success' ? '#e8f5e9' : '#ffebee',
    border: `1px solid ${type === 'success' ? '#c8e6c9' : '#ffcdd2'}`,
    borderRadius: 8,
    padding: '0.75rem 1rem',
    color: type === 'success' ? '#2e7d32' : '#c62828',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  });

  return (
    <div className="dashboard-page">
      <Navbar />
      <div className="dashboard-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <h2 style={{ color: '#1a237e', margin: 0 }}>🛡️ User & Access Management</h2>
            <p style={{ color: '#666', fontSize: '0.88rem', margin: '0.2rem 0 0 0' }}>Manage all registered users, permissions, and roles</p>
          </div>
          <Link to="/dashboard/admin" style={{ color: '#1a237e', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>

        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <div className="dashboard-card" style={{ textAlign: 'center', padding: '1rem', background: '#e8eaf6' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a237e' }}>{stats.total}</div>
              <div style={{ fontSize: '0.8rem', color: '#1a237e', fontWeight: 700 }}>Total Accounts</div>
            </div>
            {ROLES.map((r) => (
              <div key={r} className="dashboard-card" style={{ textAlign: 'center', padding: '1rem', background: roleBadgeColors[r]?.bg }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: roleBadgeColors[r]?.color }}>
                  {stats.byRole?.[r] || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: roleBadgeColors[r]?.color, fontWeight: 700 }}>
                  {r}s
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="dashboard-card">
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ flex: 1, minWidth: 220, padding: '0.65rem 1rem', border: '2px solid #e0e0e0', borderRadius: 8, fontSize: '0.95rem' }}
            />
            <select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setPage(1);
              }}
              style={{ padding: '0.65rem 1rem', border: '2px solid #e0e0e0', borderRadius: 8, fontSize: '0.95rem', background: 'white' }}
            >
              <option value="">All Roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {actionMsg.text && <div style={alertStyle(actionMsg.type)}>{actionMsg.text}</div>}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading users...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['User', 'Email', 'Role', 'Role Modification', 'Action'].map((h) => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        No users matching criteria.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{u.name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                            Joined: {new Date(u.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#475569' }}>
                          {u.email}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.6rem',
                              borderRadius: 12,
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              background: roleBadgeColors[u.role]?.bg || '#eee',
                              color: roleBadgeColors[u.role]?.color || '#333',
                            }}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <select
                              value={roleChangeMap[u._id] || ''}
                              onChange={(e) => setRoleChangeMap((prev) => ({ ...prev, [u._id]: e.target.value }))}
                              style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.85rem' }}
                            >
                              <option value="">Change role...</option>
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRoleChange(u._id)}
                              style={{
                                padding: '0.4rem 0.8rem',
                                background: '#1a237e',
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Apply
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <button
                            type="button"
                            onClick={() => handleDelete(u._id, u.name)}
                            disabled={deletingId === u._id}
                            style={{
                              padding: '0.4rem 0.8rem',
                              background: '#ffebee',
                              color: '#c62828',
                              border: '1px solid #ffcdd2',
                              borderRadius: 6,
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              opacity: deletingId === u._id ? 0.6 : 1,
                            }}
                          >
                            {deletingId === u._id ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: page === p ? '#1a237e' : '#f8fafc',
                    color: page === p ? 'white' : '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: page === p ? 700 : 500,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
