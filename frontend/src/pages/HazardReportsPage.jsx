import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import axiosInstance from '../api/axiosInstance.js';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const HAZARD_TYPES = [
  'All',
  'Flooded Road',
  'Broken Bridge',
  'Landslide',
  'Submerged Area',
  'Embankment Breach',
  'Power Line Down',
  'Blocked Evacuation Route',
  'Waterlogging',
  'Other',
];

const SEVERITIES = ['All', 'Critical', 'High', 'Moderate', 'Low'];

const DISTRICTS = [
  'All',
  'Feni',
  'Sylhet',
  'Noakhali',
  'Sunamganj',
  'Chittagong',
  "Cox's Bazar",
  'Kurigram',
  'Dhaka',
  'Cumilla',
  'Bhola',
];

const DISTRICT_COORDS = {
  Feni: [23.0159, 91.3986],
  Sylhet: [24.8949, 91.8687],
  Noakhali: [22.8698, 91.0982],
  Sunamganj: [25.0658, 91.395],
  Chittagong: [22.3569, 91.7832],
  "Cox's Bazar": [21.4272, 92.0058],
  Kurigram: [25.8054, 89.6362],
  Dhaka: [23.8103, 90.4125],
  Cumilla: [23.4607, 91.1809],
  Bhola: [22.6859, 90.6482],
};

const INITIAL_FORM = {
  title: '',
  hazardType: 'Flooded Road',
  severity: 'High',
  description: '',
  district: 'Feni',
  upazila: '',
  address: '',
  latitude: '23.015900',
  longitude: '91.398600',
  waterDepthFeet: '0',
  roadPassable: false,
};

const getStatusBadgeStyle = (status) => {
  switch (status) {
    case 'Verified':
      return { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' };
    case 'Community Verified':
      return { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
    case 'Resolved':
      return { background: '#e2e8f0', color: '#334155', border: '1px solid #cbd5e1' };
    case 'Rejected':
      return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
    default:
      return { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
  }
};

const getSeverityBadgeStyle = (severity) => {
  switch (severity) {
    case 'Critical':
      return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
    case 'High':
      return { background: '#ffedd5', color: '#9a3412', border: '1px solid #fdba74' };
    case 'Moderate':
      return { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' };
    default:
      return { background: '#e0f2fe', color: '#075985', border: '1px solid #7dd3fc' };
  }
};

const getHazardTypeIcon = (type) => {
  switch (type) {
    case 'Flooded Road':
      return '🌊';
    case 'Broken Bridge':
      return '🌉';
    case 'Landslide':
      return '⛰️';
    case 'Submerged Area':
      return '🏚️';
    case 'Embankment Breach':
      return '🚧';
    case 'Power Line Down':
      return '⚡';
    case 'Blocked Evacuation Route':
      return '⛔';
    case 'Waterlogging':
      return '💧';
    default:
      return '⚠️';
  }
};

export default function HazardReportsPage() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const isModerator = ['Admin', 'NGO', 'Volunteer'].includes(user?.role);
  const isAdmin = user?.role === 'Admin';
  const apiBase = axiosInstance.defaults.baseURL || '';

  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    communityVerified: 0,
    verified: 0,
    resolved: 0,
    rejected: 0,
    criticalActive: 0,
    avgCredibility: 0,
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [trustProfile, setTrustProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [activeTab, setActiveTab] = useState('all');
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbyActive, setNearbyActive] = useState(false);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');

  const [verifyModalReport, setVerifyModalReport] = useState(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [flagModalReport, setFlagModalReport] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [photoModalSrc, setPhotoModalSrc] = useState(null);
  const [expandedLogs, setExpandedLogs] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const modalMapRef = useRef(null);
  const modalMapInstanceRef = useRef(null);
  const modalMarkerRef = useRef(null);

  const resolvePhotoUrl = (photoUrl) => {
    if (!photoUrl) return null;
    if (
      photoUrl.startsWith('http://') ||
      photoUrl.startsWith('https://') ||
      photoUrl.startsWith('data:')
    ) {
      return photoUrl;
    }
    return `${apiBase}${photoUrl}`;
  };

  const showToast = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback({ type: '', text: '' });
    }, 4500);
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'pending') params.append('status', 'Pending');
      else if (activeTab === 'verified') params.append('status', 'Verified');
      else if (activeTab === 'mine') params.append('mine', 'true');

      if (selectedDistrict !== 'All') params.append('district', selectedDistrict);
      if (selectedType !== 'All') params.append('hazardType', selectedType);
      if (selectedSeverity !== 'All') params.append('severity', selectedSeverity);
      if (sortBy) params.append('sortBy', sortBy);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const [reportsRes, statsRes, trustRes] = await Promise.all([
        axiosInstance.get(`/api/hazards?${params}`),
        axiosInstance.get('/api/hazards/stats'),
        axiosInstance.get('/api/hazards/my-trust'),
      ]);

      if (reportsRes.data?.success) {
        let fetched = reportsRes.data.data || [];
        if (activeTab === 'verified') {
          const communityRes = await axiosInstance.get(
            '/api/hazards?status=Community Verified'
          );
          if (communityRes.data?.success) {
            const mergedMap = new Map();
            [...fetched, ...(communityRes.data.data || [])].forEach((item) => {
              mergedMap.set(item._id, item);
            });
            fetched = Array.from(mergedMap.values());
          }
        }
        setReports(fetched);
      }

      if (statsRes.data?.success) {
        setStats(statsRes.data.stats);
        setLeaderboard(statsRes.data.leaderboard || []);
      }

      if (trustRes.data?.success) {
        setTrustProfile(trustRes.data.trustProfile);
      }
      setNearbyActive(false);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to load hazard reports.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDistrict, selectedType, selectedSeverity, sortBy, searchQuery]);

  useEffect(() => {
    if (activeTab !== 'leaderboard') {
      fetchAllData();
    }
  }, [fetchAllData, activeTab]);

  useEffect(() => {
    if (!socket) return;

    const handleCreated = () => {
      fetchAllData();
    };
    const handleUpdated = (updatedReport) => {
      setReports((prev) =>
        prev.map((r) => (r._id === updatedReport._id ? updatedReport : r))
      );
      axiosInstance
        .get('/api/hazards/stats')
        .then((res) => {
          if (res.data?.success) {
            setStats(res.data.stats);
            setLeaderboard(res.data.leaderboard || []);
          }
        })
        .catch(() => {});
      axiosInstance
        .get('/api/hazards/my-trust')
        .then((res) => {
          if (res.data?.success) setTrustProfile(res.data.trustProfile);
        })
        .catch(() => {});
    };
    const handleDeleted = ({ id }) => {
      setReports((prev) => prev.filter((r) => r._id !== id));
    };

    socket.on('hazardReport:created', handleCreated);
    socket.on('hazardReport:updated', handleUpdated);
    socket.on('hazardReport:deleted', handleDeleted);

    return () => {
      socket.off('hazardReport:created', handleCreated);
      socket.off('hazardReport:updated', handleUpdated);
      socket.off('hazardReport:deleted', handleDeleted);
    };
  }, [socket, fetchAllData]);

  useEffect(() => {
    if (!showSubmitModal) {
      if (modalMapInstanceRef.current) {
        modalMapInstanceRef.current.remove();
        modalMapInstanceRef.current = null;
        modalMarkerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!modalMapRef.current || modalMapInstanceRef.current) return;
      const lat = parseFloat(formData.latitude) || 23.0159;
      const lng = parseFloat(formData.longitude) || 91.3986;

      const map = L.map(modalMapRef.current, {
        center: [lat, lng],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup('Hazard Location').openPopup();
      modalMarkerRef.current = marker;

      map.on('click', (e) => {
        const nextLat = e.latlng.lat.toFixed(6);
        const nextLng = e.latlng.lng.toFixed(6);
        setFormData((prev) => ({
          ...prev,
          latitude: nextLat,
          longitude: nextLng,
        }));
        if (modalMarkerRef.current) {
          modalMarkerRef.current.setLatLng([e.latlng.lat, e.latlng.lng]);
        }
        setGpsStatus(`Pin dropped at ${nextLat}, ${nextLng}`);
      });

      map.invalidateSize();
      modalMapInstanceRef.current = map;
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [showSubmitModal, formData.latitude, formData.longitude]);

  const handleDistrictFormChange = (nextDistrict) => {
    const coords = DISTRICT_COORDS[nextDistrict];
    setFormData((prev) => ({
      ...prev,
      district: nextDistrict,
      latitude: coords ? coords[0].toFixed(6) : prev.latitude,
      longitude: coords ? coords[1].toFixed(6) : prev.longitude,
    }));
    if (coords && modalMapInstanceRef.current && modalMarkerRef.current) {
      modalMarkerRef.current.setLatLng(coords);
      modalMapInstanceRef.current.flyTo(coords, 12, { duration: 0.8 });
    }
  };

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation is not supported by your browser.');
      return;
    }
    setGpsStatus('Acquiring GPS position...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latStr = pos.coords.latitude.toFixed(6);
        const lngStr = pos.coords.longitude.toFixed(6);
        setFormData((prev) => ({ ...prev, latitude: latStr, longitude: lngStr }));
        if (modalMapInstanceRef.current && modalMarkerRef.current) {
          modalMarkerRef.current.setLatLng([pos.coords.latitude, pos.coords.longitude]);
          modalMapInstanceRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 14, {
            duration: 1.0,
          });
        }
        setGpsStatus(`GPS locked: ${latStr}, ${lngStr}`);
      },
      (err) => {
        setGpsStatus(`GPS unavailable: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'Photo size must be under 5 MB.');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      showToast('error', 'Title and hazard description are required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('title', formData.title.trim());
      payload.append('hazardType', formData.hazardType);
      payload.append('severity', formData.severity);
      payload.append('description', formData.description.trim());
      payload.append('district', formData.district);
      payload.append('upazila', formData.upazila.trim());
      payload.append('address', formData.address.trim());
      payload.append('latitude', formData.latitude);
      payload.append('longitude', formData.longitude);
      payload.append('waterDepthFeet', formData.waterDepthFeet || '0');
      payload.append('roadPassable', String(formData.roadPassable));
      if (photoFile) {
        payload.append('photo', photoFile);
      }

      const res = await axiosInstance.post('/api/hazards', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setShowSubmitModal(false);
        setFormData(INITIAL_FORM);
        setPhotoFile(null);
        setPhotoPreview(null);
        setGpsStatus('');
        showToast('success', 'Hazard report submitted! Community verification is now open.');
        fetchAllData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to submit hazard report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNearbyFilter = () => {
    if (nearbyActive) {
      fetchAllData();
      return;
    }
    if (!navigator.geolocation) {
      showToast('error', 'Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await axiosInstance.get(
            `/api/hazards/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radius=25`
          );
          if (res.data?.success) {
            setReports(res.data.data || []);
            setNearbyActive(true);
            showToast(
              'success',
              `Showing ${res.data.count} hazard reports within 25 km of your GPS location.`
            );
          }
        } catch (err) {
          showToast('error', err.response?.data?.message || 'Nearby search failed.');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        showToast('error', `Could not get GPS location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleUpvote = async (reportId) => {
    setActionLoadingId(reportId);
    try {
      const res = await axiosInstance.post(`/api/hazards/${reportId}/upvote`);
      if (res.data?.success) {
        setReports((prev) => prev.map((r) => (r._id === reportId ? res.data.data : r)));
        showToast('success', res.data.message);
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Could not toggle upvote.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!verifyModalReport) return;
    setActionLoadingId(verifyModalReport._id);
    try {
      const res = await axiosInstance.post(
        `/api/hazards/${verifyModalReport._id}/verify`,
        { note: verifyNote.trim() }
      );
      if (res.data?.success) {
        setReports((prev) =>
          prev.map((r) => (r._id === verifyModalReport._id ? res.data.data : r))
        );
        setVerifyModalReport(null);
        setVerifyNote('');
        showToast('success', res.data.message);
        fetchAllData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Verification failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleFlagSubmit = async (e) => {
    e.preventDefault();
    if (!flagModalReport) return;
    setActionLoadingId(flagModalReport._id);
    try {
      const res = await axiosInstance.post(
        `/api/hazards/${flagModalReport._id}/flag-fake`,
        { reason: flagReason.trim() || 'Inaccurate or misleading hazard report' }
      );
      if (res.data?.success) {
        setReports((prev) =>
          prev.map((r) => (r._id === flagModalReport._id ? res.data.data : r))
        );
        setFlagModalReport(null);
        setFlagReason('');
        showToast('success', res.data.message);
        fetchAllData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Could not flag report.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStatusChange = async (reportId, nextStatus) => {
    setActionLoadingId(reportId);
    try {
      const res = await axiosInstance.patch(`/api/hazards/${reportId}/status`, {
        status: nextStatus,
      });
      if (res.data?.success) {
        setReports((prev) => prev.map((r) => (r._id === reportId ? res.data.data : r)));
        showToast('success', res.data.message);
        fetchAllData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Status update failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to permanently delete this hazard report?')) {
      return;
    }
    setActionLoadingId(reportId);
    try {
      const res = await axiosInstance.delete(`/api/hazards/${reportId}`);
      if (res.data?.success) {
        setReports((prev) => prev.filter((r) => r._id !== reportId));
        showToast('success', 'Hazard report deleted.');
        fetchAllData();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to delete hazard report.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const myScore = trustProfile?.trustScore ?? user?.trustScore ?? 50;
  const myTier = trustProfile?.trustTier || {
    tier: 'Community Member',
    color: '#334155',
    bgColor: '#f1f5f9',
    badgeIcon: '👤',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <Navbar />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        {feedback.text && (
          <div
            style={{
              padding: '0.85rem 1.2rem',
              borderRadius: '10px',
              marginBottom: '1rem',
              fontWeight: 600,
              fontSize: '0.92rem',
              background: feedback.type === 'error' ? '#fee2e2' : '#d1fae5',
              color: feedback.type === 'error' ? '#991b1b' : '#065f46',
              border:
                feedback.type === 'error' ? '1px solid #fca5a5' : '1px solid #6ee7b7',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback({ type: '', text: '' })}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                color: 'inherit',
                fontSize: '1rem',
              }}
            >
              ✕
            </button>
          </div>
        )}

        <div
          style={{
            background: 'linear-gradient(135deg, #1a237e 0%, #0f172a 100%)',
            color: '#ffffff',
            borderRadius: '14px',
            padding: '1.6rem',
            marginBottom: '1.25rem',
            boxShadow: '0 6px 20px rgba(15, 23, 42, 0.18)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem',
          }}
        >
          <div style={{ flex: '1 1 420px' }}>
            <span
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#fcd34d',
                border: '1px solid rgba(252, 211, 77, 0.45)',
                padding: '0.2rem 0.65rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Module 3 · Community Safety Network
            </span>
            <h1 style={{ fontSize: '1.65rem', margin: '0.55rem 0 0.35rem', fontWeight: 800 }}>
              ⚠️ Crowdsourced Hazard Reports & Trust Network
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', margin: 0, maxWidth: '640px' }}>
              Report flooded roads, broken bridges, landslides, and downed power lines with
              photo proof. Community upvotes and responder verification boost reporter trust
              scores and keep fake reports off the map.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                style={{
                  background: '#f59e0b',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.65rem 1.25rem',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(245, 158, 11, 0.35)',
                }}
              >
                + Report a Hazard
              </button>
              <Link
                to="/map"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px',
                  padding: '0.65rem 1.1rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                }}
              >
                🗺️ View Live Disaster Map
              </Link>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '12px',
              padding: '1rem 1.2rem',
              minWidth: '270px',
              flex: '0 1 320px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.45rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>
                Your Reporter Trust Score
              </span>
              <span
                style={{
                  background: myTier.bgColor,
                  color: myTier.color,
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px',
                }}
              >
                {myTier.badgeIcon} {myTier.tier}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
                {myScore}
              </span>
              <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>/ 100</span>
            </div>

            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255,255,255,0.16)',
                borderRadius: '99px',
                overflow: 'hidden',
                margin: '0.45rem 0 0.65rem',
              }}
            >
              <div
                style={{
                  width: `${myScore}%`,
                  height: '100%',
                  background:
                    myScore >= 70
                      ? '#10b981'
                      : myScore >= 40
                      ? '#f59e0b'
                      : '#ef4444',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.4rem',
                fontSize: '0.75rem',
                color: '#cbd5e1',
                textAlign: 'center',
              }}
            >
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.3rem', borderRadius: '6px' }}>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>
                  {trustProfile?.hazardStats?.reportsSubmitted ?? 0}
                </div>
                Submitted
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.3rem', borderRadius: '6px' }}>
                <div style={{ fontWeight: 800, color: '#34d399', fontSize: '0.9rem' }}>
                  {trustProfile?.hazardStats?.reportsVerified ?? 0}
                </div>
                Verified
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.3rem', borderRadius: '6px' }}>
                <div style={{ fontWeight: 800, color: '#93c5fd', fontSize: '0.9rem' }}>
                  {trustProfile?.hazardStats?.verificationsCast ?? 0}
                </div>
                Checks Cast
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}
        >
          {[
            { label: 'Total Reports', val: stats.total, color: '#1e293b' },
            { label: 'Officially Verified', val: stats.verified, color: '#059669' },
            { label: 'Community Verified', val: stats.communityVerified, color: '#2563eb' },
            { label: 'Pending Review', val: stats.pending, color: '#d97706' },
            { label: 'Critical / High Active', val: stats.criticalActive, color: '#dc2626' },
            { label: 'Avg Credibility', val: `${stats.avgCredibility}%`, color: '#7c3aed' },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: '0.9rem 1rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                {card.label}
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: card.color }}>
                {card.val}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.25rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '0.8rem',
              marginBottom: '0.8rem',
            }}
          >
            {[
              { id: 'all', label: `All Reports (${stats.total})` },
              { id: 'pending', label: `Pending Review (${stats.pending})` },
              {
                id: 'verified',
                label: `Verified (${stats.verified + stats.communityVerified})`,
              },
              { id: 'mine', label: 'My Reports' },
              { id: 'leaderboard', label: '🛡️ Trust Leaderboard & Rules' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  border: activeTab === tab.id ? '1px solid #1a237e' : '1px solid #cbd5e1',
                  background: activeTab === tab.id ? '#1a237e' : '#f8fafc',
                  color: activeTab === tab.id ? '#ffffff' : '#334155',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab !== 'leaderboard' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '0.65rem',
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                placeholder="Search road, bridge, area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                }}
              />

              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#fff',
                }}
              >
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d === 'All' ? 'All Districts' : d}
                  </option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#fff',
                }}
              >
                {HAZARD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'All' ? 'All Hazard Types' : t}
                  </option>
                ))}
              </select>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#fff',
                }}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'All' ? 'All Severities' : s}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#fff',
                }}
              >
                <option value="newest">Sort: Newest First</option>
                <option value="credibility">Sort: Highest Credibility</option>
                <option value="upvotes">Sort: Most Upvoted / Verified</option>
                <option value="severity">Sort: Highest Severity</option>
              </select>

              <button
                type="button"
                onClick={handleNearbyFilter}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: nearbyActive ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  background: nearbyActive ? '#e0f2fe' : '#f8fafc',
                  color: nearbyActive ? '#0369a1' : '#334155',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                {nearbyActive ? '📍 Nearby (25 km) ✓' : '📍 Nearby Hazards'}
              </button>
            </div>
          )}
        </div>

        {activeTab === 'leaderboard' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '1.35rem',
                border: '1px solid #e2e8f0',
              }}
            >
              <h2 style={{ fontSize: '1.15rem', color: '#0f172a', marginBottom: '0.85rem' }}>
                🏆 Top Trusted Community Reporters
              </h2>
              {leaderboard.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  No hazard reporters ranked yet. Submit and verify reports to appear here.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {leaderboard.map((entry, idx) => (
                    <div
                      key={entry._id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          #{idx + 1} {entry.name}{' '}
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: '#475569',
                              fontWeight: 600,
                            }}
                          >
                            ({entry.role})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {entry.hazardStats?.reportsSubmitted || 0} reports ·{' '}
                          {entry.hazardStats?.reportsVerified || 0} verified ·{' '}
                          {entry.hazardStats?.verificationsCast || 0} checks
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1a237e' }}>
                          {entry.trustScore}/100
                        </div>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '10px',
                            background: entry.trustTier.bgColor,
                            color: entry.trustTier.color,
                          }}
                        >
                          {entry.trustTier.badgeIcon} {entry.trustTier.tier}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '1.35rem',
                border: '1px solid #e2e8f0',
              }}
            >
              <h2 style={{ fontSize: '1.15rem', color: '#0f172a', marginBottom: '0.85rem' }}>
                🛡️ How Reporter Trust & Anti-Fake Scoring Works
              </h2>
              <ul style={{ paddingLeft: '1.2rem', color: '#334155', lineHeight: 1.75, fontSize: '0.9rem' }}>
                <li>
                  <strong>Starting Score (50/100):</strong> Every registered member begins as a
                  Community Member with a neutral 50 trust score.
                </li>
                <li>
                  <strong>Upvotes (+2 trust):</strong> When peers upvote a valid hazard report,
                  both the report credibility and the reporter&apos;s trust increase.
                </li>
                <li>
                  <strong>Community Verification (+4 trust):</strong> Reports reaching 3 upvotes
                  or 2 community confirmations auto-promote to <em>Community Verified</em>.
                </li>
                <li>
                  <strong>Official Verification (+6 trust):</strong> Volunteers, NGOs, and Admins
                  can officially verify reports on the ground.
                </li>
                <li>
                  <strong>Anti-Fake Protection (-10 to -15 trust):</strong> Reports flagged fake
                  by 3 community members or rejected by responders are hidden from the map and
                  reduce the reporter&apos;s trust score.
                </li>
              </ul>
            </div>
          </div>
        ) : loading ? (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '3rem',
              textAlign: 'center',
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            ⏳ Loading crowdsourced hazard reports...
          </div>
        ) : reports.length === 0 ? (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '3rem 1.5rem',
              textAlign: 'center',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛣️</div>
            <h3 style={{ color: '#0f172a', marginBottom: '0.35rem' }}>
              No hazard reports match your filters
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Be the first to alert your community about flooded roads, broken bridges, or
              blocked routes.
            </p>
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              style={{
                background: '#1a237e',
                color: '#fff',
                border: 'none',
                padding: '0.6rem 1.2rem',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Submit Hazard Report
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '1rem',
            }}
          >
            {reports.map((report) => {
              const reporterId = report.reporter?._id || report.reporter;
              const isOwnReport = user && String(reporterId) === String(user._id || user.id);
              const photoSrc = resolvePhotoUrl(report.photoUrl);
              const trustTier = report.reporterTrustTier || {
                tier: 'Community Member',
                color: '#334155',
                bgColor: '#f1f5f9',
                badgeIcon: '👤',
              };
              const isBusy = actionLoadingId === report._id;

              return (
                <div
                  key={report._id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    border:
                      report.status === 'Rejected'
                        ? '1px solid #fca5a5'
                        : report.status === 'Verified'
                        ? '1px solid #6ee7b7'
                        : '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    opacity: report.status === 'Rejected' ? 0.78 : 1,
                  }}
                >
                  {photoSrc && (
                    <div
                      onClick={() => setPhotoModalSrc(photoSrc)}
                      style={{
                        height: '180px',
                        width: '100%',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        background: '#0f172a',
                      }}
                    >
                      <img
                        src={photoSrc}
                        alt={report.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          background: 'rgba(15,23,42,0.75)',
                          color: '#fff',
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontWeight: 600,
                        }}
                      >
                        🔍 View Photo
                      </span>
                    </div>
                  )}

                  <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.4rem',
                        flexWrap: 'wrap',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          padding: '0.18rem 0.55rem',
                          borderRadius: '12px',
                          background: '#f1f5f9',
                          color: '#1e293b',
                        }}
                      >
                        {getHazardTypeIcon(report.hazardType)} {report.hazardType}
                      </span>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            ...getSeverityBadgeStyle(report.severity),
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.18rem 0.5rem',
                            borderRadius: '12px',
                          }}
                        >
                          {report.severity}
                        </span>
                        <span
                          style={{
                            ...getStatusBadgeStyle(report.status),
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.18rem 0.5rem',
                            borderRadius: '12px',
                          }}
                        >
                          {report.status}
                        </span>
                      </div>
                    </div>

                    <h3
                      style={{
                        fontSize: '1.05rem',
                        color: '#0f172a',
                        margin: '0 0 0.35rem',
                        fontWeight: 800,
                        lineHeight: 1.35,
                      }}
                    >
                      {report.title}
                    </h3>

                    <p
                      style={{
                        fontSize: '0.86rem',
                        color: '#475569',
                        margin: '0 0 0.75rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {report.description}
                    </p>

                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '0.55rem 0.7rem',
                        fontSize: '0.8rem',
                        color: '#334155',
                        marginBottom: '0.7rem',
                      }}
                    >
                      <div>
                        <strong>📍 Location:</strong>{' '}
                        {[report.location?.address, report.location?.upazila, report.location?.district]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.75rem',
                          marginTop: '0.3rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          🚦{' '}
                          <strong
                            style={{ color: report.roadPassable ? '#059669' : '#dc2626' }}
                          >
                            {report.roadPassable ? 'Partially Passable' : 'Impassable / Blocked'}
                          </strong>
                        </span>
                        {report.waterDepthFeet > 0 && (
                          <span>💧 Depth: ~{report.waterDepthFeet} ft</span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        marginBottom: '0.65rem',
                        paddingBottom: '0.6rem',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                          {report.reporter?.name || report.reporterName || 'Citizen'}
                        </div>
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: '0.15rem',
                            fontSize: '0.71rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '10px',
                            background: trustTier.bgColor,
                            color: trustTier.color,
                          }}
                        >
                          {trustTier.badgeIcon} Trust {report.reporterTrustScore}/100 · {trustTier.tier}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                          Credibility
                        </div>
                        <div
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            color:
                              report.credibilityScore >= 70
                                ? '#059669'
                                : report.credibilityScore >= 40
                                ? '#d97706'
                                : '#dc2626',
                          }}
                        >
                          {report.credibilityScore}%
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '0.45rem',
                        flexWrap: 'wrap',
                        marginTop: 'auto',
                      }}
                    >
                      <button
                        type="button"
                        disabled={isOwnReport || isBusy || report.status === 'Rejected'}
                        onClick={() => handleUpvote(report._id)}
                        title={
                          isOwnReport
                            ? 'You cannot upvote your own report'
                            : 'Upvote to confirm this hazard'
                        }
                        style={{
                          flex: '1 1 auto',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '7px',
                          border: report.hasUpvoted
                            ? '1px solid #1d4ed8'
                            : '1px solid #cbd5e1',
                          background: report.hasUpvoted ? '#dbeafe' : '#ffffff',
                          color: report.hasUpvoted ? '#1e40af' : '#1e293b',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor:
                            isOwnReport || report.status === 'Rejected'
                              ? 'not-allowed'
                              : 'pointer',
                          opacity: isOwnReport || report.status === 'Rejected' ? 0.55 : 1,
                        }}
                      >
                        👍 Upvote ({report.upvoteCount || 0})
                      </button>

                      <button
                        type="button"
                        disabled={
                          isOwnReport ||
                          isBusy ||
                          report.hasVerified ||
                          report.status === 'Rejected'
                        }
                        onClick={() => {
                          setVerifyModalReport(report);
                          setVerifyNote('');
                        }}
                        title={
                          isOwnReport
                            ? 'You cannot verify your own report'
                            : report.hasVerified
                            ? 'Already verified by you'
                            : 'Verify this hazard report'
                        }
                        style={{
                          flex: '1 1 auto',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '7px',
                          border: report.hasVerified
                            ? '1px solid #059669'
                            : '1px solid #10b981',
                          background: report.hasVerified ? '#d1fae5' : '#ecfdf5',
                          color: '#065f46',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor:
                            isOwnReport || report.hasVerified || report.status === 'Rejected'
                              ? 'not-allowed'
                              : 'pointer',
                          opacity:
                            isOwnReport || report.hasVerified || report.status === 'Rejected'
                              ? 0.6
                              : 1,
                        }}
                      >
                        ✅ {report.hasVerified ? 'Verified' : 'Verify'} ({report.verificationCount || 0})
                      </button>

                      <button
                        type="button"
                        disabled={isOwnReport || isBusy || report.hasFlagged}
                        onClick={() => {
                          setFlagModalReport(report);
                          setFlagReason('');
                        }}
                        title={
                          isOwnReport
                            ? 'You cannot flag your own report'
                            : 'Flag as inaccurate or fake'
                        }
                        style={{
                          padding: '0.45rem 0.65rem',
                          borderRadius: '7px',
                          border: '1px solid #fecaca',
                          background: report.hasFlagged ? '#fee2e2' : '#fff5f5',
                          color: '#991b1b',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor:
                            isOwnReport || report.hasFlagged ? 'not-allowed' : 'pointer',
                          opacity: isOwnReport || report.hasFlagged ? 0.6 : 1,
                        }}
                      >
                        🚩 ({report.fakeFlagCount || 0})
                      </button>
                    </div>

                    {(isModerator || (isOwnReport && report.status === 'Pending')) && (
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.4rem',
                          flexWrap: 'wrap',
                          marginTop: '0.6rem',
                          paddingTop: '0.6rem',
                          borderTop: '1px dashed #e2e8f0',
                        }}
                      >
                        {isModerator && report.status !== 'Verified' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusChange(report._id, 'Verified')}
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              padding: '0.3rem 0.55rem',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#059669',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            Official Verify
                          </button>
                        )}
                        {isModerator && report.status !== 'Resolved' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusChange(report._id, 'Resolved')}
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              padding: '0.3rem 0.55rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#f1f5f9',
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            Mark Resolved
                          </button>
                        )}
                        {isModerator && report.status !== 'Rejected' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusChange(report._id, 'Rejected')}
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              padding: '0.3rem 0.55rem',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#dc2626',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            Reject Fake
                          </button>
                        )}
                        {(isAdmin || (isOwnReport && report.status === 'Pending')) && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeleteReport(report._id)}
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              padding: '0.3rem 0.55rem',
                              borderRadius: '6px',
                              border: '1px solid #fca5a5',
                              background: '#fff',
                              color: '#b91c1c',
                              cursor: 'pointer',
                              marginLeft: 'auto',
                            }}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    )}

                    {(report.verifications?.length > 0 || report.fakeFlags?.length > 0) && (
                      <div style={{ marginTop: '0.55rem' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedLogs((prev) => ({
                              ...prev,
                              [report._id]: !prev[report._id],
                            }))
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1a237e',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          {expandedLogs[report._id]
                            ? '▲ Hide Verification & Flag Log'
                            : `▼ View Verification Log (${report.verifications?.length || 0} checks, ${report.fakeFlags?.length || 0} flags)`}
                        </button>

                        {expandedLogs[report._id] && (
                          <div
                            style={{
                              marginTop: '0.45rem',
                              background: '#f8fafc',
                              borderRadius: '8px',
                              padding: '0.55rem',
                              fontSize: '0.76rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.35rem',
                            }}
                          >
                            {(report.verifications || []).map((v, i) => (
                              <div key={`v-${i}`} style={{ color: '#065f46' }}>
                                ✅ <strong>{v.userName}</strong> ({v.userRole})
                                {v.note ? `: "${v.note}"` : ' confirmed this hazard.'}
                              </div>
                            ))}
                            {(report.fakeFlags || []).map((f, i) => (
                              <div key={`f-${i}`} style={{ color: '#991b1b' }}>
                                🚩 <strong>{f.userName}</strong> flagged: &quot;{f.reason}&quot;
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showSubmitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', color: '#0f172a', margin: 0 }}>
                ⚠️ Submit Crowdsourced Hazard Report
              </h2>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.65rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Hazard Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Submerged Approach Road Near Muhuri Bridge"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Hazard Type *
                  </label>
                  <select
                    value={formData.hazardType}
                    onChange={(e) => setFormData({ ...formData, hazardType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                    }}
                  >
                    {HAZARD_TYPES.filter((t) => t !== 'All').map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Severity *
                  </label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                    }}
                  >
                    {SEVERITIES.filter((s) => s !== 'All').map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    District *
                  </label>
                  <select
                    value={formData.district}
                    onChange={(e) => handleDistrictFormChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                    }}
                  >
                    {DISTRICTS.filter((d) => d !== 'All').map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Upazila / Area
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Parshuram"
                    value={formData.upazila}
                    onChange={(e) => setFormData({ ...formData, upazila: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Water Depth (ft)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.waterDepthFeet}
                    onChange={(e) => setFormData({ ...formData, waterDepthFeet: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Road / Landmark Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Fulchhari Bazar Culvert"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                  }}
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.35rem',
                  }}
                >
                  <label style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    Pin Hazard on Map or Auto-Detect GPS *
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectGPS}
                    style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      border: '1px solid #7dd3fc',
                      borderRadius: '6px',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    📍 Use My GPS
                  </button>
                </div>

                <div
                  ref={modalMapRef}
                  style={{
                    height: '200px',
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    marginBottom: '0.45rem',
                  }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Latitude"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    style={{
                      padding: '0.45rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                    }}
                  />
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Longitude"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    style={{
                      padding: '0.45rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                    }}
                  />
                </div>
                {gpsStatus && (
                  <div style={{ fontSize: '0.76rem', color: '#0369a1', marginTop: '0.25rem' }}>
                    {gpsStatus}
                  </div>
                )}
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.roadPassable}
                  onChange={(e) => setFormData({ ...formData, roadPassable: e.target.checked })}
                />
                Route is still partially passable (boats / high-clearance vehicles)
              </label>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Description & Safety Advice *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the flood level, bridge damage, or alternate safe route..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Photo Evidence (Optional, boosts credibility by +15%)
                </label>
                <input type="file" accept="image/*" onChange={handlePhotoSelect} />
                {photoPreview && (
                  <div style={{ marginTop: '0.5rem', position: 'relative', display: 'inline-block' }}>
                    <img
                      src={photoPreview}
                      alt="Hazard preview"
                      style={{
                        maxHeight: '140px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                      }}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.6rem 1.35rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#1a237e',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: submitting ? 'wait' : 'pointer',
                  }}
                >
                  {submitting ? 'Submitting...' : 'Publish Hazard Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {verifyModalReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.35rem',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', color: '#065f46' }}>
              ✅ Verify Hazard Report
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '0.8rem' }}>
              Confirming <strong>{verifyModalReport.title}</strong> increases the reporter&apos;s
              trust score and alerts responders.
            </p>
            <form onSubmit={handleVerifySubmit}>
              <textarea
                rows={3}
                placeholder="Optional field note (e.g. Confirmed water depth on site, alternate route open)..."
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  marginBottom: '0.9rem',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setVerifyModalReport(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.15rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#059669',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Confirm Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {flagModalReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.35rem',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', color: '#991b1b' }}>
              🚩 Flag Inaccurate / Fake Report
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '0.8rem' }}>
              Reports receiving 3 fake flags are automatically rejected and penalize the
              reporter&apos;s trust score.
            </p>
            <form onSubmit={handleFlagSubmit}>
              <textarea
                rows={3}
                required
                placeholder="Why is this report fake or outdated? (e.g. Old photo, road is dry and clear)"
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  marginBottom: '0.9rem',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setFlagModalReport(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.15rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Submit Flag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {photoModalSrc && (
        <div
          onClick={() => setPhotoModalSrc(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.82)',
            zIndex: 2500,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1.5rem',
            cursor: 'pointer',
          }}
        >
          <img
            src={photoModalSrc}
            alt="Full hazard evidence"
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              borderRadius: '10px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      )}
    </div>
  );
}
