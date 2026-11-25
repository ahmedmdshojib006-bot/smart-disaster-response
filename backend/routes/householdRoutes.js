const express = require('express');
const router = express.Router();

const {
  registerHousehold,
  getAllHouseholds,
  getDistributionCoverage,
  getAvailableRounds,
  verifyHouseholdScan,
  distributeToHousehold,
  getHouseholdById,
  updateHousehold,
  deleteHousehold,
} = require('../controllers/householdController');

const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/coverage', protect, requireRole(['Admin', 'NGO', 'Volunteer']), getDistributionCoverage);
router.get('/rounds', protect, getAvailableRounds);
router.post('/verify-scan', protect, requireRole(['Admin', 'NGO', 'Volunteer']), verifyHouseholdScan);
router.post('/distribute', protect, requireRole(['Admin', 'NGO', 'Volunteer']), distributeToHousehold);

router.get('/', protect, getAllHouseholds);
router.post('/', protect, requireRole(['Admin', 'NGO', 'Volunteer', 'Citizen']), registerHousehold);
router.get('/:id', protect, getHouseholdById);
router.put('/:id', protect, requireRole(['Admin', 'NGO', 'Volunteer']), updateHousehold);
router.delete('/:id', protect, requireRole(['Admin']), deleteHousehold);

module.exports = router;
