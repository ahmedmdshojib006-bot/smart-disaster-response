const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const {
  getAllMapData,
  getNearbyMapData,
  createHazardZone,
  createReliefCamp,
} = require('../controllers/mapController');

router.get('/all', protect, getAllMapData);
router.get('/nearby', protect, getNearbyMapData);
router.post('/hazards', protect, requireRole(['Admin', 'NGO', 'Volunteer']), createHazardZone);
router.post('/relief-camps', protect, requireRole(['Admin', 'NGO']), createReliefCamp);

module.exports = router;
