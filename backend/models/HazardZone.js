// models/HazardZone.js
// ─────────────────────────────────────────────────────────────────────────────
// Mongoose schema and model for Hazard Zones & Disaster Danger Areas.
// Module 2 (Member-2): Live Disaster Map with 2dsphere Geospatial Indexing
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const VALID_HAZARDS = [
  'Flood',
  'Flash Flood',
  'Cyclone',
  'Landslide',
  'Broken Bridge',
  'Submerged Road',
  'River Erosion',
  'Waterlogging',
  'Embankment Collapse',
];

const VALID_SEVERITIES = ['Critical', 'High', 'Moderate', 'Low'];
const VALID_STATUSES = ['Active', 'Warning', 'Monitored', 'Resolved'];

const hazardZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hazard zone title is required'],
      trim: true,
      maxlength: 160,
    },
    hazardType: {
      type: String,
      enum: VALID_HAZARDS,
      default: 'Flood',
    },
    severity: {
      type: String,
      enum: VALID_SEVERITIES,
      default: 'High',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
      latitude: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
      },
      longitude: {
        type: Number,
        required: [true, 'Longitude is required'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
      },
      address: {
        type: String,
        trim: true,
        default: '',
      },
      district: {
        type: String,
        trim: true,
        default: '',
      },
    },
    // Approximate danger/evacuation radius around the epicenter in meters
    radiusMeters: {
      type: Number,
      default: 1500,
      min: [50, 'Radius must be at least 50 meters'],
      max: [50000, 'Radius cannot exceed 50 km'],
    },
    waterLevelFeet: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: 'Active',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes for geospatial proximity queries and status filtering ───────────
hazardZoneSchema.index({ 'location.coordinates': '2dsphere' });
hazardZoneSchema.index({ status: 1, severity: 1 });

// ── Synchronize GeoJSON coordinates before saving ────────────────────────────
hazardZoneSchema.pre('save', function (next) {
  if (
    this.location &&
    typeof this.location.latitude === 'number' &&
    typeof this.location.longitude === 'number'
  ) {
    this.location.type = 'Point';
    this.location.coordinates = [this.location.longitude, this.location.latitude];
  }
  next();
});

module.exports = mongoose.model('HazardZone', hazardZoneSchema);
