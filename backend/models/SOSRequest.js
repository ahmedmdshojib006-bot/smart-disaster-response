// models/SOSRequest.js
// ─────────────────────────────────────────────────────────────────────────────
// Mongoose schema and model for Emergency SOS / Help Requests.
//
// Module 1 (Member-2):
//   Victims can submit an SOS/help request with GPS location,
//   type of need (food, water, medicine, rescue), number of people,
//   and an optional photo.
//
// Module 2 (Member-2):
//   - Automated Priority Scoring based on vulnerability factors:
//     children, elderly people, pregnant women, and injuries.
//   - MongoDB 2dsphere geospatial coordinates for real-time map tracking
//     and proximity searches ($near / $geoNear).
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const VALID_NEEDS = ['food', 'water', 'medicine', 'rescue'];
const VALID_STATUSES = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'];
const VALID_PRIORITIES = ['Low', 'Medium', 'Normal', 'High', 'Critical'];

const sosRequestSchema = new mongoose.Schema(
  {
    // The authenticated user (Citizen/Victim) who raised the SOS
    victim: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Victim ID is required'],
    },

    // Victim's GPS coordinates & GeoJSON Point for 2dsphere spatial indexing
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      // [longitude, latitude] as required by GeoJSON standards
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
      latitude: {
        type: Number,
        required: [true, 'GPS latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
      },
      longitude: {
        type: Number,
        required: [true, 'GPS longitude is required'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
      },
      address: {
        type: String,
        trim: true,
        maxlength: [300, 'Address cannot exceed 300 characters'],
        default: '',
      },
      district: {
        type: String,
        trim: true,
        default: '',
      },
    },

    // Type of emergency assistance required: food, water, medicine, rescue
    needs: {
      type: [
        {
          type: String,
          enum: {
            values: VALID_NEEDS,
            message: '{VALUE} is not a valid need type. Allowed: food, water, medicine, rescue',
          },
          lowercase: true,
          trim: true,
        },
      ],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'At least one type of need (food, water, medicine, rescue) must be selected.',
      },
      required: [true, 'Type of need is required'],
    },

    // Number of people requiring help/relief
    numberOfPeople: {
      type: Number,
      required: [true, 'Number of people is required'],
      min: [1, 'Number of people must be at least 1'],
      default: 1,
    },

    // Vulnerability demographic counts for Module 2 automated priority scoring
    vulnerabilities: {
      children: {
        type: Number,
        default: 0,
        min: [0, 'Children count cannot be negative'],
      },
      elderly: {
        type: Number,
        default: 0,
        min: [0, 'Elderly count cannot be negative'],
      },
      pregnantWomen: {
        type: Number,
        default: 0,
        min: [0, 'Pregnant women count cannot be negative'],
      },
      injured: {
        type: Number,
        default: 0,
        min: [0, 'Injured count cannot be negative'],
      },
    },

    // Objective Urgency Score (0 - 100) calculated by priorityCalculator
    priorityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },

    // Priority Factor Breakdown details for auditing and triage explanation
    priorityFactors: [
      {
        factor: { type: String },
        count: { type: Number },
        points: { type: Number },
        description: { type: String },
      },
    ],

    // Optional photo URL or path (e.g. /uploads/sos-xxx.jpg)
    photoUrl: {
      type: String,
      default: null,
      trim: true,
    },

    // Additional emergency details, health concerns, trapped situation, etc.
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },

    // Current lifecycle status of the emergency request
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: 'Pending',
      index: true,
    },

    // Priority level calculated or assigned
    priority: {
      type: String,
      enum: VALID_PRIORITIES,
      default: 'High',
      index: true,
    },

    // Assigned Volunteer (integrated with Member-3's volunteer assignment)
    assignedVolunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // History log of status transitions
    statusHistory: [
      {
        status: { type: String, enum: VALID_STATUSES },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// ── Indexes for high-speed queries ───────────────────────────────────────────
// 1. 2dsphere index on GeoJSON coordinates for spatial queries ($near, $geoNear)
sosRequestSchema.index({ 'location.coordinates': '2dsphere' });
sosRequestSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

// 2. Priority and timestamp index to ensure most critical SOS are at top of list
sosRequestSchema.index({ priorityScore: -1, createdAt: -1 });
sosRequestSchema.index({ status: 1, priorityScore: -1 });
sosRequestSchema.index({ victim: 1, createdAt: -1 });

// ── Pre-save Hook: Ensure GeoJSON synchronization ────────────────────────────
sosRequestSchema.pre('save', function (next) {
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

const SOSRequest = mongoose.model('SOSRequest', sosRequestSchema);

module.exports = SOSRequest;
