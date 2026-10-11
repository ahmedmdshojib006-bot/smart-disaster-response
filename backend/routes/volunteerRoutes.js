// routes/volunteerRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Volunteer endpoints (Member-3: Volunteer Profile & Skills Management)
//
// Endpoints:
//   GET  /api/volunteers         Admin, NGO: List & filter registered volunteers
//   GET  /api/volunteers/profile Volunteer: View own profile with task stats
//   PUT  /api/volunteers/profile Volunteer: Update skills, availability & service area
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const volunteerController = require('../controllers/volunteerController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All volunteer routes require authentication
router.use(protect);

// Volunteer profile operations (for the logged-in volunteer)
router.get('/profile', requireRole(['Volunteer']), volunteerController.getVolunteerProfile);
router.put('/profile', requireRole(['Volunteer']), volunteerController.updateVolunteerProfile);

// Volunteer listing and roster (for Admins and NGOs to find and assign volunteers)
router.get('/', requireRole(['Admin', 'NGO']), volunteerController.getVolunteers);

module.exports = router;
