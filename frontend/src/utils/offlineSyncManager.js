// frontend/src/utils/offlineSyncManager.js
// ─────────────────────────────────────────────────────────────────────────────
// Offline Storage Queue & Background Sync Manager (Member-3: Module 3).
// Allows disaster victims to submit SOS requests without active internet;
// persists requests locally and automatically syncs when connectivity returns.
// Also generates compact SMS Fallback payloads for 2G cellular dispatches.
// ─────────────────────────────────────────────────────────────────────────────

const QUEUE_STORAGE_KEY = 'reliefsync_offline_sos_queue';
const SMS_EMERGENCY_NUMBER = '999'; // Bangladesh National Emergency Services hotline

/**
 * Retrieve all pending offline SOS requests from local storage.
 */
export function getOfflineSOSQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read offline SOS queue:', err);
    return [];
  }
}

/**
 * Enqueue a new SOS request created while offline.
 */
export function saveOfflineSOS(sosPayload) {
  try {
    const queue = getOfflineSOSQueue();
    const tempId = `offline-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const queuedItem = {
      ...sosPayload,
      tempId,
      offlineLoggedAt: new Date().toISOString(),
      status: 'Pending Sync',
    };

    queue.push(queuedItem);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    console.log(`[OfflineSyncManager] SOS enqueued locally with ID: ${tempId}`);
    return queuedItem;
  } catch (err) {
    console.error('Failed to save offline SOS:', err);
    throw new Error('Could not persist offline SOS request to local storage.');
  }
}

/**
 * Remove a specific item from the offline queue after successful sync.
 */
export function removeOfflineSOS(tempId) {
  try {
    const queue = getOfflineSOSQueue();
    const updated = queue.filter((item) => item.tempId !== tempId);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to remove synced item from queue:', err);
  }
}

/**
 * Clear the entire offline queue.
 */
export function clearOfflineSOSQueue() {
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear offline SOS queue:', err);
  }
}

/**
 * Formats a compact, cellular-safe SMS message for emergency dispatch.
 * Example: "EMERGENCY SOS! Loc: 23.0159,91.3976 (Feni). Needs: Food,Water. Ppl: 4. Vulnerable: 2 kids. Phone: 01711223344"
 */
export function formatSMSMessage(sosPayload) {
  const lat = parseFloat(sosPayload.latitude) || 0;
  const lng = parseFloat(sosPayload.longitude) || 0;
  const needsStr = Array.isArray(sosPayload.needs) ? sosPayload.needs.join(',') : (sosPayload.needs || 'Rescue');
  const ppl = sosPayload.numberOfPeople || 1;
  const dist = sosPayload.district || 'Flood Zone';
  const phone = sosPayload.phone || sosPayload.victimPhone || 'Victim Device';

  let vulnText = '';
  const v = sosPayload.vulnerabilities;
  if (v) {
    const parts = [];
    if (v.children > 0) parts.push(`${v.children} kids`);
    if (v.elderly > 0) parts.push(`${v.elderly} elderly`);
    if (v.pregnantWomen > 0) parts.push(`${v.pregnantWomen} preg`);
    if (v.injured > 0) parts.push(`${v.injured} injured`);
    if (parts.length > 0) vulnText = ` Vuln:${parts.join(',')}`;
  }

  return `EMERGENCY SOS! GPS:${lat.toFixed(4)},${lng.toFixed(4)} (${dist}). Need:${needsStr}. Ppl:${ppl}.${vulnText} Tel:${phone}`;
}

/**
 * Generates an SMS clickable URI scheme (sms:999?body=...) for native mobile dispatch.
 */
export function generateSMSFallbackURI(sosPayload, targetNumber = SMS_EMERGENCY_NUMBER) {
  const message = formatSMSMessage(sosPayload);
  const encodedBody = encodeURIComponent(message);
  // Support both iOS and Android URI formats
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIOS ? '&' : '?';
  return `sms:${targetNumber}${separator}body=${encodedBody}`;
}

/**
 * Synchronize all pending offline requests with the backend API.
 */
export async function syncOfflineQueue(axiosInstance) {
  const queue = getOfflineSOSQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;

  try {
    // Attempt batch sync via dedicated /api/sos/sync-offline endpoint
    const response = await axiosInstance.post('/api/sos/sync-offline', { requests: queue });
    if (response.data && response.data.success) {
      syncedCount = response.data.count || queue.length;
      clearOfflineSOSQueue();
      return { syncedCount, failedCount: 0 };
    }
  } catch (batchError) {
    console.warn('[OfflineSyncManager] Batch sync failed, falling back to individual request sync:', batchError.message);
  }

  // Fallback: Sync items one by one
  for (const item of queue) {
    try {
      const formData = new FormData();
      formData.append('latitude', item.latitude);
      formData.append('longitude', item.longitude);
      if (item.address) formData.append('address', item.address);
      if (item.district) formData.append('district', item.district);
      formData.append('needs', Array.isArray(item.needs) ? JSON.stringify(item.needs) : item.needs);
      formData.append('numberOfPeople', item.numberOfPeople || 1);
      if (item.vulnerabilities) {
        formData.append('vulnerabilities', JSON.stringify(item.vulnerabilities));
      }
      formData.append('description', `[Offline Synced] ${item.description || ''}`);

      await axiosInstance.post('/api/sos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      removeOfflineSOS(item.tempId);
      syncedCount++;
    } catch (singleErr) {
      console.error(`[OfflineSyncManager] Failed to sync item ${item.tempId}:`, singleErr.message);
      failedCount++;
    }
  }

  return { syncedCount, failedCount };
}
