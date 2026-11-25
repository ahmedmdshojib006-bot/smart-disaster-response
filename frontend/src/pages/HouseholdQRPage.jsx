import React, { useState, useEffect, useCallback, useRef } from 'react';
import jsQR from 'jsqr';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import axiosInstance from '../api/axiosInstance.js';

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

const INITIAL_HOUSEHOLD_FORM = {
  headName: '',
  phone: '',
  nationalId: '',
  memberCount: 4,
  children: 0,
  elderly: 0,
  pregnantWomen: 0,
  disabled: 0,
  villageOrWard: '',
  unionOrMunicipality: '',
  upazila: '',
  district: 'Feni',
};

export default function HouseholdQRPage() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const isCoordinator = ['Admin', 'NGO', 'Volunteer'].includes(user?.role);
  const canDeductInventory = ['Admin', 'NGO'].includes(user?.role);
  const isAdmin = user?.role === 'Admin';

  const [activeTab, setActiveTab] = useState(isCoordinator ? 'scan' : 'households');
  const [rounds, setRounds] = useState([
    'Round 1 - Emergency Food & Water',
    'Round 2 - Medical & Hygiene Kit',
    'Round 3 - Shelter & Blankets',
  ]);
  const [selectedRound, setSelectedRound] = useState('Round 1 - Emergency Food & Water');
  const [customRoundInput, setCustomRoundInput] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [coverageFilter, setCoverageFilter] = useState('all');

  const [households, setHouseholds] = useState([]);
  const [coverageData, setCoverageData] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [scanInput, setScanInput] = useState('');
  const [scanMethod, setScanMethod] = useState('Manual ID');
  const [verifying, setVerifying] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const [distributionCenter, setDistributionCenter] = useState('');
  const [itemName, setItemName] = useState('Emergency Food & Water Family Kit');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnit, setItemUnit] = useState('kit');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [resourceQty, setResourceQty] = useState(1);
  const [distributionNotes, setDistributionNotes] = useState('');
  const [submittingDist, setSubmittingDist] = useState(false);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState(null);
  const [qrCardModal, setQrCardModal] = useState(null);
  const [qrCardHistory, setQrCardHistory] = useState([]);
  const [formData, setFormData] = useState(INITIAL_HOUSEHOLD_FORM);
  const [savingForm, setSavingForm] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const activeRoundValue = customRoundInput.trim() ? customRoundInput.trim() : selectedRound;

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('round', activeRoundValue);
      if (selectedDistrict !== 'All') params.append('district', selectedDistrict);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (coverageFilter !== 'all') params.append('coverageFilter', coverageFilter);

      const requests = [
        axiosInstance.get(`/api/households?${params}`),
        axiosInstance.get('/api/households/rounds'),
      ];

      if (isCoordinator) {
        const covParams = new URLSearchParams();
        covParams.append('round', activeRoundValue);
        if (selectedDistrict !== 'All') covParams.append('district', selectedDistrict);
        requests.push(axiosInstance.get(`/api/households/coverage?${covParams}`));
      }

      if (canDeductInventory) {
        requests.push(axiosInstance.get('/api/resources?status=In Stock'));
      }

      const results = await Promise.all(requests);

      if (results[0]?.data?.success) {
        setHouseholds(results[0].data.households || []);
      }
      if (results[1]?.data?.success && Array.isArray(results[1].data.rounds)) {
        setRounds(results[1].data.rounds);
      }
      if (isCoordinator && results[2]?.data?.success) {
        setCoverageData(results[2].data);
      }
      if (canDeductInventory) {
        const resIdx = isCoordinator ? 3 : 2;
        if (results[resIdx]?.data?.resources) {
          setResources(results[resIdx].data.resources);
        }
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to load household registry data.',
      });
    } finally {
      setLoading(false);
    }
  }, [activeRoundValue, selectedDistrict, searchQuery, coverageFilter, isCoordinator, canDeductInventory]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (!socket) return;
    const handleSync = () => {
      fetchAllData();
    };
    socket.on('household:registered', handleSync);
    socket.on('household:distributed', handleSync);
    return () => {
      socket.off('household:registered', handleSync);
      socket.off('household:distributed', handleSync);
    };
  }, [socket, fetchAllData]);

  const verifyCode = async (rawCode, detectedMethod = 'Manual ID') => {
    if (!rawCode || !rawCode.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a Household ID or scan a QR code.' });
      return;
    }

    setVerifying(true);
    setScanResult(null);
    setFeedback({ type: '', text: '' });
    setScanInput(rawCode.trim());
    setScanMethod(detectedMethod);

    try {
      const res = await axiosInstance.post('/api/households/verify-scan', {
        qrData: rawCode.trim(),
        distributionRound: activeRoundValue,
      });
      setScanResult(res.data);
    } catch (err) {
      setScanResult({
        success: false,
        eligible: false,
        isDuplicate: false,
        message: err.response?.data?.message || 'Verification failed.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const startCameraScanner = async () => {
    setCameraError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported in this browser. You can upload a QR image instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        scanTimerRef.current = setInterval(() => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState !== 4) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (decoded && decoded.data) {
            stopCamera();
            verifyCode(decoded.data, 'QR Camera');
          }
        }, 250);
      }, 150);
    } catch {
      setCameraError('Could not access camera permission. Try uploading a QR image or entering the ID manually.');
      stopCamera();
    }
  };

  const handleQrImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);

        if (decoded && decoded.data) {
          verifyCode(decoded.data, 'QR Image');
        } else {
          setScanResult({
            success: false,
            eligible: false,
            message: 'No valid QR code detected in the uploaded image.',
          });
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirmDistribution = async (e) => {
    e.preventDefault();
    if (!scanResult?.household) return;

    setSubmittingDist(true);
    setFeedback({ type: '', text: '' });

    try {
      const payload = {
        qrData: scanInput,
        householdId: scanResult.household.householdId,
        distributionRound: activeRoundValue,
        distributionCenter,
        scanMethod,
        notes: distributionNotes,
        itemsProvided: [
          {
            itemName: itemName.trim() || 'Family Relief Kit',
            quantity: Math.max(1, parseInt(itemQuantity, 10) || 1),
            unit: itemUnit.trim() || 'kit',
          },
        ],
      };

      if (canDeductInventory && selectedResourceId) {
        payload.resourceId = selectedResourceId;
        payload.resourceQuantity = Math.max(1, parseInt(resourceQty, 10) || 1);
      }

      const res = await axiosInstance.post('/api/households/distribute', payload);
      if (res.data.success) {
        setFeedback({ type: 'success', text: res.data.message });
        setDistributionNotes('');
        await verifyCode(scanResult.household.qrPayload || scanResult.household.householdId, scanMethod);
        fetchAllData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Could not record distribution.',
      });
      if (err.response?.data?.isDuplicate) {
        await verifyCode(scanResult.household.householdId, scanMethod);
      }
    } finally {
      setSubmittingDist(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setSavingForm(true);
    setFeedback({ type: '', text: '' });

    try {
      const payload = {
        headName: formData.headName,
        phone: formData.phone,
        nationalId: formData.nationalId,
        memberCount: Number(formData.memberCount),
        vulnerabilities: {
          children: Number(formData.children) || 0,
          elderly: Number(formData.elderly) || 0,
          pregnantWomen: Number(formData.pregnantWomen) || 0,
          disabled: Number(formData.disabled) || 0,
        },
        address: {
          villageOrWard: formData.villageOrWard,
          unionOrMunicipality: formData.unionOrMunicipality,
          upazila: formData.upazila,
          district: formData.district,
        },
      };

      const res = await axiosInstance.post('/api/households', payload);
      if (res.data.success) {
        setFeedback({ type: 'success', text: res.data.message });
        setShowRegisterModal(false);
        setFormData(INITIAL_HOUSEHOLD_FORM);
        setQrCardModal(res.data.household);
        setQrCardHistory([]);
        fetchAllData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to register household.',
      });
    } finally {
      setSavingForm(false);
    }
  };

  const handleOpenEdit = (hh) => {
    setEditingHousehold(hh);
    setFormData({
      headName: hh.headName || '',
      phone: hh.phone || '',
      nationalId: hh.nationalId || '',
      memberCount: hh.memberCount || 1,
      children: hh.vulnerabilities?.children || 0,
      elderly: hh.vulnerabilities?.elderly || 0,
      pregnantWomen: hh.vulnerabilities?.pregnantWomen || 0,
      disabled: hh.vulnerabilities?.disabled || 0,
      villageOrWard: hh.address?.villageOrWard || '',
      unionOrMunicipality: hh.address?.unionOrMunicipality || '',
      upazila: hh.address?.upazila || '',
      district: hh.address?.district || 'Feni',
      status: hh.status || 'Active',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingHousehold) return;
    setSavingForm(true);

    try {
      const payload = {
        headName: formData.headName,
        phone: formData.phone,
        memberCount: Number(formData.memberCount),
        status: formData.status,
        vulnerabilities: {
          children: Number(formData.children) || 0,
          elderly: Number(formData.elderly) || 0,
          pregnantWomen: Number(formData.pregnantWomen) || 0,
          disabled: Number(formData.disabled) || 0,
        },
        address: {
          villageOrWard: formData.villageOrWard,
          unionOrMunicipality: formData.unionOrMunicipality,
          upazila: formData.upazila,
          district: formData.district,
        },
      };

      const res = await axiosInstance.put(`/api/households/${editingHousehold._id}`, payload);
      if (res.data.success) {
        setFeedback({ type: 'success', text: res.data.message });
        setShowEditModal(false);
        setEditingHousehold(null);
        fetchAllData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update household.',
      });
    } finally {
      setSavingForm(false);
    }
  };

  const handleDeleteHousehold = async (hh) => {
    if (!window.confirm(`Delete household ${hh.householdId} (${hh.headName}) and its logs?`)) return;
    try {
      const res = await axiosInstance.delete(`/api/households/${hh._id}`);
      if (res.data.success) {
        setFeedback({ type: 'success', text: res.data.message });
        fetchAllData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to delete household.',
      });
    }
  };

  const handleOpenQrCard = async (hh) => {
    setQrCardModal(hh);
    setQrCardHistory([]);
    try {
      const res = await axiosInstance.get(`/api/households/${hh._id}`);
      if (res.data.success) {
        setQrCardModal(res.data.household);
        setQrCardHistory(res.data.distributions || []);
      }
    } catch {
    }
  };

  const handleDownloadQrPng = (hh) => {
    if (!hh?.qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = hh.qrCodeDataUrl;
    link.download = `${hh.householdId}-QR-Card.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintCard = (hh) => {
    if (!hh?.qrCodeDataUrl) return;
    const win = window.open('', '_blank', 'width=520,height=650');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>ReliefSync Household Card - ${hh.householdId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; text-align: center; color: #1e293b; }
            .card { border: 2px solid #1a237e; border-radius: 12px; padding: 24px; max-width: 400px; margin: 0 auto; }
            .badge { display: inline-block; background: #1a237e; color: #fff; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-bottom: 12px; }
            .info { text-align: left; background: #f8fafc; padding: 12px; border-radius: 8px; margin-top: 12px; font-size: 13px; line-height: 1.6; }
            img { width: 220px; height: 220px; margin: 10px 0; border: 1px solid #cbd5e1; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">ReliefSync Official Family Card</div>
            <h2 style="margin: 6px 0; color: #1a237e;">${hh.householdId}</h2>
            <img src="${hh.qrCodeDataUrl}" alt="Household QR" />
            <div class="info">
              <div><strong>Head of Family:</strong> ${hh.headName}</div>
              <div><strong>Family Members:</strong> ${hh.memberCount}</div>
              <div><strong>District:</strong> ${hh.address?.district || ''}</div>
              <div><strong>Location:</strong> ${[hh.address?.villageOrWard, hh.address?.upazila].filter(Boolean).join(', ')}</div>
              <div><strong>Phone:</strong> ${hh.phone}</div>
            </div>
            <p style="font-size: 11px; color: #64748b; margin-top: 14px;">Present this QR card at relief checkpoints to prevent duplicate entries and ensure fair delivery.</p>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const summary = coverageData?.summary;

  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-content">
        <div
          style={{
            background: 'linear-gradient(135deg, #1a237e, #1d4ed8)',
            borderRadius: '12px',
            padding: '1.8rem',
            color: 'white',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 24px rgba(26,35,126,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.65rem', margin: 0, fontWeight: 800 }}>
              🪪 Household Relief ID & QR Verification
            </h1>
            <p style={{ margin: '0.4rem 0 0 0', opacity: 0.9, fontSize: '0.95rem', maxWidth: 640 }}>
              Register affected families with tamper-proof QR cards, scan at relief distribution centers to stop duplicate claims, and monitor missed households.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setFormData(INITIAL_HOUSEHOLD_FORM);
                setShowRegisterModal(true);
              }}
              style={{
                background: '#ffffff',
                color: '#1a237e',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ➕ Register Household
            </button>

            {isCoordinator && (
              <button
                type="button"
                onClick={() => setActiveTab('scan')}
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  color: '#ffffff',
                  border: '1.5px solid rgba(255,255,255,0.55)',
                  borderRadius: '8px',
                  padding: '0.75rem 1.2rem',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                📷 QR Scanner
              </button>
            )}
          </div>
        </div>

        {feedback.text && (
          <div
            style={{
              padding: '0.9rem 1.1rem',
              borderRadius: '8px',
              marginBottom: '1.2rem',
              background: feedback.type === 'error' ? '#fee2e2' : '#dcfce7',
              color: feedback.type === 'error' ? '#991b1b' : '#166534',
              border: `1px solid ${feedback.type === 'error' ? '#fca5a5' : '#86efac'}`,
              fontWeight: 600,
            }}
          >
            {feedback.text}
          </div>
        )}

        {isCoordinator && summary && (
          <div className="dashboard-card" style={{ padding: '1.25rem 1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.8rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.05rem' }}>
                  Active Relief Round Coverage Tracking
                </h3>
                <span style={{ fontSize: '0.84rem', color: '#64748b' }}>
                  Monitoring round: <strong>{activeRoundValue}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={selectedRound}
                  onChange={(e) => {
                    setSelectedRound(e.target.value);
                    setCustomRoundInput('');
                    setScanResult(null);
                  }}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    background: '#fff',
                  }}
                >
                  {rounds.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Or custom round name..."
                  value={customRoundInput}
                  onChange={(e) => {
                    setCustomRoundInput(e.target.value);
                    setScanResult(null);
                  }}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    width: '185px',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
              }}
            >
              <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Registered Families
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1e293b' }}>
                  {summary.totalHouseholds}
                </div>
              </div>

              <div style={{ background: '#f0fdf4', padding: '0.9rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>
                  Received Relief
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#166534' }}>
                  {summary.coveredCount}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#15803d' }}>
                  {summary.totalPeopleCovered} people served
                </div>
              </div>

              <div
                style={{
                  background: summary.missedCount > 0 ? '#fff7ed' : '#f0fdf4',
                  padding: '0.9rem',
                  borderRadius: '8px',
                  border: `1px solid ${summary.missedCount > 0 ? '#fed7aa' : '#bbf7d0'}`,
                }}
              >
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: summary.missedCount > 0 ? '#c2410c' : '#15803d',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Missed / Pending
                </div>
                <div
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: summary.missedCount > 0 ? '#ea580c' : '#166534',
                  }}
                >
                  {summary.missedCount}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#9a3412' }}>
                  {summary.totalPeopleMissed} people waiting
                </div>
              </div>

              <div style={{ background: '#eff6ff', padding: '0.9rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase' }}>
                  Round Coverage
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1e3a8a' }}>
                  {summary.coveragePercent}%
                </div>
                <div style={{ height: '7px', background: '#dbeafe', borderRadius: '4px', marginTop: '0.35rem', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${summary.coveragePercent}%`,
                      height: '100%',
                      background: '#2563eb',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {isCoordinator && (
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              style={{
                padding: '0.65rem 1.2rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: activeTab === 'scan' ? '#1a237e' : '#ffffff',
                color: activeTab === 'scan' ? '#ffffff' : '#334155',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              📷 Scan & Distribute
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('households')}
            style={{
              padding: '0.65rem 1.2rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: activeTab === 'households' ? '#1a237e' : '#ffffff',
              color: activeTab === 'households' ? '#ffffff' : '#334155',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🪪 Registered Households ({households.length})
          </button>

          {isCoordinator && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('missed')}
                style={{
                  padding: '0.65rem 1.2rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: activeTab === 'missed' ? '#1a237e' : '#ffffff',
                  color: activeTab === 'missed' ? '#ffffff' : '#334155',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ⚠️ Missed Families ({summary?.missedCount ?? 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '0.65rem 1.2rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: activeTab === 'history' ? '#1a237e' : '#ffffff',
                  color: activeTab === 'history' ? '#ffffff' : '#334155',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                📜 Distribution Log ({coverageData?.recentDistributions?.length ?? 0})
              </button>
            </>
          )}
        </div>

        {activeTab === 'scan' && isCoordinator && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            <div className="dashboard-card" style={{ marginBottom: 0 }}>
              <h2 style={{ fontSize: '1.2rem', color: '#1a237e', marginBottom: '0.4rem' }}>
                Verify Household QR Code
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1rem' }}>
                Scan via device camera, upload a QR card PNG, or enter the Household ID before handing out relief supplies for <strong>{activeRoundValue}</strong>.
              </p>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={startCameraScanner}
                    style={{
                      background: '#1a237e',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '7px',
                      padding: '0.6rem 1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    📷 Start Camera Scanner
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    style={{
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '7px',
                      padding: '0.6rem 1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ⏹ Stop Camera
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: '#f1f5f9',
                    color: '#1e293b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '7px',
                    padding: '0.6rem 1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  🖼️ Scan QR Image File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQrImageUpload}
                  style={{ display: 'none' }}
                />
              </div>

              {cameraError && (
                <div style={{ padding: '0.75rem', background: '#fef3c7', color: '#92400e', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.88rem' }}>
                  {cameraError}
                </div>
              )}

              {cameraActive && (
                <div style={{ marginBottom: '1rem', textAlign: 'center', background: '#0f172a', borderRadius: '8px', padding: '0.75rem' }}>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{ width: '100%', maxWidth: '340px', borderRadius: '6px' }}
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                    Point camera directly at household QR card...
                  </div>
                </div>
              )}

              <div style={{ marginTop: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Manual Household ID or QR Payload
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="e.g. HH-FEN-1001 or RELIEFSYNC:HH:..."
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        verifyCode(scanInput, 'Manual ID');
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.9rem',
                      borderRadius: '7px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.95rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => verifyCode(scanInput, 'Manual ID')}
                    disabled={verifying}
                    style={{
                      background: '#059669',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '7px',
                      padding: '0.65rem 1.1rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {verifying ? 'Checking...' : 'Verify'}
                  </button>
                </div>
              </div>
            </div>

            <div className="dashboard-card" style={{ marginBottom: 0 }}>
              <h2 style={{ fontSize: '1.2rem', color: '#1a237e', marginBottom: '0.8rem' }}>
                Eligibility & Distribution Check
              </h2>

              {!scanResult ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  Scan a QR code or enter a Household ID to check duplicate eligibility and authorize relief distribution.
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      background: scanResult.eligible ? '#dcfce7' : '#fee2e2',
                      border: `2px solid ${scanResult.eligible ? '#16a34a' : '#dc2626'}`,
                      color: scanResult.eligible ? '#14532d' : '#7f1d1d',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                      {scanResult.eligible
                        ? '✅ VERIFIED ELIGIBLE FOR RELIEF'
                        : scanResult.isDuplicate
                        ? '⛔ DUPLICATE RELIEF BLOCKED'
                        : '⚠️ VERIFICATION FAILED'}
                    </div>
                    <div style={{ fontSize: '0.9rem' }}>{scanResult.message}</div>
                  </div>

                  {scanResult.household && (
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '1.05rem', color: '#1a237e' }}>
                          {scanResult.household.householdId}
                        </strong>
                        <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                          {scanResult.household.memberCount} Members
                        </span>
                      </div>
                      <div><strong>Head:</strong> {scanResult.household.headName}</div>
                      <div><strong>Phone:</strong> {scanResult.household.phone}</div>
                      <div>
                        <strong>Location:</strong>{' '}
                        {[
                          scanResult.household.address?.villageOrWard,
                          scanResult.household.address?.upazila,
                          scanResult.household.address?.district,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                      <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {scanResult.household.vulnerabilities?.children > 0 && (
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                            Children: {scanResult.household.vulnerabilities.children}
                          </span>
                        )}
                        {scanResult.household.vulnerabilities?.elderly > 0 && (
                          <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                            Elderly: {scanResult.household.vulnerabilities.elderly}
                          </span>
                        )}
                        {scanResult.household.vulnerabilities?.pregnantWomen > 0 && (
                          <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                            Pregnant: {scanResult.household.vulnerabilities.pregnantWomen}
                          </span>
                        )}
                        {scanResult.household.vulnerabilities?.disabled > 0 && (
                          <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                            Disabled: {scanResult.household.vulnerabilities.disabled}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {scanResult.isDuplicate && scanResult.existingDistribution && (
                    <div style={{ background: '#fff1f2', padding: '0.9rem', borderRadius: '8px', border: '1px solid #fecdd3', fontSize: '0.88rem', color: '#881337' }}>
                      <div><strong>Already Distributed On:</strong> {new Date(scanResult.existingDistribution.distributedAt).toLocaleString()}</div>
                      <div><strong>Distributed By:</strong> {scanResult.existingDistribution.distributedByName} ({scanResult.existingDistribution.distributedByRole})</div>
                      {scanResult.existingDistribution.distributionCenter && (
                        <div><strong>Center:</strong> {scanResult.existingDistribution.distributionCenter}</div>
                      )}
                    </div>
                  )}

                  {scanResult.eligible && (
                    <form onSubmit={handleConfirmDistribution} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Relief Package / Items Given
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            required
                            style={{ flex: 2, padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          />
                          <input
                            type="number"
                            min="1"
                            value={itemQuantity}
                            onChange={(e) => setItemQuantity(e.target.value)}
                            required
                            style={{ width: '70px', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          />
                          <input
                            type="text"
                            value={itemUnit}
                            onChange={(e) => setItemUnit(e.target.value)}
                            style={{ width: '70px', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          />
                        </div>
                      </div>

                      {canDeductInventory && resources.length > 0 && (
                        <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#166534', marginBottom: '0.35rem' }}>
                            Optional: Deduct from Warehouse Inventory
                          </label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select
                              value={selectedResourceId}
                              onChange={(e) => setSelectedResourceId(e.target.value)}
                              style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="">No inventory deduction</option>
                              {resources.map((r) => (
                                <option key={r._id} value={r._id}>
                                  {r.name} ({r.quantityAvailable} {r.unit} available)
                                </option>
                              ))}
                            </select>
                            {selectedResourceId && (
                              <input
                                type="number"
                                min="1"
                                value={resourceQty}
                                onChange={(e) => setResourceQty(e.target.value)}
                                style={{ width: '75px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Distribution Camp / Center (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Feni Govt College Camp"
                          value={distributionCenter}
                          onChange={(e) => setDistributionCenter(e.target.value)}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Notes (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Any remarks..."
                          value={distributionNotes}
                          onChange={(e) => setDistributionNotes(e.target.value)}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingDist}
                        style={{
                          background: '#16a34a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.8rem',
                          fontSize: '0.98rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {submittingDist ? 'Recording Delivery...' : 'Confirm & Record Relief Delivery'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'households' && (
          <div className="dashboard-card">
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <input
                type="text"
                placeholder="Search by Household ID, Name, Phone or Ward..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 2,
                  minWidth: '220px',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.92rem',
                }}
              />

              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                style={{
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  background: '#fff',
                }}
              >
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d === 'All' ? 'All Districts' : d}
                  </option>
                ))}
              </select>

              {isCoordinator && (
                <select
                  value={coverageFilter}
                  onChange={(e) => setCoverageFilter(e.target.value)}
                  style={{
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    background: '#fff',
                  }}
                >
                  <option value="all">All Coverage Status</option>
                  <option value="missed">Pending / Not Received</option>
                  <option value="received">Already Received</option>
                </select>
              )}
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Loading households...</p>
            ) : households.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem', background: '#f8fafc', borderRadius: '8px' }}>
                No registered households found matching your filters. Click "Register Household" to issue a Family QR Card.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.2rem' }}>
                {households.map((hh) => (
                  <div
                    key={hh._id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '1.15rem',
                      background: '#ffffff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.8rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div>
                          <span
                            style={{
                              display: 'inline-block',
                              background: '#e0e7ff',
                              color: '#1e3a8a',
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '6px',
                              marginBottom: '0.35rem',
                            }}
                          >
                            {hh.householdId}
                          </span>
                          <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#1e293b' }}>{hh.headName}</h3>
                        </div>

                        {hh.qrCodeDataUrl && (
                          <img
                            src={hh.qrCodeDataUrl}
                            alt={hh.householdId}
                            onClick={() => handleOpenQrCard(hh)}
                            style={{
                              width: '64px',
                              height: '64px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          />
                        )}
                      </div>

                      <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: '0.5rem', lineHeight: 1.5 }}>
                        <div><strong>Members:</strong> {hh.memberCount} | <strong>Phone:</strong> {hh.phone}</div>
                        <div>
                          <strong>Area:</strong>{' '}
                          {[hh.address?.villageOrWard, hh.address?.upazila, hh.address?.district].filter(Boolean).join(', ')}
                        </div>
                        <div style={{ marginTop: '0.35rem' }}>
                          {hh.receivedInRound ? (
                            <span style={{ background: '#dcfce7', color: '#166534', padding: '0.18rem 0.55rem', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 700 }}>
                              ✅ Received ({activeRoundValue})
                            </span>
                          ) : (
                            <span style={{ background: '#ffedd5', color: '#9a3412', padding: '0.18rem 0.55rem', borderRadius: '12px', fontSize: '0.76rem', fontWeight: 700 }}>
                              ⏳ Pending in Current Round
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenQrCard(hh)}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid #1a237e',
                          background: '#eff6ff',
                          color: '#1a237e',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        🪪 QR Card
                      </button>

                      {isCoordinator && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('scan');
                            verifyCode(hh.qrPayload || hh.householdId, 'QR Camera');
                          }}
                          style={{
                            flex: 1,
                            padding: '0.45rem 0.6rem',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#059669',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                          }}
                        >
                          📷 Verify
                        </button>
                      )}

                      {isCoordinator && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(hh)}
                          style={{
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            color: '#334155',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                          }}
                        >
                          ✏️
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteHousehold(hh)}
                          style={{
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'missed' && isCoordinator && (
          <div className="dashboard-card">
            <h2 style={{ fontSize: '1.25rem', color: '#c2410c', marginBottom: '0.4rem' }}>
              ⚠️ Unreached & Pending Households ({activeRoundValue})
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.2rem' }}>
              Families listed below are registered in the system but have not yet received relief for this round. Dispatch field teams to guarantee no household is missed.
            </p>

            {coverageData?.districtBreakdown?.length > 0 && (
              <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.7rem' }}>District</th>
                      <th style={{ padding: '0.7rem' }}>Total Families</th>
                      <th style={{ padding: '0.7rem' }}>Covered</th>
                      <th style={{ padding: '0.7rem' }}>Missed / Pending</th>
                      <th style={{ padding: '0.7rem' }}>Coverage %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverageData.districtBreakdown.map((d) => {
                      const pct = d.total > 0 ? Math.round((d.covered / d.total) * 100) : 0;
                      return (
                        <tr key={d.district} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.7rem', fontWeight: 700 }}>{d.district}</td>
                          <td style={{ padding: '0.7rem' }}>{d.total}</td>
                          <td style={{ padding: '0.7rem', color: '#15803d', fontWeight: 700 }}>{d.covered}</td>
                          <td style={{ padding: '0.7rem', color: d.missed > 0 ? '#ea580c' : '#15803d', fontWeight: 700 }}>
                            {d.missed}
                          </td>
                          <td style={{ padding: '0.7rem' }}>{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!coverageData?.missedHouseholds?.length ? (
              <div style={{ padding: '2rem', textAlign: 'center', background: '#f0fdf4', color: '#166534', borderRadius: '8px', fontWeight: 700 }}>
                🎉 100% Coverage! Every registered active household has received relief for this round.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#fff7ed', textAlign: 'left', borderBottom: '2px solid #fed7aa' }}>
                      <th style={{ padding: '0.7rem' }}>Household ID</th>
                      <th style={{ padding: '0.7rem' }}>Head of Family</th>
                      <th style={{ padding: '0.7rem' }}>Members</th>
                      <th style={{ padding: '0.7rem' }}>Location</th>
                      <th style={{ padding: '0.7rem' }}>Phone</th>
                      <th style={{ padding: '0.7rem' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverageData.missedHouseholds.map((hh) => (
                      <tr key={hh._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.7rem', fontWeight: 700, color: '#1a237e' }}>{hh.householdId}</td>
                        <td style={{ padding: '0.7rem' }}>{hh.headName}</td>
                        <td style={{ padding: '0.7rem' }}>{hh.memberCount}</td>
                        <td style={{ padding: '0.7rem' }}>
                          {[hh.address?.villageOrWard, hh.address?.district].filter(Boolean).join(', ')}
                        </td>
                        <td style={{ padding: '0.7rem' }}>{hh.phone}</td>
                        <td style={{ padding: '0.7rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('scan');
                              verifyCode(hh.qrPayload || hh.householdId, 'Manual ID');
                            }}
                            style={{
                              background: '#ea580c',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Distribute Now
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && isCoordinator && (
          <div className="dashboard-card">
            <h2 style={{ fontSize: '1.25rem', color: '#1a237e', marginBottom: '1rem' }}>
              📜 Verified Household Relief Distribution Log ({activeRoundValue})
            </h2>

            {!coverageData?.recentDistributions?.length ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                No relief distributions logged yet for this round.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.7rem' }}>Date & Time</th>
                      <th style={{ padding: '0.7rem' }}>Household ID</th>
                      <th style={{ padding: '0.7rem' }}>Head Name</th>
                      <th style={{ padding: '0.7rem' }}>Items Provided</th>
                      <th style={{ padding: '0.7rem' }}>Method</th>
                      <th style={{ padding: '0.7rem' }}>Distributed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverageData.recentDistributions.map((dist) => (
                      <tr key={dist._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.7rem', color: '#475569' }}>
                          {new Date(dist.distributedAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.7rem', fontWeight: 700, color: '#1a237e' }}>
                          {dist.householdIdCode}
                        </td>
                        <td style={{ padding: '0.7rem' }}>{dist.headName}</td>
                        <td style={{ padding: '0.7rem' }}>
                          {(dist.itemsProvided || []).map((i) => `${i.itemName} (${i.quantity} ${i.unit})`).join(', ')}
                        </td>
                        <td style={{ padding: '0.7rem' }}>
                          <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.76rem', fontWeight: 600 }}>
                            {dist.scanMethod}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem' }}>
                          {dist.distributedByName} ({dist.distributedByRole})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {(showRegisterModal || showEditModal) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.6rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: '#1a237e', fontSize: '1.25rem' }}>
                {showEditModal ? `Edit Household (${editingHousehold?.householdId})` : 'Register Household & Generate QR'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowRegisterModal(false);
                  setShowEditModal(false);
                }}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={showEditModal ? handleEditSubmit : handleRegisterSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
            >
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem', marginBottom: '0.25rem' }}>
                  Head of Household Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.headName}
                  onChange={(e) => setFormData({ ...formData, headName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem', marginBottom: '0.25rem' }}>
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem', marginBottom: '0.25rem' }}>
                    National ID / Birth Reg (Optional)
                  </label>
                  <input
                    type="text"
                    disabled={showEditModal}
                    value={formData.nationalId}
                    onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem', marginBottom: '0.25rem' }}>
                    District *
                  </label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    {DISTRICTS.filter((d) => d !== 'All').map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem', marginBottom: '0.25rem' }}>
                    Total Family Members *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formData.memberCount}
                    onChange={(e) => setFormData({ ...formData, memberCount: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem', marginBottom: '0.25rem' }}>
                    Village / Ward
                  </label>
                  <input
                    type="text"
                    value={formData.villageOrWard}
                    onChange={(e) => setFormData({ ...formData, villageOrWard: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem', marginBottom: '0.25rem' }}>
                    Upazila / Thana
                  </label>
                  <input
                    type="text"
                    value={formData.upazila}
                    onChange={(e) => setFormData({ ...formData, upazila: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                  Vulnerable Members in Household
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.76rem' }}>Children</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.children}
                      onChange={(e) => setFormData({ ...formData, children: e.target.value })}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.76rem' }}>Elderly</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.elderly}
                      onChange={(e) => setFormData({ ...formData, elderly: e.target.value })}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.76rem' }}>Pregnant</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.pregnantWomen}
                      onChange={(e) => setFormData({ ...formData, pregnantWomen: e.target.value })}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.76rem' }}>Disabled</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.disabled}
                      onChange={(e) => setFormData({ ...formData, disabled: e.target.value })}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
              </div>

              {showEditModal && (
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem', marginBottom: '0.25rem' }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Relocated">Relocated</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={savingForm}
                style={{
                  background: '#1a237e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '0.4rem',
                }}
              >
                {savingForm ? 'Saving...' : showEditModal ? 'Save Changes' : 'Register & Generate QR Card'}
              </button>
            </form>
          </div>
        </div>
      )}

      {qrCardModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              maxWidth: '460px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '1.6rem',
              textAlign: 'center',
              borderTop: '5px solid #1a237e',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ background: '#e0e7ff', color: '#1a237e', padding: '0.25rem 0.7rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                Digital Family Relief Card
              </span>
              <button
                type="button"
                onClick={() => setQrCardModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <h2 style={{ margin: '0.3rem 0', color: '#1a237e', fontSize: '1.5rem' }}>{qrCardModal.householdId}</h2>
            <p style={{ margin: 0, color: '#475569', fontWeight: 600 }}>{qrCardModal.headName}</p>

            {qrCardModal.qrCodeDataUrl && (
              <img
                src={qrCardModal.qrCodeDataUrl}
                alt={qrCardModal.householdId}
                style={{
                  width: '210px',
                  height: '210px',
                  margin: '1rem auto',
                  border: '2px solid #cbd5e1',
                  borderRadius: '10px',
                }}
              />
            )}

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', textAlign: 'left', fontSize: '0.86rem', color: '#334155', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
              <div><strong>Members:</strong> {qrCardModal.memberCount}</div>
              <div><strong>Phone:</strong> {qrCardModal.phone}</div>
              <div><strong>District:</strong> {qrCardModal.address?.district}</div>
              <div><strong>QR Payload:</strong> <code style={{ fontSize: '0.78rem' }}>{qrCardModal.qrPayload}</code></div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => handleDownloadQrPng(qrCardModal)}
                style={{
                  flex: 1,
                  background: '#1a237e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '0.65rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ⬇️ Download QR PNG
              </button>
              <button
                type="button"
                onClick={() => handlePrintCard(qrCardModal)}
                style={{
                  flex: 1,
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '0.65rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🖨️ Print Card
              </button>
            </div>

            {qrCardHistory.length > 0 && (
              <div style={{ textAlign: 'left', borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem' }}>
                <strong style={{ fontSize: '0.86rem', color: '#1e293b' }}>Past Relief Receipts:</strong>
                <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {qrCardHistory.map((d) => (
                    <div key={d._id} style={{ fontSize: '0.8rem', background: '#f0fdf4', padding: '0.5rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      <div><strong>{d.distributionRound}</strong></div>
                      <div style={{ color: '#475569' }}>{new Date(d.distributedAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
