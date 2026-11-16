import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import axiosInstance from '../api/axiosInstance.js';

const CATEGORIES = ['All', 'Food', 'Water', 'Medicine', 'Blankets', 'Emergency Kits', 'Sanitation', 'Other'];
const STATUSES = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];
const DISTRICTS = ['All', 'Feni', 'Sylhet', 'Noakhali', 'Sunamganj', 'Chittagong', 'Cox\'s Bazar', 'Kurigram', 'Dhaka'];
const RECIPIENT_TYPES = ['Shelter', 'Relief Camp', 'Affected Community', 'Household', 'Individual'];

export default function ResourceManagementPage() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const isAuthorized = user?.role === 'Admin' || user?.role === 'NGO';
  const isAdmin = user?.role === 'Admin';

  const [resources, setResources] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [stats, setStats] = useState(null);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

 
  const [activeTab, setActiveTab] = useState('inventory');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');


  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [submitting, setSubmitting] = useState(false);


  const [createForm, setCreateForm] = useState({
    name: '',
    category: 'Food',
    unit: 'bags',
    quantityAvailable: 100,
    thresholdLowStock: 25,
    warehouseName: 'Central Relief Hub',
    warehouseDistrict: 'Feni',
    warehouseAddress: '',
    donorName: '',
    donorContact: '',
    notes: '',
  });

  const [distributeForm, setDistributeForm] = useState({
    resourceId: '',
    quantity: 10,
    recipientType: 'Shelter',
    shelterId: '',
    destinationName: '',
    district: 'Feni',
    upazila: '',
    beneficiaryCount: 50,
    transportMethod: 'Road Vehicle',
    notes: '',
  });

  const [restockForm, setRestockForm] = useState({
    quantityToAdd: 50,
    donorName: '',
    notes: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    category: 'Food',
    unit: '',
    thresholdLowStock: 20,
    warehouseName: '',
    warehouseDistrict: '',
    warehouseAddress: '',
    donorName: '',
    notes: '',
  });

  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [resRes, statsRes, distRes] = await Promise.all([
        axiosInstance.get('/api/resources'),
        axiosInstance.get('/api/resources/stats'),
        axiosInstance.get('/api/resources/distributions/history?limit=100'),
      ]);

      if (resRes.data?.resources) {
        setResources(resRes.data.resources);
      }
      if (statsRes.data?.stats) {
        setStats(statsRes.data.stats);
      }
      if (distRes.data?.distributions) {
        setDistributions(distRes.data.distributions);
      }
    } catch (err) {
      console.error('Error fetching resource data:', err);
      setErrorMsg('Failed to load relief resource data. Please check your connection.');
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
     
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchShelters();
  }, [fetchData, fetchShelters]);


  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      fetchData();
    };

    const handleAlert = (data) => {
      setSuccessMsg(`⚠️ LOW STOCK ALERT: "${data.name}" in ${data.district} is down to ${data.remainingStock} ${data.unit}!`);
      fetchData();
    };

    socket.on('resource:created', handleUpdate);
    socket.on('resource:updated', handleUpdate);
    socket.on('resource:restocked', handleUpdate);
    socket.on('resource:distributed', handleUpdate);
    socket.on('resource:low_stock_alert', handleAlert);

    return () => {
      socket.off('resource:created', handleUpdate);
      socket.off('resource:updated', handleUpdate);
      socket.off('resource:restocked', handleUpdate);
      socket.off('resource:distributed', handleUpdate);
      socket.off('resource:low_stock_alert', handleAlert);
    };
  }, [socket, fetchData]);


  const filteredResources = useMemo(() => {
    return resources.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (selectedStatus !== 'All' && item.status !== selectedStatus) return false;
      if (selectedDistrict !== 'All' && item.warehouse?.district?.toLowerCase() !== selectedDistrict.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(query);
        const matchesWarehouse = item.warehouse?.name?.toLowerCase().includes(query);
        const matchesDistrict = item.warehouse?.district?.toLowerCase().includes(query);
        const matchesDonor = item.donor?.name?.toLowerCase().includes(query);
        if (!matchesName && !matchesWarehouse && !matchesDistrict && !matchesDonor) return false;
      }
      return true;
    });
  }, [resources, selectedCategory, selectedStatus, selectedDistrict, searchQuery]);

  const handleCreateResource = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await axiosInstance.post('/api/resources', createForm);
      setSuccessMsg(`Relief resource "${createForm.name}" registered successfully.`);
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        category: 'Food',
        unit: 'bags',
        quantityAvailable: 100,
        thresholdLowStock: 25,
        warehouseName: 'Central Relief Hub',
        warehouseDistrict: 'Feni',
        warehouseAddress: '',
        donorName: '',
        donorContact: '',
        notes: '',
      });
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create resource item.');
    } finally {
      setSubmitting(false);
    }
  };


  const handleRecordDistribution = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);

      const targetResource = resources.find((r) => r._id === distributeForm.resourceId);
      if (targetResource && distributeForm.quantity > targetResource.quantityAvailable) {
        setErrorMsg(`Cannot distribute ${distributeForm.quantity} ${targetResource.unit}. Only ${targetResource.quantityAvailable} available in stock!`);
        setSubmitting(false);
        return;
      }

      await axiosInstance.post('/api/resources/distribute', distributeForm);
      setSuccessMsg(`Distribution recorded successfully. Stock has been updated in real-time.`);
      setShowDistributeModal(false);
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to record distribution.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestockResource = async (e) => {
    e.preventDefault();
    if (!selectedResource) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await axiosInstance.post(`/api/resources/${selectedResource._id}/restock`, restockForm);
      setSuccessMsg(`Added ${restockForm.quantityToAdd} ${selectedResource.unit} to "${selectedResource.name}".`);
      setShowRestockModal(false);
      setSelectedResource(null);
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to restock resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditResource = async (e) => {
    e.preventDefault();
    if (!selectedResource) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await axiosInstance.put(`/api/resources/${selectedResource._id}`, editForm);
      setSuccessMsg(`Resource "${editForm.name}" updated successfully.`);
      setShowEditModal(false);
      setSelectedResource(null);
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteResource = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from inventory?`)) return;
    try {
      setErrorMsg(null);
      await axiosInstance.delete(`/api/resources/${id}`);
      setSuccessMsg(`Resource "${name}" was removed.`);
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete resource item.');
    }
  };

  const openDistributeModal = (item) => {
    setSelectedResource(item);
    setDistributeForm({
      resourceId: item._id,
      quantity: Math.min(10, item.quantityAvailable || 1),
      recipientType: 'Shelter',
      shelterId: shelters[0]?._id || '',
      destinationName: shelters[0]?.name || `${item.warehouse?.district || 'Feni'} Shelter`,
      district: item.warehouse?.district || 'Feni',
      upazila: '',
      beneficiaryCount: 50,
      transportMethod: 'Road Vehicle',
      notes: '',
    });
    setShowDistributeModal(true);
  };

  const openRestockModal = (item) => {
    setSelectedResource(item);
    setRestockForm({
      quantityToAdd: 50,
      donorName: item.donor?.name || '',
      notes: '',
    });
    setShowRestockModal(true);
  };


  const openEditModal = (item) => {
    setSelectedResource(item);
    setEditForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      thresholdLowStock: item.thresholdLowStock,
      warehouseName: item.warehouse?.name || '',
      warehouseDistrict: item.warehouse?.district || '',
      warehouseAddress: item.warehouse?.address || '',
      donorName: item.donor?.name || '',
      notes: item.notes || '',
    });
    setShowEditModal(true);
  };


  const handleShelterChange = (e) => {
    const sId = e.target.value;
    const found = shelters.find((s) => s._id === sId);
    if (found) {
      setDistributeForm((prev) => ({
        ...prev,
        shelterId: sId,
        destinationName: found.name,
        district: found.location?.district || prev.district,
      }));
    } else {
      setDistributeForm((prev) => ({ ...prev, shelterId: sId }));
    }
  };

  return (
    <div style={styles.page}>
      <Navbar />

      <div style={styles.container}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={styles.headerCard}>
          <div style={styles.headerLeft}>
            <div style={styles.badgeRow}>
              <span style={styles.moduleBadge}>Module 2: Relief Operations</span>
              <span style={styles.memberBadge}>Member-3: Minhaz Chowdhury</span>
              {isAuthorized && <span style={styles.roleAccessBadge}>Authorized Coordinator ({user?.role})</span>}
            </div>
            <h1 style={styles.title}>📦 Resource Inventory & Distribution Tracking</h1>
            <p style={styles.subtitle}>
              Monitor real-time relief stockpiles (Food, Water, Medicine, Blankets), track warehouse balances,
              and maintain transparent, auditable distribution records across flood and cyclone-affected districts.
            </p>
          </div>

          <div style={styles.headerActions}>
            {isAuthorized && (
              <>
                <button
                  type="button"
                  style={styles.btnPrimary}
                  onClick={() => setShowCreateModal(true)}
                >
                  ➕ Add Relief Item
                </button>
                <button
                  type="button"
                  style={styles.btnSuccess}
                  onClick={() => {
                    if (resources.length > 0) {
                      openDistributeModal(resources[0]);
                    } else {
                      setShowDistributeModal(true);
                    }
                  }}
                >
                  🚚 Record Distribution
                </button>
              </>
            )}
            <button
              type="button"
              style={styles.btnOutline}
              onClick={fetchData}
              title="Refresh Data"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* ── Feedback Messages ───────────────────────────────────────────── */}
        {errorMsg && (
          <div style={styles.alertDanger}>
            <span>⚠️ {errorMsg}</span>
            <button type="button" style={styles.alertClose} onClick={() => setErrorMsg(null)}>×</button>
          </div>
        )}
        {successMsg && (
          <div style={styles.alertSuccess}>
            <span>✅ {successMsg}</span>
            <button type="button" style={styles.alertClose} onClick={() => setSuccessMsg(null)}>×</button>
          </div>
        )}

        {/* ── KPI Stat Cards ──────────────────────────────────────────────── */}
        <div style={styles.statsGrid}>
          <div style={{ ...styles.statCard, borderLeft: '5px solid #2563eb' }}>
            <div style={styles.statIcon}>📦</div>
            <div style={styles.statBody}>
              <div style={styles.statLabel}>Available Stock on Hand</div>
              <div style={styles.statValue}>{stats?.totalAvailableStock?.toLocaleString() || 0} <span style={styles.statUnit}>units</span></div>
              <div style={styles.statSub}>Across {stats?.totalItems || 0} tracked resource items</div>
            </div>
          </div>

          <div style={{ ...styles.statCard, borderLeft: '5px solid #059669' }}>
            <div style={styles.statIcon}>🚚</div>
            <div style={styles.statBody}>
              <div style={styles.statLabel}>Total Supplies Distributed</div>
              <div style={styles.statValue}>{stats?.totalDistributedStock?.toLocaleString() || 0} <span style={styles.statUnit}>units</span></div>
              <div style={styles.statSub}>{stats?.totalDistributionsCount || 0} operations logged</div>
            </div>
          </div>

          <div style={{ ...styles.statCard, borderLeft: '5px solid #ea580c' }}>
            <div style={styles.statIcon}>⚠️</div>
            <div style={styles.statBody}>
              <div style={styles.statLabel}>Low Stock & Depleted Alerts</div>
              <div style={{ ...styles.statValue, color: (stats?.lowStockCount || 0) + (stats?.outOfStockCount || 0) > 0 ? '#ea580c' : '#1e293b' }}>
                {(stats?.lowStockCount || 0) + (stats?.outOfStockCount || 0)}
              </div>
              <div style={styles.statSub}>{stats?.outOfStockCount || 0} Out of Stock • {stats?.lowStockCount || 0} Low Stock</div>
            </div>
          </div>

          <div style={{ ...styles.statCard, borderLeft: '5px solid #7c3aed' }}>
            <div style={styles.statIcon}>👥</div>
            <div style={styles.statBody}>
              <div style={styles.statLabel}>Beneficiaries Reached</div>
              <div style={styles.statValue}>{stats?.totalBeneficiariesReached?.toLocaleString() || 0} <span style={styles.statUnit}>citizens</span></div>
              <div style={styles.statSub}>In shelters & affected communities</div>
            </div>
          </div>
        </div>

        {/* ── Tab Switcher ────────────────────────────────────────────────── */}
        <div style={styles.tabsContainer}>
          <button
            type="button"
            style={activeTab === 'inventory' ? styles.tabActive : styles.tabInactive}
            onClick={() => setActiveTab('inventory')}
          >
            📦 Inventory Stock Tracker ({resources.length})
          </button>
          <button
            type="button"
            style={activeTab === 'distributions' ? styles.tabActive : styles.tabInactive}
            onClick={() => setActiveTab('distributions')}
          >
            🚚 Distribution Audit Log ({distributions.length})
          </button>
          <button
            type="button"
            style={activeTab === 'analytics' ? styles.tabActive : styles.tabInactive}
            onClick={() => setActiveTab('analytics')}
          >
            📊 Relief Stock Balances & Analytics
          </button>
        </div>

        {/* ── TAB 1: Inventory Stock Tracker ─────────────────────────────── */}
        {activeTab === 'inventory' && (
          <div style={styles.tabContent}>
            {/* Filter Toolbar */}
            <div style={styles.filterCard}>
              <div style={styles.searchBox}>
                <span style={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Search supplies by name, warehouse, district, or donor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} style={styles.clearBtn}>✕</button>
                )}
              </div>

              <div style={styles.filterRow}>
                {/* Category Filter */}
                <div style={styles.filterGroup}>
                  <span style={styles.filterLabel}>Category:</span>
                  <div style={styles.pillContainer}>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        style={selectedCategory === cat ? styles.categoryPillActive : styles.categoryPill}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat === 'Food' && '🍞 '}
                        {cat === 'Water' && '💧 '}
                        {cat === 'Medicine' && '💊 '}
                        {cat === 'Blankets' && '🧣 '}
                        {cat === 'Emergency Kits' && '📦 '}
                        {cat === 'Sanitation' && '🧼 '}
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status & District Selectors */}
                <div style={styles.dropdownsGroup}>
                  <div style={styles.selectWrapper}>
                    <label style={styles.selectLabel}>Status:</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      style={styles.selectInput}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.selectWrapper}>
                    <label style={styles.selectLabel}>District:</label>
                    <select
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      style={styles.selectInput}
                    >
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Table */}
            {loading ? (
              <div style={styles.loadingBox}>
                <div style={styles.spinner} />
                <p>Loading relief stockpiles...</p>
              </div>
            ) : filteredResources.length === 0 ? (
              <div style={styles.emptyCard}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
                <h3>No relief supplies found</h3>
                <p style={{ color: '#64748b' }}>Try adjusting your search query, category, or status filter.</p>
                {isAuthorized && (
                  <button
                    type="button"
                    style={{ ...styles.btnPrimary, marginTop: '1rem' }}
                    onClick={() => setShowCreateModal(true)}
                  >
                    ➕ Add First Relief Item
                  </button>
                )}
              </div>
            ) : (
              <div style={styles.tableCard}>
                <div style={styles.tableResponsive}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Resource Item</th>
                        <th style={styles.th}>Category</th>
                        <th style={styles.th}>Stock Health & Balance</th>
                        <th style={styles.th}>Available</th>
                        <th style={styles.th}>Distributed</th>
                        <th style={styles.th}>Warehouse & District</th>
                        <th style={styles.th}>Status</th>
                        {isAuthorized && <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResources.map((item) => {
                        const total = item.totalReceived || (item.quantityAvailable + (item.totalDistributed || 0));
                        const pct = total > 0 ? Math.round((item.quantityAvailable / total) * 100) : 0;
                        const isLow = item.status === 'Low Stock';
                        const isOut = item.status === 'Out of Stock';

                        return (
                          <tr key={item._id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={styles.itemName}>{item.name}</div>
                              <div style={styles.itemMeta}>
                                <span>Unit: <strong>{item.unit}</strong></span>
                                {item.donor?.name && <span> • Donor: {item.donor.name}</span>}
                              </div>
                            </td>

                            <td style={styles.td}>
                              <span style={getCategoryBadgeStyle(item.category)}>
                                {item.category}
                              </span>
                            </td>

                            <td style={styles.td}>
                              <div style={styles.progressBarWrapper}>
                                <div
                                  style={{
                                    ...styles.progressBarFill,
                                    width: `${Math.max(5, pct)}%`,
                                    backgroundColor: isOut ? '#ef4444' : isLow ? '#f97316' : '#10b981',
                                  }}
                                />
                              </div>
                              <div style={styles.progressText}>
                                {item.quantityAvailable} of {total} {item.unit} ({pct}%)
                              </div>
                            </td>

                            <td style={styles.td}>
                              <span style={styles.qtyAvailable}>{item.quantityAvailable}</span> {item.unit}
                            </td>

                            <td style={styles.td}>
                              <span style={styles.qtyDistributed}>{item.totalDistributed || 0}</span> {item.unit}
                            </td>

                            <td style={styles.td}>
                              <div style={styles.warehouseName}>{item.warehouse?.name || 'Relief Depot'}</div>
                              <span style={styles.districtBadge}>📍 {item.warehouse?.district || 'General'}</span>
                            </td>

                            <td style={styles.td}>
                              <span style={getStatusBadgeStyle(item.status)}>
                                {item.status === 'In Stock' && '🟢 In Stock'}
                                {item.status === 'Low Stock' && '🟠 Low Stock'}
                                {item.status === 'Out of Stock' && '🔴 Out of Stock'}
                              </span>
                            </td>

                            {isAuthorized && (
                              <td style={{ ...styles.td, textAlign: 'right' }}>
                                <div style={styles.actionButtonsRow}>
                                  <button
                                    type="button"
                                    style={styles.actionBtnDistribute}
                                    onClick={() => openDistributeModal(item)}
                                    disabled={item.quantityAvailable <= 0}
                                    title="Distribute stock"
                                  >
                                    🚚 Distribute
                                  </button>
                                  <button
                                    type="button"
                                    style={styles.actionBtnRestock}
                                    onClick={() => openRestockModal(item)}
                                    title="Restock inventory"
                                  >
                                    🔄 Restock
                                  </button>
                                  <button
                                    type="button"
                                    style={styles.actionBtnEdit}
                                    onClick={() => openEditModal(item)}
                                    title="Edit item"
                                  >
                                    ✏️
                                  </button>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      style={styles.actionBtnDelete}
                                      onClick={() => handleDeleteResource(item._id, item.name)}
                                      title="Delete item"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Distribution Audit Log ───────────────────────────────── */}
        {activeTab === 'distributions' && (
          <div style={styles.tabContent}>
            <div style={styles.tableCard}>
              <div style={styles.cardHeaderFlex}>
                <div>
                  <h3 style={styles.cardHeaderTitle}>Distribution Audit History</h3>
                  <p style={styles.cardHeaderSubtitle}>
                    Verified relief deliveries logged by authorized administrators and NGO relief organizations.
                  </p>
                </div>
                {isAuthorized && (
                  <button
                    type="button"
                    style={styles.btnSuccess}
                    onClick={() => {
                      if (resources.length > 0) openDistributeModal(resources[0]);
                      else setShowDistributeModal(true);
                    }}
                  >
                    🚚 Log New Distribution
                  </button>
                )}
              </div>

              {loading ? (
                <div style={styles.loadingBox}>
                  <div style={styles.spinner} />
                  <p>Loading distribution audit log...</p>
                </div>
              ) : distributions.length === 0 ? (
                <div style={styles.emptyCard}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚚</div>
                  <h3>No distribution records logged yet</h3>
                  <p style={{ color: '#64748b' }}>Record a distribution operation to generate immutable audit logs.</p>
                </div>
              ) : (
                <div style={styles.tableResponsive}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date & Time</th>
                        <th style={styles.th}>Relief Item</th>
                        <th style={styles.th}>Category</th>
                        <th style={styles.th}>Quantity</th>
                        <th style={styles.th}>Destination & Recipient</th>
                        <th style={styles.th}>Beneficiaries</th>
                        <th style={styles.th}>Logged By</th>
                        <th style={styles.th}>Transport</th>
                        <th style={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distributions.map((dist) => (
                        <tr key={dist._id} style={styles.tr}>
                          <td style={styles.td}>
                            <div style={styles.distDate}>
                              {new Date(dist.distributionDate || dist.createdAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            <div style={styles.distTime}>
                              {new Date(dist.distributionDate || dist.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          <td style={styles.td}>
                            <strong>{dist.resourceName}</strong>
                          </td>

                          <td style={styles.td}>
                            <span style={getCategoryBadgeStyle(dist.category)}>{dist.category}</span>
                          </td>

                          <td style={styles.td}>
                            <span style={styles.distQty}>{dist.quantity} {dist.unit}</span>
                          </td>

                          <td style={styles.td}>
                            <div style={styles.destName}>{dist.destination?.name}</div>
                            <div style={styles.destDistrict}>
                              <span>📍 {dist.destination?.district}</span>
                              {dist.destination?.upazila && <span> • {dist.destination.upazila}</span>}
                              <span style={styles.recipientPill}>{dist.recipientType}</span>
                            </div>
                            {dist.shelterName && (
                              <div style={styles.shelterLink}>
                                🏠 Linked Shelter: {dist.shelterName}
                              </div>
                            )}
                          </td>

                          <td style={styles.td}>
                            <span style={styles.beneficiaryCount}>
                              👥 {dist.beneficiaryCount?.toLocaleString() || 0}
                            </span>
                          </td>

                          <td style={styles.td}>
                            <div>{dist.distributedByName}</div>
                            <span style={styles.roleTag}>{dist.distributedByRole}</span>
                          </td>

                          <td style={styles.td}>
                            <span style={styles.transportTag}>🚤 {dist.transportMethod || 'Road Vehicle'}</span>
                          </td>

                          <td style={styles.td}>
                            <span style={styles.statusDelivered}>
                              ✓ {dist.status || 'Delivered'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: Stock Balances & Analytics ───────────────────────────── */}
        {activeTab === 'analytics' && (
          <div style={styles.tabContent}>
            <div style={styles.analyticsGrid}>
              {/* Category Breakdown Cards */}
              <div style={styles.analyticsCard}>
                <h3 style={styles.analyticsCardTitle}>Category-Wise Relief Distribution Breakdown</h3>
                <p style={styles.cardHeaderSubtitle}>
                  Comparison of available stock vs. distributed relief supplies for core disaster relief materials.
                </p>

                <div style={styles.categoryStatsList}>
                  {['Food', 'Water', 'Medicine', 'Blankets'].map((catName) => {
                    const catData = stats?.categoryBreakdown?.find((c) => c.category === catName) || {
                      available: 0,
                      distributed: 0,
                      totalReceived: 0,
                      itemCount: 0,
                    };

                    const total = catData.available + catData.distributed;
                    const pctDistributed = total > 0 ? Math.round((catData.distributed / total) * 100) : 0;

                    return (
                      <div key={catName} style={styles.catStatBox}>
                        <div style={styles.catStatHeader}>
                          <div style={styles.catStatTitle}>
                            {catName === 'Food' && '🍞 Food Supplies'}
                            {catName === 'Water' && '💧 Water & Purification'}
                            {catName === 'Medicine' && '💊 Medical & First Aid'}
                            {catName === 'Blankets' && '🧣 Blankets & Bedding'}
                          </div>
                          <span style={styles.catCountBadge}>{catData.itemCount} item types</span>
                        </div>

                        <div style={styles.catNumbersRow}>
                          <div>
                            <span style={styles.catNumLabel}>Available:</span>
                            <span style={styles.catNumAvail}> {catData.available.toLocaleString()} units</span>
                          </div>
                          <div>
                            <span style={styles.catNumLabel}>Distributed:</span>
                            <span style={styles.catNumDist}> {catData.distributed.toLocaleString()} units</span>
                          </div>
                          <div>
                            <span style={styles.catNumLabel}>Fulfilled:</span>
                            <span style={styles.catNumPct}> {pctDistributed}%</span>
                          </div>
                        </div>

                        <div style={styles.multiProgressBar}>
                          <div
                            style={{
                              ...styles.multiProgressDistributed,
                              width: `${pctDistributed}%`,
                            }}
                            title={`Distributed: ${catData.distributed}`}
                          />
                          <div
                            style={{
                              ...styles.multiProgressAvailable,
                              width: `${100 - pctDistributed}%`,
                            }}
                            title={`Available: ${catData.available}`}
                          />
                        </div>

                        <div style={styles.barLegend}>
                          <span style={styles.legendDist}>■ Distributed ({pctDistributed}%)</span>
                          <span style={styles.legendAvail}>■ Stock on Hand ({100 - pctDistributed}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Districts Chart/List */}
              <div style={styles.analyticsCard}>
                <h3 style={styles.analyticsCardTitle}>Top Relief Distribution Districts</h3>
                <p style={styles.cardHeaderSubtitle}>
                  Relief volume dispatched across high-risk flood and cyclone districts.
                </p>

                <div style={styles.districtList}>
                  {stats?.topDistricts?.length > 0 ? (
                    stats.topDistricts.map((item, idx) => {
                      const maxQty = stats.topDistricts[0].totalQuantity || 1;
                      const barWidth = Math.round((item.totalQuantity / maxQty) * 100);

                      return (
                        <div key={item.district} style={styles.districtRow}>
                          <div style={styles.distRank}>#{idx + 1}</div>
                          <div style={styles.distInfo}>
                            <div style={styles.distNameFlex}>
                              <span style={styles.districtNameText}>📍 {item.district}</span>
                              <span style={styles.districtQtyText}>{item.totalQuantity.toLocaleString()} units</span>
                            </div>
                            <div style={styles.districtBarTrack}>
                              <div
                                style={{
                                  ...styles.districtBarFill,
                                  width: `${barWidth}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>
                      No district distribution data available yet.
                    </p>
                  )}
                </div>

                <div style={styles.auditIntegrityBox}>
                  <h4>🔒 Data Integrity & Concurrency Guarantee</h4>
                  <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, marginTop: '0.4rem' }}>
                    All distribution requests execute server-enforced atomic stock validations.
                    Over-distribution beyond warehouse stock is rejected with HTTP 400. Real-time Socket.IO broadcasts
                    synchronize connected Admin and NGO consoles instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 1: Create Resource ────────────────────────────────────── */}
        {showCreateModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>➕ Add New Relief Resource Item</h3>
                <button type="button" style={styles.modalClose} onClick={() => setShowCreateModal(false)}>✕</button>
              </div>

              <form onSubmit={handleCreateResource} style={styles.modalForm}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Resource Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Miniket Rice (25kg bags), Purified Drinking Water 5L"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Category *</label>
                    <select
                      value={createForm.category}
                      onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                      style={styles.input}
                    >
                      <option value="Food">🍞 Food</option>
                      <option value="Water">💧 Water</option>
                      <option value="Medicine">💊 Medicine</option>
                      <option value="Blankets">🧣 Blankets</option>
                      <option value="Emergency Kits">📦 Emergency Kits</option>
                      <option value="Sanitation">🧼 Sanitation</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Measurement Unit *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. bags, cartons, bottles, pieces"
                      value={createForm.unit}
                      onChange={(e) => setCreateForm({ ...createForm, unit: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Initial Available Quantity *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={createForm.quantityAvailable}
                      onChange={(e) => setCreateForm({ ...createForm, quantityAvailable: parseInt(e.target.value, 10) || 0 })}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Low-Stock Threshold Alert *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={createForm.thresholdLowStock}
                      onChange={(e) => setCreateForm({ ...createForm, thresholdLowStock: parseInt(e.target.value, 10) || 0 })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Warehouse District *</label>
                    <select
                      value={createForm.warehouseDistrict}
                      onChange={(e) => setCreateForm({ ...createForm, warehouseDistrict: e.target.value })}
                      style={styles.input}
                    >
                      {DISTRICTS.filter((d) => d !== 'All').map((dist) => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Warehouse / Depot Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Feni Central Government Relief Depot"
                      value={createForm.warehouseName}
                      onChange={(e) => setCreateForm({ ...createForm, warehouseName: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Donor / Source Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. Bangladesh Red Crescent Society (BDRCS), UNICEF"
                    value={createForm.donorName}
                    onChange={(e) => setCreateForm({ ...createForm, donorName: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Storage & Handling Notes</label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Keep dry on raised pallets; prioritize for marooned households."
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    style={styles.textarea}
                  />
                </div>

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    style={styles.btnSecondary}
                    onClick={() => setShowCreateModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={styles.btnPrimary}
                    disabled={submitting}
                  >
                    {submitting ? 'Registering...' : 'Register Relief Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL 2: Record Distribution ────────────────────────────────── */}
        {showDistributeModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>🚚 Log Relief Supply Distribution</h3>
                <button type="button" style={styles.modalClose} onClick={() => setShowDistributeModal(false)}>✕</button>
              </div>

              <form onSubmit={handleRecordDistribution} style={styles.modalForm}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Select Resource Item to Distribute *</label>
                  <select
                    value={distributeForm.resourceId}
                    onChange={(e) => {
                      const resId = e.target.value;
                      const resItem = resources.find((r) => r._id === resId);
                      setDistributeForm((prev) => ({
                        ...prev,
                        resourceId: resId,
                        district: resItem?.warehouse?.district || prev.district,
                      }));
                    }}
                    required
                    style={styles.input}
                  >
                    <option value="">-- Choose Relief Supply Item --</option>
                    {resources.map((item) => (
                      <option
                        key={item._id}
                        value={item._id}
                        disabled={item.quantityAvailable <= 0}
                      >
                        {item.name} ({item.category}) — {item.quantityAvailable} {item.unit} available in {item.warehouse?.district}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Quantity to Distribute *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={distributeForm.quantity}
                      onChange={(e) => setDistributeForm({ ...distributeForm, quantity: parseInt(e.target.value, 10) || 1 })}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Recipient Type *</label>
                    <select
                      value={distributeForm.recipientType}
                      onChange={(e) => setDistributeForm({ ...distributeForm, recipientType: e.target.value })}
                      style={styles.input}
                    >
                      {RECIPIENT_TYPES.map((rt) => (
                        <option key={rt} value={rt}>{rt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {distributeForm.recipientType === 'Shelter' && shelters.length > 0 && (
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Select Registered Shelter (Member-1 Integration)</label>
                    <select
                      value={distributeForm.shelterId}
                      onChange={handleShelterChange}
                      style={styles.input}
                    >
                      <option value="">-- Choose from active shelters --</option>
                      {shelters.map((s) => (
                        <option key={s._id} value={s._id}>
                          🏠 {s.name} ({s.location?.district}) — Capacity: {s.capacity?.total || 0}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Destination Name / Location *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Parshuram High School Camp, Submerged Ward 3"
                      value={distributeForm.destinationName}
                      onChange={(e) => setDistributeForm({ ...distributeForm, destinationName: e.target.value })}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Target District *</label>
                    <select
                      value={distributeForm.district}
                      onChange={(e) => setDistributeForm({ ...distributeForm, district: e.target.value })}
                      style={styles.input}
                    >
                      {DISTRICTS.filter((d) => d !== 'All').map((dist) => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Beneficiaries Count (Estimated)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 150 people"
                      value={distributeForm.beneficiaryCount}
                      onChange={(e) => setDistributeForm({ ...distributeForm, beneficiaryCount: parseInt(e.target.value, 10) || 0 })}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Transport Method</label>
                    <select
                      value={distributeForm.transportMethod}
                      onChange={(e) => setDistributeForm({ ...distributeForm, transportMethod: e.target.value })}
                      style={styles.input}
                    >
                      <option value="Road Vehicle">Road Truck / Pickup</option>
                      <option value="Rescue Speedboat">Rescue Speedboat / Engine Boat</option>
                      <option value="Army Heavy Transport">Army Heavy Transport</option>
                      <option value="Volunteer Foot Patrol">Volunteer Foot Patrol</option>
                      <option value="Helicopter Airdrop">Helicopter Airdrop</option>
                    </select>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Distribution Notes / Special Instructions</label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Handed over to local Union Parishad relief coordinator."
                    value={distributeForm.notes}
                    onChange={(e) => setDistributeForm({ ...distributeForm, notes: e.target.value })}
                    style={styles.textarea}
                  />
                </div>

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    style={styles.btnSecondary}
                    onClick={() => setShowDistributeModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={styles.btnSuccess}
                    disabled={submitting}
                  >
                    {submitting ? 'Recording...' : 'Confirm & Deduct Stock'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL 3: Restock Resource ───────────────────────────────────── */}
        {showRestockModal && selectedResource && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>🔄 Restock "{selectedResource.name}"</h3>
                <button type="button" style={styles.modalClose} onClick={() => setShowRestockModal(false)}>✕</button>
              </div>

              <form onSubmit={handleRestockResource} style={styles.modalForm}>
                <div style={styles.currentStockNotice}>
                  Current stock on hand: <strong>{selectedResource.quantityAvailable} {selectedResource.unit}</strong> in {selectedResource.warehouse?.name} ({selectedResource.warehouse?.district})
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Additional Quantity to Add * ({selectedResource.unit})</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={restockForm.quantityToAdd}
                    onChange={(e) => setRestockForm({ ...restockForm, quantityToAdd: parseInt(e.target.value, 10) || 1 })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Donor / Resupply Partner</label>
                  <input
                    type="text"
                    placeholder="e.g. Red Crescent Emergency Shipment"
                    value={restockForm.donorName}
                    onChange={(e) => setRestockForm({ ...restockForm, donorName: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Restock Notes</label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Batch received from Chittagong port storage."
                    value={restockForm.notes}
                    onChange={(e) => setRestockForm({ ...restockForm, notes: e.target.value })}
                    style={styles.textarea}
                  />
                </div>

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    style={styles.btnSecondary}
                    onClick={() => setShowRestockModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={styles.btnPrimary}
                    disabled={submitting}
                  >
                    {submitting ? 'Updating...' : `Add +${restockForm.quantityToAdd} ${selectedResource.unit}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL 4: Edit Resource ──────────────────────────────────────── */}
        {showEditModal && selectedResource && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>✏️ Edit "{selectedResource.name}"</h3>
                <button type="button" style={styles.modalClose} onClick={() => setShowEditModal(false)}>✕</button>
              </div>

              <form onSubmit={handleEditResource} style={styles.modalForm}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Resource Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Category</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      style={styles.input}
                    >
                      <option value="Food">Food</option>
                      <option value="Water">Water</option>
                      <option value="Medicine">Medicine</option>
                      <option value="Blankets">Blankets</option>
                      <option value="Emergency Kits">Emergency Kits</option>
                      <option value="Sanitation">Sanitation</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Measurement Unit</label>
                    <input
                      type="text"
                      required
                      value={editForm.unit}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Low Stock Threshold</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.thresholdLowStock}
                      onChange={(e) => setEditForm({ ...editForm, thresholdLowStock: parseInt(e.target.value, 10) || 0 })}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Warehouse District</label>
                    <select
                      value={editForm.warehouseDistrict}
                      onChange={(e) => setEditForm({ ...editForm, warehouseDistrict: e.target.value })}
                      style={styles.input}
                    >
                      {DISTRICTS.filter((d) => d !== 'All').map((dist) => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Warehouse Name</label>
                  <input
                    type="text"
                    value={editForm.warehouseName}
                    onChange={(e) => setEditForm({ ...editForm, warehouseName: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    style={styles.btnSecondary}
                    onClick={() => setShowEditModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={styles.btnPrimary}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
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

// ── Category and Status Badge Color Helpers ──────────────────────────────────
function getCategoryBadgeStyle(category) {
  const base = {
    display: 'inline-block',
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: 600,
  };

  switch (category) {
    case 'Food':
      return { ...base, background: '#fef3c7', color: '#92400e' };
    case 'Water':
      return { ...base, background: '#e0f2fe', color: '#0369a1' };
    case 'Medicine':
      return { ...base, background: '#fee2e2', color: '#991b1b' };
    case 'Blankets':
      return { ...base, background: '#f3e8ff', color: '#6b21a8' };
    case 'Emergency Kits':
      return { ...base, background: '#dcfce7', color: '#166534' };
    case 'Sanitation':
      return { ...base, background: '#f1f5f9', color: '#334155' };
    default:
      return { ...base, background: '#e2e8f0', color: '#475569' };
  }
}

function getStatusBadgeStyle(status) {
  const base = {
    display: 'inline-block',
    padding: '0.25rem 0.65rem',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: 700,
  };

  switch (status) {
    case 'In Stock':
      return { ...base, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' };
    case 'Low Stock':
      return { ...base, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' };
    case 'Out of Stock':
      return { ...base, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' };
    default:
      return base;
  }
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
  roleAccessBadge: {
    backgroundColor: '#faf5ff',
    color: '#7e22ce',
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
  alertClose: {
    background: 'transparent',
    border: 'none',
    fontSize: '1.2rem',
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
  statBody: {
    flex: 1,
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
  statUnit: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#64748b',
  },
  statSub: {
    fontSize: '0.78rem',
    color: '#64748b',
  },
  tabsContainer: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '2px solid #e2e8f0',
    marginBottom: '1.25rem',
    overflowX: 'auto',
  },
  tabActive: {
    padding: '0.75rem 1.25rem',
    fontWeight: 700,
    fontSize: '0.92rem',
    color: '#2563eb',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid #2563eb',
    marginBottom: '-2px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabInactive: {
    padding: '0.75rem 1.25rem',
    fontWeight: 500,
    fontSize: '0.92rem',
    color: '#64748b',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabContent: {
    marginTop: '0.5rem',
  },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '1.15rem 1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0',
    marginBottom: '1.25rem',
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
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  tableResponsive: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.88rem',
  },
  th: {
    backgroundColor: '#f8fafc',
    color: '#475569',
    fontWeight: 700,
    padding: '0.85rem 1rem',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
    fontSize: '0.82rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '0.85rem 1rem',
    verticalAlign: 'middle',
  },
  itemName: {
    fontWeight: 700,
    color: '#0f172a',
  },
  itemMeta: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '0.2rem',
  },
  progressBarWrapper: {
    width: '120px',
    height: '7px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '0.25rem',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  qtyAvailable: {
    fontWeight: 700,
    color: '#0f172a',
    fontSize: '0.95rem',
  },
  qtyDistributed: {
    fontWeight: 600,
    color: '#059669',
  },
  warehouseName: {
    fontWeight: 600,
    color: '#334155',
    fontSize: '0.82rem',
  },
  districtBadge: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  actionButtonsRow: {
    display: 'flex',
    gap: '0.35rem',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionBtnDistribute: {
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #a7f3d0',
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionBtnRestock: {
    backgroundColor: '#eff6ff',
    color: '#1e40af',
    border: '1px solid #bfdbfe',
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionBtnEdit: {
    backgroundColor: '#f8fafc',
    color: '#475569',
    border: '1px solid #cbd5e1',
    padding: '0.35rem 0.5rem',
    borderRadius: '6px',
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  actionBtnDelete: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    padding: '0.35rem 0.5rem',
    borderRadius: '6px',
    fontSize: '0.78rem',
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
  cardHeaderFlex: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e2e8f0',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  cardHeaderTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  cardHeaderSubtitle: {
    margin: '0.25rem 0 0 0',
    fontSize: '0.84rem',
    color: '#64748b',
  },
  distDate: {
    fontWeight: 600,
    color: '#0f172a',
  },
  distTime: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  distQty: {
    fontWeight: 700,
    color: '#059669',
  },
  destName: {
    fontWeight: 600,
    color: '#0f172a',
  },
  destDistrict: {
    fontSize: '0.78rem',
    color: '#64748b',
    marginTop: '0.15rem',
    display: 'flex',
    gap: '0.4rem',
    alignItems: 'center',
  },
  recipientPill: {
    backgroundColor: '#f1f5f9',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#334155',
  },
  shelterLink: {
    fontSize: '0.75rem',
    color: '#2563eb',
    marginTop: '0.2rem',
  },
  beneficiaryCount: {
    fontWeight: 600,
    color: '#7c3aed',
  },
  roleTag: {
    display: 'inline-block',
    fontSize: '0.7rem',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    marginTop: '0.15rem',
  },
  transportTag: {
    fontSize: '0.78rem',
    color: '#334155',
  },
  statusDelivered: {
    display: 'inline-block',
    padding: '0.2rem 0.55rem',
    borderRadius: '12px',
    backgroundColor: '#ecfdf5',
    color: '#047857',
    fontWeight: 700,
    fontSize: '0.78rem',
  },
  analyticsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
    gap: '1.25rem',
  },
  analyticsCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '1.5rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  analyticsCardTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  categoryStatsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '1.25rem',
  },
  catStatBox: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '1rem',
    border: '1px solid #e2e8f0',
  },
  catStatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  catStatTitle: {
    fontWeight: 700,
    fontSize: '0.92rem',
    color: '#0f172a',
  },
  catCountBadge: {
    fontSize: '0.75rem',
    color: '#64748b',
    backgroundColor: '#ffffff',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    border: '1px solid #e2e8f0',
  },
  catNumbersRow: {
    display: 'flex',
    gap: '1.25rem',
    fontSize: '0.82rem',
    marginBottom: '0.65rem',
  },
  catNumLabel: {
    color: '#64748b',
  },
  catNumAvail: {
    fontWeight: 700,
    color: '#2563eb',
  },
  catNumDist: {
    fontWeight: 700,
    color: '#059669',
  },
  catNumPct: {
    fontWeight: 700,
    color: '#d97706',
  },
  multiProgressBar: {
    height: '10px',
    backgroundColor: '#e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden',
    display: 'flex',
  },
  multiProgressDistributed: {
    backgroundColor: '#059669',
    height: '100%',
    transition: 'width 0.3s ease',
  },
  multiProgressAvailable: {
    backgroundColor: '#2563eb',
    height: '100%',
    transition: 'width 0.3s ease',
  },
  barLegend: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.75rem',
    marginTop: '0.4rem',
  },
  legendDist: {
    color: '#059669',
    fontWeight: 600,
  },
  legendAvail: {
    color: '#2563eb',
    fontWeight: 600,
  },
  districtList: {
    marginTop: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  districtRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  distRank: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 700,
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distInfo: {
    flex: 1,
  },
  distNameFlex: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.84rem',
    marginBottom: '0.25rem',
  },
  districtNameText: {
    fontWeight: 600,
    color: '#0f172a',
  },
  districtQtyText: {
    fontWeight: 700,
    color: '#059669',
  },
  districtBarTrack: {
    height: '6px',
    backgroundColor: '#f1f5f9',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  districtBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  auditIntegrityBox: {
    marginTop: '1.5rem',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '1rem',
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
  modalContent: {
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
  modalClose: {
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
  currentStockNotice: {
    backgroundColor: '#eff6ff',
    color: '#1e40af',
    padding: '0.65rem 0.85rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    border: '1px solid #bfdbfe',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.75rem',
  },
};
