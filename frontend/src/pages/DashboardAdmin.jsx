// ============================================================
// src/pages/DashboardAdmin.jsx — Admin Dashboard
//
// Features:
//   - Volunteer Roster & Availability Monitoring
//   - Task Creation & Assignment to Volunteers
//   - Task Lifecycle Tracking (Assigned -> Accepted -> In Progress -> Completed)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import axiosInstance from '../api/axiosInstance.js';

function DashboardAdmin() {
  const { user } = useAuth();
  const { socket } = useSocket();

  // ── States ───────────────────────────────────────────────────
  const [volunteers, setVolunteers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Tabs: 'tasks' | 'volunteers'
  const [activeTab, setActiveTab] = useState('tasks');

  // Task Filter States
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Create Task Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    taskType: 'General',
    priority: 'Medium',
    serviceArea: '',
    assignedTo: '',
    dueDate: '',
    notes: '',
  });

  // Reassign Modal State
  const [reassignTaskId, setReassignTaskId] = useState(null);
  const [reassignVolunteerId, setReassignVolunteerId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // History Expand
  const [expandedAudit, setExpandedAudit] = useState({});

  // ── Data Fetching ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoadingData(true);
      const [vRes, tRes] = await Promise.all([
        axiosInstance.get('/api/volunteers'),
        axiosInstance.get('/api/tasks'),
      ]);

      if (vRes.data?.volunteers) {
        setVolunteers(vRes.data.volunteers);
      }
      if (tRes.data?.tasks) {
        setTasks(tRes.data.tasks);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notif) => {
      if (notif.title?.toLowerCase().includes('task') || notif.type === 'general') {
        fetchData();
      }
    };

    socket.on('notification:new', handleNotification);
    return () => {
      socket.off('notification:new', handleNotification);
    };
  }, [socket, fetchData]);

  // ── Create & Assign Task ─────────────────────────────────────
  const handleOpenCreateModal = (preselectedVolunteerId = '') => {
    setTaskFormData({
      title: '',
      description: '',
      taskType: 'General',
      priority: 'Medium',
      serviceArea: '',
      assignedTo: preselectedVolunteerId,
      dueDate: '',
      notes: '',
    });
    setShowCreateModal(true);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setCreatingTask(true);
    try {
      const res = await axiosInstance.post('/api/tasks', taskFormData);
      if (res.data?.task) {
        setTasks((prev) => [res.data.task, ...prev]);
        setShowCreateModal(false);
        setFeedbackMsg({
          type: 'success',
          text: `Task "${res.data.task.title}" successfully created and assigned!`,
        });
        setTimeout(() => setFeedbackMsg(null), 3500);
        // Refresh volunteer counts
        fetchData();
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to create task.',
      });
    } finally {
      setCreatingTask(false);
    }
  };

  // ── Reassign Task ────────────────────────────────────────────
  const handleReassign = async (e) => {
    e.preventDefault();
    if (!reassignTaskId || !reassignVolunteerId) return;

    setReassigning(true);
    try {
      const res = await axiosInstance.put(`/api/tasks/${reassignTaskId}/assign`, {
        assignedTo: reassignVolunteerId,
      });
      if (res.data?.task) {
        setTasks((prev) =>
          prev.map((t) => (t._id === reassignTaskId ? res.data.task : t))
        );
        setReassignTaskId(null);
        setReassignVolunteerId('');
        setFeedbackMsg({
          type: 'success',
          text: 'Task reassigned successfully.',
        });
        setTimeout(() => setFeedbackMsg(null), 3500);
        fetchData();
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to reassign task.',
      });
    } finally {
      setReassigning(false);
    }
  };

  // ── Delete Task ──────────────────────────────────────────────
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await axiosInstance.delete(`/api/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      setFeedbackMsg({
        type: 'success',
        text: 'Task deleted successfully.',
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to delete task.',
      });
    }
  };

  const toggleAudit = (taskId) => {
    setExpandedAudit((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // ── Filters & Metrics ────────────────────────────────────────
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'All' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(term);
      const matchVol = t.assignedTo?.name?.toLowerCase().includes(term);
      const matchArea = t.serviceArea?.toLowerCase().includes(term);
      if (!matchTitle && !matchVol && !matchArea) return false;
    }
    return true;
  });

  const availableVolunteersCount = volunteers.filter(
    (v) => v.availability === 'Available'
  ).length;

  const completedTasksCount = tasks.filter((t) => t.status === 'Completed').length;
  const activeTasksCount = tasks.filter((t) => t.status !== 'Completed').length;

  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-content">
        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            style={{
              padding: '0.85rem 1.2rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              background: feedbackMsg.type === 'error' ? '#ffebee' : '#e8f5e9',
              color: feedbackMsg.type === 'error' ? '#c62828' : '#2e7d32',
              border: `1px solid ${feedbackMsg.type === 'error' ? '#ffcdd2' : '#c8e6c9'}`,
              fontWeight: '500',
            }}
          >
            {feedbackMsg.text}
          </div>
        )}

        {/* Welcome & Overview Card */}
        <div className="dashboard-card" style={{ borderTop: '4px solid #1a237e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', color: '#1a237e', margin: 0 }}>
                Administrator Dashboard
                <span className="role-badge Admin">Admin</span>
              </h1>
              <p style={{ color: '#666', marginTop: '0.4rem', fontSize: '0.95rem' }}>
                Manage emergency volunteer deployments, task assignments, and monitor real-time lifecycle progression.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Link
                to="/admin/users"
                style={{
                  background: '#f1f5f9',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '0.75rem 1.1rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                🛡️ Users & Roles
              </Link>
              <Link
                to="/admin/alerts"
                style={{
                  background: '#fef2f2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '0.75rem 1.1rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                📡 Broadcast Alert
              </Link>
              <button
                type="button"
                onClick={() => handleOpenCreateModal()}
                style={{
                  background: '#1a237e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.2rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 6px rgba(26,35,126,0.25)',
                }}
              >
                ➕ Assign Task
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '1.2rem 0' }} />

          {/* Stats Counters */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
            }}
          >
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1e293b' }}>{volunteers.length}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Registered Volunteers</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#16a34a' }}>{availableVolunteersCount}</div>
              <div style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: '600' }}>🟢 Available for Deployment</div>
            </div>
            <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2563eb' }}>{activeTasksCount}</div>
              <div style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: '600' }}>Active Tasks in Field</div>
            </div>
            <div style={{ background: '#faf5ff', padding: '1rem', borderRadius: '8px', border: '1px solid #e9d5ff', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#9333ea' }}>{completedTasksCount}</div>
              <div style={{ fontSize: '0.85rem', color: '#7e22ce', fontWeight: '600' }}>Completed Operations</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.2rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'tasks' ? '#1a237e' : '#fff',
              color: activeTab === 'tasks' ? '#fff' : '#475569',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            📋 Tasks Overview ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('volunteers')}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'volunteers' ? '#1a237e' : '#fff',
              color: activeTab === 'volunteers' ? '#fff' : '#475569',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            🦺 Volunteer Roster & Skills ({volunteers.length})
          </button>
        </div>

        {/* ── TAB 1: TASKS OVERVIEW ───────────────────────────────── */}
        {activeTab === 'tasks' && (
          <div className="dashboard-card">
            {/* Filter Bar */}
            <div
              style={{
                display: 'flex',
                gap: '0.8rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                marginBottom: '1.2rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid #eee',
              }}
            >
              <input
                type="text"
                placeholder="Search tasks, volunteer or area..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '220px',
                  padding: '0.6rem 0.9rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                }}
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.6rem 0.9rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#fff',
                }}
              >
                <option value="All">All Statuses</option>
                <option value="Assigned">Assigned</option>
                <option value="Accepted">Accepted</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={{
                  padding: '0.6rem 0.9rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#fff',
                }}
              >
                <option value="All">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Tasks List */}
            {loadingData ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Loading tasks...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px dashed #cbd5e1',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                <h3 style={{ fontSize: '1.05rem', color: '#334155', margin: '0 0 0.3rem 0' }}>
                  No tasks matching criteria
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                  Click "Assign New Task" above to deploy volunteers.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredTasks.map((task) => (
                  <div
                    key={task._id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '1.2rem',
                      background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '1.15rem', color: '#0f172a', margin: 0 }}>
                            {task.title}
                          </h3>
                          <span
                            style={{
                              background: '#f1f5f9',
                              color: '#475569',
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontWeight: '600',
                            }}
                          >
                            {task.taskType}
                          </span>
                          <span
                            style={{
                              background:
                                task.priority === 'Urgent'
                                  ? '#ffebee'
                                  : task.priority === 'High'
                                  ? '#fff3e0'
                                  : task.priority === 'Medium'
                                  ? '#e3f2fd'
                                  : '#f5f5f5',
                              color:
                                task.priority === 'Urgent'
                                  ? '#c62828'
                                  : task.priority === 'High'
                                  ? '#e65100'
                                  : task.priority === 'Medium'
                                  ? '#1565c0'
                                  : '#616161',
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontWeight: '700',
                            }}
                          >
                            {task.priority} Priority
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.3rem' }}>
                          📍 {task.serviceArea} • Assigned to:{' '}
                          <strong style={{ color: '#1e293b' }}>
                            {task.assignedTo?.name || 'Unassigned'}
                          </strong>{' '}
                          {task.assignedTo?.phone && `(${task.assignedTo.phone})`}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        style={{
                          background:
                            task.status === 'Completed'
                              ? '#e8f5e9'
                              : task.status === 'In Progress'
                              ? '#fff3e0'
                              : task.status === 'Accepted'
                              ? '#f3e5f5'
                              : '#e3f2fd',
                          color:
                            task.status === 'Completed'
                              ? '#2e7d32'
                              : task.status === 'In Progress'
                              ? '#e65100'
                              : task.status === 'Accepted'
                              ? '#6a1b9a'
                              : '#1565c0',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          padding: '0.35rem 0.8rem',
                          borderRadius: '20px',
                        }}
                      >
                        ● {task.status}
                      </span>
                    </div>

                    <p style={{ color: '#334155', fontSize: '0.92rem', margin: '0.8rem 0', lineHeight: 1.5 }}>
                      {task.description}
                    </p>

                    {/* Progress Bar */}
                    <div
                      style={{
                        margin: '0.8rem 0',
                        padding: '0.6rem 0.8rem',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.8rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: '#64748b', fontWeight: '600' }}>Workflow:</span>
                      {['Assigned', 'Accepted', 'In Progress', 'Completed'].map((st, sIdx) => {
                        const states = ['Assigned', 'Accepted', 'In Progress', 'Completed'];
                        const isDone = states.indexOf(task.status) >= sIdx;
                        return (
                          <span
                            key={st}
                            style={{
                              color: isDone ? '#1a237e' : '#94a3b8',
                              fontWeight: isDone ? '700' : 'normal',
                            }}
                          >
                            {isDone ? '✓ ' : '○ '}
                            {st}
                            {sIdx < 3 && <span style={{ color: '#cbd5e1', margin: '0 0.4rem' }}>➔</span>}
                          </span>
                        );
                      })}
                    </div>

                    {task.notes && (
                      <div style={{ fontSize: '0.85rem', color: '#475569', background: '#f1f5f9', padding: '0.5rem 0.8rem', borderRadius: '6px', marginBottom: '0.6rem' }}>
                        💬 <strong>Notes:</strong> {task.notes}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={() => toggleAudit(task._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#1a237e',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        {expandedAudit[task._id] ? 'Hide Audit Log' : 'View Audit Log'}
                      </button>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setReassignTaskId(task._id);
                            setReassignVolunteerId(task.assignedTo?._id || '');
                          }}
                          style={{
                            background: '#f1f5f9',
                            color: '#1e293b',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          🔄 Reassign
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task._id)}
                          style={{
                            background: '#ffebee',
                            color: '#c62828',
                            border: '1px solid #ffcdd2',
                            borderRadius: '6px',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {/* Audit Trail */}
                    {expandedAudit[task._id] && (
                      <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569' }}>
                        <strong>Audit Trail:</strong>
                        <ul style={{ paddingLeft: '1.2rem', marginTop: '0.3rem' }}>
                          {task.statusHistory && task.statusHistory.length > 0 ? (
                            task.statusHistory.map((h, i) => (
                              <li key={i}>
                                <strong>{h.status}</strong> — {new Date(h.changedAt).toLocaleString()}
                                {h.notes && ` (${h.notes})`}
                              </li>
                            ))
                          ) : (
                            <li>Created as Assigned</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: VOLUNTEER ROSTER ────────────────────────────── */}
        {activeTab === 'volunteers' && (
          <div className="dashboard-card">
            <h2 style={{ fontSize: '1.3rem', color: '#1e293b', marginTop: 0, marginBottom: '0.4rem' }}>
              🦺 Registered Volunteers Roster
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
              Inspect volunteer availability, capability skillsets, and service regions for assignment.
            </p>

            {volunteers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                No volunteers registered yet.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '1rem',
                }}
              >
                {volunteers.map((vol) => (
                  <div
                    key={vol._id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '1.2rem',
                      background: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                          {vol.name}
                        </h4>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            background:
                              vol.availability === 'Available'
                                ? '#e8f5e9'
                                : vol.availability === 'Busy'
                                ? '#fff3e0'
                                : '#ffebee',
                            color:
                              vol.availability === 'Available'
                                ? '#2e7d32'
                                : vol.availability === 'Busy'
                                ? '#e65100'
                                : '#c62828',
                          }}
                        >
                          ● {vol.availability || 'Available'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.3rem' }}>
                        📧 {vol.email}
                        {vol.phone && ` • 📞 ${vol.phone}`}
                      </div>

                      <div style={{ fontSize: '0.85rem', color: '#1e293b', marginTop: '0.5rem', fontWeight: '500' }}>
                        📍 Service Area: <strong>{vol.serviceArea || 'Not set'}</strong>
                      </div>

                      {/* Skills */}
                      <div style={{ marginTop: '0.6rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                          Skills:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                          {vol.skills && vol.skills.length > 0 ? (
                            vol.skills.map((s, idx) => (
                              <span
                                key={idx}
                                style={{
                                  background: '#e0e7ff',
                                  color: '#3730a3',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '8px',
                                }}
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No skills listed</span>
                          )}
                        </div>
                      </div>

                      {/* Workload */}
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.8rem' }}>
                        Active Tasks: <strong>{vol.stats?.activeTasks || 0}</strong> • Completed:{' '}
                        <strong>{vol.stats?.completedTasks || 0}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenCreateModal(vol._id)}
                      style={{
                        marginTop: '1rem',
                        width: '100%',
                        background: '#1a237e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.55rem',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      ➕ Assign Task to {vol.name.split(' ')[0]}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CREATE TASK MODAL ─────────────────────────────────────── */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ fontSize: '1.4rem', color: '#1a237e', marginTop: 0, marginBottom: '0.4rem' }}>
              Assign New Disaster Relief Task
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
              Assign an on-the-ground task to a registered volunteer. Status starts at <strong>Assigned</strong>.
            </p>

            <form onSubmit={handleCreateTask}>
              {/* Title */}
              <div className="form-group">
                <label>Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distribute clean drinking water to Ward 7"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Description & Instructions *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Detailed instructions, contact numbers, landmarks..."
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #e0e0e0',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Type & Priority Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div className="form-group">
                  <label>Task Type</label>
                  <select
                    value={taskFormData.taskType}
                    onChange={(e) => setTaskFormData({ ...taskFormData, taskType: e.target.value })}
                  >
                    <option value="Rescue">Rescue & Evacuation</option>
                    <option value="Food Distribution">Food & Water Distribution</option>
                    <option value="Medical Aid">Medical Aid</option>
                    <option value="Shelter Management">Shelter Management</option>
                    <option value="Logistics">Logistics & Transport</option>
                    <option value="General">General Relief</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={taskFormData.priority}
                    onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">🚨 Urgent</option>
                  </select>
                </div>
              </div>

              {/* Service Area */}
              <div className="form-group">
                <label>Service Area / Location *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Feni Parshuram, Mirpur Ward 11, Sunamganj"
                  value={taskFormData.serviceArea}
                  onChange={(e) => setTaskFormData({ ...taskFormData, serviceArea: e.target.value })}
                />
              </div>

              {/* Assign to Volunteer */}
              <div className="form-group">
                <label>Assign to Volunteer *</label>
                <select
                  required
                  value={taskFormData.assignedTo}
                  onChange={(e) => setTaskFormData({ ...taskFormData, assignedTo: e.target.value })}
                >
                  <option value="">— Choose a Volunteer —</option>
                  {volunteers.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.name} ({v.availability || 'Available'} | {v.serviceArea || 'No Area'} | Skills:{' '}
                      {v.skills?.join(', ') || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div className="form-group">
                <label>Target Completion Date (Optional)</label>
                <input
                  type="date"
                  value={taskFormData.dueDate}
                  onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                />
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.2rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTask}
                  style={{
                    background: '#1a237e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.3rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  {creatingTask ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REASSIGN MODAL ────────────────────────────────────────── */}
      {reassignTaskId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ fontSize: '1.3rem', color: '#1a237e', marginTop: 0, marginBottom: '0.5rem' }}>
              Reassign Task
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
              Select a new volunteer to take over this relief task. Status will reset to <strong>Assigned</strong>.
            </p>

            <form onSubmit={handleReassign}>
              <div className="form-group">
                <label>New Volunteer</label>
                <select
                  required
                  value={reassignVolunteerId}
                  onChange={(e) => setReassignVolunteerId(e.target.value)}
                >
                  <option value="">— Select Volunteer —</option>
                  {volunteers.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.name} ({v.availability} | {v.serviceArea})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setReassignTaskId(null)}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.2rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning}
                  style={{
                    background: '#1a237e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.2rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  {reassigning ? 'Reassigning...' : 'Confirm Reassign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardAdmin;
