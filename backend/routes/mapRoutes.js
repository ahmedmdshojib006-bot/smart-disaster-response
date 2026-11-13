// routes/mapRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Express router for Live Disaster Map and Geospatial 2dsphere queries (Member-2).
// ─────────────────────────────────────────────────────────────────────────────

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

// ── GET /api/map/all
// Fetch all active SOS requests, shelters, hazard zones, and relief camps
router.get('/all', protect, getAllMapData);

// ── GET /api/map/nearby
// Proximity search using MongoDB 2dsphere index ($near)
// Query params: lat, lng, radius (km), types (optional)
router.get('/nearby', protect, getNearbyMapData);

// ── POST /api/map/hazards
// Create a new hazard danger zone (Admin, NGO, Volunteer)
router.post('/hazards', protect, requireRole(['Admin', 'NGO', 'Volunteer']), createHazardZone);

// ── POST /api/map/relief-camps
// Register a new relief distribution camp (Admin, NGO)
router.post('/relief-camps', protect, requireRole(['Admin', 'NGO']), createReliefCamp);

module.exports = router;
