import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import axiosInstance from '../api/axiosInstance.js';

const TARGET_DISTRICTS = [
  'General Relief Fund',
  'Feni',
  'Sylhet',
  'Noakhali',
  'Sunamganj',
  'Chittagong',
  "Cox's Bazar",
  'Kurigram',
  'Dhaka',
  'Cumilla',
];

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];
const SUPPLY_CATEGORIES = ['Food', 'Water', 'Medicine', 'Blankets', 'Emergency Kits', 'Sanitation', 'Other'];
const PAYMENT_METHODS = ['bKash', 'Nagad', 'Bank Transfer', 'Card'];

export default function DashboardDonor() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [activeTab, setActiveTab] = useState('donate');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [myDonations, setMyDonations] = useState([]);
  const [mySummary, setMySummary] = useState({ totalDonations: 0, totalMonetaryBDT: 0, totalSupplyUnits: 0 });
  const [shelters, setShelters] = useState([]);

  const [donationType, setDonationType] = useState('Monetary');
  const [amountBDT, setAmountBDT] = useState('1000');
  const [paymentMethod, setPaymentMethod] = useState('bKash');
  const [transactionRef, setTransactionRef] = useState('');
  const [supplyCategory, setSupplyCategory] = useState('Food');
  const [supplyItemName, setSupplyItemName] = useState('');
  const [supplyQuantity, setSupplyQuantity] = useState('25');
  const [supplyUnit, setSupplyUnit] = useState('packs');
  const [targetDistrict, setTargetDistrict] = useState('General Relief Fund');
  const [targetShelterId, setTargetShelterId] = useState('');
  const [targetResourceId, setTargetResourceId] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [receiptModal, setReceiptModal] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, myRes, shelterRes] = await Promise.all([
        axiosInstance.get('/api/donations/overview'),
        axiosInstance.get('/api/donations/my'),
        axiosInstance.get('/api/shelters'),
      ]);

      if (overviewRes.data?.success) {
        setOverview(overviewRes.data.overview);
      }
      if (myRes.data?.success) {
        setMyDonations(myRes.data.donations || []);
        setMySummary(myRes.data.summary || { totalDonations: 0, totalMonetaryBDT: 0, totalSupplyUnits: 0 });
      }
      if (shelterRes.data?.success) {
        setShelters(shelterRes.data.data || []);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Could not load live donor dashboard data.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!socket) return;
    const handleSync = () => fetchDashboardData();
    socket.on('donation:created', handleSync);
    socket.on('resource:restocked', handleSync);
    socket.on('resource:distributed', handleSync);
    return () => {
      socket.off('donation:created', handleSync);
      socket.off('resource:restocked', handleSync);
      socket.off('resource:distributed', handleSync);
    };
  }, [socket, fetchDashboardData]);

  const handleSponsorUrgentNeed = (need) => {
    setDonationType('Supplies');
    setSupplyCategory(need.category || 'Food');
    setSupplyItemName(need.name);
    setSupplyQuantity('20');
    setSupplyUnit(need.unit || 'units');
    setTargetDistrict(need.district || 'Feni');
    setTargetResourceId(need._id);
    setActiveTab('donate');
    setFeedback({
      type: 'success',
      text: `Pre-filled supply pledge for urgent item: ${need.name} (${need.district}). Review and confirm below.`,
    });
  };

  const handleDonateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ type: '', text: '' });

    try {
      const payload = {
        donationType,
        targetDistrict,
        targetShelterId: targetShelterId || null,
        notes,
      };

      if (donationType === 'Monetary') {
        payload.amountBDT = Number(amountBDT);
        payload.paymentMethod = paymentMethod;
        payload.transactionRef = transactionRef;
      } else {
        payload.targetResourceId = targetResourceId || null;
        payload.supplyDetails = {
          category: supplyCategory,
          itemName: supplyItemName,
          quantity: Number(supplyQuantity),
          unit: supplyUnit,
        };
      }

      const res = await axiosInstance.post('/api/donations', payload);
      if (res.data?.success) {
        setFeedback({ type: 'success', text: res.data.message });
        setReceiptModal(res.data.donation);
        setTransactionRef('');
        setNotes('');
        setTargetResourceId('');
        if (donationType === 'Supplies') {
          setSupplyItemName('');
        }
        fetchDashboardData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to submit contribution.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintReceipt = (don) => {
    if (!don) return;
    const win = window.open('', '_blank', 'width=560,height=640');
    if (!win) return;

    const amountOrItem =
      don.donationType === 'Monetary'
        ? `BDT ${Number(don.amountBDT).toLocaleString()} (${don.paymentMethod})`
        : `${don.supplyDetails?.quantity} ${don.supplyDetails?.unit} — ${don.supplyDetails?.itemName} (${don.supplyDetails?.category})`;

    win.document.write(`
      <html>
        <head>
          <title>ReliefSync Official Donation Receipt - ${don.receiptNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #1e293b; }
            .box { border: 2px solid #1a237e; border-radius: 12px; padding: 24px; max-width: 480px; margin: 0 auto; }
            .tag { background: #1a237e; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; display: inline-block; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="box">
            <span class="tag">ReliefSync Official Contribution Receipt</span>
            <h2 style="color: #1a237e; margin: 12px 0 4px 0;">${don.receiptNo}</h2>
            <p style="color: #64748b; margin-top: 0; font-size: 13px;">Issued on ${new Date(don.donatedAt).toLocaleString()}</p>
            <div class="row"><strong>Donor Name</strong><span>${don.donorName}</span></div>
            <div class="row"><strong>Email</strong><span>${don.donorEmail}</span></div>
            <div class="row"><strong>Contribution Type</strong><span>${don.donationType}</span></div>
            <div class="row"><strong>Amount / Items</strong><span>${amountOrItem}</span></div>
            <div class="row"><strong>Allocated To</strong><span>${don.targetShelterName || don.targetDistrict}</span></div>
            <div class="row"><strong>Status</strong><span>${don.status}</span></div>
            <p style="font-size: 12px; color: #64748b; margin-top: 18px; text-align: center;">
              Thank you for supporting disaster-affected communities across Bangladesh through ReliefSync.
            </p>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-content">
        <div
          style={{
            background: 'linear-gradient(135deg, #4c1d95 0%, #1d4ed8 100%)',
            borderRadius: '12px',
            padding: '1.8rem',
            color: '#ffffff',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 24px rgba(76,29,149,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.2rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.65rem', margin: 0, fontWeight: 800 }}>
                Welcome, {user?.name}!
              </h1>
              <span
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '0.25rem 0.7rem',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {user?.role}
              </span>
            </div>
            <p style={{ margin: '0.45rem 0 0 0', opacity: 0.92, fontSize: '0.95rem', maxWidth: 620 }}>
              Fund urgent disaster relief needs, donate essential supplies directly to low-stock warehouses, and track transparent ground allocations in real time.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveTab('donate')}
              style={{
                background: '#ffffff',
                color: '#4c1d95',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.2rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              💝 Contribute Now
            </button>
            <Link
              to="/map"
              style={{
                background: 'rgba(255,255,255,0.16)',
                color: '#ffffff',
                border: '1.5px solid rgba(255,255,255,0.5)',
                borderRadius: '8px',
                padding: '0.75rem 1.1rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              🗺️ Live Map
            </Link>
            <Link
              to="/shelters"
              style={{
                background: 'rgba(255,255,255,0.16)',
                color: '#ffffff',
                border: '1.5px solid rgba(255,255,255,0.5)',
                borderRadius: '8px',
                padding: '0.75rem 1.1rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              🏠 Shelters
            </Link>
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div className="dashboard-card" style={{ marginBottom: 0, padding: '1.2rem', borderLeft: '4px solid #6d28d9' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              My Monetary Contribution
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4c1d95', marginTop: '0.25rem' }}>
              ৳{mySummary.totalMonetaryBDT.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
              {mySummary.totalDonations} contributions ({mySummary.totalSupplyUnits} supply units)
            </div>
          </div>

          <div className="dashboard-card" style={{ marginBottom: 0, padding: '1.2rem', borderLeft: '4px solid #059669' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Platform Relief Delivered
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#047857', marginTop: '0.25rem' }}>
              {(overview?.totalDistributedStock || 0).toLocaleString()} units
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
              Across {overview?.totalDistributionsCount || 0} verified dispatches
            </div>
          </div>

          <div className="dashboard-card" style={{ marginBottom: 0, padding: '1.2rem', borderLeft: '4px solid #2563eb' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Community Fund Raised
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.25rem' }}>
              ৳{(overview?.totalPlatformFundingBDT || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
              {overview?.openSheltersCount || 0} active open shelters supported
            </div>
          </div>

          <div className="dashboard-card" style={{ marginBottom: 0, padding: '1.2rem', borderLeft: '4px solid #dc2626' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Urgent Low-Stock Needs
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: (overview?.urgentNeedsCount || 0) > 0 ? '#dc2626' : '#047857', marginTop: '0.25rem' }}>
              {overview?.urgentNeedsCount || 0} items
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
              Requiring immediate donor replenishment
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('donate')}
            style={{
              padding: '0.65rem 1.2rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: activeTab === 'donate' ? '#1a237e' : '#ffffff',
              color: activeTab === 'donate' ? '#ffffff' : '#334155',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            💝 Donate & Urgent Needs
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
            📜 My Donations & Receipts ({myDonations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('impact')}
            style={{
              padding: '0.65rem 1.2rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: activeTab === 'impact' ? '#1a237e' : '#ffffff',
              color: activeTab === 'impact' ? '#ffffff' : '#334155',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📊 Live Ground Allocation & Impact
          </button>
        </div>

        {activeTab === 'donate' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            <div className="dashboard-card" style={{ marginBottom: 0 }}>
              <h2 style={{ fontSize: '1.2rem', color: '#1a237e', marginBottom: '0.9rem' }}>
                Make a Contribution
              </h2>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setDonationType('Monetary');
                    setTargetResourceId('');
                  }}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: '7px',
                    border: '1.5px solid #1a237e',
                    background: donationType === 'Monetary' ? '#1a237e' : '#ffffff',
                    color: donationType === 'Monetary' ? '#ffffff' : '#1a237e',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  💳 Monetary (BDT)
                </button>
                <button
                  type="button"
                  onClick={() => setDonationType('Supplies')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: '7px',
                    border: '1.5px solid #059669',
                    background: donationType === 'Supplies' ? '#059669' : '#ffffff',
                    color: donationType === 'Supplies' ? '#ffffff' : '#059669',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  📦 Supply Donation
                </button>
              </div>

              <form onSubmit={handleDonateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {donationType === 'Monetary' ? (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                        Quick Select Amount (BDT)
                      </label>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        {QUICK_AMOUNTS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setAmountBDT(String(amt))}
                            style={{
                              padding: '0.4rem 0.75rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: Number(amountBDT) === amt ? '#ede9fe' : '#f8fafc',
                              color: Number(amountBDT) === amt ? '#5b21b6' : '#334155',
                              fontWeight: 700,
                              fontSize: '0.84rem',
                              cursor: 'pointer',
                            }}
                          >
                            ৳{amt.toLocaleString()}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min="10"
                        required
                        value={amountBDT}
                        onChange={(e) => setAmountBDT(e.target.value)}
                        placeholder="Enter amount in BDT"
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Payment Channel
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                        >
                          {PAYMENT_METHODS.map((pm) => (
                            <option key={pm} value={pm}>
                              {pm}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Transaction Ref (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. TXN982314"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Category
                        </label>
                        <select
                          value={supplyCategory}
                          onChange={(e) => setSupplyCategory(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                        >
                          {SUPPLY_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Item Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Bottled Water"
                          value={supplyItemName}
                          onChange={(e) => setSupplyItemName(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Quantity *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={supplyQuantity}
                          onChange={(e) => setSupplyQuantity(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Unit (packs, cartons, kg)
                        </label>
                        <input
                          type="text"
                          required
                          value={supplyUnit}
                          onChange={(e) => setSupplyUnit(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Target Campaign / District
                    </label>
                    <select
                      value={targetDistrict}
                      onChange={(e) => setTargetDistrict(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                    >
                      {TARGET_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Specific Shelter (Optional)
                    </label>
                    <select
                      value={targetShelterId}
                      onChange={(e) => setTargetShelterId(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                    >
                      <option value="">Any active shelter / general</option>
                      {shelters.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({s.location?.district})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Dedication / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. For flood relief families in Feni"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: donationType === 'Monetary' ? '#1a237e' : '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.8rem',
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: '0.25rem',
                  }}
                >
                  {submitting
                    ? 'Processing Contribution...'
                    : donationType === 'Monetary'
                    ? `Confirm Donation (৳${Number(amountBDT || 0).toLocaleString()})`
                    : 'Confirm Supply Pledge & Generate Receipt'}
                </button>
              </form>
            </div>

            <div className="dashboard-card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.2rem', color: '#dc2626', margin: 0 }}>
                  🚨 Urgent Relief Shortages
                </h2>
                <Link to="/resources" style={{ fontSize: '0.84rem', color: '#1d4ed8', fontWeight: 600 }}>
                  View Full Stock →
                </Link>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1rem' }}>
                Live inventory items currently running critically low across relief warehouses. Click to sponsor direct replenishment:
              </p>

              {loading ? (
                <p style={{ color: '#64748b' }}>Loading live stock alerts...</p>
              ) : !overview?.urgentNeeds?.length ? (
                <div style={{ padding: '1.8rem', textAlign: 'center', background: '#f0fdf4', color: '#166534', borderRadius: '8px', fontWeight: 600 }}>
                  ✅ All relief warehouses currently meet minimum safety thresholds. You can still contribute to the General Relief Fund.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '420px', overflowY: 'auto' }}>
                  {overview.urgentNeeds.map((need) => (
                    <div
                      key={need._id}
                      style={{
                        border: `1px solid ${need.status === 'Out of Stock' ? '#fca5a5' : '#fde68a'}`,
                        background: need.status === 'Out of Stock' ? '#fef2f2' : '#fffbeb',
                        borderRadius: '8px',
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.96rem' }}>
                          {need.name}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.15rem' }}>
                          <strong>{need.category}</strong> • {need.district} ({need.warehouseName})
                        </div>
                        <div style={{ fontSize: '0.82rem', color: need.status === 'Out of Stock' ? '#b91c1c' : '#b45309', fontWeight: 700, marginTop: '0.2rem' }}>
                          Remaining: {need.quantityAvailable} {need.unit} ({need.status})
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSponsorUrgentNeed(need)}
                        style={{
                          background: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.5rem 0.85rem',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Donate This Item
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="dashboard-card">
            <h2 style={{ fontSize: '1.2rem', color: '#1a237e', marginBottom: '1rem' }}>
              📜 My Donations & Downloadable Receipts
            </h2>

            {myDonations.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
                You haven&apos;t made any donations yet. Switch to the &quot;Donate &amp; Urgent Needs&quot; tab to make your first impact!
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.75rem' }}>Receipt No</th>
                      <th style={{ padding: '0.75rem' }}>Date</th>
                      <th style={{ padding: '0.75rem' }}>Type</th>
                      <th style={{ padding: '0.75rem' }}>Amount / Supplies</th>
                      <th style={{ padding: '0.75rem' }}>Target Area</th>
                      <th style={{ padding: '0.75rem' }}>Status</th>
                      <th style={{ padding: '0.75rem' }}>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myDonations.map((don) => (
                      <tr key={don._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 700, color: '#1a237e' }}>
                          {don.receiptNo}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#475569' }}>
                          {new Date(don.donatedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{don.donationType}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                          {don.donationType === 'Monetary'
                            ? `৳${Number(don.amountBDT).toLocaleString()} (${don.paymentMethod})`
                            : `${don.supplyDetails?.quantity} ${don.supplyDetails?.unit} — ${don.supplyDetails?.itemName}`}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {don.targetShelterName || don.targetDistrict}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span
                            style={{
                              background: don.status === 'Delivered' ? '#dcfce7' : don.status === 'Allocated' ? '#dbeafe' : '#ede9fe',
                              color: don.status === 'Delivered' ? '#166534' : don.status === 'Allocated' ? '#1e40af' : '#5b21b6',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '12px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                            }}
                          >
                            {don.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => handlePrintReceipt(don)}
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              padding: '0.35rem 0.7rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            🖨️ Print Receipt
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

        {activeTab === 'impact' && (
          <div className="dashboard-card">
            <h2 style={{ fontSize: '1.2rem', color: '#1a237e', marginBottom: '0.4rem' }}>
              📊 Ground Relief Allocation & Impact Transparency
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.2rem' }}>
              Live audit log showing how relief supplies funded by donors and managed by NGOs are actively reaching disaster-affected districts.
            </p>

            {overview?.categoryBreakdown?.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
                {overview.categoryBreakdown.map((cat) => (
                  <div key={cat.category} style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.92rem' }}>{cat.category}</div>
                    <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: '0.25rem' }}>
                      Distributed: <strong>{cat.distributed.toLocaleString()}</strong>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                      In Stock: <strong>{cat.available.toLocaleString()}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!overview?.recentDistributions?.length ? (
              <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
                No ground distribution records logged yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.7rem' }}>Date</th>
                      <th style={{ padding: '0.7rem' }}>Resource Item</th>
                      <th style={{ padding: '0.7rem' }}>Quantity</th>
                      <th style={{ padding: '0.7rem' }}>Destination</th>
                      <th style={{ padding: '0.7rem' }}>Citizens Helped</th>
                      <th style={{ padding: '0.7rem' }}>Coordinator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentDistributions.map((dist) => (
                      <tr key={dist._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.7rem', color: '#475569' }}>
                          {new Date(dist.distributionDate).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0.7rem', fontWeight: 700, color: '#1e293b' }}>
                          {dist.resourceName} ({dist.category})
                        </td>
                        <td style={{ padding: '0.7rem', color: '#047857', fontWeight: 700 }}>
                          {dist.quantity} {dist.unit}
                        </td>
                        <td style={{ padding: '0.7rem' }}>
                          {dist.destination?.name || dist.shelterName} ({dist.destination?.district})
                        </td>
                        <td style={{ padding: '0.7rem' }}>{dist.beneficiaryCount || 0}</td>
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

      {receiptModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.58)',
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
              maxWidth: '440px',
              width: '100%',
              padding: '1.6rem',
              borderTop: '5px solid #4c1d95',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '0.2rem 0.65rem', borderRadius: '14px', fontSize: '0.78rem', fontWeight: 700 }}>
                Official Tax & Relief Receipt
              </span>
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <h2 style={{ margin: '0.3rem 0', color: '#1a237e' }}>{receiptModal.receiptNo}</h2>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
              Thank you, {receiptModal.donorName}! Your contribution is confirmed.
            </p>

            <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '8px', fontSize: '0.88rem', lineHeight: 1.7, border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div><strong>Type:</strong> {receiptModal.donationType}</div>
              <div>
                <strong>Contribution:</strong>{' '}
                {receiptModal.donationType === 'Monetary'
                  ? `৳${Number(receiptModal.amountBDT).toLocaleString()} (${receiptModal.paymentMethod})`
                  : `${receiptModal.supplyDetails?.quantity} ${receiptModal.supplyDetails?.unit} — ${receiptModal.supplyDetails?.itemName}`}
              </div>
              <div><strong>Allocated To:</strong> {receiptModal.targetShelterName || receiptModal.targetDistrict}</div>
              <div><strong>Status:</strong> {receiptModal.status}</div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => handlePrintReceipt(receiptModal)}
                style={{
                  flex: 1,
                  background: '#1a237e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🖨️ Print / Save Receipt
              </button>
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                style={{
                  padding: '0.7rem 1rem',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
