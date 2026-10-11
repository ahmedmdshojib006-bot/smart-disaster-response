// ============================================================
// src/pages/DashboardVolunteer.jsx — Volunteer Dashboard
//
// Member-3: Volunteer Profile, Availability & Task Lifecycle Management
// Lifecycle: Assigned ──► Accepted ──► In Progress ──► Completed
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import axiosInstance from '../api/axiosInstance.js';

const AVAILABLE_SKILLS_LIST = [
  'First Aid',
  'Search & Rescue',
  'Medical Support',
  'Food & Water Distribution',
  'Logistics & Transport',
  'Shelter Management',
  'Boat Operations',
  'Counseling / Mental Health',
];

function DashboardVolunteer() {
  const { user } = useAuth();
  const { socket } = useSocket();

  // ── State ────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    skills: user?.skills || [],
    availability: user?.availability || 'Available',
    serviceArea: user?.serviceArea || '',
    phone: user?.phone || '',
  });

  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [actionLoading, setActionLoading] = useState({});
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Profile Edit Modal State
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    skills: [],
    availability: 'Available',
    serviceArea: '',
    phone: '',
  });
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Completion Modal State
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');

  // Expanded History for tasks
  const [expandedHistory, setExpandedHistory] = useState({});

  // ── Fetch Profile & Tasks ────────────────────────────────────
  const fetchProfileAndTasks = useCallback(async () => {
    try {
      setLoadingTasks(true);
      // Fetch fresh profile
      const profRes = await axiosInstance.get('/api/volunteers/profile');
      if (profRes.data?.user) {
        setProfile({
          skills: profRes.data.user.skills || [],
          availability: profRes.data.user.availability || 'Available',
          serviceArea: profRes.data.user.serviceArea || '',
          phone: profRes.data.user.phone || '',
        });
      }

      // Fetch tasks
      const taskRes = await axiosInstance.get('/api/tasks/my-tasks');
      if (taskRes.data?.tasks) {
        setTasks(taskRes.data.tasks);
      }
    } catch (err) {
      console.error('Error fetching volunteer data:', err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileAndTasks();
  }, [fetchProfileAndTasks]);

  // ── Real-time Socket Listener ────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notif) => {
      // If notification is about a task, refresh tasks
      if (notif.title?.toLowerCase().includes('task') || notif.type === 'general') {
        fetchProfileAndTasks();
      }
    };

    socket.on('notification:new', handleNotification);
    return () => {
      socket.off('notification:new', handleNotification);
    };
  }, [socket, fetchProfileAndTasks]);

  // ── Quick Availability Toggle ────────────────────────────────
  const handleQuickAvailabilityChange = async (newAvailability) => {
    try {
      setActionLoading((prev) => ({ ...prev, availability: true }));
      const res = await axiosInstance.put('/api/volunteers/profile', {
        availability: newAvailability,
      });
      if (res.data?.user) {
        setProfile((prev) => ({ ...prev, availability: newAvailability }));
        setFeedbackMsg({
          type: 'success',
          text: `Availability status set to "${newAvailability}".`,
        });
        setTimeout(() => setFeedbackMsg(null), 3500);
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update availability.',
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, availability: false }));
    }
  };

  // ── Open Edit Profile Modal ──────────────────────────────────
  const handleOpenEditModal = () => {
    setEditFormData({
      skills: [...profile.skills],
      availability: profile.availability,
      serviceArea: profile.serviceArea,
      phone: profile.phone,
    });
    setCustomSkillInput('');
    setShowEditProfile(true);
  };

  const handleToggleEditSkill = (skill) => {
    setEditFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleAddCustomSkill = (e) => {
    e.preventDefault();
    if (customSkillInput.trim() && !editFormData.skills.includes(customSkillInput.trim())) {
      setEditFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, customSkillInput.trim()],
      }));
      setCustomSkillInput('');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await axiosInstance.put('/api/volunteers/profile', {
        skills: editFormData.skills,
        availability: editFormData.availability,
        serviceArea: editFormData.serviceArea,
        phone: editFormData.phone,
      });
      if (res.data?.user) {
        setProfile({
          skills: res.data.user.skills || [],
          availability: res.data.user.availability || 'Available',
          serviceArea: res.data.user.serviceArea || '',
          phone: res.data.user.phone || '',
        });
        setShowEditProfile(false);
        setFeedbackMsg({ type: 'success', text: 'Profile updated successfully!' });
        setTimeout(() => setFeedbackMsg(null), 3500);
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save profile.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Task Status Workflow Handler ─────────────────────────────
  // State machine: Assigned ──► Accepted ──► In Progress ──► Completed
  const handleTransitionTask = async (taskId, targetStatus, notes = '') => {
    try {
      setActionLoading((prev) => ({ ...prev, [taskId]: true }));
      const payload = { status: targetStatus };
      if (notes) payload.notes = notes;

      const res = await axiosInstance.patch(`/api/tasks/${taskId}/status`, payload);
      if (res.data?.task) {
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? res.data.task : t))
        );
        setFeedbackMsg({
          type: 'success',
          text: `Task updated to "${targetStatus}".`,
        });
        setTimeout(() => setFeedbackMsg(null), 3500);
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update task status.',
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const handleConfirmCompletion = async (e) => {
    e.preventDefault();
    if (!completingTaskId) return;
    await handleTransitionTask(completingTaskId, 'Completed', completionNotes);
    setCompletingTaskId(null);
    setCompletionNotes('');
  };

  const toggleHistory = (taskId) => {
    setExpandedHistory((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Filtered Tasks
  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'All') return true;
    return t.status === activeTab;
  });

  // Task Stats Counts
  const counts = {
    total: tasks.length,
    assigned: tasks.filter((t) => t.status === 'Assigned').length,
    accepted: tasks.filter((t) => t.status === 'Accepted').length,
    inProgress: tasks.filter((t) => t.status === 'In Progress').length,
    completed: tasks.filter((t) => t.status === 'Completed').length,
  };

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

        {/* Welcome Card & Volunteer Profile */}
        <div className="dashboard-card" style={{ borderTop: '4px solid #2e7d32' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', color: '#1a237e', margin: 0 }}>
                Welcome, {user?.name}!
                <span className="role-badge Volunteer">Volunteer</span>
              </h1>
              <p style={{ color: '#666', marginTop: '0.4rem', fontSize: '0.95rem' }}>
                Manage your service profile, availability, and active disaster relief assignments below.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenEditModal}
              style={{
                background: '#1a237e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 1.1rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              ✏️ Edit Profile & Skills
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '1.2rem 0' }} />

          {/* Profile Details Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.2rem',
            }}
          >
            {/* Availability Box */}
            <div
              style={{
                background: '#f8fafc',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                Availability Status
              </div>
              <div style={{ margin: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background:
                      profile.availability === 'Available'
                        ? '#2e7d32'
                        : profile.availability === 'Busy'
                        ? '#ed6c02'
                        : '#d32f2f',
                  }}
                />
                <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>
                  {profile.availability}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => handleQuickAvailabilityChange('Available')}
                  disabled={actionLoading.availability || profile.availability === 'Available'}
                  style={{
                    flex: 1,
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.2rem',
                    borderRadius: '5px',
                    border: '1px solid #c8e6c9',
                    background: profile.availability === 'Available' ? '#2e7d32' : '#fff',
                    color: profile.availability === 'Available' ? '#fff' : '#2e7d32',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Available
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAvailabilityChange('Busy')}
                  disabled={actionLoading.availability || profile.availability === 'Busy'}
                  style={{
                    flex: 1,
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.2rem',
                    borderRadius: '5px',
                    border: '1px solid #ffe0b2',
                    background: profile.availability === 'Busy' ? '#ed6c02' : '#fff',
                    color: profile.availability === 'Busy' ? '#fff' : '#ed6c02',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Busy
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAvailabilityChange('Unavailable')}
                  disabled={actionLoading.availability || profile.availability === 'Unavailable'}
                  style={{
                    flex: 1,
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.2rem',
                    borderRadius: '5px',
                    border: '1px solid #ffcdd2',
                    background: profile.availability === 'Unavailable' ? '#d32f2f' : '#fff',
                    color: profile.availability === 'Unavailable' ? '#fff' : '#d32f2f',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Off Duty
                </button>
              </div>
            </div>

            {/* Service Area Box */}
            <div
              style={{
                background: '#f8fafc',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                📍 Service Area
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '1.05rem', color: '#1e293b', fontWeight: '600' }}>
                {profile.serviceArea || 'Not specified'}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.4rem' }}>
                📞 Contact: {profile.phone || 'No phone set'}
              </div>
            </div>

            {/* Skills Box */}
            <div
              style={{
                background: '#f8fafc',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                🛠️ Skills & Capabilities
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                {profile.skills && profile.skills.length > 0 ? (
                  profile.skills.map((s, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: '#e0e7ff',
                        color: '#3730a3',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '12px',
                      }}
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No skills listed yet</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Task Counters Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div className="dashboard-card" style={{ padding: '1.2rem', margin: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1a237e' }}>{counts.total}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Total Tasks</div>
          </div>
          <div className="dashboard-card" style={{ padding: '1.2rem', margin: 0, textAlign: 'center', borderBottom: '3px solid #1976d2' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1976d2' }}>{counts.assigned}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Assigned (Pending)</div>
          </div>
          <div className="dashboard-card" style={{ padding: '1.2rem', margin: 0, textAlign: 'center', borderBottom: '3px solid #7b1fa2' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#7b1fa2' }}>{counts.accepted}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Accepted</div>
          </div>
          <div className="dashboard-card" style={{ padding: '1.2rem', margin: 0, textAlign: 'center', borderBottom: '3px solid #f57c00' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#f57c00' }}>{counts.inProgress}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>In Progress</div>
          </div>
          <div className="dashboard-card" style={{ padding: '1.2rem', margin: 0, textAlign: 'center', borderBottom: '3px solid #2e7d32' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2e7d32' }}>{counts.completed}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Completed</div>
          </div>
        </div>

        {/* Tasks Section Card */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1.2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', color: '#1e293b', margin: 0 }}>
                📋 My Assigned Tasks
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                Follow the workflow: <strong>Assigned ➔ Accepted ➔ In Progress ➔ Completed</strong>
              </p>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {['All', 'Assigned', 'Accepted', 'In Progress', 'Completed'].map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: activeTab === tab ? '#1a237e' : '#f1f5f9',
                    color: activeTab === tab ? '#fff' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.8rem',
                    fontWeight: activeTab === tab ? '600' : '500',
                    cursor: 'pointer',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tasks List */}
          {loadingTasks ? (
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
              <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>📭</div>
              <h3 style={{ fontSize: '1.05rem', color: '#334155', margin: '0 0 0.3rem 0' }}>
                No tasks found
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                {activeTab === 'All'
                  ? 'You currently have no tasks assigned by Admins. Stay available!'
                  : `No tasks in "${activeTab}" status.`}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredTasks.map((task) => {
                const isAssigned = task.status === 'Assigned';
                const isAccepted = task.status === 'Accepted';
                const isInProgress = task.status === 'In Progress';
                const isCompleted = task.status === 'Completed';

                return (
                  <div
                    key={task._id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '1.2rem',
                      background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Header: Title & Badges */}
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
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.3rem' }}>
                          📍 {task.serviceArea} • Assigned by: {task.assignedBy?.name || 'Admin'} •{' '}
                          {new Date(task.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Current Status Badge */}
                      <span
                        style={{
                          background: isCompleted
                            ? '#e8f5e9'
                            : isInProgress
                            ? '#fff3e0'
                            : isAccepted
                            ? '#f3e5f5'
                            : '#e3f2fd',
                          color: isCompleted
                            ? '#2e7d32'
                            : isInProgress
                            ? '#e65100'
                            : isAccepted
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

                    {/* Description */}
                    <p style={{ color: '#334155', fontSize: '0.92rem', margin: '0.8rem 0', lineHeight: 1.5 }}>
                      {task.description}
                    </p>

                    {/* Progress Workflow Stepper */}
                    <div
                      style={{
                        margin: '1rem 0',
                        padding: '0.75rem 1rem',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #edf2f7',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          position: 'relative',
                        }}
                      >
                        {[
                          { key: 'Assigned', label: '1. Assigned' },
                          { key: 'Accepted', label: '2. Accepted' },
                          { key: 'In Progress', label: '3. In Progress' },
                          { key: 'Completed', label: '4. Completed' },
                        ].map((step, idx) => {
                          const statesOrder = ['Assigned', 'Accepted', 'In Progress', 'Completed'];
                          const currentIdx = statesOrder.indexOf(task.status);
                          const isReached = currentIdx >= idx;
                          const isCurrent = currentIdx === idx;

                          return (
                            <div
                              key={step.key}
                              style={{
                                textAlign: 'center',
                                flex: 1,
                                position: 'relative',
                              }}
                            >
                              <div
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: isReached ? (isCompleted ? '#2e7d32' : '#1a237e') : '#cbd5e1',
                                  color: '#fff',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  marginBottom: '0.2rem',
                                  boxShadow: isCurrent ? '0 0 0 3px rgba(26,35,126,0.2)' : 'none',
                                }}
                              >
                                {isReached ? '✓' : idx + 1}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: isCurrent ? '700' : '500',
                                  color: isCurrent ? '#1a237e' : isReached ? '#334155' : '#94a3b8',
                                }}
                              >
                                {step.label}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notes if completed or present */}
                    {task.notes && (
                      <div
                        style={{
                          fontSize: '0.85rem',
                          background: '#f1f5f9',
                          padding: '0.6rem 0.8rem',
                          borderRadius: '6px',
                          marginBottom: '0.8rem',
                          color: '#475569',
                        }}
                      >
                        💬 <strong>Notes:</strong> {task.notes}
                      </div>
                    )}

                    {/* Bottom Actions Row */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.6rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleHistory(task._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#1a237e',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        {expandedHistory[task._id] ? 'Hide Audit History' : 'View Audit History'}
                      </button>

                      {/* State Transition Actions */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {isAssigned && (
                          <button
                            type="button"
                            onClick={() => handleTransitionTask(task._id, 'Accepted')}
                            disabled={actionLoading[task._id]}
                            style={{
                              background: '#6a1b9a',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.5rem 1rem',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            {actionLoading[task._id] ? 'Updating...' : '✅ Accept Task'}
                          </button>
                        )}

                        {isAccepted && (
                          <button
                            type="button"
                            onClick={() => handleTransitionTask(task._id, 'In Progress')}
                            disabled={actionLoading[task._id]}
                            style={{
                              background: '#e65100',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.5rem 1rem',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            {actionLoading[task._id] ? 'Updating...' : '🚀 Start Working (In Progress)'}
                          </button>
                        )}

                        {isInProgress && (
                          <button
                            type="button"
                            onClick={() => {
                              setCompletingTaskId(task._id);
                              setCompletionNotes('');
                            }}
                            disabled={actionLoading[task._id]}
                            style={{
                              background: '#2e7d32',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.5rem 1rem',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            🎉 Mark as Completed
                          </button>
                        )}

                        {isCompleted && (
                          <span
                            style={{
                              color: '#2e7d32',
                              fontWeight: '600',
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            ✓ Completed on {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'Finished'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expandable Audit Trail */}
                    {expandedHistory[task._id] && (
                      <div
                        style={{
                          marginTop: '0.8rem',
                          padding: '0.8rem',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>Audit Log:</strong>
                        <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', fontSize: '0.8rem', color: '#475569' }}>
                          {task.statusHistory && task.statusHistory.length > 0 ? (
                            task.statusHistory.map((h, hIdx) => (
                              <li key={hIdx} style={{ marginBottom: '0.3rem' }}>
                                <strong>{h.status}</strong> — {new Date(h.changedAt).toLocaleString()}
                                {h.notes && <span> ({h.notes})</span>}
                              </li>
                            ))
                          ) : (
                            <li>Created as Assigned</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── EDIT PROFILE MODAL ────────────────────────────────────── */}
      {showEditProfile && (
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
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ fontSize: '1.4rem', color: '#1a237e', marginTop: 0, marginBottom: '0.5rem' }}>
              Edit Volunteer Profile
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
              Update your service area, availability, and response capabilities.
            </p>

            <form onSubmit={handleSaveProfile}>
              {/* Service Area */}
              <div className="form-group">
                <label>Service Area / District</label>
                <input
                  type="text"
                  value={editFormData.serviceArea}
                  onChange={(e) => setEditFormData({ ...editFormData, serviceArea: e.target.value })}
                  placeholder="e.g. Dhaka (Mirpur), Sylhet, Feni"
                  required
                />
              </div>

              {/* Availability */}
              <div className="form-group">
                <label>Availability Status</label>
                <select
                  value={editFormData.availability}
                  onChange={(e) => setEditFormData({ ...editFormData, availability: e.target.value })}
                >
                  <option value="Available">🟢 Available (Ready for deployment)</option>
                  <option value="Busy">🟡 Busy (On active assignment)</option>
                  <option value="Unavailable">🔴 Unavailable (Off duty)</option>
                </select>
              </div>

              {/* Phone */}
              <div className="form-group">
                <label>Phone / Emergency Contact</label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="+88017xxxxxxxx"
                />
              </div>

              {/* Skills */}
              <div className="form-group">
                <label>Skills & Capabilities</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.5rem 0' }}>
                  {AVAILABLE_SKILLS_LIST.map((skill) => {
                    const isSelected = editFormData.skills.includes(skill);
                    return (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => handleToggleEditSkill(skill)}
                        style={{
                          background: isSelected ? '#1a237e' : '#fff',
                          color: isSelected ? '#fff' : '#334155',
                          border: isSelected ? '1px solid #1a237e' : '1px solid #cbd5e1',
                          borderRadius: '16px',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: isSelected ? '600' : 'normal',
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {skill}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    value={customSkillInput}
                    onChange={(e) => setCustomSkillInput(e.target.value)}
                    placeholder="Add custom skill"
                    style={{ fontSize: '0.85rem' }}
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
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditProfile(false)}
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
                  disabled={profileSaving}
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
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TASK COMPLETION MODAL ─────────────────────────────────── */}
      {completingTaskId && (
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
            <h2 style={{ fontSize: '1.3rem', color: '#2e7d32', marginTop: 0, marginBottom: '0.5rem' }}>
              Complete Assignment
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Provide any field notes, summary of outcomes, or relief distributed before marking this task as Completed.
            </p>

            <form onSubmit={handleConfirmCompletion}>
              <div className="form-group">
                <label>Field Notes / Summary (Optional)</label>
                <textarea
                  rows="3"
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Delivered 50 food packets and medical kits to families in ward 3."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #e0e0e0',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.2rem' }}>
                <button
                  type="button"
                  onClick={() => setCompletingTaskId(null)}
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
                  style={{
                    background: '#2e7d32',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.2rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Confirm Completed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardVolunteer;
