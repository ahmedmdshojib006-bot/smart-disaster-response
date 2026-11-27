const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema(
  {
    receiptNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Donor user reference is required'],
      index: true,
    },
    donorName: {
      type: String,
      required: true,
      trim: true,
    },
    donorEmail: {
      type: String,
      required: true,
      trim: true,
    },
    donationType: {
      type: String,
      required: true,
      enum: ['Monetary', 'Supplies'],
      default: 'Monetary',
    },
    amountBDT: {
      type: Number,
      default: 0,
      min: [0, 'Donation amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: ['bKash', 'Nagad', 'Bank Transfer', 'Card', 'Direct Supply'],
      default: 'bKash',
    },
    transactionRef: {
      type: String,
      trim: true,
      default: '',
    },
    supplyDetails: {
      category: {
        type: String,
        enum: ['Food', 'Water', 'Medicine', 'Blankets', 'Emergency Kits', 'Sanitation', 'Other'],
        default: 'Food',
      },
      itemName: {
        type: String,
        trim: true,
        default: '',
      },
      quantity: {
        type: Number,
        min: [0, 'Quantity cannot be negative'],
        default: 0,
      },
      unit: {
        type: String,
        trim: true,
        default: '',
      },
    },
    targetDistrict: {
      type: String,
      required: [true, 'Target district or relief fund is required'],
      trim: true,
      default: 'General Relief Fund',
    },
    targetShelter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shelter',
      default: null,
    },
    targetShelterName: {
      type: String,
      trim: true,
      default: '',
    },
    targetResource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      default: null,
    },
    status: {
      type: String,
      enum: ['Confirmed', 'Allocated', 'Delivered'],
      default: 'Confirmed',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    donatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

donationSchema.index({ donor: 1, donatedAt: -1 });

module.exports = mongoose.model('Donation', donationSchema);
