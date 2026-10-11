// models/Task.js
// ─────────────────────────────────────────────────────────────────────────────
// Mongoose schema and model for tasks assigned to volunteers by Admins.
//
// Lifecycle States (Member-3 specification):
//   Assigned ──► Accepted ──► In Progress ──► Completed
//
// Each transition is logged in `statusHistory` to maintain a full audit trail.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    // Short, descriptive title of the task (e.g., "Rescue stranded family in ward 4")
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    // Detailed instructions, contact info, or on-the-ground context
    description: {
      type: String,
      required: [true, 'Task description is required'],
      trim: true,
    },

    // Category of the task — helps match with volunteer skills
    taskType: {
      type: String,
      enum: ['Rescue', 'Food Distribution', 'Medical Aid', 'Shelter Management', 'Logistics', 'General'],
      default: 'General',
    },

    // Urgency level
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },

    // Geographical area or district where the task must be performed
    serviceArea: {
      type: String,
      required: [true, 'Service area is required'],
      trim: true,
    },

    // The volunteer assigned to this task
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A volunteer must be assigned to this task'],
    },

    // The admin who created/assigned this task
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Current state of the task in the workflow
    status: {
      type: String,
      enum: ['Assigned', 'Accepted', 'In Progress', 'Completed'],
      default: 'Assigned',
    },

    // Audit trail of status transitions
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

    // Optional field notes from the volunteer upon completion or progress update
    notes: {
      type: String,
      trim: true,
      default: '',
    },

    // Optional target completion deadline
    dueDate: {
      type: Date,
      default: null,
    },

    // Recorded when the task transitions to 'Completed'
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes for query performance ─────────────────────────────────────────────
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ serviceArea: 1 });
taskSchema.index({ createdAt: -1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
