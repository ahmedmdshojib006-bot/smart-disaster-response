const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      required: [true, 'Task description is required'],
      trim: true,
    },

    taskType: {
      type: String,
      enum: ['Rescue', 'Food Distribution', 'Medical Aid', 'Shelter Management', 'Logistics', 'General'],
      default: 'General',
    },

    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },

    serviceArea: {
      type: String,
      required: [true, 'Service area is required'],
      trim: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A volunteer must be assigned to this task'],
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    status: {
      type: String,
      enum: ['Assigned', 'Accepted', 'In Progress', 'Completed'],
      default: 'Assigned',
    },

    statusHistory: [
      {
        status: {
          type: String,
          enum: ['Assigned', 'Accepted', 'In Progress', 'Completed'],
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        notes: {
          type: String,
          trim: true,
          default: '',
        },
      },
    ],

    notes: {
      type: String,
      trim: true,
      default: '',
    },

    dueDate: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ serviceArea: 1 });
taskSchema.index({ createdAt: -1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
