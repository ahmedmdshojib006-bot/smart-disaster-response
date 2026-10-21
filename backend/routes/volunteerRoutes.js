const express = require('express');
const router = express.Router();
const volunteerController = require('../controllers/volunteerController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/profile', requireRole(['Volunteer']), volunteerController.getVolunteerProfile);
router.put('/profile', requireRole(['Volunteer']), volunteerController.updateVolunteerProfile);

router.get('/', requireRole(['Admin', 'NGO']), volunteerController.getVolunteers);

module.exports = router;
