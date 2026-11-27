const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

const {
  createHazardReport,
  getAllHazardReports,
  getNearbyHazardReports,
  getHazardStats,
  getMyTrustProfile,
  getHazardReportById,
  toggleUpvoteHazard,
  verifyHazardReport,
  flagFakeHazardReport,
  updateHazardStatus,
  deleteHazardReport,
} = require('../controllers/hazardController');

router.get('/stats', getHazardStats);
router.get('/nearby', getNearbyHazardReports);
router.get('/my-trust', protect, getMyTrustProfile);
router.get('/', protect, getAllHazardReports);
router.post('/', protect, upload.single('photo'), createHazardReport);
router.get('/:id', protect, getHazardReportById);
router.post('/:id/upvote', protect, toggleUpvoteHazard);
router.post('/:id/verify', protect, verifyHazardReport);
router.post('/:id/flag-fake', protect, flagFakeHazardReport);
router.patch('/:id/status', protect, requireRole(['Admin', 'NGO', 'Volunteer']), updateHazardStatus);
router.delete('/:id', protect, deleteHazardReport);

module.exports = router;
