import React, { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axiosInstance from '../api/axiosInstance.js';
import { calculatePriorityScoreClient } from '../utils/priorityCalculatorClient.js';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const AVAILABLE_NEEDS = [
  { id: 'rescue', label: 'Emergency Rescue', icon: '🛟', desc: 'Trapped / Water rising' },
  { id: 'food', label: 'Food Rations', icon: '🍞', desc: 'Dry food / cooked meals' },
  { id: 'water', label: 'Drinking Water', icon: '💧', desc: 'Clean potable water' },
  { id: 'medicine', label: 'Medical / First Aid', icon: '💊', desc: 'Injuries / Essential medicines' },
];

function SOSRequestForm({ onSOSSubmitted }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [gpsStatus, setGpsStatus] = useState({ text: '', type: '' });
  const [gpsLoading, setGpsLoading] = useState(false);

  const [selectedNeeds, setSelectedNeeds] = useState(['rescue']);
  const [numberOfPeople, setNumberOfPeople] = useState(1);
  const [description, setDescription] = useState('');

  const [childrenCount, setChildrenCount] = useState(0);
  const [elderlyCount, setElderlyCount] = useState(0);
  const [pregnantCount, setPregnantCount] = useState(0);
  const [injuredCount, setInjuredCount] = useState(0);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const priorityCalculation = useMemo(() => {
    return calculatePriorityScoreClient({
      vulnerabilities: {
        children: childrenCount,
        elderly: elderlyCount,
        pregnantWomen: pregnantCount,
        injured: injuredCount,
      },
      needs: selectedNeeds,
      numberOfPeople,
      description,
    });
  }, [childrenCount, elderlyCount, pregnantCount, injuredCount, selectedNeeds, numberOfPeople, description]);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = parseFloat(latitude) || 23.685;
    const initialLng = parseFloat(longitude) || 90.3563;
    const initialZoom = latitude && longitude ? 13 : 7;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    if (latitude && longitude && !isNaN(initialLat) && !isNaN(initialLng)) {
      const marker = L.marker([initialLat, initialLng]).addTo(map);
      marker.bindPopup('Emergency Location').openPopup();
      markerRef.current = marker;
    }

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const latStr = lat.toFixed(6);
      const lngStr = lng.toFixed(6);
      setLatitude(latStr);
      setLongitude(lngStr);

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng]).addTo(map);
        marker.bindPopup('Distress Location Selected').openPopup();
        markerRef.current = marker;
      }
      setGpsStatus({
        text: `Map location selected: ${latStr}, ${lngStr}`,
        type: 'success',
      });
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    mapInstanceRef.current = map;

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const handleLatChange = (e) => {
    const val = e.target.value;
    setLatitude(val);
    const latNum = parseFloat(val);
    const lngNum = parseFloat(longitude);
    if (!isNaN(latNum) && !isNaN(lngNum) && mapInstanceRef.current) {
      if (markerRef.current) {
        markerRef.current.setLatLng([latNum, lngNum]);
      } else {
        markerRef.current = L.marker([latNum, lngNum]).addTo(mapInstanceRef.current);
      }
      mapInstanceRef.current.panTo([latNum, lngNum]);
    }
  };

  const handleLngChange = (e) => {
    const val = e.target.value;
    setLongitude(val);
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(val);
    if (!isNaN(latNum) && !isNaN(lngNum) && mapInstanceRef.current) {
      if (markerRef.current) {
        markerRef.current.setLatLng([latNum, lngNum]);
      } else {
        markerRef.current = L.marker([latNum, lngNum]).addTo(mapInstanceRef.current);
      }
      mapInstanceRef.current.panTo([latNum, lngNum]);
    }
  };

  const handleDetectLocation = () => {
    setErrorMsg('');
    if (!navigator.geolocation) {
      setGpsStatus({
        text: 'Geolocation is not supported by your browser. Please enter coordinates manually.',
        type: 'error',
      });
      return;
    }

    setGpsLoading(true);
    setGpsStatus({ text: 'Acquiring high-accuracy GPS coordinates...', type: 'info' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        const accuracy = Math.round(position.coords.accuracy);

        setLatitude(lat);
        setLongitude(lng);
        setGpsLoading(false);
        setGpsStatus({
          text: `GPS acquired (accuracy: ±${accuracy}m).`,
          type: 'success',
        });

        if (mapInstanceRef.current) {
          const latNum = parseFloat(lat);
          const lngNum = parseFloat(lng);
          if (markerRef.current) {
            markerRef.current.setLatLng([latNum, lngNum]);
          } else {
            markerRef.current = L.marker([latNum, lngNum]).addTo(mapInstanceRef.current);
          }
          markerRef.current.bindPopup('Your Current GPS Location').openPopup();
          mapInstanceRef.current.flyTo([latNum, lngNum], 14, { duration: 1.2 });
        }
      },
      (error) => {
        setGpsLoading(false);
        let msg = 'Failed to retrieve GPS location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please allow location access or type coordinates below.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location information is unavailable.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'GPS request timed out. Please try again or type coordinates.';
        }
        setGpsStatus({ text: msg, type: 'error' });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const toggleNeed = (needId) => {
    setSelectedNeeds((prev) => {
      if (prev.includes(needId)) {
        return prev.filter((id) => id !== needId);
      } else {
        return [...prev, needId];
      }
    });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size must be under 5 MB.');
      return;
    }

    setErrorMsg('');
    setPhotoFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!latitude || !longitude) {
      setErrorMsg('GPS coordinates are required. Click "Auto-Detect My GPS" or enter latitude/longitude.');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setErrorMsg('Invalid latitude. Must be between -90 and 90.');
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setErrorMsg('Invalid longitude. Must be between -180 and 180.');
      return;
    }

    if (selectedNeeds.length === 0) {
      setErrorMsg('Please select at least one type of need (food, water, medicine, rescue).');
      return;
    }

    if (numberOfPeople < 1) {
      setErrorMsg('Number of people must be at least 1.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      formData.append('address', address);
      formData.append('district', district);
      formData.append('numberOfPeople', numberOfPeople);
      formData.append('description', description);
      formData.append('needs', JSON.stringify(selectedNeeds));

      formData.append(
        'vulnerabilities',
        JSON.stringify({
          children: childrenCount,
          elderly: elderlyCount,
          pregnantWomen: pregnantCount,
          injured: injuredCount,
        })
      );

      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const response = await axiosInstance.post('/api/sos', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const priorityScoreAssigned = response.data.data?.priorityScore || priorityCalculation.score;
        const priorityTierAssigned = response.data.data?.priority || priorityCalculation.priority;

        setSuccessMsg(
          `🚨 Emergency SOS Dispatched! Priority Score: ${priorityScoreAssigned}/100 (${priorityTierAssigned}). Live alert broadcast to rescue teams.`
        );

        setDescription('');
        setPhotoFile(null);
        setPhotoPreview(null);
        setNumberOfPeople(1);
        setChildrenCount(0);
        setElderlyCount(0);
        setPregnantCount(0);
        setInjuredCount(0);

        if (onSOSSubmitted) {
          onSOSSubmitted(response.data.data);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit SOS request.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sos-form-card">
      <div className="sos-form-header">
        <h2>
          <span>🚨</span> Request Emergency Assistance (SOS)
        </h2>
        <p>
          Fill in your distress details. The platform automatically calculates an objective
          urgency priority score based on vulnerable individuals (children, elderly, pregnant, injured)
          so rescue teams reach those most in danger first.
        </p>
      </div>

      {errorMsg && (
        <div
          style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '0.85rem 1.2rem',
            borderRadius: '8px',
            marginBottom: '1.2rem',
            fontWeight: '600',
            fontSize: '0.92rem',
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            background: '#f0fdf4',
            color: '#15803d',
            border: '2px solid #86efac',
            padding: '1rem 1.4rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.3rem' }}>
            {successMsg}
          </div>
          <div style={{ fontSize: '0.88rem', color: '#166534', marginTop: '0.3rem' }}>
            Current Status:{' '}
            <strong
              style={{
                background: '#fef3c7',
                color: '#92400e',
                padding: '0.2rem 0.6rem',
                borderRadius: 12,
                border: '1px solid #fde68a',
              }}
            >
              ⏳ PENDING VERIFICATION
            </strong>{' '}
            — Your emergency signal is live on the Disaster Map.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="sos-form-group">
          <label>
            1. GPS Location & Landmark <span className="required-star">*</span>
          </label>
          <div className="gps-box">
            <div className="gps-detect-row">
              <button
                type="button"
                className="gps-btn"
                onClick={handleDetectLocation}
                disabled={gpsLoading}
              >
                <span>📍</span>
                {gpsLoading ? 'Detecting GPS...' : 'Auto-Detect My GPS Location'}
              </button>

              {gpsStatus.text && (
                <span className={`gps-status-indicator ${gpsStatus.type}`}>
                  {gpsStatus.type === 'success' ? '✓ ' : '• '}
                  {gpsStatus.text}
                </span>
              )}
            </div>

            <div className="gps-coords-grid">
              <div>
                <label style={{ fontSize: '0.85rem', color: '#555' }}>
                  Latitude <span className="required-star">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 23.810331"
                  className="gps-input"
                  value={latitude}
                  onChange={handleLatChange}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#555' }}>
                  Longitude <span className="required-star">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 90.412521"
                  className="gps-input"
                  value={longitude}
                  onChange={handleLngChange}
                  required
                />
              </div>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                  🗺️ Interactive Distress Location Map (Click anywhere to drop pin)
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Bangladesh Live GIS
                </span>
              </div>
              <div
                ref={mapContainerRef}
                className="mini-map-container"
                style={{
                  height: '240px',
                  width: '100%',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  overflow: 'hidden',
                  background: '#e2e8f0',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
                }}
              />
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                💡 Click or tap anywhere on the map above to accurately place your emergency location pin, or click "Auto-Detect My GPS Location".
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.8rem', marginTop: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#555' }}>
                  Landmark / Specific Area (e.g. Parshuram Bazar, Roof of Mosque)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Mirpur-10 Roundabout, 3rd floor red roof building"
                  className="gps-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#555' }}>
                  District (e.g. Feni, Sylhet)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Feni"
                  className="gps-input"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sos-form-group">
          <label>
            2. Type of Emergency Need <span className="required-star">*</span>{' '}
            <span style={{ fontSize: '0.82rem', fontWeight: 'normal', color: '#666' }}>
              (Select all that apply)
            </span>
          </label>
          <div className="needs-grid">
            {AVAILABLE_NEEDS.map((item) => {
              const isSelected = selectedNeeds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`need-card-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleNeed(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') toggleNeed(item.id);
                  }}
                >
                  <span className="need-icon">{item.icon}</span>
                  <span className="need-label">{item.label}</span>
                  <span style={{ fontSize: '0.72rem', color: isSelected ? '#b71c1c' : '#777' }}>
                    {item.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sos-form-group">
          <label>
            3. Total Number of People in Group <span className="required-star">*</span>
          </label>
          <div className="counter-box">
            <button
              type="button"
              className="counter-btn"
              onClick={() => setNumberOfPeople((prev) => Math.max(1, prev - 1))}
              disabled={numberOfPeople <= 1}
            >
              −
            </button>
            <input
              type="number"
              min="1"
              max="500"
              className="counter-input"
              value={numberOfPeople}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setNumberOfPeople(isNaN(val) ? 1 : Math.max(1, val));
              }}
              required
            />
            <button
              type="button"
              className="counter-btn"
              onClick={() => setNumberOfPeople((prev) => prev + 1)}
            >
              +
            </button>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>
              {numberOfPeople === 1 ? 'person' : 'people'} requiring evacuation or supplies
            </span>
          </div>
        </div>

        <div className="sos-form-group" style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '1rem', color: '#1e293b', marginBottom: 0 }}>
                4. Vulnerability Assessment (Priority Factors)
              </label>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Requests with high vulnerability are automatically prioritized at the top of the admin triage board.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.9rem' }}>
            <div style={{ background: '#fff', padding: '0.9rem', borderRadius: 8, border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>👶 Children (&le; 12 yrs)</span>
                <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>+12 pts/ea</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="counter-btn"
                  style={{ width: 34, height: 34, fontSize: '1.1rem' }}
                  onClick={() => setChildrenCount((prev) => Math.max(0, prev - 1))}
                  disabled={childrenCount <= 0}
                >
                  −
                </button>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 24, textAlign: 'center' }}>
                  {childrenCount}
                </span>
                <button
                  type="button"
                  className="counter-btn"
                  style={{ width: 34, height: 34, fontSize: '1.1rem' }}
                  onClick={() => setChildrenCount((prev) => prev + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ background: '#fff', padding: '0.9rem', borderRadius: 8, border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>👵 Elderly (&ge; 60 yrs)</span>
                <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>+10 pts/ea</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="counter-btn"
                  style={{ width: 34, height: 34, fontSize: '1.1rem' }}
                  onClick={() => setElderlyCount((prev) => Math.max(0, prev - 1))}
                  disabled={elderlyCount <= 0}
                >
                  −
                </button>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 24, textAlign: 'center' }}>
                  {elderlyCount}
                </span>
                <button
                  type="button"
                  className="counter-btn"
                  style={{ width: 34, height: 34, fontSize: '1.1rem' }}
                  onClick={() => setElderlyCount((prev) => prev + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ background: '#fff', padding: '0.9rem', borderRadius: 8, border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>🤰 Pregnant Women</span>
                <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>+25 pts/ea</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="counter-btn"
                  style={{ width: 34, height: 34, fontSize: '1.1rem' }}
                  onClick={() => setPregnantCount((prev) => Math.max(0, prev - 1))}
                  disabled={pregnantCount <= 0}
                >
                  −
                </button>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 24, textAlign: 'center' }}>
                  {pregnantCount}
                </span>
                <button
                  type="button"
                  className="counter-btn"
                  style={{ width: 34, height: 34, fontSize: '1.1rem' }}
                  onClick={() => setPregnantCount((prev) => prev + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ background: '#fff', padding: '0.9rem', borderRadius: 8, border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>🩹 Injured / Urgent Medical</span>
                <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>+25 pts/ea</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="counter-btn"
                  style={{ width: 34, height: 34, fontSize: '1.1rem' }}
                  onClick={() => setInjuredCount((prev) => Math.max(0, prev - 1))}
                  disabled={injuredCount <= 0}
                >
                  −
                </button>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 24, textAlign: 'center' }}>
                  {injuredCount}
                </span>
                <button
                  type="button"
                  className="counter-btn"
                  style={{ width: 34, height: 34, fontSize: '1.1rem' }}
                  onClick={() => setInjuredCount((prev) => prev + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: '1rem',
              padding: '0.9rem 1.1rem',
              borderRadius: 8,
              background:
                priorityCalculation.priority === 'Critical'
                  ? '#fef2f2'
                  : priorityCalculation.priority === 'High'
                  ? '#fffbeb'
                  : '#f8fafc',
              border:
                priorityCalculation.priority === 'Critical'
                  ? '2px solid #ef4444'
                  : priorityCalculation.priority === 'High'
                  ? '2px solid #f59e0b'
                  : '1px solid #cbd5e1',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.3rem' }}>
                  {priorityCalculation.priority === 'Critical' ? '🚨' : priorityCalculation.priority === 'High' ? '⚠️' : 'ℹ️'}
                </span>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                    Calculated Urgency Score:{' '}
                    <span
                      style={{
                        color:
                          priorityCalculation.priority === 'Critical'
                            ? '#dc2626'
                            : priorityCalculation.priority === 'High'
                            ? '#d97706'
                            : '#2563eb',
                      }}
                    >
                      {priorityCalculation.score} / 100
                    </span>{' '}
                    —{' '}
                    <span
                      style={{
                        textTransform: 'uppercase',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background:
                          priorityCalculation.priority === 'Critical'
                            ? '#fee2e2'
                            : priorityCalculation.priority === 'High'
                            ? '#fef3c7'
                            : '#e0f2fe',
                        color:
                          priorityCalculation.priority === 'Critical'
                            ? '#991b1b'
                            : priorityCalculation.priority === 'High'
                            ? '#92400e'
                            : '#075985',
                      }}
                    >
                      {priorityCalculation.priority} Priority
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Priority scoring algorithm automatically prioritizes vulnerable citizens for admin dispatch.
                  </div>
                </div>
              </div>

              <div style={{ width: '130px', height: '10px', background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${priorityCalculation.score}%`,
                    background:
                      priorityCalculation.priority === 'Critical'
                        ? '#dc2626'
                        : priorityCalculation.priority === 'High'
                        ? '#f59e0b'
                        : '#3b82f6',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {priorityCalculation.factors.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
                {priorityCalculation.factors.map((f, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.75rem',
                      background: 'rgba(0,0,0,0.06)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 4,
                      color: '#334155',
                    }}
                  >
                    +{f.points} pts: {f.desc || f.factor}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sos-form-group">
          <label>
            5. Optional Photo <span style={{ fontSize: '0.82rem', color: '#666' }}>(Camera or Gallery)</span>
          </label>
          <div className="photo-upload-container">
            <input
              type="file"
              id="sos-photo-input"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />

            {!photoPreview ? (
              <label htmlFor="sos-photo-input" style={{ cursor: 'pointer', display: 'block' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>📷</div>
                <div style={{ fontWeight: '600', color: '#1a237e' }}>
                  Click to take a photo or upload an image
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                  Helps rescue teams assess the situation (Max size: 5MB)
                </div>
              </label>
            ) : (
              <div className="photo-preview-box">
                <img src={photoPreview} alt="SOS Preview" className="photo-preview-img" />
                <button
                  type="button"
                  className="photo-remove-btn"
                  onClick={handleRemovePhoto}
                  title="Remove photo"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="sos-form-group">
          <label>6. Additional Situation Details (Optional)</label>
          <textarea
            rows="3"
            className="gps-input"
            style={{ width: '100%', resize: 'vertical' }}
            placeholder="e.g. Any injured, elderly, children, flood water level, or specific access routes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="sos-submit-btn"
          disabled={submitting}
          style={{
            background:
              priorityCalculation.priority === 'Critical'
                ? 'linear-gradient(135deg, #b91c1c, #991b1b)'
                : 'linear-gradient(135deg, #d32f2f, #b71c1c)',
          }}
        >
          <span>🚨</span>
          {submitting
            ? 'Broadcasting SOS to Relief Network...'
            : `SUBMIT EMERGENCY SOS (SCORE: ${priorityCalculation.score} — ${priorityCalculation.priority.toUpperCase()})`}
        </button>
      </form>
    </div>
  );
}

export default SOSRequestForm;
