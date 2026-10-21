const User = require('../models/User');
const Task = require('../models/Task');

const getVolunteers = async (req, res) => {
  try {
    const { availability, serviceArea, skill, search } = req.query;

    const filter = { role: 'Volunteer' };

    if (availability) {
      filter.availability = availability;
    }

    if (serviceArea) {
      filter.serviceArea = { $regex: serviceArea.trim(), $options: 'i' };
    }

    if (skill) {
      filter.skills = { $in: [new RegExp(skill.trim(), 'i')] };
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }, { serviceArea: searchRegex }];
    }

    const volunteers = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    const volunteerIds = volunteers.map((v) => v._id);
    const taskCounts = await Task.aggregate([
      { $match: { assignedTo: { $in: volunteerIds } } },
      {
        $group: {
          _id: '$assignedTo',
          totalTasks: { $sum: 1 },
          activeTasks: {
            $sum: {
              $cond: [{ $in: ['$status', ['Assigned', 'Accepted', 'In Progress']] }, 1, 0],
            },
          },
          completedTasks: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0],
            },
          },
        },
      },
    ]);

    const taskCountMap = {};
    taskCounts.forEach((tc) => {
      taskCountMap[tc._id.toString()] = {
        totalTasks: tc.totalTasks,
        activeTasks: tc.activeTasks,
        completedTasks: tc.completedTasks,
      };
    });

    const volunteersWithStats = volunteers.map((vol) => {
      const stats = taskCountMap[vol._id.toString()] || {
        totalTasks: 0,
        activeTasks: 0,
        completedTasks: 0,
      };
      return {
        ...vol.toObject(),
        stats,
      };
    });

    return res.status(200).json({
      success: true,
      count: volunteersWithStats.length,
      volunteers: volunteersWithStats,
    });
  } catch (error) {
    console.error('getVolunteers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving volunteers.',
    });
  }
};

const getVolunteerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer profile not found.',
      });
    }

    const taskSummary = await Task.aggregate([
      { $match: { assignedTo: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = {
      Assigned: 0,
      Accepted: 0,
      'In Progress': 0,
      Completed: 0,
    };
    taskSummary.forEach((s) => {
      if (statusCounts[s._id] !== undefined) {
        statusCounts[s._id] = s.count;
      }
    });

    return res.status(200).json({
      success: true,
      user,
      taskSummary: statusCounts,
    });
  } catch (error) {
    console.error('getVolunteerProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving profile.',
    });
  }
};

const updateVolunteerProfile = async (req, res) => {
  try {
    const { skills, availability, serviceArea, phone } = req.body;
    const updates = {};

    if (skills !== undefined) {
      if (Array.isArray(skills)) {
        updates.skills = skills.map((s) => s.trim()).filter(Boolean);
      } else if (typeof skills === 'string') {
        updates.skills = skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    if (availability !== undefined) {
      if (!['Available', 'Busy', 'Unavailable'].includes(availability)) {
        return res.status(422).json({
          success: false,
          message: 'Invalid availability status. Must be Available, Busy, or Unavailable.',
        });
      }
      updates.availability = availability;
    }

    if (serviceArea !== undefined) {
      updates.serviceArea = serviceArea.trim();
    }

    if (phone !== undefined) {
      updates.phone = phone.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true })
      .select('-passwordHash');

    return res.status(200).json({
      success: true,
      message: 'Volunteer profile updated successfully.',
      user: updatedUser,
    });
  } catch (error) {
    console.error('updateVolunteerProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating profile.',
    });
  }
};

module.exports = {
  getVolunteers,
  getVolunteerProfile,
  updateVolunteerProfile,
};
