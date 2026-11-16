const mongoose = require('mongoose');

const VALID_STATUSES = ['Active', 'Depleted', 'Closed'];

const reliefCampSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Relief camp name is required'],
      trim: true,
      maxlength: 160,
    },
    operatingAgency: {
      type: String,
      required: [true, 'Operating agency/organization is required'],
      trim: true,
      default: 'Bangladesh Red Crescent Society',
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
      district: {
        type: String,
        trim: true,
        default: '',
      },
    },
    itemsAvailable: [
      {
        type: String,
        trim: true,
      },
    ],
    dailyCapacityBeneficiaries: {
      type: Number,
      default: 500,
      min: 1,
    },
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: 'Active',
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
      maxlength: 1000,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

reliefCampSchema.index({ 'location.coordinates': '2dsphere' });
reliefCampSchema.index({ status: 1 });

reliefCampSchema.pre('save', function (next) {
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

module.exports = mongoose.model('ReliefCamp', reliefCampSchema);
