const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');

const getAllUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error retrieving users.' });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error retrieving user.' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['Volunteer', 'NGO', 'Citizen', 'Donor', 'Admin'];

    if (!allowedRoles.includes(role)) {
      return res.status(422).json({ success: false, message: 'Invalid role.' });
    }

    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role } },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `User role updated to ${role}.`,
      user,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error updating user role.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error deleting user.' });
  }
};

const sendAlert = async (req, res) => {
  try {
    const { type, title, message, targetRole } = req.body;
    const validTypes = ['weather', 'evacuation', 'general'];

    if (!validTypes.includes(type)) {
      return res.status(422).json({
        success: false,
        message: 'Alert type must be weather, evacuation, or general.',
      });
    }

    if (!title || !message) {
      return res.status(422).json({
        success: false,
        message: 'Title and message are required.',
      });
    }

    const io = req.app.get('io');
    const notification = await sendNotification({
      io,
      type,
      title: title.trim(),
      message: message.trim(),
      targetRole: targetRole || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Alert sent successfully.',
      notification,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error sending alert.' });
  }
};

const getStats = async (req, res) => {
  try {
    const [total, byRole] = await Promise.all([
      User.countDocuments(),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);

    const stats = { total, byRole: {} };
    byRole.forEach((item) => {
      stats.byRole[item._id] = item.count;
    });

    return res.status(200).json({ success: true, stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error retrieving statistics.' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  sendAlert,
  getStats,
};
