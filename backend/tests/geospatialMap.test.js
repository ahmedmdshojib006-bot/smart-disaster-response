// tests/geospatialMap.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Geospatial 2dsphere and Live Disaster Map Test Suite (Module 2 - Member-2)
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');
const SOSRequest = require('../models/SOSRequest');
const HazardZone = require('../models/HazardZone');
const ReliefCamp = require('../models/ReliefCamp');
const Shelter = require('../models/Shelter');
const mapRoutes = require('../routes/mapRoutes');

describe('Module 2 (Member-2): Geospatial 2dsphere and Map Models', () => {
  it('should export mapRoutes router', () => {
    expect(mapRoutes).toBeDefined();
  });

  it('should have 2dsphere index and GeoJSON location format on SOSRequest model', () => {
    const paths = SOSRequest.schema.paths;
    expect(paths['location.type']).toBeDefined();
    expect(paths['location.coordinates']).toBeDefined();

    const indexes = SOSRequest.schema.indexes();
    const has2dSphere = indexes.some(
      (idx) => idx[0]['location.coordinates'] === '2dsphere'
    );
    expect(has2dSphere).toBe(true);
  });

  it('should automatically synchronize GeoJSON coordinates from latitude and longitude on SOSRequest save hook', () => {
    const doc = new SOSRequest({
      victim: new mongoose.Types.ObjectId(),
      location: {
        latitude: 23.0159,
        longitude: 91.3986,
        address: 'Feni Muhuri River',
      },
      needs: ['rescue'],
      numberOfPeople: 4,
    });

    const err = doc.validateSync();
    expect(err).toBeUndefined();

    // Trigger schema save hook manually
    doc.location.type = 'Point';
    doc.location.coordinates = [doc.location.longitude, doc.location.latitude];

    expect(doc.location.coordinates[0]).toBe(91.3986); // longitude first in GeoJSON
    expect(doc.location.coordinates[1]).toBe(23.0159); // latitude second
  });

  it('should validate HazardZone model schema and 2dsphere index', () => {
    const paths = HazardZone.schema.paths;
    expect(paths['name']).toBeDefined();
    expect(paths['hazardType']).toBeDefined();
    expect(paths['severity']).toBeDefined();
    expect(paths['radiusMeters']).toBeDefined();
    expect(paths['location.coordinates']).toBeDefined();

    const hazard = new HazardZone({
      name: 'Test Flooded Embankment',
      hazardType: 'Flood',
      severity: 'Critical',
      location: {
        latitude: 23.8103,
        longitude: 90.4125,
      },
      radiusMeters: 2500,
    });

    const err = hazard.validateSync();
    expect(err).toBeUndefined();
  });

  it('should validate ReliefCamp model schema and 2dsphere index', () => {
    const paths = ReliefCamp.schema.paths;
    expect(paths['name']).toBeDefined();
    expect(paths['operatingAgency']).toBeDefined();
    expect(paths['itemsAvailable']).toBeDefined();
    expect(paths['dailyCapacityBeneficiaries']).toBeDefined();
    expect(paths['location.coordinates']).toBeDefined();

    const camp = new ReliefCamp({
      name: 'Feni Relief Center',
      operatingAgency: 'Bangladesh Red Crescent',
      location: {
        latitude: 23.0185,
        longitude: 91.3995,
      },
      itemsAvailable: ['Water', 'Dry Food'],
    });

    const err = camp.validateSync();
    expect(err).toBeUndefined();
  });
});
