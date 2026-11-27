// backend/routes/missingPersonRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Express route definitions for Missing Persons & Community Safety Network
// (Member-3: Module 3).
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const {
  getAllMissingPersons,
  getMissingPersonStats,
  getMissingPersonById,
  reportMissingPerson,
  markPersonSafe,
  updateMissingPerson,
  deleteMissingPerson,
} = require('../controllers/missingPersonController');

const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// ── Public / Read endpoints ───────────────────────────────────────────────────
router.get('/stats', getMissingPersonStats);
router.get('/', getAllMissingPersons);
router.get('/:id', getMissingPersonById);

// ── Authenticated operations ──────────────────────────────────────────────────
router.post('/', protect, upload.single('photo'), reportMissingPerson);
router.patch('/:id/safe', protect, markPersonSafe);
router.put('/:id', protect, upload.single('photo'), updateMissingPerson);
router.delete('/:id', protect, deleteMissingPerson);

module.exports = router;
