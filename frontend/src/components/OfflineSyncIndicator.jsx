import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance.js';
import {
  getOfflineSOSQueue,
  syncOfflineQueue,
  generateSMSFallbackURI,
  formatSMSMessage,
} from '../utils/offlineSyncManager.js';

export default function OfflineSyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [selectedSOS, setSelectedSOS] = useState(null);

  const updateQueueStatus = useCallback(() => {
    const queue = getOfflineSOSQueue();
    setQueuedCount(queue.length);
    if (queue.length > 0 && !selectedSOS) {
      setSelectedSOS(queue[0]);
    }
  }, [selectedSOS]);

  const handleTriggerSync = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    try {
      setSyncing(true);
      setSyncMessage('🔄 Syncing offline SOS requests with server...');
      const { syncedCount } = await syncOfflineQueue(axiosInstance);
      updateQueueStatus();
      if (syncedCount > 0) {
        setSyncMessage(`✅ Successfully synced ${syncedCount} offline emergency request(s)!`);
        setTimeout(() => setSyncMessage(null), 5000);
      } else {
        setSyncMessage(null);
      }
    } catch (err) {
      console.error('Failed to sync offline queue:', err);
      setSyncMessage('⚠️ Sync failed. Will retry automatically.');
    } finally {
      setSyncing(false);
    }
  }, [syncing, updateQueueStatus]);

  useEffect(() => {
    updateQueueStatus();

    const handleOnline = () => {
      setIsOnline(true);
      console.log('[PWA] Network connection restored. Auto-syncing queue...');
      handleTriggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[PWA] Network disconnected. Switched to offline mode.');
    };

    const handleStorageChange = () => {
      updateQueueStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(updateQueueStatus, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [handleTriggerSync, updateQueueStatus]);
  if (isOnline && queuedCount === 0 && !syncMessage) {
    return null;
  }

  const sampleFallbackPayload = selectedSOS || {
    latitude: 23.0159,
    longitude: 91.3976,
    district: 'Feni',
    needs: ['food', 'water', 'rescue'],
    numberOfPeople: 4,
    phone: '01700000000',
    vulnerabilities: { children: 2, elderly: 1 },
  };

  const smsText = formatSMSMessage(sampleFallbackPayload);
  const smsURI = generateSMSFallbackURI(sampleFallbackPayload, '999');

  return (
    <>
      {/* ── Floating Indicator Bar (Bottom Right) ── */}
      <div style={styles.floatingBar}>
        {!isOnline && (
          <div style={styles.offlinePill}>
            <span style={styles.pulseDotRed} />
            <span style={styles.boldText}>Offline Mode (PWA Active)</span>
            {queuedCount > 0 && (
              <span style={styles.badge}>{queuedCount} queued</span>
            )}
            <button
              type="button"
              style={styles.smsBtn}
              onClick={() => setShowSMSModal(true)}
              title="Send SOS via SMS Fallback"
            >
              📱 SMS Fallback
            </button>
          </div>
        )}

        {isOnline && queuedCount > 0 && (
          <div style={styles.onlinePendingPill}>
            <span style={styles.pulseDotGreen} />
            <span>Connection Restored: <strong>{queuedCount}</strong> SOS pending sync</span>
            <button
              type="button"
              style={styles.syncBtn}
              onClick={handleTriggerSync}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : '⚡ Sync Now'}
            </button>
          </div>
        )}

        {syncMessage && (
          <div style={styles.syncToast}>
            <span>{syncMessage}</span>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              style={styles.closeBtn}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ── SMS Fallback Modal ── */}
      {showSMSModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#b91c1c' }}>
                📱 Emergency SMS Fallback Dispatch
              </h3>
              <button
                type="button"
                onClick={() => setShowSMSModal(false)}
                style={styles.closeBtnLarge}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.smsAlertNotice}>
                <strong>⚠️ Cellular Fallback Activated:</strong> When internet towers collapse during floods or cyclones, 2G SMS signals still operate. You can send your emergency GPS location and needs directly to Bangladesh Emergency Hotline (<strong>999</strong>) or local rescue cells.
              </div>

              <div style={styles.label}>Generated Cellular SOS Message:</div>
              <div style={styles.smsPreviewBox}>
                <code>{smsText}</code>
              </div>

              <div style={styles.smsStatsRow}>
                <div><strong>Target:</strong> 999 (National Emergency)</div>
                <div><strong>GPS Accuracy:</strong> High (Hardware GPS)</div>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setShowSMSModal(false)}
                >
                  Close
                </button>
                <a
                  href={smsURI}
                  style={styles.sendSMSLink}
                  onClick={() => setShowSMSModal(false)}
                >
                  ✉️ Open Device SMS App (999)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  floatingBar: {
    position: 'fixed',
    bottom: '1.25rem',
    right: '1.25rem',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxWidth: '420px',
  },
  offlinePill: {
    backgroundColor: '#7f1d1d',
    color: '#ffffff',
    padding: '0.6rem 1rem',
    borderRadius: '30px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '0.85rem',
    border: '1px solid #b91c1c',
  },
  onlinePendingPill: {
    backgroundColor: '#064e3b',
    color: '#ffffff',
    padding: '0.6rem 1rem',
    borderRadius: '30px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '0.85rem',
    border: '1px solid #059669',
  },
  boldText: {
    fontWeight: 700,
  },
  badge: {
    backgroundColor: '#fef08a',
    color: '#713f12',
    padding: '0.15rem 0.5rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  smsBtn: {
    backgroundColor: '#ffffff',
    color: '#991b1b',
    border: 'none',
    padding: '0.25rem 0.65rem',
    borderRadius: '14px',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  syncBtn: {
    backgroundColor: '#ffffff',
    color: '#065f46',
    border: 'none',
    padding: '0.25rem 0.65rem',
    borderRadius: '14px',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  syncToast: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    marginLeft: '0.5rem',
  },
  pulseDotRed: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    boxShadow: '0 0 8px #ef4444',
  },
  pulseDotGreen: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 8px #10b981',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '1rem',
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    maxWidth: '520px',
    width: '100%',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #fee2e2',
    backgroundColor: '#fef2f2',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtnLarge: {
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    color: '#991b1b',
  },
  modalBody: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  smsAlertNotice: {
    backgroundColor: '#fffbeb',
    color: '#92400e',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    fontSize: '0.84rem',
    lineHeight: 1.5,
    border: '1px solid #fde68a',
  },
  label: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#334155',
  },
  smsPreviewBox: {
    backgroundColor: '#f1f5f9',
    padding: '0.85rem 1rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '0.88rem',
    color: '#0f172a',
    wordBreak: 'break-word',
  },
  smsStatsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    color: '#64748b',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    padding: '0.6rem 1.1rem',
    borderRadius: '8px',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  sendSMSLink: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    textDecoration: 'none',
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    fontSize: '0.88rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    boxShadow: '0 2px 4px rgba(220,38,38,0.25)',
  },
};
