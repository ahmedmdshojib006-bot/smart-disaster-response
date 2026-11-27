const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const donationRoutes = require('../routes/donationRoutes');
const donationController = require('../controllers/donationController');

describe('Donor Dashboard & Donation Tracking Specifications', () => {
  describe('Route & Controller Exports', () => {
    it('should export donation routes and all controller methods', () => {
      expect(donationRoutes).toBeDefined();
      expect(donationController.createDonation).toBeDefined();
      expect(donationController.getMyDonations).toBeDefined();
      expect(donationController.getDonorOverview).toBeDefined();
      expect(donationController.getAllDonations).toBeDefined();
      expect(donationController.updateDonationStatus).toBeDefined();
    });
  });

  describe('Donation Schema Validation', () => {
    it('should require receiptNo, donor, donorName, and donorEmail', () => {
      const d = new Donation({});
      const err = d.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.receiptNo).toBeDefined();
      expect(err.errors.donor).toBeDefined();
      expect(err.errors.donorName).toBeDefined();
      expect(err.errors.donorEmail).toBeDefined();
    });

    it('should reject negative amountBDT and validate monetary and supply donations', () => {
      const donorId = new mongoose.Types.ObjectId();

      const invalid = new Donation({
        receiptNo: 'DON-2026-100001',
        donor: donorId,
        donorName: 'Test Donor',
        donorEmail: 'donor@test.com',
        donationType: 'Monetary',
        amountBDT: -50,
      });
      const err = invalid.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.amountBDT).toBeDefined();

      const validMonetary = new Donation({
        receiptNo: 'don-2026-100002',
        donor: donorId,
        donorName: 'Md. Abu Yusuf',
        donorEmail: 'yusuf@test.com',
        donationType: 'Monetary',
        amountBDT: 5000,
        paymentMethod: 'bKash',
        targetDistrict: 'Feni',
      });
      expect(validMonetary.validateSync()).toBeUndefined();
      expect(validMonetary.receiptNo).toBe('DON-2026-100002');
      expect(validMonetary.status).toBe('Confirmed');

      const validSupplies = new Donation({
        receiptNo: 'DON-2026-100003',
        donor: donorId,
        donorName: 'Md. Abu Yusuf',
        donorEmail: 'yusuf@test.com',
        donationType: 'Supplies',
        paymentMethod: 'Direct Supply',
        supplyDetails: {
          category: 'Medicine',
          itemName: 'Oral Saline Packs',
          quantity: 100,
          unit: 'boxes',
        },
        targetDistrict: 'Sylhet',
      });
      expect(validSupplies.validateSync()).toBeUndefined();
    });
  });
});
