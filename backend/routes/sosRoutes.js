// routes/sosRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Express router for SOS / Emergency Help requests (Module 1 & Module 2).
// ─────────────────────────────────────────────────────────────────────────────

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
} = require('../controllers/sosController');

// ── Submit emergency SOS request (Citizens / Victims, or any authenticated user)
// Supports optional photo upload as multipart/form-data with field name 'photo'
router.post('/', protect, upload.single('photo'), createSOS);

// ── Get the authenticated user's submitted SOS requests
router.get('/my', protect, getMySOS);

// ── Get prioritized emergency requests (Module 2: ranked by priority score)
router.get('/prioritized', protect, requireRole(['Admin', 'Volunteer', 'NGO']), getPrioritizedSOS);

// ── Get all SOS requests (for Admin, Volunteer, NGO coordinators)
router.get('/', protect, requireRole(['Admin', 'Volunteer', 'NGO']), getAllSOS);

// ── Get single SOS request by ID
router.get('/:id', protect, getSOSById);

// ── Cancel an SOS request (Citizen who submitted it, or Admin)
router.patch('/:id/cancel', protect, cancelSOS);

// ── Update status of an SOS request (Admin, Volunteer, NGO)
router.patch('/:id/status', protect, requireRole(['Admin', 'Volunteer', 'NGO']), updateSOSStatus);

module.exports = router;
