const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

const {
  createSOS,
  getMySOS,
  getSOSById,
  getAllSOS,
  getPrioritizedSOS,
  cancelSOS,
  updateSOSStatus,
  syncOfflineSOS,
  handleSMSFallback,
} = require('../controllers/sosController');

router.post('/', protect, upload.single('photo'), createSOS);
router.post('/sync-offline', protect, syncOfflineSOS);
router.post('/sms-fallback', handleSMSFallback);
router.get('/my', protect, getMySOS);
router.get('/prioritized', protect, requireRole(['Admin', 'Volunteer', 'NGO']), getPrioritizedSOS);
router.get('/', protect, requireRole(['Admin', 'Volunteer', 'NGO']), getAllSOS);
router.get('/:id', protect, getSOSById);
router.patch('/:id/cancel', protect, cancelSOS);
router.patch('/:id/status', protect, requireRole(['Admin', 'Volunteer', 'NGO']), updateSOSStatus);

module.exports = router;
