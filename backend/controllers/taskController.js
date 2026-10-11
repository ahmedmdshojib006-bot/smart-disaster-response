// controllers/taskController.js
// ─────────────────────────────────────────────────────────────────────────────
// Task Controller (Member-3: Volunteer Task Management):
//   - createTask: Admins assign a new disaster response task to a volunteer.
//   - getAllTasks: Admins & NGOs inspect all tasks with filtering.
//   - getMyTasks: Volunteers view tasks assigned specifically to them.
//   - getTaskById: Retrieve detailed task info and history.
//   - updateTaskStatus: Volunteer or Admin moves task across lifecycle:
//       Assigned ──► Accepted ──► In Progress ──► Completed
//   - assignTask: Admins reassign an existing task to another volunteer.
//   - deleteTask: Admins remove/cancel a task.
// ─────────────────────────────────────────────────────────────────────────────

const Task = require('../models/Task');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');

// State machine allowed transitions
const VALID_TRANSITIONS = {
  Assigned: ['Accepted'],
  Accepted: ['In Progress'],
  'In Progress': ['Completed'],
  Completed: [], // terminal state for normal flow
};

/**
 * Helper: Safely push real-time notification without breaking main request flow
 */
const safeNotify = async (req, { type = 'general', title, message, recipientUserId, targetRole }) => {
  try {
    const io = req.app ? req.app.get('io') : null;
    if (io) {
      await sendNotification({
        io,
        type,
        title,
        message,
        recipientUserId,
        targetRole,
      });
    }
  } catch (err) {
    console.warn('Real-time notification could not be delivered:', err.message);
  }
};

/**
 * createTask
 * POST /api/tasks
 * Requires role: Admin
 */
const createTask = async (req, res) => {
  try {
    const { title, description, taskType, priority, serviceArea, assignedTo, dueDate, notes } = req.body;

    if (!title || !description || !serviceArea || !assignedTo) {
      return res.status(422).json({
        success: false,
        message: 'Title, description, service area, and assigned volunteer are required.',
      });
    }

    // Verify assigned volunteer exists and has role Volunteer
    const volunteer = await User.findById(assignedTo);
    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Assigned volunteer not found.',
      });
    }

    if (volunteer.role !== 'Volunteer') {
      return res.status(422).json({
        success: false,
        message: `User ${volunteer.name} has role "${volunteer.role}". Tasks can only be assigned to Volunteers.`,
      });
    }

    const newTask = new Task({
      title: title.trim(),
      description: description.trim(),
      taskType: taskType || 'General',
      priority: priority || 'Medium',
      serviceArea: serviceArea.trim(),
      assignedTo: volunteer._id,
      assignedBy: req.user._id,
      status: 'Assigned',
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes ? notes.trim() : '',
      statusHistory: [
        {
          status: 'Assigned',
          changedBy: req.user._id,
          changedAt: new Date(),
          notes: 'Task created and assigned by Admin',
        },
      ],
    });

    await newTask.save();
    await newTask.populate([
      { path: 'assignedTo', select: 'name email skills availability serviceArea phone' },
      { path: 'assignedBy', select: 'name email' },
    ]);

    // Send real-time notification to the volunteer
    await safeNotify(req, {
      type: 'general',
      title: `New Task Assigned: ${newTask.title}`,
      message: `You have been assigned to "${newTask.title}" in ${newTask.serviceArea} (Priority: ${newTask.priority}).`,
      recipientUserId: volunteer._id.toString(),
    });

    return res.status(201).json({
      success: true,
      message: 'Task successfully created and assigned to volunteer.',
      task: newTask,
    });
  } catch (error) {
    console.error('createTask error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating task.',
    });
  }
};

/**
 * getAllTasks
 * GET /api/tasks
 * Requires role: Admin or NGO
 * Query parameters: status, priority, serviceArea, assignedTo, search
 */
const getAllTasks = async (req, res) => {
  try {
    const { status, priority, serviceArea, assignedTo, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (priority) {
      filter.priority = priority;
    }

    if (serviceArea) {
      filter.serviceArea = { $regex: serviceArea.trim(), $options: 'i' };
    }

    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ title: searchRegex }, { description: searchRegex }, { serviceArea: searchRegex }];
    }

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email skills availability serviceArea phone')
      .populate('assignedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error('getAllTasks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving tasks.',
    });
  }
};

/**
 * getMyTasks
 * GET /api/tasks/my-tasks
 * Requires role: Volunteer
 * Fetches all tasks assigned to the currently authenticated volunteer.
 */
const getMyTasks = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { assignedTo: req.user._id };

    if (status) {
      filter.status = status;
    }

    const tasks = await Task.find(filter)
      .populate('assignedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error('getMyTasks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving assigned tasks.',
    });
  }
};

/**
 * getTaskById
 * GET /api/tasks/:id
 * Accessible to Admin, NGO, or the assigned volunteer
 */
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email skills availability serviceArea phone')
      .populate('assignedBy', 'name email')
      .populate('statusHistory.changedBy', 'name email role');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    // Authorization check: Admin and NGO can view any task; Volunteer can only view their own
    const isAdminOrNGO = ['Admin', 'NGO'].includes(req.user.role);
    const isAssignedVolunteer = task.assignedTo && task.assignedTo._id.toString() === req.user._id.toString();

    if (!isAdminOrNGO && !isAssignedVolunteer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You cannot view tasks assigned to others.',
      });
    }

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    console.error('getTaskById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving task details.',
    });
  }
};

/**
 * updateTaskStatus
 * PATCH /api/tasks/:id/status
 * State machine transition:
 *   Assigned ──► Accepted ──► In Progress ──► Completed
 *
 * Accessible to:
 *   - The assigned volunteer
 *   - Admins (who have override privilege)
 */
const updateTaskStatus = async (req, res) => {
  try {
    const { status: targetStatus, notes } = req.body;

    if (!targetStatus) {
      return res.status(422).json({
        success: false,
        message: 'Target status is required.',
      });
    }

    const validStates = ['Assigned', 'Accepted', 'In Progress', 'Completed'];
    if (!validStates.includes(targetStatus)) {
      return res.status(422).json({
        success: false,
        message: `Invalid status "${targetStatus}". Must be one of: ${validStates.join(', ')}`,
      });
    }

    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    const isAdmin = req.user.role === 'Admin';
    const isAssignedVolunteer =
      task.assignedTo && task.assignedTo._id.toString() === req.user._id.toString();

    if (!isAdmin && !isAssignedVolunteer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the assigned volunteer or an Admin may update this task.',
      });
    }

    // Validate state machine transition for volunteers
    if (!isAdmin) {
      const allowedNextStates = VALID_TRANSITIONS[task.status] || [];
      if (!allowedNextStates.includes(targetStatus)) {
        return res.status(422).json({
          success: false,
          message: `Cannot transition task from "${task.status}" to "${targetStatus}". Allowed next step(s): ${
            allowedNextStates.length ? allowedNextStates.join(', ') : 'None (Terminal state)'
          }`,
        });
      }
    }

    const previousStatus = task.status;
    task.status = targetStatus;

    if (notes) {
      task.notes = notes.trim();
    }

    if (targetStatus === 'Completed') {
      task.completedAt = new Date();
    }

    // Append to status history
    task.statusHistory.push({
      status: targetStatus,
      changedBy: req.user._id,
      changedAt: new Date(),
      notes: notes ? notes.trim() : `Status changed from ${previousStatus} to ${targetStatus}`,
    });

    await task.save();

    // Notify Admin or Volunteer
    if (isAssignedVolunteer) {
      // Volunteer updated status — notify the assigner (Admin)
      await safeNotify(req, {
        type: 'general',
        title: `Task ${targetStatus}: ${task.title}`,
        message: `Volunteer ${req.user.name} transitioned task "${task.title}" to "${targetStatus}".`,
        recipientUserId: task.assignedBy ? task.assignedBy._id.toString() : null,
        targetRole: 'Admin',
      });
    } else if (isAdmin && task.assignedTo) {
      // Admin adjusted status — notify the volunteer
      await safeNotify(req, {
        type: 'general',
        title: `Task Status Updated: ${task.title}`,
        message: `Admin updated your task "${task.title}" to status "${targetStatus}".`,
        recipientUserId: task.assignedTo._id.toString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: `Task status updated from "${previousStatus}" to "${targetStatus}".`,
      task,
    });
  } catch (error) {
    console.error('updateTaskStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating task status.',
    });
  }
};

/**
 * assignTask
 * PUT /api/tasks/:id/assign
 * Admin can reassign task to a different volunteer
 */
const assignTask = async (req, res) => {
  try {
    const { assignedTo, notes } = req.body;

    if (!assignedTo) {
      return res.status(422).json({
        success: false,
        message: 'assignedTo volunteer ID is required.',
      });
    }

    const volunteer = await User.findById(assignedTo);
    if (!volunteer || volunteer.role !== 'Volunteer') {
      return res.status(422).json({
        success: false,
        message: 'Target user must exist and have the Volunteer role.',
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    task.assignedTo = volunteer._id;
    task.status = 'Assigned'; // reset to Assigned for new volunteer
    task.statusHistory.push({
      status: 'Assigned',
      changedBy: req.user._id,
      changedAt: new Date(),
      notes: notes ? notes.trim() : `Reassigned to volunteer ${volunteer.name}`,
    });

    await task.save();
    await task.populate([
      { path: 'assignedTo', select: 'name email skills availability serviceArea phone' },
      { path: 'assignedBy', select: 'name email' },
    ]);

    await safeNotify(req, {
      type: 'general',
      title: `Task Assigned: ${task.title}`,
      message: `You have been assigned to task "${task.title}" in ${task.serviceArea}.`,
      recipientUserId: volunteer._id.toString(),
    });

    return res.status(200).json({
      success: true,
      message: `Task reassigned to ${volunteer.name}.`,
      task,
    });
  } catch (error) {
    console.error('assignTask error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error reassigning task.',
    });
  }
};

/**
 * deleteTask
 * DELETE /api/tasks/:id
 * Admin can remove a task
 */
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Task successfully removed.',
    });
  } catch (error) {
    console.error('deleteTask error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting task.',
    });
  }
};

module.exports = {
  createTask,
  getAllTasks,
  getMyTasks,
  getTaskById,
  updateTaskStatus,
  assignTask,
  deleteTask,
};
