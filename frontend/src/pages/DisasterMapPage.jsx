// ============================================================
// src/pages/DisasterMapPage.jsx — Live Disaster Map (Member-2)
//
// Module 2 (Member-2):
//   Users can view a live disaster map (via Leaflet) showing SOS
//   requests, shelters, hazard zones, and relief camps, using
//   MongoDB’s 2dsphere geospatial queries to easily find nearby requests.
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Navbar from '../components/Navbar.jsx';
import axiosInstance from '../api/axiosInstance.js';
import { useSocket } from '../context/SocketContext.jsx';
import '../styles/map.css';

// Fix default Leaflet icon paths in Vite/bundler environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Key Bangladesh disaster hot-spot coordinates for fast navigation
const REGION_PRESETS = [
  { name: '🇧🇩 Bangladesh Overview', lat: 23.685, lng: 90.3563, zoom: 7 },
  { name: '🌊 Feni Flood Zone', lat: 23.0159, lng: 91.3986, zoom: 12 },
  { name: '🌊 Sylhet Basin', lat: 24.8949, lng: 91.8687, zoom: 12 },
  { name: '🌊 Noakhali Coastal', lat: 22.8698, lng: 91.0982, zoom: 12 },
  { name: '🏙️ Dhaka Metro', lat: 23.8103, lng: 90.4125, zoom: 12 },
];

function DisasterMapPage() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const userLocationLayerRef = useRef(null);
  const circleLayerRef = useRef(null);

  const { socket } = useSocket();

  // ── State ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapData, setMapData] = useState({
    sosRequests: [],
    shelters: [],
    hazardZones: [],
    reliefCamps: [],
  });
  const [stats, setStats] = useState({
    totalSOS: 0,
    criticalSOS: 0,
    highSOS: 0,
    totalShelters: 0,
    availableShelterSpots: 0,
    activeHazards: 0,
    activeReliefCamps: 0,
  });

  // Layer filters
  const [showSOS, setShowSOS] = useState(true);
  const [showShelters, setShowShelters] = useState(true);
  const [showHazards, setShowHazards] = useState(true);
  const [showReliefCamps, setShowReliefCamps] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Proximity 2dsphere search state
  const [userCoords, setUserCoords] = useState(null);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(15);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [nearbyStats, setNearbyStats] = useState(null);

  // Active selected item for focus
  const [selectedSOSId, setSelectedSOSId] = useState(null);

  // ── 1. Initialize Leaflet Map ───────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent double initialization

    // Center on Bangladesh
    const map = L.map(mapContainerRef.current, {
      center: [23.685, 90.3563],
      zoom: 7,
      minZoom: 6,
      maxZoom: 18,
      zoomControl: false,
    });

    // Zoom control at top-left
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // OpenStreetMap standard tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | ReliefSync Bangladesh',
      maxZoom: 19,
    }).addTo(map);

    // Feature group layers for markers and overlays
    const markersLayer = L.featureGroup().addTo(map);
    const circleLayer = L.featureGroup().addTo(map);
    const userLocationLayer = L.featureGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    circleLayerRef.current = circleLayer;
    userLocationLayerRef.current = userLocationLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── 2. Fetch Map Data from Backend ──────────────────────────
  const fetchMapData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axiosInstance.get('/api/map/all');
      if (res.data?.success) {
        setMapData(res.data.data);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to load live disaster map data:', err);
      setError('Failed to load disaster map data. Check your network connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // ── 3. Real-Time Socket.IO Synchronization ──────────────────
  useEffect(() => {
    if (!socket) return;

    const handleSOSCreated = () => fetchMapData();
    const handleSOSUpdated = () => fetchMapData();
    const handleHazardCreated = () => fetchMapData();
    const handleReliefCreated = () => fetchMapData();

    socket.on('sos:created', handleSOSCreated);
    socket.on('sos:updated', handleSOSUpdated);
    socket.on('hazard:created', handleHazardCreated);
    socket.on('reliefCamp:created', handleReliefCreated);

    return () => {
      socket.off('sos:created', handleSOSCreated);
      socket.off('sos:updated', handleSOSUpdated);
      socket.off('hazard:created', handleHazardCreated);
      socket.off('reliefCamp:created', handleReliefCreated);
    };
  }, [socket, fetchMapData]);

  // ── 4. Helper to create custom HTML Pin Icons ───────────────
  const createSOSIcon = (priority, status) => {
    let tierClass = 'high';
    let iconChar = '🚨';

    if (status === 'Completed') {
      tierClass = 'completed';
      iconChar = '✓';
    } else if (priority === 'Critical') {
      tierClass = 'critical';
      iconChar = '🆘';
    } else if (priority === 'Medium' || priority === 'Low') {
      tierClass = 'medium';
      iconChar = '⚠️';
    }

    return L.divIcon({
      className: 'custom-leaflet-icon',
      html: `
        <div class="sos-marker-pin ${tierClass}">
          <div class="sos-marker-inner">${iconChar}</div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38],
    });
  };

  const createShelterIcon = () => {
    return L.divIcon({
      className: 'custom-leaflet-icon',
      html: `<div class="shelter-marker-pin">🏠</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    });
  };

  const createHazardIcon = () => {
    return L.divIcon({
      className: 'custom-leaflet-icon',
      html: `<div class="hazard-marker-pin">⚠️</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    });
  };

  const createReliefIcon = () => {
    return L.divIcon({
      className: 'custom-leaflet-icon',
      html: `<div class="relief-marker-pin">🏕️</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    });
  };

  // ── 5. Render Layers on Leaflet Map ─────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const circleLayer = circleLayerRef.current;
    if (!map || !markersLayer || !circleLayer) return;

    // Clear previous markers & circles
    markersLayer.clearLayers();
    circleLayer.clearLayers();

    // ── Render Hazard Zones (with translucent danger circle) ──
    if (showHazards) {
      mapData.hazardZones.forEach((h) => {
        if (!h.lat || !h.lng) return;

        // Radius danger circle
        const circle = L.circle([h.lat, h.lng], {
          radius: h.radiusMeters || 1500,
          color: h.severity === 'Critical' ? '#dc2626' : '#d97706',
          fillColor: h.severity === 'Critical' ? '#ef4444' : '#f59e0b',
          fillOpacity: 0.22,
          weight: 2,
          dashArray: '4, 4',
        });
        circleLayer.addLayer(circle);

        // Center Marker Pin
        const marker = L.marker([h.lat, h.lng], { icon: createHazardIcon() });
        const popupContent = `
          <div class="map-popup-card">
            <div class="map-popup-header">
              <h4 class="map-popup-title">⚠️ ${h.title}</h4>
              <span class="map-popup-badge" style="background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">
                ${h.severity} Danger
              </span>
            </div>
            <div class="map-popup-body">
              <p style="margin:0 0 0.4rem 0;"><strong>Type:</strong> ${h.hazardType}</p>
              ${h.waterLevelFeet ? `<p style="margin:0 0 0.4rem 0; color:#dc2626;"><strong>Water Depth:</strong> ~${h.waterLevelFeet} feet</p>` : ''}
              <p style="margin:0 0 0.4rem 0;"><strong>Evacuation Radius:</strong> ${(h.radiusMeters / 1000).toFixed(1)} km</p>
              <p style="margin:0 0 0.4rem 0; font-size:0.8rem; color:#64748b;">${h.address || h.district || ''}</p>
              ${h.description ? `<p style="margin:0.4rem 0 0 0; background:#f8fafc; padding:0.4rem; border-radius:4px; font-style:italic;">"${h.description}"</p>` : ''}
            </div>
            <div class="map-popup-actions">
              <a href="https://www.google.com/maps?q=${h.lat},${h.lng}" target="_blank" rel="noopener noreferrer" class="map-popup-btn secondary">
                🗺️ Google Maps
              </a>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
        markersLayer.addLayer(marker);
      });
    }

    // ── Render Shelters ───────────────────────────────────────
    if (showShelters) {
      mapData.shelters.forEach((sh) => {
        if (!sh.lat || !sh.lng) return;

        const marker = L.marker([sh.lat, sh.lng], { icon: createShelterIcon() });
        const facilitiesList = [];
        if (sh.facilities?.womenOnlySection) facilitiesList.push('👩 Women Section');
        if (sh.facilities?.medicalCare) facilitiesList.push('🩺 Medical Care');
        if (sh.facilities?.toilet) facilitiesList.push('🚻 Toilets');
        if (sh.facilities?.drinkingWater) facilitiesList.push('💧 Drinking Water');
        if (sh.facilities?.electricityBackup) facilitiesList.push('⚡ Generator');

        const popupContent = `
          <div class="map-popup-card">
            <div class="map-popup-header">
              <h4 class="map-popup-title">🏠 ${sh.title}</h4>
              <span class="map-popup-badge" style="background:#e0f2fe; color:#075985; border:1px solid #7dd3fc;">
                ${sh.status}
              </span>
            </div>
            <div class="map-popup-body">
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:0.4rem; margin-bottom:0.5rem; text-align:center;">
                <span style="font-size:1.1rem; font-weight:800; color:#15803d;">${sh.availableSpots}</span>
                <span style="font-size:0.8rem; color:#166534;"> spots available (Total: ${sh.capacity?.total || 0})</span>
              </div>
              <p style="margin:0 0 0.3rem 0; font-size:0.8rem; color:#64748b;">📍 ${sh.address || sh.district || ''}</p>
              ${sh.contactPhone ? `<p style="margin:0 0 0.3rem 0;">📞 <strong>Helpline:</strong> <a href="tel:${sh.contactPhone}" style="color:#0284c7; font-weight:700;">${sh.contactPhone}</a></p>` : ''}
              ${facilitiesList.length > 0 ? `<div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.4rem;">${facilitiesList.map((f) => `<span style="font-size:0.72rem; background:#f1f5f9; padding:0.15rem 0.4rem; border-radius:4px;">${f}</span>`).join('')}</div>` : ''}
            </div>
            <div class="map-popup-actions">
              <a href="/shelters" class="map-popup-btn primary">
                View Full Details
              </a>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${sh.lat},${sh.lng}" target="_blank" rel="noopener noreferrer" class="map-popup-btn secondary">
                🧭 Directions
              </a>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
        markersLayer.addLayer(marker);
      });
    }

    // ── Render Relief Camps ───────────────────────────────────
    if (showReliefCamps) {
      mapData.reliefCamps.forEach((rc) => {
        if (!rc.lat || !rc.lng) return;

        const marker = L.marker([rc.lat, rc.lng], { icon: createReliefIcon() });
        const popupContent = `
          <div class="map-popup-card">
            <div class="map-popup-header">
              <h4 class="map-popup-title">🏕️ ${rc.title}</h4>
              <span class="map-popup-badge" style="background:#f3e8ff; color:#6b21a8; border:1px solid #d8b4fe;">
                ${rc.status}
              </span>
            </div>
            <div class="map-popup-body">
              <p style="margin:0 0 0.4rem 0;"><strong>Agency:</strong> ${rc.operatingAgency}</p>
              <p style="margin:0 0 0.4rem 0; font-size:0.8rem; color:#64748b;">📍 ${rc.address || rc.district || ''}</p>
              ${rc.contactPhone ? `<p style="margin:0 0 0.4rem 0;">📞 <strong>Contact:</strong> ${rc.contactPhone}</p>` : ''}
              ${rc.itemsAvailable?.length > 0 ? `<div style="margin-top:0.5rem;"><strong style="font-size:0.75rem; color:#475569;">Available Supplies:</strong><div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-top:0.2rem;">${rc.itemsAvailable.map((item) => `<span style="font-size:0.72rem; background:#f1f5f9; padding:0.15rem 0.4rem; border-radius:4px;">📦 ${item}</span>`).join('')}</div></div>` : ''}
            </div>
            <div class="map-popup-actions">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${rc.lat},${rc.lng}" target="_blank" rel="noopener noreferrer" class="map-popup-btn primary">
                🧭 Get Directions
              </a>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
        markersLayer.addLayer(marker);
      });
    }

    // ── Render SOS Requests (Color-coded by Automated Priority Score) ─
    if (showSOS) {
      const filteredSOS = mapData.sosRequests.filter((s) => {
        if (priorityFilter !== 'All' && s.priority !== priorityFilter) return false;
        return true;
      });

      filteredSOS.forEach((s) => {
        if (!s.lat || !s.lng) return;

        const marker = L.marker([s.lat, s.lng], {
          icon: createSOSIcon(s.priority, s.status),
          zIndexOffset: s.priority === 'Critical' ? 1000 : 500,
        });

        const v = s.vulnerabilities || {};
        const vulnTags = [];
        if (v.pregnantWomen > 0) vulnTags.push(`🤰 ${v.pregnantWomen} Pregnant`);
        if (v.injured > 0) vulnTags.push(`🩹 ${v.injured} Injured`);
        if (v.children > 0) vulnTags.push(`👶 ${v.children} Children`);
        if (v.elderly > 0) vulnTags.push(`👵 ${v.elderly} Elderly`);

        const needsBadges = (s.needs || [])
          .map(
            (n) =>
              `<span style="background:#fee2e2; color:#991b1b; padding:0.1rem 0.4rem; border-radius:4px; font-size:0.75rem; font-weight:700;">${n}</span>`
          )
          .join(' ');

        const popupContent = `
          <div class="map-popup-card">
            <div class="map-popup-header">
              <div>
                <h4 class="map-popup-title">🚨 ${s.title}</h4>
                <div style="font-size:0.75rem; color:#64748b;">${new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
              <span class="map-popup-badge" style="background:${
                s.priority === 'Critical' ? '#fee2e2' : s.priority === 'High' ? '#fef3c7' : '#e0f2fe'
              }; color:${
          s.priority === 'Critical' ? '#991b1b' : s.priority === 'High' ? '#92400e' : '#075985'
        }; border:1px solid ${
          s.priority === 'Critical' ? '#fca5a5' : s.priority === 'High' ? '#fde68a' : '#bae6fd'
        };">
                Score ${s.priorityScore}/100 (${s.priority})
              </span>
            </div>

            <div class="map-popup-body">
              <p style="margin:0 0 0.3rem 0;"><strong>Status:</strong> <span style="font-weight:700; color:#1e293b;">${s.status}</span></p>
              <p style="margin:0 0 0.3rem 0;"><strong>People in Danger:</strong> ${s.numberOfPeople} person(s)</p>
              <div style="margin:0 0 0.4rem 0;"><strong>Needs:</strong> ${needsBadges}</div>

              ${
                vulnTags.length > 0
                  ? `<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:0.35rem 0.5rem; margin:0.4rem 0;">
                      <div style="font-size:0.75rem; font-weight:700; color:#b91c1c; margin-bottom:0.2rem;">Vulnerability Breakdown:</div>
                      <div style="display:flex; flex-wrap:wrap; gap:0.25rem;">${vulnTags
                        .map(
                          (t) =>
                            `<span style="font-size:0.72rem; background:#fff; padding:0.1rem 0.35rem; border-radius:3px; border:1px solid #fca5a5;">${t}</span>`
                        )
                        .join('')}</div>
                    </div>`
                  : ''
              }

              <p style="margin:0 0 0.3rem 0; font-size:0.8rem; color:#475569;">📍 ${s.address || s.district || 'GPS Coordinates'}</p>
              ${s.description ? `<p style="margin:0.3rem 0 0 0; background:#f8fafc; padding:0.35rem; border-radius:4px; font-size:0.8rem; font-style:italic;">"${s.description}"</p>` : ''}
              ${s.photoUrl ? `<div style="margin-top:0.4rem;"><img src="${s.photoUrl}" alt="Evidence" style="width:100%; max-height:100px; object-fit:cover; border-radius:6px; border:1px solid #cbd5e1;" /></div>` : ''}
            </div>

            <div class="map-popup-actions">
              <a href="https://www.google.com/maps?q=${s.lat},${s.lng}" target="_blank" rel="noopener noreferrer" class="map-popup-btn primary">
                🚨 Navigate GPS
              </a>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
        markersLayer.addLayer(marker);
      });
    }
  }, [mapData, showSOS, showShelters, showHazards, showReliefCamps, priorityFilter]);

  // ── 6. Geospatial 2dsphere Proximity Search ($near) ─────────
  const handleNearbySearch = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsSearchingNearby(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });

        const map = mapInstanceRef.current;
        const userLocationLayer = userLocationLayerRef.current;

        if (map && userLocationLayer) {
          userLocationLayer.clearLayers();

          // User blue pulsing marker
          const userIcon = L.divIcon({
            className: 'custom-leaflet-icon',
            html: `<div class="user-location-pin" title="Your GPS Location"></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          const userMarker = L.marker([lat, lng], { icon: userIcon });
          userMarker.bindPopup('<strong>📍 You are here</strong>').openPopup();
          userLocationLayer.addLayer(userMarker);

          // Search Radius circle
          const searchCircle = L.circle([lat, lng], {
            radius: nearbyRadiusKm * 1000,
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '5, 5',
          });
          userLocationLayer.addLayer(searchCircle);

          // Pan and zoom to user's proximity area
          map.flyTo([lat, lng], nearbyRadiusKm <= 5 ? 13 : nearbyRadiusKm <= 15 ? 11 : 9, {
            duration: 1.2,
          });
        }

        // Call backend MongoDB 2dsphere $near endpoint
        try {
          const res = await axiosInstance.get(
            `/api/map/nearby?lat=${lat}&lng=${lng}&radius=${nearbyRadiusKm}`
          );
          if (res.data?.success) {
            setNearbyStats(res.data.query);
            // Re-render nearby dataset
            const nearbyRes = res.data.data;
            setMapData({
              sosRequests: nearbyRes.sosRequests.map((s) => ({
                id: s._id,
                type: 'sos',
                lat: s.location.latitude,
                lng: s.location.longitude,
                title: `SOS #${s._id.toString().slice(-6).toUpperCase()}`,
                priorityScore: s.priorityScore,
                priority: s.priority,
                status: s.status,
                needs: s.needs || [],
                numberOfPeople: s.numberOfPeople || 1,
                vulnerabilities: s.vulnerabilities,
                address: s.location.address || '',
                description: s.description || '',
                createdAt: s.createdAt,
                distanceKm: s.distanceKm,
              })),
              shelters: nearbyRes.shelters.map((sh) => ({
                id: sh._id,
                type: 'shelter',
                lat: sh.location.latitude,
                lng: sh.location.longitude,
                title: sh.name,
                capacity: sh.capacity,
                availableSpots: sh.availableSpots,
                facilities: sh.facilities,
                status: sh.status,
                address: sh.location.address,
                contactPhone: sh.contactPhone,
                distanceKm: sh.distanceKm,
              })),
              hazardZones: nearbyRes.hazardZones.map((h) => ({
                id: h._id,
                type: 'hazard',
                lat: h.location.latitude,
                lng: h.location.longitude,
                title: h.name,
                hazardType: h.hazardType,
                severity: h.severity,
                radiusMeters: h.radiusMeters,
                waterLevelFeet: h.waterLevelFeet,
                address: h.location.address,
                description: h.description,
                distanceKm: h.distanceKm,
              })),
              reliefCamps: nearbyRes.reliefCamps.map((rc) => ({
                id: rc._id,
                type: 'reliefCamp',
                lat: rc.location.latitude,
                lng: rc.location.longitude,
                title: rc.name,
                operatingAgency: rc.operatingAgency,
                itemsAvailable: rc.itemsAvailable,
                contactPhone: rc.contactPhone,
                address: rc.location.address,
                distanceKm: rc.distanceKm,
              })),
            });
          }
        } catch (fetchErr) {
          console.error('2dsphere nearby search failed:', fetchErr);
        } finally {
          setIsSearchingNearby(false);
        }
      },
      (err) => {
        setIsSearchingNearby(false);
        alert(`Location permission error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── 7. Pan to specific item on map from sidebar ─────────────
  const handleFocusItem = (item) => {
    setSelectedSOSId(item.id);
    const map = mapInstanceRef.current;
    if (map && item.lat && item.lng) {
      map.flyTo([item.lat, item.lng], 15, { duration: 1.0 });
    }
  };

  // ── 8. Region Fast Jump ─────────────────────────────────────
  const handleRegionJump = (region) => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([region.lat, region.lng], region.zoom, { duration: 1.2 });
    }
  };

  // Sidebar list: SOS sorted by Priority Score descending
  const sortedSidebarSOS = mapData.sosRequests
    .filter((s) => {
      if (priorityFilter !== 'All' && s.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          (s.address && s.address.toLowerCase().includes(q)) ||
          (s.needs && s.needs.some((n) => n.toLowerCase().includes(q)))
        );
      }
      return true;
    })
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  return (
    <div className="map-page-container">
      <Navbar />

      {/* ── Top Map Control & Filter Toolbar ─────────────────── */}
      <div className="map-toolbar">
        <div className="map-toolbar-left">
          {/* Layer toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginRight: '0.2rem' }}>
              LAYERS:
            </span>
            <button
              type="button"
              className={`map-filter-btn ${showSOS ? 'active-sos' : ''}`}
              onClick={() => setShowSOS((prev) => !prev)}
            >
              🚨 SOS Requests ({mapData.sosRequests.length})
            </button>
            <button
              type="button"
              className={`map-filter-btn ${showShelters ? 'active-shelter' : ''}`}
              onClick={() => setShowShelters((prev) => !prev)}
            >
              🏠 Shelters ({mapData.shelters.length})
            </button>
            <button
              type="button"
              className={`map-filter-btn ${showHazards ? 'active-hazard' : ''}`}
              onClick={() => setShowHazards((prev) => !prev)}
            >
              ⚠️ Hazard Zones ({mapData.hazardZones.length})
            </button>
            <button
              type="button"
              className={`map-filter-btn ${showReliefCamps ? 'active-relief' : ''}`}
              onClick={() => setShowReliefCamps((prev) => !prev)}
            >
              🏕️ Relief Camps ({mapData.reliefCamps.length})
            </button>
          </div>

          {/* Priority filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Urgency:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{
                padding: '0.35rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: '#fff',
              }}
            >
              <option value="All">All Priorities</option>
              <option value="Critical">🚨 Critical (&ge;70)</option>
              <option value="High">⚠️ High (45-69)</option>
              <option value="Medium">🟡 Medium (25-44)</option>
              <option value="Low">🔵 Low (&lt;25)</option>
            </select>
          </div>
        </div>

        <div className="map-toolbar-right">
          {/* Geospatial 2dsphere Nearby Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <select
              value={nearbyRadiusKm}
              onChange={(e) => setNearbyRadiusKm(Number(e.target.value))}
              style={{
                padding: '0.4rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                background: '#fff',
              }}
            >
              <option value={5}>Within 5 km</option>
              <option value={15}>Within 15 km</option>
              <option value={30}>Within 30 km</option>
              <option value={50}>Within 50 km</option>
            </select>
            <button
              type="button"
              className="nearby-search-btn"
              onClick={handleNearbySearch}
              disabled={isSearchingNearby}
            >
              <span>📍</span>
              {isSearchingNearby ? 'Scanning 2dsphere...' : 'Find Nearby (GPS)'}
            </button>
          </div>

          {/* Region Fast Jump */}
          <select
            onChange={(e) => {
              const reg = REGION_PRESETS.find((r) => r.name === e.target.value);
              if (reg) handleRegionJump(reg);
            }}
            style={{
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: '#fff',
            }}
          >
            <option value="">Jump to Region...</option>
            {REGION_PRESETS.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Reset / Refresh */}
          <button
            type="button"
            onClick={fetchMapData}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              cursor: 'pointer',
              fontWeight: 600,
              color: '#334155',
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Nearby 2dsphere Search Results Banner */}
      {nearbyStats && (
        <div
          style={{
            background: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            padding: '0.45rem 1.5rem',
            fontSize: '0.85rem',
            color: '#1e40af',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            📍 <strong>Geospatial Query Active:</strong> Showing {nearbyStats.totalFound} emergency resources within{' '}
            <strong>{nearbyStats.radiusKm} km</strong> of your GPS position.
          </span>
          <button
            type="button"
            onClick={() => {
              setNearbyStats(null);
              fetchMapData();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#1e40af',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.82rem',
            }}
          >
            Clear Proximity Filter
          </button>
        </div>
      )}

      {/* ── Main Map + Sidebar Layout ────────────────────────── */}
      <div className="map-layout-body">
        {/* Leaflet Map Canvas */}
        <div className="leaflet-map-wrapper">
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

          {loading && (
            <div
              style={{
                position: 'absolute',
                top: '1rem',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.95)',
                padding: '0.6rem 1.2rem',
                borderRadius: '20px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
                fontSize: '0.88rem',
                fontWeight: 600,
                color: '#1a237e',
              }}
            >
              ⏳ Loading live disaster markers...
            </div>
          )}
        </div>

        {/* Priority-Ranked Sidebar Feed */}
        <div className="map-sidebar">
          <div className="map-sidebar-header">
            {/* Quick Stat Counters */}
            <div className="map-stats-strip">
              <div className="map-stat-box">
                <div className="stat-val" style={{ color: '#dc2626' }}>
                  {stats.criticalSOS}
                </div>
                <div className="stat-lbl">Critical</div>
              </div>
              <div className="map-stat-box">
                <div className="stat-val" style={{ color: '#ea580c' }}>
                  {stats.totalSOS}
                </div>
                <div className="stat-lbl">Total SOS</div>
              </div>
              <div className="map-stat-box">
                <div className="stat-val" style={{ color: '#0284c7' }}>
                  {stats.availableShelterSpots}
                </div>
                <div className="stat-lbl">Spots</div>
              </div>
              <div className="map-stat-box">
                <div className="stat-val" style={{ color: '#d97706' }}>
                  {stats.activeHazards}
                </div>
                <div className="stat-lbl">Hazards</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.95rem', color: '#1e293b', margin: 0, fontWeight: 700 }}>
                🚨 Priority Triage Queue ({sortedSidebarSOS.length})
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sorted by Urgency Score</span>
            </div>

            {/* Quick search input */}
            <input
              type="text"
              placeholder="Search by area or need..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                marginTop: '0.6rem',
                padding: '0.4rem 0.7rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                background: '#fff',
              }}
            />
          </div>

          <div className="map-sidebar-content">
            {sortedSidebarSOS.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>No matching SOS requests found.</p>
                <p style={{ fontSize: '0.8rem', margin: '0.3rem 0 0 0' }}>Adjust your filters or zoom out on the map.</p>
              </div>
            ) : (
              sortedSidebarSOS.map((sos) => {
                const tierClass = (sos.priority || 'high').toLowerCase();
                const isSelected = selectedSOSId === sos.id;
                const v = sos.vulnerabilities || {};

                return (
                  <div
                    key={sos.id}
                    className={`sidebar-item-card ${tierClass}`}
                    onClick={() => handleFocusItem(sos)}
                    style={{
                      background: isSelected ? '#f1f5f9' : '#fff',
                      boxShadow: isSelected ? '0 0 0 2px #1a237e' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{sos.title}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(sos.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                          {sos.address || 'GPS Coordinates'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '12px',
                            background:
                              sos.priority === 'Critical' ? '#fee2e2' : sos.priority === 'High' ? '#fef3c7' : '#e0f2fe',
                            color:
                              sos.priority === 'Critical' ? '#991b1b' : sos.priority === 'High' ? '#92400e' : '#075985',
                          }}
                        >
                          {sos.priorityScore} pts
                        </span>
                      </div>
                    </div>

                    {/* Vulnerability factors */}
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', margin: '0.5rem 0 0.3rem 0' }}>
                      {v.pregnantWomen > 0 && (
                        <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#991b1b', padding: '0.1rem 0.35rem', borderRadius: 3, fontWeight: 700 }}>
                          🤰 {v.pregnantWomen}
                        </span>
                      )}
                      {v.injured > 0 && (
                        <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#991b1b', padding: '0.1rem 0.35rem', borderRadius: 3, fontWeight: 700 }}>
                          🩹 {v.injured}
                        </span>
                      )}
                      {v.children > 0 && (
                        <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1e40af', padding: '0.1rem 0.35rem', borderRadius: 3, fontWeight: 700 }}>
                          👶 {v.children}
                        </span>
                      )}
                      {v.elderly > 0 && (
                        <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '0.1rem 0.35rem', borderRadius: 3, fontWeight: 700 }}>
                          👵 {v.elderly}
                        </span>
                      )}
                      <span style={{ fontSize: '0.7rem', background: '#f1f5f9', color: '#475569', padding: '0.1rem 0.35rem', borderRadius: 3 }}>
                        👥 {sos.numberOfPeople} people
                      </span>
                      {sos.distanceKm !== undefined && (
                        <span style={{ fontSize: '0.7rem', background: '#ecfdf5', color: '#047857', padding: '0.1rem 0.35rem', borderRadius: 3, fontWeight: 700 }}>
                          📍 {sos.distanceKm} km away
                        </span>
                      )}
                    </div>

                    {/* Needs tags */}
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                      {(sos.needs || []).map((need) => (
                        <span
                          key={need}
                          style={{
                            fontSize: '0.7rem',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '3px',
                            color: '#334155',
                            textTransform: 'capitalize',
                          }}
                        >
                          {need}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DisasterMapPage;
