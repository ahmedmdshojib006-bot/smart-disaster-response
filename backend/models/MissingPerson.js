// backend/models/MissingPerson.js
// ─────────────────────────────────────────────────────────────────────────────
// Mongoose schema for Missing Persons & Community Reunification Board
// (Member-3: Module 3 — Community Engagement & Safety Network).
// Allows citizens, volunteers, and rescue workers to post missing person reports
// with photos and physical features, and mark individuals as "Safe" once found.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const missingPersonSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Missing person name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [0, 'Age cannot be negative'],
      max: [120, 'Please enter a valid age'],
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: {
        values: ['Male', 'Female', 'Child', 'Other'],
        message: '{VALUE} is not a valid gender option',
      },
      index: true,
    },
    photoUrl: {
      type: String,
      default: null,
      trim: true,
    },
    lastSeenLocation: {
      district: {
        type: String,
        required: [true, 'Last seen district is required'],
        trim: true,
        index: true,
      },
      upazila: {
        type: String,
        trim: true,
        default: '',
      },
      landmark: {
        type: String,
        required: [true, 'Specific landmark or area is required (e.g., Near Parshuram bridge)'],
        trim: true,
      },
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
    },
    lastSeenDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    physicalDescription: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Physical description cannot exceed 500 characters'],
    },
    medicalNeeds: {
      type: String,
      trim: true,
      default: '',
      maxlength: [300, 'Medical needs cannot exceed 300 characters'],
    },
    status: {
      type: String,
      enum: ['Missing', 'Found / Safe', 'Deceased'],
      default: 'Missing',
      index: true,
    },
    contactPerson: {
      name: {
        type: String,
        required: [true, 'Contact person name is required'],
        trim: true,
      },
      relationship: {
        type: String,
        required: [true, 'Relationship to missing person is required (e.g. Father, Sister)'],
        trim: true,
      },
      phone: {
        type: String,
        required: [true, 'Contact phone number is required'],
        trim: true,
      },
      altPhone: {
        type: String,
        trim: true,
        default: '',
      },
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reportedByName: {
      type: String,
      default: 'Concerned Citizen',
      trim: true,
    },
    safetyUpdate: {
      markedSafeAt: {
        type: Date,
        default: null,
      },
      markedSafeBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      markedSafeByName: {
        type: String,
        default: '',
      },
      foundLocation: {
        type: String,
        default: '',
        trim: true,
      },
      rescueShelter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shelter',
        default: null,
      },
      rescueShelterName: {
        type: String,
        default: '',
      },
      notes: {
        type: String,
        default: '',
        trim: true,
      },
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Compound Indexes for Fast Searching & Filtering ──────────────────────────
missingPersonSchema.index({ status: 1, 'lastSeenLocation.district': 1 });
missingPersonSchema.index({ fullName: 'text', physicalDescription: 'text', 'lastSeenLocation.landmark': 'text' });

module.exports = mongoose.model('MissingPerson', missingPersonSchema);
