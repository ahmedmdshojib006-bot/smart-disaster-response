// models/SOSRequest.js
// ─────────────────────────────────────────────────────────────────────────────
// Mongoose schema and model for Emergency SOS / Help Requests.
// Member-2 Responsibility:
//   Victims can submit an SOS/help request with their GPS location,
//   type of need (food, water, medicine, rescue), number of people,
//   and an optional photo.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const VALID_NEEDS = ['food', 'water', 'medicine', 'rescue'];
const VALID_STATUSES = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'];
const VALID_PRIORITIES = ['Normal', 'High', 'Critical'];

const sosRequestSchema = new mongoose.Schema(
  {
    // The authenticated user (Citizen/Victim) who raised the SOS
    victim: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Victim ID is required'],
    },

    // Victim's GPS coordinates and optional address/landmark
    location: {
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
    },

    // Priority level calculated or assigned
    priority: {
      type: String,
      enum: VALID_PRIORITIES,
      default: 'High',
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
    timestamps: true, // creates createdAt and updatedAt automatically
  }
);

// Indexes for fast geospatial / status queries
sosRequestSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
sosRequestSchema.index({ status: 1, createdAt: -1 });
sosRequestSchema.index({ victim: 1, createdAt: -1 });

const SOSRequest = mongoose.model('SOSRequest', sosRequestSchema);

module.exports = SOSRequest;
