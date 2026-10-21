import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';

export default function SheltersPage() {
  const { user } = useAuth();
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [userCoords, setUserCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [nearestShelter, setNearestShelter] = useState(null);
  const [nearestError, setNearestError] = useState('');

  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [status, setStatus] = useState('');
  const [filterToilet, setFilterToilet] = useState(false);
  const [filterMedical, setFilterMedical] = useState(false);
  const [filterWomenOnly, setFilterWomenOnly] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShelter, setEditingShelter] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    address: '',
    district: '',
    totalCapacity: '',
    occupiedCapacity: '0',
    toilet: true,
    medicalCare: false,
    womenOnlySection: true,
    drinkingWater: true,
    electricityBackup: false,
    status: 'Open',
    contactPerson: '',
    contactPhone: '',
    notes: '',
  });

  const fetchShelters = useCallback(async (coords = userCoords) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (district) params.append('district', district);
      if (status) params.append('status', status);
      if (filterToilet) params.append('toilet', 'true');
      if (filterMedical) params.append('medicalCare', 'true');
      if (filterWomenOnly) params.append('womenOnlySection', 'true');

      if (coords?.lat && coords?.lng) {
        params.append('userLat', coords.lat);
        params.append('userLng', coords.lng);
      }

      const res = await axiosInstance.get(`/api/shelters?${params}`);
      if (res.data.success) {
        setShelters(res.data.data);
      }
    } catch {
      setError('Unable to load shelters at this time.');
    } finally {
      setLoading(false);
    }
  }, [search, district, status, filterToilet, filterMedical, filterWomenOnly, userCoords]);

  useEffect(() => {
    fetchShelters();
  }, [fetchShelters]);

  const handleDetectLocationAndFindNearest = () => {
    setNearestError('');
    if (!navigator.geolocation) {
      setNearestError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserCoords(coords);

        try {
          const res = await axiosInstance.get(
            `/api/shelters/nearest?latitude=${coords.lat}&longitude=${coords.lng}`
          );
          if (res.data.success) {
            setNearestShelter(res.data.data);
          }
        } catch (err) {
          setNearestError(err.response?.data?.message || 'No nearby shelter found.');
        } finally {
          setGpsLoading(false);
        }

        fetchShelters(coords);
      },
      () => {
        setGpsLoading(false);
        setNearestError('Location permission denied. Please allow GPS access.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      latitude: '',
      longitude: '',
      address: '',
      district: '',
      totalCapacity: '',
      occupiedCapacity: '0',
      toilet: true,
      medicalCare: false,
      womenOnlySection: true,
      drinkingWater: true,
      electricityBackup: false,
      status: 'Open',
      contactPerson: '',
      contactPhone: '',
      notes: '',
    });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (shelter) => {
    setEditingShelter(shelter);
    setFormData({
      name: shelter.name,
      latitude: shelter.location?.latitude || '',
      longitude: shelter.location?.longitude || '',
      address: shelter.location?.address || '',
      district: shelter.location?.district || '',
      totalCapacity: shelter.capacity?.total || '',
      occupiedCapacity: shelter.capacity?.occupied || 0,
      toilet: Boolean(shelter.facilities?.toilet),
      medicalCare: Boolean(shelter.facilities?.medicalCare),
      womenOnlySection: Boolean(shelter.facilities?.womenOnlySection),
      drinkingWater: Boolean(shelter.facilities?.drinkingWater),
      electricityBackup: Boolean(shelter.facilities?.electricityBackup),
      status: shelter.status || 'Open',
      contactPerson: shelter.contactPerson || '',
      contactPhone: shelter.contactPhone || '',
      notes: shelter.notes || '',
    });
    setShowEditModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setActionMsg({ type: '', text: '' });

    try {
      const payload = {
        name: formData.name,
        location: {
          latitude: formData.latitude,
          longitude: formData.longitude,
          address: formData.address,
          district: formData.district,
        },
        capacity: {
          total: formData.totalCapacity,
          occupied: formData.occupiedCapacity,
        },
        facilities: {
          toilet: formData.toilet,
          medicalCare: formData.medicalCare,
          womenOnlySection: formData.womenOnlySection,
          drinkingWater: formData.drinkingWater,
          electricityBackup: formData.electricityBackup,
        },
        status: formData.status,
        contactPerson: formData.contactPerson,
        contactPhone: formData.contactPhone,
        notes: formData.notes,
      };

      await axiosInstance.post('/api/shelters', payload);
      setShowCreateModal(false);
      setActionMsg({ type: 'success', text: 'Shelter added successfully.' });
      fetchShelters();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to add shelter.' });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingShelter) return;
    setFormSubmitting(true);
    setActionMsg({ type: '', text: '' });

    try {
      const payload = {
        name: formData.name,
        location: {
          latitude: formData.latitude,
          longitude: formData.longitude,
          address: formData.address,
          district: formData.district,
        },
        capacity: {
          total: formData.totalCapacity,
          occupied: formData.occupiedCapacity,
        },
        facilities: {
          toilet: formData.toilet,
          medicalCare: formData.medicalCare,
          womenOnlySection: formData.womenOnlySection,
          drinkingWater: formData.drinkingWater,
          electricityBackup: formData.electricityBackup,
        },
        status: formData.status,
        contactPerson: formData.contactPerson,
        contactPhone: formData.contactPhone,
        notes: formData.notes,
      };

      await axiosInstance.put(`/api/shelters/${editingShelter._id}`, payload);
      setShowEditModal(false);
      setEditingShelter(null);
      setActionMsg({ type: 'success', text: 'Shelter updated successfully.' });
      fetchShelters();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update shelter.' });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete shelter "${name}"?`)) return;
    try {
      await axiosInstance.delete(`/api/shelters/${id}`);
      setActionMsg({ type: 'success', text: 'Shelter deleted successfully.' });
      fetchShelters();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to delete shelter.' });
    }
  };

  const getCapacityColor = (rate) => {
    if (rate >= 90) return '#dc2626';
    if (rate >= 70) return '#ea580c';
    return '#16a34a';
  };

  const getDirectionsUrl = (lat, lng) => {
    if (userCoords?.lat && userCoords?.lng) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${lat},${lng}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  };

  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-content">
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)',
            borderRadius: '12px',
            padding: '2rem',
            color: 'white',
            marginBottom: '2rem',
            boxShadow: '0 8px 24px rgba(30,58,138,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '2rem' }}>🏠</span>
              <h1 style={{ fontSize: '1.7rem', margin: 0, fontWeight: 800 }}>
                Disaster Relief Shelters Directory
              </h1>
            </div>
            <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem', maxWidth: 600 }}>
              Find safe refuge centers, live capacity availability, dedicated medical care, separate toilets, and women-only safe spaces.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleDetectLocationAndFindNearest}
              disabled={gpsLoading}
              style={{
                background: '#ffffff',
                color: '#1e3a8a',
                border: 'none',
                borderRadius: '8px',
                padding: '0.8rem 1.4rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <span>📍</span>
              {gpsLoading ? 'Locating Nearest Shelter...' : 'Find Nearest Shelter to Me'}
            </button>

            {user?.role === 'Admin' && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  border: '1.5px solid rgba(255,255,255,0.5)',
                  borderRadius: '8px',
                  padding: '0.8rem 1.2rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>➕</span> Add New Shelter
              </button>
            )}
          </div>
        </div>

        {actionMsg.text && (
          <div
            style={{
              padding: '0.85rem 1.2rem',
              borderRadius: '8px',
              marginBottom: '1.2rem',
              background: actionMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
              color: actionMsg.type === 'error' ? '#b91c1c' : '#15803d',
              border: `1px solid ${actionMsg.type === 'error' ? '#fca5a5' : '#86efac'}`,
              fontWeight: 600,
            }}
          >
            {actionMsg.text}
          </div>
        )}

        {nearestError && (
          <div
            style={{
              padding: '0.85rem 1.2rem',
              borderRadius: '8px',
              marginBottom: '1.2rem',
              background: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fde68a',
              fontWeight: 600,
            }}
          >
            ⚠️ {nearestError}
          </div>
        )}

        {nearestShelter && (
          <div
            style={{
              background: '#f0fdf4',
              border: '2px solid #22c55e',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem',
              boxShadow: '0 4px 16px rgba(34,197,94,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🎯</span>
                <h3 style={{ margin: 0, color: '#14532d', fontSize: '1.2rem' }}>
                  Nearest Recommended Shelter
                </h3>
                <span
                  style={{
                    background: '#22c55e',
                    color: 'white',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 12,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  {nearestShelter.distanceKm} km away
                </span>
              </div>

              <a
                href={getDirectionsUrl(nearestShelter.location?.latitude, nearestShelter.location?.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#15803d',
                  color: 'white',
                  padding: '0.55rem 1.2rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                🧭 Get Turn-by-Turn Directions ↗
              </a>
            </div>

            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
              {nearestShelter.name}
            </div>

            <div style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.8rem' }}>
              📍 {nearestShelter.location?.address}, {nearestShelter.location?.district}
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.88rem', color: '#334155' }}>
              <div>
                <strong>Capacity:</strong> {nearestShelter.capacity?.occupied} / {nearestShelter.capacity?.total} Occupied ({nearestShelter.occupancyRate}%)
              </div>
              <div style={{ color: '#15803d', fontWeight: 700 }}>
                🟢 {nearestShelter.availableSpots} spots available now
              </div>
              {nearestShelter.contactPhone && (
                <div>
                  <strong>Emergency Contact:</strong> {nearestShelter.contactPhone}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="dashboard-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
            <input
              type="text"
              placeholder="Search shelter name, landmark or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '0.65rem 1rem',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.95rem',
              }}
            />

            <input
              type="text"
              placeholder="Filter by district (e.g. Sylhet, Sunamganj)..."
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              style={{
                padding: '0.65rem 1rem',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.95rem',
              }}
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                padding: '0.65rem 1rem',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.95rem',
                background: 'white',
              }}
            >
              <option value="">All Shelter Statuses</option>
              <option value="Open">Open</option>
              <option value="Full">Full</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569' }}>
              Facility Requirements:
            </span>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterToilet}
                onChange={(e) => setFilterToilet(e.target.checked)}
              />
              🚻 Toilet Available
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterMedical}
                onChange={(e) => setFilterMedical(e.target.checked)}
              />
              🏥 Emergency Medical Care
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterWomenOnly}
                onChange={(e) => setFilterWomenOnly(e.target.checked)}
              />
              👩 Dedicated Women-Only Section
            </label>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            Loading shelters directory...
          </div>
        ) : shelters.length === 0 ? (
          <div className="dashboard-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏠</div>
            <h3 style={{ color: '#334155', margin: '0 0 0.4rem 0' }}>No shelters matching criteria</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Try clearing some of the filters or search terms above.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
            {shelters.map((shelter) => {
              const capacityRate = shelter.occupancyRate ?? Math.round((shelter.capacity.occupied / shelter.capacity.total) * 100);
              const color = getCapacityColor(capacityRate);
              const spots = shelter.availableSpots ?? Math.max(0, shelter.capacity.total - shelter.capacity.occupied);
              const directionsUrl = getDirectionsUrl(shelter.location?.latitude, shelter.location?.longitude);

              return (
                <div
                  key={shelter._id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 700, lineHeight: 1.3 }}>
                        {shelter.name}
                      </h3>
                      <span
                        style={{
                          background: shelter.status === 'Open' ? '#dcfce7' : shelter.status === 'Full' ? '#fee2e2' : '#f1f5f9',
                          color: shelter.status === 'Open' ? '#15803d' : shelter.status === 'Full' ? '#b91c1c' : '#475569',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          border: '1px solid currentColor',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ● {shelter.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                      📍 {shelter.location?.address}{shelter.location?.district ? `, ${shelter.location?.district}` : ''}
                      {shelter.distanceKm !== null && shelter.distanceKm !== undefined && (
                        <strong style={{ color: '#1d4ed8', marginLeft: '0.4rem' }}>
                          • {shelter.distanceKm} km away
                        </strong>
                      )}
                    </div>

                    <div style={{ marginBottom: '1.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' }}>
                        <span>Capacity: {shelter.capacity.occupied} / {shelter.capacity.total}</span>
                        <span style={{ color }}>{capacityRate}% Occupied</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, capacityRate)}%`,
                            height: '100%',
                            background: color,
                            borderRadius: '4px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '0.8rem', color: spots > 0 ? '#15803d' : '#b91c1c', fontWeight: 600, marginTop: '0.3rem' }}>
                        {spots > 0 ? `🟢 ${spots} spots currently open` : '🔴 Shelter is at maximum capacity'}
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.2rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                        Facilities Available:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            background: shelter.facilities?.toilet ? '#e0f2fe' : '#f1f5f9',
                            color: shelter.facilities?.toilet ? '#0369a1' : '#94a3b8',
                            fontWeight: 600,
                          }}
                        >
                          🚻 {shelter.facilities?.toilet ? 'Toilet' : 'No Toilet'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            background: shelter.facilities?.medicalCare ? '#fce7f3' : '#f1f5f9',
                            color: shelter.facilities?.medicalCare ? '#be185d' : '#94a3b8',
                            fontWeight: 600,
                          }}
                        >
                          🏥 {shelter.facilities?.medicalCare ? 'Medical Care' : 'No Clinic'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            background: shelter.facilities?.womenOnlySection ? '#fef3c7' : '#f1f5f9',
                            color: shelter.facilities?.womenOnlySection ? '#b45309' : '#94a3b8',
                            fontWeight: 600,
                          }}
                        >
                          👩 {shelter.facilities?.womenOnlySection ? 'Women-Only Wing' : 'Mixed Space'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            background: shelter.facilities?.drinkingWater ? '#dcfce7' : '#f1f5f9',
                            color: shelter.facilities?.drinkingWater ? '#15803d' : '#94a3b8',
                            fontWeight: 600,
                          }}
                        >
                          💧 {shelter.facilities?.drinkingWater ? 'Potable Water' : 'No Water'}
                        </span>
                        {shelter.facilities?.electricityBackup && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              background: '#fef08a',
                              color: '#854d0e',
                              fontWeight: 600,
                            }}
                          >
                            ⚡ Generator Backup
                          </span>
                        )}
                      </div>
                    </div>

                    {(shelter.contactPerson || shelter.contactPhone) && (
                      <div style={{ fontSize: '0.82rem', color: '#475569', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1.2rem' }}>
                        {shelter.contactPerson && <div>👤 <strong>Contact:</strong> {shelter.contactPerson}</div>}
                        {shelter.contactPhone && <div>📞 <strong>Phone:</strong> {shelter.contactPhone}</div>}
                      </div>
                    )}
                  </div>

                  <div>
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        width: '100%',
                        background: '#1d4ed8',
                        color: 'white',
                        padding: '0.65rem 0',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        marginBottom: user?.role === 'Admin' ? '0.6rem' : 0,
                      }}
                    >
                      🧭 Get Directions ↗
                    </a>

                    {user?.role === 'Admin' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(shelter)}
                          style={{
                            flex: 1,
                            background: '#f1f5f9',
                            color: '#1e293b',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.4rem',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ Edit / Occupancy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(shelter._id, shelter.name)}
                          style={{
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(showCreateModal || showEditModal) && (
          <div
            onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: 620,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}
            >
              <h2 style={{ margin: '0 0 1.2rem 0', color: '#1e3a8a' }}>
                {showCreateModal ? '➕ Register New Emergency Shelter' : '✏️ Update Shelter & Capacity'}
              </h2>

              <form onSubmit={showCreateModal ? handleCreateSubmit : handleEditSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                    Shelter Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Sylhet Government High School Shelter"
                    style={{ width: '100%', padding: '0.65rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                      Latitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.latitude}
                      onChange={(e) => setFormData((p) => ({ ...p, latitude: e.target.value }))}
                      placeholder="e.g. 24.8949"
                      style={{ width: '100%', padding: '0.65rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                      Longitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.longitude}
                      onChange={(e) => setFormData((p) => ({ ...p, longitude: e.target.value }))}
                      placeholder="e.g. 91.8687"
                      style={{ width: '100%', padding: '0.65rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                      Address / Landmark
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Road, Area, Upazila"
                      style={{ width: '100%', padding: '0.65rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                      District
                    </label>
                    <input
                      type="text"
                      value={formData.district}
                      onChange={(e) => setFormData((p) => ({ ...p, district: e.target.value }))}
                      placeholder="e.g. Sylhet"
                      style={{ width: '100%', padding: '0.65rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                      Total Capacity *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.totalCapacity}
                      onChange={(e) => setFormData((p) => ({ ...p, totalCapacity: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                      Occupied Count
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.occupiedCapacity}
                      onChange={(e) => setFormData((p) => ({ ...p, occupiedCapacity: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '6px', background: 'white', boxSizing: 'border-box' }}
                    >
                      <option value="Open">Open</option>
                      <option value="Full">Full</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem' }}>
                    Facilities On Site:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.88rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.toilet}
                        onChange={(e) => setFormData((p) => ({ ...p, toilet: e.target.checked }))}
                      />
                      🚻 Toilet Facilities
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.medicalCare}
                        onChange={(e) => setFormData((p) => ({ ...p, medicalCare: e.target.checked }))}
                      />
                      🏥 Emergency Medical Care
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.womenOnlySection}
                        onChange={(e) => setFormData((p) => ({ ...p, womenOnlySection: e.target.checked }))}
                      />
                      👩 Women-Only Safe Section
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.drinkingWater}
                        onChange={(e) => setFormData((p) => ({ ...p, drinkingWater: e.target.checked }))}
                      />
                      💧 Clean Drinking Water
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.electricityBackup}
                        onChange={(e) => setFormData((p) => ({ ...p, electricityBackup: e.target.checked }))}
                      />
                      ⚡ Generator Power Backup
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1.2rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData((p) => ({ ...p, contactPerson: e.target.value }))}
                      placeholder="Name"
                      style={{ width: '100%', padding: '0.65rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData((p) => ({ ...p, contactPhone: e.target.value }))}
                      placeholder="017xxxxxxxx"
                      style={{ width: '100%', padding: '0.65rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                    }}
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.7rem 1.2rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    style={{
                      background: '#1d4ed8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.7rem 1.5rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: formSubmitting ? 0.7 : 1,
                    }}
                  >
                    {formSubmitting ? 'Saving...' : showCreateModal ? 'Create Shelter' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
