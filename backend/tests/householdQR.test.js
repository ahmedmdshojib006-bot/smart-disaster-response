const mongoose = require('mongoose');
const Household = require('../models/Household');
const HouseholdDistribution = require('../models/HouseholdDistribution');
const householdRoutes = require('../routes/householdRoutes');
const householdController = require('../controllers/householdController');

describe('Member-1 (Module 3): Household Registration & QR Distribution Verification', () => {
  describe('Route & Controller Exports', () => {
    it('should export household routes and all controller handlers', () => {
      expect(householdRoutes).toBeDefined();
      expect(householdController.registerHousehold).toBeDefined();
      expect(householdController.getAllHouseholds).toBeDefined();
      expect(householdController.getDistributionCoverage).toBeDefined();
      expect(householdController.getAvailableRounds).toBeDefined();
      expect(householdController.verifyHouseholdScan).toBeDefined();
      expect(householdController.distributeToHousehold).toBeDefined();
      expect(householdController.getHouseholdById).toBeDefined();
      expect(householdController.updateHousehold).toBeDefined();
      expect(householdController.deleteHousehold).toBeDefined();
    });
  });

  describe('QR Cryptographic Signature & Payload Parsing', () => {
    it('should generate deterministic HMAC signature and formatted QR payload', () => {
      const sig1 = householdController.generateSignature('HH-FEN-1001');
      const sig2 = householdController.generateSignature('hh-fen-1001');
      expect(sig1).toBe(sig2);
      expect(sig1).toHaveLength(12);

      const payload = householdController.buildQrPayload('HH-FEN-1001', sig1);
      expect(payload).toBe(`RELIEFSYNC:HH:HH-FEN-1001:${sig1}`);
    });

    it('should parse RELIEFSYNC payload strings, JSON payloads, and raw Household IDs', () => {
      const sig = householdController.generateSignature('HH-SYL-2001');
      const fullPayload = `RELIEFSYNC:HH:HH-SYL-2001:${sig}`;
      const parsedFull = householdController.parseQrInput(fullPayload);
      expect(parsedFull.householdId).toBe('HH-SYL-2001');
      expect(parsedFull.signature).toBe(sig);

      const jsonPayload = JSON.stringify({ householdId: 'hh-noa-3001', signature: 'ABCDEF123456' });
      const parsedJson = householdController.parseQrInput(jsonPayload);
      expect(parsedJson.householdId).toBe('HH-NOA-3001');
      expect(parsedJson.signature).toBe('ABCDEF123456');

      const parsedManual = householdController.parseQrInput('  hh-fen-1002 ');
      expect(parsedManual.householdId).toBe('HH-FEN-1002');
      expect(parsedManual.signature).toBeNull();
    });
  });

  describe('Household Schema Validation', () => {
    it('should require householdId, headName, phone, memberCount, address.district, qrPayload, verificationHash', () => {
      const doc = new Household({});
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.householdId).toBeDefined();
      expect(err.errors.headName).toBeDefined();
      expect(err.errors.phone).toBeDefined();
      expect(err.errors.memberCount).toBeDefined();
      expect(err.errors['address.district']).toBeDefined();
      expect(err.errors.qrPayload).toBeDefined();
      expect(err.errors.verificationHash).toBeDefined();
    });

    it('should reject memberCount below 1 and apply proper defaults', () => {
      const invalidDoc = new Household({
        householdId: 'HH-TEST-0001',
        headName: 'Test Head',
        phone: '01700000000',
        memberCount: 0,
        address: { district: 'Feni' },
        qrPayload: 'RELIEFSYNC:HH:HH-TEST-0001:TEST12345678',
        verificationHash: 'TEST12345678',
      });
      const err = invalidDoc.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.memberCount).toBeDefined();

      const validDoc = new Household({
        householdId: 'hh-test-0002',
        headName: 'Valid Head',
        phone: '01700000001',
        memberCount: 4,
        address: { district: 'Sylhet' },
        qrPayload: 'RELIEFSYNC:HH:HH-TEST-0002:TEST12345678',
        verificationHash: 'TEST12345678',
      });
      expect(validDoc.validateSync()).toBeUndefined();
      expect(validDoc.householdId).toBe('HH-TEST-0002');
      expect(validDoc.status).toBe('Active');
      expect(validDoc.totalDistributionsReceived).toBe(0);
    });
  });

  describe('HouseholdDistribution Duplicate-Prevention Schema', () => {
    it('should define compound unique index on household + distributionRound', () => {
      const indexes = HouseholdDistribution.schema.indexes();
      const hasCompoundUnique = indexes.some(
        ([fields, options]) =>
          fields.household === 1 &&
          fields.distributionRound === 1 &&
          options &&
          options.unique === true
      );
      expect(hasCompoundUnique).toBe(true);
    });

    it('should enforce required fields and valid scanMethod / role enums', () => {
      const dummyHh = new mongoose.Types.ObjectId();
      const dummyUser = new mongoose.Types.ObjectId();

      const dist = new HouseholdDistribution({
        household: dummyHh,
        householdIdCode: 'HH-FEN-1001',
        headName: 'Abdul Karim',
        distributionRound: 'Round 1 - Emergency Food & Water',
        itemsProvided: [{ itemName: 'Rice', quantity: 10, unit: 'kg' }],
        distributedBy: dummyUser,
        distributedByName: 'Volunteer One',
        distributedByRole: 'Volunteer',
        scanMethod: 'QR Camera',
      });

      expect(dist.validateSync()).toBeUndefined();
      expect(dist.householdIdCode).toBe('HH-FEN-1001');
    });
  });
});
