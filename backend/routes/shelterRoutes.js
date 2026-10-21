const express = require('express');
const router = express.Router();

const {
  getAllShelters,
  getNearestShelter,
  getShelterById,
  createShelter,
  updateShelter,
  deleteShelter,
} = require('../controllers/shelterController');

const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', getAllShelters);
router.get('/nearest', getNearestShelter);
router.get('/:id', getShelterById);

router.post('/', protect, requireRole(['Admin']), createShelter);
router.put('/:id', protect, requireRole(['Admin']), updateShelter);
router.delete('/:id', protect, requireRole(['Admin']), deleteShelter);

module.exports = router;
