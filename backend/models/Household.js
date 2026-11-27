const mongoose = require('mongoose');

const householdSchema = new mongoose.Schema(
  {
    householdId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    headName: {
      type: String,
      required: [true, 'Household head name is required'],
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
      index: true,
    },
    nationalId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    memberCount: {
      type: Number,
      required: [true, 'Number of household members is required'],
      min: [1, 'Household must have at least 1 member'],
      max: [50, 'Member count cannot exceed 50'],
    },
    vulnerabilities: {
      children: { type: Number, default: 0, min: 0 },
      elderly: { type: Number, default: 0, min: 0 },
      pregnantWomen: { type: Number, default: 0, min: 0 },
      disabled: { type: Number, default: 0, min: 0 },
    },
    address: {
      villageOrWard: { type: String, trim: true, default: '' },
      unionOrMunicipality: { type: String, trim: true, default: '' },
      upazila: { type: String, trim: true, default: '' },
      district: {
        type: String,
        required: [true, 'District is required'],
        trim: true,
        index: true,
      },
    },
    qrPayload: {
      type: String,
      required: true,
      unique: true,
    },
    verificationHash: {
      type: String,
      required: true,
    },
    qrCodeDataUrl: {
      type: String,
      default: '',
    },
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    registeredByName: {
      type: String,
      trim: true,
      default: '',
    },
    citizenUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['Active', 'Relocated', 'Inactive'],
      default: 'Active',
      index: true,
    },
    totalDistributionsReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastDistributedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

householdSchema.index({ 'address.district': 1, status: 1 });

module.exports = mongoose.model('Household', householdSchema);
