const MissingPerson = require('../models/MissingPerson');
const SOSRequest = require('../models/SOSRequest');
const missingPersonRoutes = require('../routes/missingPersonRoutes');
const missingPersonController = require('../controllers/missingPersonController');
const sosController = require('../controllers/sosController');

describe('Module 3: Community Engagement & Safety Network (Member-3)', () => {
  describe('Missing Person Board Schema & Model Specifications', () => {
    it('should define MissingPerson model and required schema paths', () => {
      expect(MissingPerson).toBeDefined();
      const paths = MissingPerson.schema.paths;

      expect(paths['fullName']).toBeDefined();
      expect(paths['age']).toBeDefined();
      expect(paths['gender']).toBeDefined();
      expect(paths['lastSeenLocation.district']).toBeDefined();
      expect(paths['lastSeenLocation.landmark']).toBeDefined();
      expect(paths['status']).toBeDefined();
      expect(paths['contactPerson.name']).toBeDefined();
      expect(paths['contactPerson.phone']).toBeDefined();
      expect(paths['safetyUpdate.foundLocation']).toBeDefined();
      expect(paths['safetyUpdate.markedSafeAt']).toBeDefined();
    });

    it('should enforce status enum: Missing, Found / Safe, Deceased with default Missing', () => {
      const statusPath = MissingPerson.schema.path('status');
      expect(statusPath.enumValues).toEqual(['Missing', 'Found / Safe', 'Deceased']);
      expect(statusPath.defaultValue).toBe('Missing');
    });

    it('should enforce gender enum: Male, Female, Child, Other', () => {
      const genderPath = MissingPerson.schema.path('gender');
      expect(genderPath.enumValues).toEqual(['Male', 'Female', 'Child', 'Other']);
    });

    it('should validate valid missing person instance', () => {
      const person = new MissingPerson({
        fullName: 'Abdur Rahim',
        age: 38,
        gender: 'Male',
        lastSeenLocation: {
          district: 'Feni',
          landmark: 'Parshuram Bazar near river embankment',
        },
        contactPerson: {
          name: 'Fatema Begum',
          phone: '+8801711223344',
          relationship: 'Spouse',
        },
      });

      const err = person.validateSync();
      expect(err).toBeUndefined();
      expect(person.status).toBe('Missing');
    });

    it('should reject missing required fields: fullName, age, district, contactPerson', () => {
      const person = new MissingPerson({});
      const err = person.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.fullName).toBeDefined();
      expect(err.errors.age).toBeDefined();
      expect(err.errors.gender).toBeDefined();
      expect(err.errors['lastSeenLocation.district']).toBeDefined();
      expect(err.errors['contactPerson.name']).toBeDefined();
      expect(err.errors['contactPerson.phone']).toBeDefined();
    });
  });

  describe('Missing Person Routes & Controllers', () => {
    it('should export all required Missing Person controllers', () => {
      expect(missingPersonController.getAllMissingPersons).toBeDefined();
      expect(missingPersonController.getMissingPersonStats).toBeDefined();
      expect(missingPersonController.getMissingPersonById).toBeDefined();
      expect(missingPersonController.reportMissingPerson).toBeDefined();
      expect(missingPersonController.markPersonSafe).toBeDefined();
      expect(missingPersonController.updateMissingPerson).toBeDefined();
      expect(missingPersonController.deleteMissingPerson).toBeDefined();
    });

    it('should export Missing Person routes', () => {
      expect(missingPersonRoutes).toBeDefined();
    });
  });

  describe('Offline PWA SOS & SMS Fallback Specifications (Member-3)', () => {
    it('should include isOfflineSync, offlineLoggedAt, and submissionSource in SOSRequest schema', () => {
      const paths = SOSRequest.schema.paths;
      expect(paths['isOfflineSync']).toBeDefined();
      expect(paths['offlineLoggedAt']).toBeDefined();
      expect(paths['submissionSource']).toBeDefined();

      const sourceEnum = SOSRequest.schema.path('submissionSource').enumValues;
      expect(sourceEnum).toEqual(['WEB', 'PWA_OFFLINE', 'SMS_FALLBACK']);
    });

    it('should export syncOfflineSOS and handleSMSFallback controllers', () => {
      expect(sosController.syncOfflineSOS).toBeDefined();
      expect(sosController.handleSMSFallback).toBeDefined();
    });

    it('should validate SOSRequest created from offline sync source', () => {
      const sos = new SOSRequest({
        victim: '507f191e810c19729de860ea',
        location: { latitude: 23.0159, longitude: 91.3976, address: 'Parshuram', district: 'Feni' },
        needs: ['rescue', 'water'],
        numberOfPeople: 4,
        isOfflineSync: true,
        offlineLoggedAt: new Date(),
        submissionSource: 'PWA_OFFLINE',
      });

      const err = sos.validateSync();
      expect(err).toBeUndefined();
      expect(sos.isOfflineSync).toBe(true);
      expect(sos.submissionSource).toBe('PWA_OFFLINE');
    });

    it('should validate SOSRequest created from SMS fallback gateway', () => {
      const sos = new SOSRequest({
        location: { latitude: 24.8949, longitude: 91.8687, district: 'Sylhet' },
        needs: ['medicine'],
        numberOfPeople: 2,
        isOfflineSync: true,
        submissionSource: 'SMS_FALLBACK',
        description: '[SMS Fallback] Emergency from 01711000000',
      });

      const err = sos.validateSync();
      expect(err).toBeUndefined();
      expect(sos.submissionSource).toBe('SMS_FALLBACK');
    });
  });
});
