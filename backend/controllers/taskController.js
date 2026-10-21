const Task = require('../models/Task');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');

const VALID_TRANSITIONS = {
  Assigned: ['Accepted'],
  Accepted: ['In Progress'],
  'In Progress': ['Completed'],
  Completed: [], 
};

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

const createTask = async (req, res) => {
  try {
    const { title, description, taskType, priority, serviceArea, assignedTo, dueDate, notes } = req.body;

    if (!title || !description || !serviceArea || !assignedTo) {
      return res.status(422).json({
        success: false,
        message: 'Title, description, service area, and assigned volunteer are required.',
      });
    }

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

    task.statusHistory.push({
      status: targetStatus,
      changedBy: req.user._id,
      changedAt: new Date(),
      notes: notes ? notes.trim() : `Status changed from ${previousStatus} to ${targetStatus}`,
    });

    await task.save();

    if (isAssignedVolunteer) {
      await safeNotify(req, {
        type: 'general',
        title: `Task ${targetStatus}: ${task.title}`,
        message: `Volunteer ${req.user.name} transitioned task "${task.title}" to "${targetStatus}".`,
        recipientUserId: task.assignedBy ? task.assignedBy._id.toString() : null,
        targetRole: 'Admin',
      });
    } else if (isAdmin && task.assignedTo) {
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
    task.status = 'Assigned'; 
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
