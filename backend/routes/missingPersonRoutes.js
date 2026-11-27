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
router.get('/stats', getMissingPersonStats);
router.get('/', getAllMissingPersons);
router.get('/:id', getMissingPersonById);
router.post('/', protect, upload.single('photo'), reportMissingPerson);
router.patch('/:id/safe', protect, markPersonSafe);
router.put('/:id', protect, upload.single('photo'), updateMissingPerson);
router.delete('/:id', protect, deleteMissingPerson);

module.exports = router;
