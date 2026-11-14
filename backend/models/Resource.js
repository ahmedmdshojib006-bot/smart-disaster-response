// backend/models/Resource.js
// ─────────────────────────────────────────────────────────────────────────────
// Mongoose schema for Relief Resource Inventory (Member-3: Module 2).
// Tracks stock levels of Food, Water, Medicine, Blankets, and other essential
// supplies across relief warehouses and districts in Bangladesh.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Resource item name is required'],
      trim: true,
      maxlength: [120, 'Resource name cannot exceed 120 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['Food', 'Water', 'Medicine', 'Blankets', 'Emergency Kits', 'Sanitation', 'Other'],
        message: '{VALUE} is not a supported resource category',
      },
      index: true,
    },
    unit: {
      type: String,
      required: [true, 'Unit of measurement is required (e.g. bags, cartons, litres, pieces)'],
      trim: true,
      maxlength: 30,
    },
    quantityAvailable: {
      type: Number,
      required: [true, 'Available quantity is required'],
      min: [0, 'Available quantity cannot be negative'],
      default: 0,
    },
    totalReceived: {
      type: Number,
      required: [true, 'Total received quantity is required'],
      min: [0, 'Total received cannot be negative'],
      default: 0,
    },
    totalDistributed: {
      type: Number,
      min: [0, 'Total distributed cannot be negative'],
      default: 0,
    },
    thresholdLowStock: {
      type: Number,
      min: [0, 'Low-stock threshold cannot be negative'],
      default: 20,
    },
    status: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock'],
      default: 'In Stock',
      index: true,
    },
    warehouse: {
      name: {
        type: String,
        trim: true,
        default: 'Central Relief Hub',
      },
      district: {
        type: String,
        required: [true, 'Warehouse district is required'],
        trim: true,
        index: true,
      },
      address: {
        type: String,
        trim: true,
        default: '',
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
    donor: {
      name: {
        type: String,
        trim: true,
        default: 'General Relief Fund',
      },
      contact: {
        type: String,
        trim: true,
        default: '',
      },
    },
    expirationDate: {
      type: Date,
      default: null,
    },
    batchNumber: {
      type: String,
      trim: true,
      default: '',
    },
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    managedByRole: {
      type: String,
      enum: ['Admin', 'NGO'],
      default: 'Admin',
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

// ── Compound Indexes for Fast Searching & Filtering ──────────────────────────
resourceSchema.index({ category: 1, status: 1 });
resourceSchema.index({ 'warehouse.district': 1, category: 1 });
resourceSchema.index({ name: 'text', 'warehouse.name': 'text', 'warehouse.district': 'text' });

// ── Pre-save Hook: Compute Dynamic Stock Status ──────────────────────────────
resourceSchema.pre('save', function (next) {
  if (this.quantityAvailable <= 0) {
    this.status = 'Out of Stock';
  } else if (this.quantityAvailable <= this.thresholdLowStock) {
    this.status = 'Low Stock';
  } else {
    this.status = 'In Stock';
  }
  next();
});

// ── Instance Method: Helper to check if item can fulfill quantity ────────────
resourceSchema.methods.canFulfill = function (qty) {
  return typeof qty === 'number' && qty > 0 && this.quantityAvailable >= qty;
};

module.exports = mongoose.model('Resource', resourceSchema);
