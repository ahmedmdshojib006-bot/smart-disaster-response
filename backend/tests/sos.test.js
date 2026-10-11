// tests/sos.test.js
const request = require('supertest');
const SOSRequest = require('../models/SOSRequest');
const sosRoutes = require('../routes/sosRoutes');

describe('SOS Request Module (Member-2) Specification', () => {
  it('should define SOSRequest model and its schema fields', () => {
    expect(SOSRequest).toBeDefined();
    const schemaPaths = SOSRequest.schema.paths;

    expect(schemaPaths['victim']).toBeDefined();
    expect(schemaPaths['location.latitude']).toBeDefined();
    expect(schemaPaths['location.longitude']).toBeDefined();
    expect(schemaPaths['location.address']).toBeDefined();
    expect(schemaPaths['needs']).toBeDefined();
    expect(schemaPaths['numberOfPeople']).toBeDefined();
    expect(schemaPaths['photoUrl']).toBeDefined();
    expect(schemaPaths['status']).toBeDefined();
    expect(schemaPaths['priority']).toBeDefined();
  });

  it('should export SOS routes successfully', () => {
    expect(sosRoutes).toBeDefined();
  });

  it('should validate allowed emergency needs: food, water, medicine, rescue', () => {
    const validNeeds = ['food', 'water', 'medicine', 'rescue'];
    validNeeds.forEach((need) => {
      const sos = new SOSRequest({
        victim: '507f191e810c19729de860ea',
        location: { latitude: 23.8103, longitude: 90.4125 },
        needs: [need],
        numberOfPeople: 2,
      });
      const err = sos.validateSync();
      expect(err).toBeUndefined();
    });
  });

  it('should reject invalid need types', () => {
    const sos = new SOSRequest({
      victim: '507f191e810c19729de860ea',
      location: { latitude: 23.8103, longitude: 90.4125 },
      needs: ['luxury_cars'],
      numberOfPeople: 1,
    });
    const err = sos.validateSync();
    expect(err).toBeDefined();
    expect(err.errors['needs.0']).toBeDefined();
  });

  it('should require latitude and longitude', () => {
    const sos = new SOSRequest({
      victim: '507f191e810c19729de860ea',
      location: {},
      needs: ['food'],
      numberOfPeople: 1,
    });
    const err = sos.validateSync();
    expect(err).toBeDefined();
    expect(err.errors['location.latitude']).toBeDefined();
    expect(err.errors['location.longitude']).toBeDefined();
  });

  it('should reject non-positive numberOfPeople', () => {
    const sos = new SOSRequest({
      victim: '507f191e810c19729de860ea',
      location: { latitude: 23.8103, longitude: 90.4125 },
      needs: ['water'],
      numberOfPeople: 0,
    });
    const err = sos.validateSync();
    expect(err).toBeDefined();
    expect(err.errors['numberOfPeople']).toBeDefined();
  });
});
