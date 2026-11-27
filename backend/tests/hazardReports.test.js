const mongoose = require('mongoose');
const HazardReport = require('../models/HazardReport');
const User = require('../models/User');
const hazardRoutes = require('../routes/hazardRoutes');
const hazardController = require('../controllers/hazardController');
const {
  TRUST_DELTAS,
  clampScore,
  getTrustTier,
  calculateCredibilityScore,
} = require('../utils/trustScoreCalculator');

describe('Member-2 (Module 3): Crowdsourced Hazard Reports, Verification & Trust Score', () => {
  describe('Route & Controller Exports', () => {
    it('should export hazard routes and all controller handlers', () => {
      expect(hazardRoutes).toBeDefined();
      expect(hazardController.createHazardReport).toBeDefined();
      expect(hazardController.getAllHazardReports).toBeDefined();
      expect(hazardController.getNearbyHazardReports).toBeDefined();
      expect(hazardController.getHazardStats).toBeDefined();
      expect(hazardController.getMyTrustProfile).toBeDefined();
      expect(hazardController.getHazardReportById).toBeDefined();
      expect(hazardController.toggleUpvoteHazard).toBeDefined();
      expect(hazardController.verifyHazardReport).toBeDefined();
      expect(hazardController.flagFakeHazardReport).toBeDefined();
      expect(hazardController.updateHazardStatus).toBeDefined();
      expect(hazardController.deleteHazardReport).toBeDefined();
    });
  });

  describe('Trust Score & Credibility Calculator', () => {
    it('should clamp scores strictly between 0 and 100', () => {
      expect(clampScore(-25)).toBe(0);
      expect(clampScore(140)).toBe(100);
      expect(clampScore(64.6)).toBe(65);
      expect(clampScore('invalid')).toBe(50);
    });

    it('should assign accurate trust tiers across score ranges', () => {
      expect(getTrustTier(92).tier).toBe('Trusted Guardian');
      expect(getTrustTier(72).tier).toBe('Verified Reporter');
      expect(getTrustTier(50).tier).toBe('Community Member');
      expect(getTrustTier(28).tier).toBe('Low Trust');
      expect(getTrustTier(10).tier).toBe('Flagged Reporter');
    });

    it('should increase credibility with photo, upvotes, and verifications, and penalize fake flags', () => {
      const baseScore = calculateCredibilityScore({
        reporterTrustScore: 50,
        hasPhoto: false,
        upvotesCount: 0,
        verificationsCount: 0,
        officialVerificationsCount: 0,
        fakeFlagsCount: 0,
        status: 'Pending',
      });

      const verifiedScore = calculateCredibilityScore({
        reporterTrustScore: 80,
        hasPhoto: true,
        upvotesCount: 3,
        verificationsCount: 1,
        officialVerificationsCount: 1,
        fakeFlagsCount: 0,
        status: 'Verified',
      });

      const flaggedScore = calculateCredibilityScore({
        reporterTrustScore: 30,
        hasPhoto: false,
        upvotesCount: 0,
        verificationsCount: 0,
        officialVerificationsCount: 0,
        fakeFlagsCount: 3,
        status: 'Rejected',
      });

      expect(verifiedScore).toBeGreaterThan(baseScore);
      expect(verifiedScore).toBeLessThanOrEqual(100);
      expect(flaggedScore).toBe(0);
    });

    it('should define expected trust score deltas', () => {
      expect(TRUST_DELTAS.UPVOTE_RECEIVED).toBeGreaterThan(0);
      expect(TRUST_DELTAS.OFFICIAL_VERIFIED_BONUS).toBeGreaterThan(TRUST_DELTAS.COMMUNITY_VERIFIED_BONUS);
      expect(TRUST_DELTAS.FAKE_THRESHOLD_PENALTY).toBeLessThan(0);
      expect(TRUST_DELTAS.OFFICIAL_REJECTED_PENALTY).toBeLessThan(0);
    });
  });

  describe('User Trust Schema Defaults', () => {
    it('should default trustScore to 50 and initialize hazardStats counters to 0', () => {
      const user = new User({
        name: 'Citizen Reporter',
        email: 'reporter@example.com',
        passwordHash: 'Password123!',
      });

      expect(user.trustScore).toBe(50);
      expect(user.hazardStats.reportsSubmitted).toBe(0);
      expect(user.hazardStats.reportsVerified).toBe(0);
      expect(user.hazardStats.reportsFlaggedFake).toBe(0);
      expect(user.hazardStats.verificationsCast).toBe(0);
    });
  });

  describe('HazardReport Schema & 2dsphere Index Validation', () => {
    it('should define a 2dsphere geospatial index on location.coordinates', () => {
      const indexes = HazardReport.schema.indexes();
      const has2dsphere = indexes.some(
        ([fields]) => fields['location.coordinates'] === '2dsphere'
      );
      expect(has2dsphere).toBe(true);
    });

    it('should require title, description, location.latitude, location.longitude, location.district, and reporter', () => {
      const doc = new HazardReport({});
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.title).toBeDefined();
      expect(err.errors.description).toBeDefined();
      expect(err.errors['location.latitude']).toBeDefined();
      expect(err.errors['location.longitude']).toBeDefined();
      expect(err.errors['location.district']).toBeDefined();
      expect(err.errors.reporter).toBeDefined();
    });

    it('should validate valid hazard report and enforce hazardType / status enums', () => {
      const valid = new HazardReport({
        title: 'Flooded Approach Road at Fulgazi',
        hazardType: 'Flooded Road',
        severity: 'Critical',
        description: 'Water depth exceeds 4 feet over the main highway.',
        photoUrl: '/uploads/hazard-12345.jpg',
        location: {
          latitude: 23.0784,
          longitude: 91.412,
          address: 'Fulgazi Bazar',
          district: 'Feni',
        },
        waterDepthFeet: 4.2,
        roadPassable: false,
        reporter: new mongoose.Types.ObjectId(),
        reporterName: 'Kamrul Hasan',
        reporterTrustSnapshot: 75,
      });

      expect(valid.validateSync()).toBeUndefined();
      expect(valid.status).toBe('Pending');

      const invalid = new HazardReport({
        title: 'Invalid Type Test',
        hazardType: 'Meteor Strike',
        description: 'Invalid hazard type should fail validation.',
        location: {
          latitude: 23.0,
          longitude: 91.0,
          district: 'Feni',
        },
        reporter: new mongoose.Types.ObjectId(),
      });

      const err = invalid.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.hazardType).toBeDefined();
    });

    it('should compute formatted response with upvote, verification, and flag counts', () => {
      const uid1 = new mongoose.Types.ObjectId();
      const uid2 = new mongoose.Types.ObjectId();
      const report = new HazardReport({
        title: 'Broken Bridge Test',
        hazardType: 'Broken Bridge',
        severity: 'High',
        description: 'Timber bridge deck collapsed.',
        location: {
          latitude: 22.9247,
          longitude: 91.1025,
          district: 'Noakhali',
        },
        reporter: uid1,
        reporterName: 'Reporter One',
        reporterTrustSnapshot: 68,
        upvotes: [uid2],
        verifications: [{ user: uid2, userName: 'Verifier', userRole: 'Citizen', note: 'Confirmed' }],
        fakeFlags: [],
      });

      const formatted = hazardController.formatReportResponse(report, uid2);
      expect(formatted.upvoteCount).toBe(1);
      expect(formatted.verificationCount).toBe(1);
      expect(formatted.fakeFlagCount).toBe(0);
      expect(formatted.hasUpvoted).toBe(true);
      expect(formatted.hasVerified).toBe(true);
      expect(formatted.hasFlagged).toBe(false);
      expect(formatted.reporterTrustTier.tier).toBe('Verified Reporter');
    });
  });
});
