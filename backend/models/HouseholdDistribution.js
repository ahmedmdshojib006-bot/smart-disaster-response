const mongoose = require('mongoose');

const householdDistributionSchema = new mongoose.Schema(
  {
    household: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Household',
      required: [true, 'Household reference is required'],
      index: true,
    },
    householdIdCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    headName: {
      type: String,
      required: true,
      trim: true,
    },
    distributionRound: {
      type: String,
      required: [true, 'Relief round name is required'],
      trim: true,
      index: true,
    },
    itemsProvided: {
      type: [
        {
          itemName: { type: String, required: true, trim: true },
          quantity: { type: Number, required: true, min: 1 },
          unit: { type: String, trim: true, default: 'units' },
        },
      ],
      default: [],
    },
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      default: null,
    },
    resourceQuantityDeducted: {
      type: Number,
      default: 0,
      min: 0,
    },
    distributedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    distributedByName: {
      type: String,
      required: true,
      trim: true,
    },
    distributedByRole: {
      type: String,
      enum: ['Admin', 'NGO', 'Volunteer'],
      required: true,
    },
    distributionCenter: {
      type: String,
      trim: true,
      default: '',
    },
    district: {
      type: String,
      trim: true,
      default: '',
    },
    scanMethod: {
      type: String,
      enum: ['QR Camera', 'QR Image', 'Manual ID'],
      default: 'QR Camera',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    distributedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

householdDistributionSchema.index({ household: 1, distributionRound: 1 }, { unique: true });

module.exports = mongoose.model('HouseholdDistribution', householdDistributionSchema);
