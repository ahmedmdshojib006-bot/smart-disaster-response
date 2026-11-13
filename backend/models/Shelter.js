const mongoose = require('mongoose');

const shelterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
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
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
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
  capacity: {
    total: {
      type: Number,
      required: true,
      min: 1,
    },
    occupied: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  facilities: {
    toilet: {
      type: Boolean,
      default: false,
    },
    medicalCare: {
      type: Boolean,
      default: false,
    },
    womenOnlySection: {
      type: Boolean,
      default: false,
    },
    drinkingWater: {
      type: Boolean,
      default: true,
    },
    electricityBackup: {
      type: Boolean,
      default: false,
    },
  },
  status: {
    type: String,
    enum: ['Open', 'Full', 'Closed'],
    default: 'Open',
  },
  contactPerson: {
    type: String,
    trim: true,
    default: '',
  },
  contactPhone: {
    type: String,
    trim: true,
    default: '',
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

shelterSchema.index({ 'location.coordinates': '2dsphere' });
shelterSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

shelterSchema.pre('save', function (next) {
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

shelterSchema.methods.getAvailableSpots = function () {
  return Math.max(0, this.capacity.total - this.capacity.occupied);
};

module.exports = mongoose.model('Shelter', shelterSchema);
