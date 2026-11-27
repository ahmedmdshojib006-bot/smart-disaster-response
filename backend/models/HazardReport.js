const mongoose = require('mongoose');

const VALID_HAZARD_TYPES = [
  'Flooded Road',
  'Broken Bridge',
  'Landslide',
  'Submerged Area',
  'Embankment Breach',
  'Power Line Down',
  'Blocked Evacuation Route',
  'Waterlogging',
  'Other',
];

const VALID_SEVERITIES = ['Critical', 'High', 'Moderate', 'Low'];
const VALID_REPORT_STATUSES = [
  'Pending',
  'Community Verified',
  'Verified',
  'Resolved',
  'Rejected',
];

const verificationEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      trim: true,
      default: 'Community Member',
    },
    userRole: {
      type: String,
      trim: true,
      default: 'Citizen',
    },
    note: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const fakeFlagEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      trim: true,
      default: 'Community Member',
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 400,
      default: 'Inaccurate or misleading report',
    },
    flaggedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const hazardReportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Hazard title is required'],
      trim: true,
      maxlength: [160, 'Title cannot exceed 160 characters'],
    },
    hazardType: {
      type: String,
      enum: VALID_HAZARD_TYPES,
      required: [true, 'Hazard type is required'],
      default: 'Flooded Road',
    },
    severity: {
      type: String,
      enum: VALID_SEVERITIES,
      default: 'High',
    },
    description: {
      type: String,
      required: [true, 'Description of the hazard is required'],
      trim: true,
      maxlength: [1500, 'Description cannot exceed 1500 characters'],
    },
    photoUrl: {
      type: String,
      default: null,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
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
      upazila: {
        type: String,
        trim: true,
        default: '',
      },
      district: {
        type: String,
        required: [true, 'District is required'],
        trim: true,
      },
    },
    waterDepthFeet: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    roadPassable: {
      type: Boolean,
      default: false,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reporterName: {
      type: String,
      trim: true,
      default: 'Anonymous Citizen',
    },
    reporterTrustSnapshot: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    verifications: {
      type: [verificationEntrySchema],
      default: [],
    },
    fakeFlags: {
      type: [fakeFlagEntrySchema],
      default: [],
    },
    status: {
      type: String,
      enum: VALID_REPORT_STATUSES,
      default: 'Pending',
    },
    credibilityScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    communityVerifyAwarded: {
      type: Boolean,
      default: false,
    },
    officialVerifyAwarded: {
      type: Boolean,
      default: false,
    },
    fakePenaltyApplied: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

hazardReportSchema.index({ 'location.coordinates': '2dsphere' });
hazardReportSchema.index({ status: 1, severity: 1, createdAt: -1 });
hazardReportSchema.index({ 'location.district': 1, status: 1 });
hazardReportSchema.index({ reporter: 1, createdAt: -1 });

hazardReportSchema.pre('save', function (next) {
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

const HazardReport = mongoose.model('HazardReport', hazardReportSchema);

module.exports = HazardReport;
module.exports.VALID_HAZARD_TYPES = VALID_HAZARD_TYPES;
module.exports.VALID_SEVERITIES = VALID_SEVERITIES;
module.exports.VALID_REPORT_STATUSES = VALID_REPORT_STATUSES;
