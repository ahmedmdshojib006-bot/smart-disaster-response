const express = require('express');
const router = express.Router();

const {
  createDonation,
  getMyDonations,
  getDonorOverview,
  getAllDonations,
  updateDonationStatus,
} = require('../controllers/donationController');

const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/overview', protect, getDonorOverview);
router.get('/my', protect, getMyDonations);
router.get('/', protect, requireRole(['Admin', 'NGO']), getAllDonations);
router.post('/', protect, requireRole(['Donor', 'Admin', 'NGO', 'Volunteer', 'Citizen']), createDonation);
router.patch('/:id/status', protect, requireRole(['Admin', 'NGO']), updateDonationStatus);

module.exports = router;
