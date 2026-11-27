// frontend/src/pages/MissingPersonsPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Member-3: Module 3 — Community Engagement & Safety Network
// Missing Persons & Family Reunification Board.
// Allows users, volunteers, and rescue workers to post missing person reports
// with photos and details, and mark individuals as "Safe" once found.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import axiosInstance from '../api/axiosInstance.js';

const DISTRICTS = ['All', 'Feni', 'Sylhet', 'Noakhali', 'Sunamganj', 'Chittagong', 'Cox\'s Bazar', 'Kurigram', 'Dhaka'];
const GENDERS = ['All', 'Male', 'Female', 'Child', 'Other'];
const STATUSES = ['All', 'Missing', 'Found / Safe'];

export default function MissingPersonsPage() {
  const { user } = useAuth();
  const { socket } = useSocket();

  // ── State ──────────────────────────────────────────────────────────────────
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMarkSafeModal, setShowMarkSafeModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form: Report Missing Person
  const [reportForm, setReportForm] = useState({
    fullName: '',
    age: '',
    gender: 'Male',
    district: 'Feni',
    upazila: '',
    landmark: '',
    lastSeenDate: new Date().toISOString().split('T')[0],
    physicalDescription: '',
    medicalNeeds: '',
    contactName: '',
    contactRelationship: 'Family Member',
    contactPhone: '',
    contactAltPhone: '',
    photoUrl: '',
  });

  // Form: Mark Safe
  const [safeForm, setSafeForm] = useState({
    foundLocation: '',
    rescueShelterId: '',
    notes: '',
  });

  // ── Fetch Data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [reportsRes, statsRes] = await Promise.all([
        axiosInstance.get('/api/missing-persons'),
        axiosInstance.get('/api/missing-persons/stats'),
      ]);

      if (reportsRes.data?.reports) {
        setReports(reportsRes.data.reports);
      }
      if (statsRes.data?.stats) {
        setStats(statsRes.data.stats);
      }
    } catch (err) {
      console.error('Error fetching missing person records:', err);
      setErrorMsg('Failed to load missing persons data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShelters = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/api/shelters');
      if (res.data?.shelters) {
        setShelters(res.data.shelters);
      }
    } catch (e) {
      // Non-critical fallback
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchShelters();
  }, [fetchData, fetchShelters]);

  // ── Real-Time WebSockets ───────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleReported = (newPerson) => {
      setFeedbackMsg(`📢 NEW MISSING REPORT: "${newPerson.fullName}" reported in ${newPerson.district}.`);
      fetchData();
    };

    const handleMarkedSafe = (data) => {
      setFeedbackMsg(`🎉 REUNITED & SAFE: "${data.fullName}" has been safely found in ${data.foundLocation}!`);
      fetchData();
    };

    socket.on('missing-person:reported', handleReported);
    socket.on('missing-person:marked-safe', handleMarkedSafe);

    return () => {
      socket.off('missing-person:reported', handleReported);
      socket.off('missing-person:marked-safe', handleMarkedSafe);
    };
  }, [socket, fetchData]);

  // ── Filtered Reports ───────────────────────────────────────────────────────
  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;
      if (districtFilter !== 'All' && item.lastSeenLocation?.district?.toLowerCase() !== districtFilter.toLowerCase()) return false;
      if (genderFilter !== 'All' && item.gender !== genderFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.fullName?.toLowerCase().includes(query);
        const matchesDesc = item.physicalDescription?.toLowerCase().includes(query);
        const matchesLandmark = item.lastSeenLocation?.landmark?.toLowerCase().includes(query);
        const matchesContact = item.contactPerson?.name?.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesLandmark && !matchesContact) return false;
      }
      return true;
    });
  }, [reports, statusFilter, districtFilter, genderFilter, searchQuery]);

  // ── Submit Report ──────────────────────────────────────────────────────────
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);

      await axiosInstance.post('/api/missing-persons', reportForm);
      setFeedbackMsg(`Report for "${reportForm.fullName}" registered successfully.`);
      setShowReportModal(false);
      setReportForm({
        fullName: '',
        age: '',
        gender: 'Male',
        district: 'Feni',
        upazila: '',
        landmark: '',
        lastSeenDate: new Date().toISOString().split('T')[0],
        physicalDescription: '',
        medicalNeeds: '',
        contactName: '',
        contactRelationship: 'Family Member',
        contactPhone: '',
        contactAltPhone: '',
        photoUrl: '',
      });
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit missing person report.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Mark Person Safe ───────────────────────────────────────────────────────
  const handleMarkSafeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPerson) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);

      await axiosInstance.patch(`/api/missing-persons/${selectedPerson._id}/safe`, safeForm);
      setFeedbackMsg(`🎉 Great news! ${selectedPerson.fullName} has been marked as Safe & Reunited.`);
      setShowMarkSafeModal(false);
      setSelectedPerson(null);
      setSafeForm({ foundLocation: '', rescueShelterId: '', notes: '' });
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update safe status.');
    } finally {
      setSubmitting(false);
    }
  };

  const openMarkSafeModal = (person) => {
    setSelectedPerson(person);
    setSafeForm({
      foundLocation: `${person.lastSeenLocation?.district || 'Relief'} Shelter / Family home`,
      rescueShelterId: shelters[0]?._id || '',
      notes: 'Safely rescued by volunteers and reunited with family.',
    });
    setShowMarkSafeModal(true);
  };

  return (
    <div style={styles.page}>
      <Navbar />

      <div style={styles.container}>
        {/* ── Header Card ──────────────────────────────────────────────────── */}
        <div style={styles.headerCard}>
          <div style={styles.headerLeft}>
            <div style={styles.badgeRow}>
              <span style={styles.moduleBadge}>Module 3: Community Safety</span>
              <span style={styles.memberBadge}>Member-3: Minhaz Chowdhury</span>
            </div>
            <h1 style={styles.title}>👥 Missing Persons & Family Reunification Board</h1>
            <p style={styles.subtitle}>
              Crowdsourced missing person reports, search & rescue coordination, and verified safe reunification records
              during disaster emergencies across Bangladesh.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              style={styles.btnPrimary}
              onClick={() => setShowReportModal(true)}
            >
              ➕ Report Missing Person
            </button>
            <button
              type="button"
              style={styles.btnOutline}
              onClick={fetchData}
              title="Refresh Reports"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* ── Feedback Toasts ──────────────────────────────────────────────── */}
        {feedbackMsg && (
          <div style={styles.alertSuccess}>
            <span>{feedbackMsg}</span>
            <button type="button" style={styles.alertClose} onClick={() => setFeedbackMsg(null)}>✕</button>
          </div>
        )}
        {errorMsg && (
          <div style={styles.alertDanger}>
            <span>⚠️ {errorMsg}</span>
            <button type="button" style={styles.alertClose} onClick={() => setErrorMsg(null)}>✕</button>
          </div>
        )}

        {/* ── Executive KPI Cards ─────────────────────────────────────────── */}
        <div style={styles.statsGrid}>
          <div style={{ ...styles.statCard, borderLeft: '5px solid #2563eb' }}>
            <div style={styles.statIcon}>📋</div>
            <div>
              <div style={styles.statLabel}>Total Reports Filed</div>
              <div style={styles.statValue}>{stats?.totalReports || reports.length}</div>
              <div style={styles.statSub}>Crowdsourced across disaster zones</div>
            </div>
          </div>

          <div style={{ ...styles.statCard, borderLeft: '5px solid #dc2626' }}>
            <div style={styles.statIcon}>🚨</div>
            <div>
              <div style={styles.statLabel}>Still Missing (Urgent)</div>
              <div style={{ ...styles.statValue, color: '#dc2626' }}>
                {stats?.totalMissing ?? reports.filter((r) => r.status === 'Missing').length}
              </div>
              <div style={styles.statSub}>Active search & rescue in progress</div>
            </div>
          </div>

          <div style={{ ...styles.statCard, borderLeft: '5px solid #059669' }}>
            <div style={styles.statIcon}>🟢</div>
            <div>
              <div style={styles.statLabel}>Safely Reunited & Found</div>
              <div style={{ ...styles.statValue, color: '#059669' }}>
                {stats?.totalFoundSafe ?? reports.filter((r) => r.status === 'Found / Safe').length}
              </div>
              <div style={styles.statSub}>Reunited with families or in shelters</div>
            </div>
          </div>

          <div style={{ ...styles.statCard, borderLeft: '5px solid #7c3aed' }}>
            <div style={styles.statIcon}>🤝</div>
            <div>
              <div style={styles.statLabel}>Reunification Success Rate</div>
              <div style={styles.statValue}>
                {stats?.reunificationRate || 0}%
              </div>
              <div style={styles.statSub}>Confirmed verified safety cases</div>
            </div>
          </div>
        </div>

        {/* ── Filters & Search Toolbar ────────────────────────────────────── */}
        <div style={styles.filterCard}>
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search missing persons by name, physical traits, landmark, or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} style={styles.clearBtn}>✕</button>
            )}
          </div>

          <div style={styles.filterRow}>
            {/* Status Tabs */}
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>Status:</span>
              <div style={styles.pillContainer}>
                {STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    style={statusFilter === st ? styles.categoryPillActive : styles.categoryPill}
                    onClick={() => setStatusFilter(st)}
                  >
                    {st === 'Missing' && '🚨 '}
                    {st === 'Found / Safe' && '🟢 '}
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* District & Gender Selectors */}
            <div style={styles.dropdownsGroup}>
              <div style={styles.selectWrapper}>
                <label style={styles.selectLabel}>District:</label>
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  style={styles.selectInput}
                >
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div style={styles.selectWrapper}>
                <label style={styles.selectLabel}>Gender:</label>
                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  style={styles.selectInput}
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Missing Persons Cards Grid ─────────────────────────────────── */}
        {loading ? (
          <div style={styles.loadingBox}>
            <div style={styles.spinner} />
            <p>Loading missing person reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <h3>No missing person reports match your criteria</h3>
            <p style={{ color: '#64748b' }}>Try adjusting your search terms or filters.</p>
            <button
              type="button"
              style={{ ...styles.btnPrimary, marginTop: '1rem' }}
              onClick={() => setShowReportModal(true)}
            >
              ➕ Report Missing Person
            </button>
          </div>
        ) : (
          <div style={styles.reportsGrid}>
            {filteredReports.map((person) => {
              const isMissing = person.status === 'Missing';

              return (
                <div
                  key={person._id}
                  style={{
                    ...styles.personCard,
                    borderTop: isMissing ? '4px solid #ef4444' : '4px solid #10b981',
                  }}
                >
                  {/* Card Header & Status */}
                  <div style={styles.cardTopRow}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: isMissing ? '#fee2e2' : '#dcfce7',
                        color: isMissing ? '#991b1b' : '#166534',
                        border: isMissing ? '1px solid #fecaca' : '1px solid #bbf7d0',
                      }}
                    >
                      {isMissing ? '🚨 STILL MISSING' : '🟢 FOUND / SAFE'}
                    </span>

                    <span style={styles.dateTag}>
                      {new Date(person.lastSeenDate || person.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Profile Info */}
                  <div style={styles.personHeader}>
                    <div style={styles.avatarBox}>
                      {person.photoUrl ? (
                        <img
                          src={person.photoUrl}
                          alt={person.fullName}
                          style={styles.avatarImg}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={styles.avatarPlaceholder}>
                          {person.gender === 'Female' ? '👩' : person.gender === 'Child' ? '🧒' : '👨'}
                        </div>
                      )}
                    </div>

                    <div style={styles.personBasicInfo}>
                      <h3 style={styles.personName}>{person.fullName}</h3>
                      <div style={styles.personSubInfo}>
                        <span>Age: <strong>{person.age} yrs</strong></span> • 
                        <span>Gender: <strong>{person.gender}</strong></span>
                      </div>
                      <div style={styles.districtTag}>
                        📍 {person.lastSeenLocation?.district}
                        {person.lastSeenLocation?.upazila ? ` • ${person.lastSeenLocation.upazila}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Location & Traits */}
                  <div style={styles.detailsSection}>
                    <div style={styles.detailRow}>
                      <span style={styles.detailKey}>Last Seen Area:</span>
                      <span style={styles.detailVal}>{person.lastSeenLocation?.landmark}</span>
                    </div>

                    {person.physicalDescription && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailKey}>Appearance:</span>
                        <span style={styles.detailVal}>{person.physicalDescription}</span>
                      </div>
                    )}

                    {person.medicalNeeds && (
                      <div style={styles.medicalAlertBox}>
                        ⚠️ <strong>Medical Needs:</strong> {person.medicalNeeds}
                      </div>
                    )}
                  </div>

                  {/* Safe Status Confirmation Box */}
                  {!isMissing && person.safetyUpdate && (
                    <div style={styles.safeSuccessBox}>
                      <div style={styles.safeHeader}>✓ Reunited & Safe</div>
                      <div style={styles.safeText}>
                        Found at: <strong>{person.safetyUpdate.foundLocation}</strong>
                        {person.safetyUpdate.rescueShelterName && (
                          <span> (Shelter: {person.safetyUpdate.rescueShelterName})</span>
                        )}
                      </div>
                      {person.safetyUpdate.notes && (
                        <div style={styles.safeNotes}>"{person.safetyUpdate.notes}"</div>
                      )}
                      <div style={styles.safeMeta}>
                        Verified by: {person.safetyUpdate.markedSafeByName || 'Rescue Team'} on{' '}
                        {new Date(person.safetyUpdate.markedSafeAt).toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  {/* Contact Footer */}
                  <div style={styles.cardFooter}>
                    <div style={styles.contactInfo}>
                      <div style={styles.contactTitle}>Emergency Contact:</div>
                      <div style={styles.contactNameText}>
                        {person.contactPerson?.name} ({person.contactPerson?.relationship})
                      </div>
                    </div>

                    <div style={styles.cardActions}>
                      {person.contactPerson?.phone && (
                        <a
                          href={`tel:${person.contactPerson.phone}`}
                          style={styles.callBtn}
                          title="Call Emergency Contact"
                        >
                          📞 Call
                        </a>
                      )}

                      {isMissing && (
                        <button
                          type="button"
                          style={styles.markSafeBtn}
                          onClick={() => openMarkSafeModal(person)}
                        >
                          ✓ Mark Safe
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MODAL 1: Report Missing Person ───────────────────────────────── */}
        {showReportModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalBox}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>➕ Report a Missing Person</h3>
                <button
                  type="button"
                  style={styles.modalCloseBtn}
                  onClick={() => setShowReportModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleReportSubmit} style={styles.modalForm}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mohammad Ali, Fatima Begum"
                    value={reportForm.fullName}
                    onChange={(e) => setReportForm({ ...reportForm, fullName: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Age (years) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="120"
                      placeholder="e.g. 12"
                      value={reportForm.age}
                      onChange={(e) => setReportForm({ ...reportForm, age: e.target.value })}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Gender *</label>
                    <select
                      value={reportForm.gender}
                      onChange={(e) => setReportForm({ ...reportForm, gender: e.target.value })}
                      style={styles.input}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Child">Child</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Last Seen District *</label>
                    <select
                      value={reportForm.district}
                      onChange={(e) => setReportForm({ ...reportForm, district: e.target.value })}
                      style={styles.input}
                    >
                      {DISTRICTS.filter((d) => d !== 'All').map((dist) => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Upazila / Sub-district</label>
                    <input
                      type="text"
                      placeholder="e.g. Parshuram, Fulgazi, Companiganj"
                      value={reportForm.upazila}
                      onChange={(e) => setReportForm({ ...reportForm, upazila: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Last Seen Specific Landmark or Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Near Parshuram embankment breach, washed away while crossing road"
                    value={reportForm.landmark}
                    onChange={(e) => setReportForm({ ...reportForm, landmark: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Physical Description (Clothing, Height, Marks)</label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Wearing blue lungi and white shirt, scar on left cheek, height approx 5ft 6in"
                    value={reportForm.physicalDescription}
                    onChange={(e) => setReportForm({ ...reportForm, physicalDescription: e.target.value })}
                    style={styles.textarea}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Urgent Medical Needs (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Diabetic, speech-impaired, needs asthma inhaler"
                    value={reportForm.medicalNeeds}
                    onChange={(e) => setReportForm({ ...reportForm, medicalNeeds: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Contact Person Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Abdul Karim"
                      value={reportForm.contactName}
                      onChange={(e) => setReportForm({ ...reportForm, contactName: e.target.value })}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Relationship *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Father, Elder Brother"
                      value={reportForm.contactRelationship}
                      onChange={(e) => setReportForm({ ...reportForm, contactRelationship: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Emergency Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 01711223344"
                      value={reportForm.contactPhone}
                      onChange={(e) => setReportForm({ ...reportForm, contactPhone: e.target.value })}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Photo URL / Link (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      value={reportForm.photoUrl}
                      onChange={(e) => setReportForm({ ...reportForm, photoUrl: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    style={styles.btnSecondary}
                    onClick={() => setShowReportModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={styles.btnPrimary}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Post Missing Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL 2: Mark Person as Safe ─────────────────────────────────── */}
        {showMarkSafeModal && selectedPerson && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalBox}>
              <div style={{ ...styles.modalHeader, backgroundColor: '#ecfdf5', borderBottom: '1px solid #bbf7d0' }}>
                <h3 style={{ margin: 0, color: '#065f46', fontSize: '1.15rem' }}>
                  🎉 Mark "{selectedPerson.fullName}" as Safe & Reunited
                </h3>
                <button
                  type="button"
                  style={styles.modalCloseBtn}
                  onClick={() => setShowMarkSafeModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleMarkSafeSubmit} style={styles.modalForm}>
                <div style={styles.safeModalNotice}>
                  Please confirm that <strong>{selectedPerson.fullName}</strong> (Age: {selectedPerson.age}) has been safely located. This will notify relief volunteers and celebrate their safe return.
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Where was this person found? *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Feni Govt High School Shelter, Parshuram Camp"
                    value={safeForm.foundLocation}
                    onChange={(e) => setSafeForm({ ...safeForm, foundLocation: e.target.value })}
                    style={styles.input}
                  />
                </div>

                {shelters.length > 0 && (
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Linked Rescue Shelter (Member-1 Integration)</label>
                    <select
                      value={safeForm.rescueShelterId}
                      onChange={(e) => setSafeForm({ ...safeForm, rescueShelterId: e.target.value })}
                      style={styles.input}
                    >
                      <option value="">-- None / Found outside shelter --</option>
                      {shelters.map((s) => (
                        <option key={s._id} value={s._id}>
                          🏠 {s.name} ({s.location?.district})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={styles.formGroup}>
                  <label style={styles.label}>Reunification Notes / Resolution Remarks</label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Rescued by Bangladesh Army boat patrol. Reunited with her father in healthy condition."
                    value={safeForm.notes}
                    onChange={(e) => setSafeForm({ ...safeForm, notes: e.target.value })}
                    style={styles.textarea}
                  />
                </div>

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    style={styles.btnSecondary}
                    onClick={() => setShowMarkSafeModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={styles.btnSuccess}
                    disabled={submitting}
                  >
                    {submitting ? 'Confirming...' : 'Confirm Person is Safe ✓'}
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

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '1.75rem 1rem 4rem 1rem',
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '1.5rem 1.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1.25rem',
    marginBottom: '1.5rem',
    border: '1px solid #e2e8f0',
  },
  headerLeft: {
    flex: '1 1 500px',
  },
  badgeRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '0.5rem',
  },
  moduleBadge: {
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  memberBadge: {
    backgroundColor: '#f0fdf4',
    color: '#15803d',
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  title: {
    fontSize: '1.65rem',
    fontWeight: 800,
    color: '#0f172a',
    margin: '0.25rem 0',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#475569',
    margin: 0,
    lineHeight: 1.5,
  },
  headerActions: {
    display: 'flex',
    gap: '0.65rem',
    flexWrap: 'wrap',
  },
  btnPrimary: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '0.55rem 1.15rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
  },
  btnSuccess: {
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    padding: '0.55rem 1.15rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(5,150,105,0.2)',
  },
  btnOutline: {
    backgroundColor: '#ffffff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    padding: '0.55rem 0.95rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  btnSecondary: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    padding: '0.55rem 1.15rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  alertSuccess: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '0.85rem 1.25rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.9rem',
    border: '1px solid #bbf7d0',
  },
  alertDanger: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '0.85rem 1.25rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.9rem',
    border: '1px solid #fecaca',
  },
  alertClose: {
    background: 'none',
    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',
    color: 'inherit',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '1.15rem 1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    border: '1px solid #e2e8f0',
  },
  statIcon: {
    fontSize: '2rem',
  },
  statLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#64748b',
    letterSpacing: '0.04em',
  },
  statValue: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#0f172a',
    margin: '0.15rem 0',
  },
  statSub: {
    fontSize: '0.78rem',
    color: '#64748b',
  },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '1.15rem 1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0',
    marginBottom: '1.5rem',
  },
  searchBox: {
    position: 'relative',
    marginBottom: '1rem',
  },
  searchIcon: {
    position: 'absolute',
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '0.95rem',
  },
  searchInput: {
    width: '100%',
    padding: '0.65rem 2.25rem 0.65rem 2.35rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.88rem',
    boxSizing: 'border-box',
    outline: 'none',
  },
  clearBtn: {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
  },
  filterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#475569',
  },
  pillContainer: {
    display: 'flex',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
  categoryPill: {
    padding: '0.3rem 0.65rem',
    borderRadius: '16px',
    fontSize: '0.78rem',
    fontWeight: 500,
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
  },
  categoryPillActive: {
    padding: '0.3rem 0.65rem',
    borderRadius: '16px',
    fontSize: '0.78rem',
    fontWeight: 700,
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: '1px solid #2563eb',
    cursor: 'pointer',
  },
  dropdownsGroup: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  selectWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  selectLabel: {
    fontSize: '0.82rem',
    color: '#475569',
    fontWeight: 500,
  },
  selectInput: {
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.82rem',
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  reportsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '1.25rem',
  },
  personCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  cardTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    padding: '0.2rem 0.6rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
  },
  dateTag: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  personHeader: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
  },
  avatarBox: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '2px solid #e2e8f0',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    fontSize: '2rem',
  },
  personBasicInfo: {
    flex: 1,
  },
  personName: {
    margin: '0 0 0.2rem 0',
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  personSubInfo: {
    fontSize: '0.82rem',
    color: '#475569',
  },
  districtTag: {
    fontSize: '0.78rem',
    color: '#2563eb',
    fontWeight: 600,
    marginTop: '0.25rem',
  },
  detailsSection: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    fontSize: '0.84rem',
  },
  detailRow: {
    display: 'flex',
    gap: '0.4rem',
  },
  detailKey: {
    fontWeight: 600,
    color: '#475569',
    minWidth: '100px',
  },
  detailVal: {
    color: '#0f172a',
    flex: 1,
  },
  medicalAlertBox: {
    backgroundColor: '#fffbeb',
    color: '#b45309',
    padding: '0.4rem 0.6rem',
    borderRadius: '6px',
    fontSize: '0.78rem',
    border: '1px solid #fef3c7',
  },
  safeSuccessBox: {
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
    padding: '0.75rem',
    fontSize: '0.82rem',
  },
  safeHeader: {
    fontWeight: 700,
    color: '#065f46',
    marginBottom: '0.25rem',
  },
  safeText: {
    color: '#047857',
  },
  safeNotes: {
    fontStyle: 'italic',
    color: '#065f46',
    marginTop: '0.25rem',
  },
  safeMeta: {
    fontSize: '0.72rem',
    color: '#6ee7b7',
    marginTop: '0.4rem',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '0.75rem',
    borderTop: '1px solid #f1f5f9',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  contactInfo: {
    fontSize: '0.78rem',
  },
  contactTitle: {
    color: '#64748b',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  contactNameText: {
    fontWeight: 600,
    color: '#0f172a',
  },
  cardActions: {
    display: 'flex',
    gap: '0.4rem',
  },
  callBtn: {
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    textDecoration: 'none',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: '1px solid #bfdbfe',
    display: 'inline-flex',
    alignItems: 'center',
  },
  markSafeBtn: {
    backgroundColor: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  loadingBox: {
    padding: '3rem',
    textAlign: 'center',
    color: '#64748b',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #2563eb',
    borderRadius: '50%',
    margin: '0 auto 1rem auto',
    animation: 'spin 1s linear infinite',
  },
  emptyCard: {
    padding: '3rem 1.5rem',
    textAlign: 'center',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    maxWidth: '560px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
    border: '1px solid #e2e8f0',
  },
  modalHeader: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e2e8f0',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    color: '#64748b',
  },
  modalForm: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  formRow2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.85rem',
  },
  label: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#334155',
  },
  input: {
    padding: '0.55rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.88rem',
    outline: 'none',
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  textarea: {
    padding: '0.55rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.88rem',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  safeModalNotice: {
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    lineHeight: 1.5,
    border: '1px solid #a7f3d0',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.75rem',
  },
};
