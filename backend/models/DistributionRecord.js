// backend/models/DistributionRecord.js
// ─────────────────────────────────────────────────────────────────────────────
// Mongoose schema for Relief Resource Distribution Tracking (Member-3: Module 2).
// Tracks where, when, to whom, and how much relief resources (food, water, medicine,
// blankets) have been distributed across affected districts and shelters.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const distributionRecordSchema = new mongoose.Schema(
  {
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: [true, 'Resource reference is required'],
      index: true,
    },
    resourceName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity distributed is required'],
      min: [1, 'Distributed quantity must be at least 1'],
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    recipientType: {
      type: String,
      required: [true, 'Recipient type is required'],
      enum: ['Shelter', 'Relief Camp', 'Affected Community', 'Household', 'Individual'],
      default: 'Affected Community',
      index: true,
    },
    shelter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shelter',
      default: null,
      index: true,
    },
    shelterName: {
      type: String,
      trim: true,
      default: '',
    },
    destination: {
      name: {
        type: String,
        required: [true, 'Destination name/location is required'],
        trim: true,
      },
      district: {
        type: String,
        required: [true, 'Destination district is required'],
        trim: true,
        index: true,
      },
      upazila: {
        type: String,
        trim: true,
        default: '',
      },
      address: {
        type: String,
        trim: true,
        default: '',
      },
    },
    beneficiaryCount: {
      type: Number,
      min: [0, 'Beneficiary count cannot be negative'],
      default: 0,
    },
    distributionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    distributedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Distributor user reference is required'],
    },
    distributedByName: {
      type: String,
      required: true,
      trim: true,
    },
    distributedByRole: {
      type: String,
      enum: ['Admin', 'NGO'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Dispatched', 'In Transit', 'Delivered', 'Cancelled'],
      default: 'Delivered',
      index: true,
    },
    transportMethod: {
      type: String,
      trim: true,
      default: 'Road Vehicle',
    },
    verifiedBy: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

distributionRecordSchema.index({ 'destination.district': 1, distributionDate: -1 });
distributionRecordSchema.index({ category: 1, distributionDate: -1 });

module.exports = mongoose.model('DistributionRecord', distributionRecordSchema);
