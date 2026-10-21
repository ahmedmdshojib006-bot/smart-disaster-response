const SOSRequest = require('../models/SOSRequest');
const { sendNotification } = require('../services/notificationService');

const parseNeeds = (rawNeeds) => {
  if (!rawNeeds) return [];
  if (Array.isArray(rawNeeds)) return rawNeeds.map((n) => String(n).trim().toLowerCase());
  if (typeof rawNeeds === 'string') {
    try {
      const parsed = JSON.parse(rawNeeds);
      if (Array.isArray(parsed)) return parsed.map((n) => String(n).trim().toLowerCase());
    } catch {
    }
    return rawNeeds
      .split(',')
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

const createSOS = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      address,
      needs: rawNeeds,
      numberOfPeople,
      description,
      priority: customPriority,
    } = req.body;

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      return res.status(400).json({
        success: false,
        message: 'A valid GPS latitude (-90 to 90) is required.',
      });
    }

    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({
        success: false,
        message: 'A valid GPS longitude (-180 to 180) is required.',
      });
    }

    const needs = parseNeeds(rawNeeds);
    const validNeedsList = ['food', 'water', 'medicine', 'rescue'];
    const invalidNeeds = needs.filter((n) => !validNeedsList.includes(n));

    if (needs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one type of need (food, water, medicine, rescue) is required.',
      });
    }

    if (invalidNeeds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid need type(s): ${invalidNeeds.join(', ')}. Must be one of: ${validNeedsList.join(', ')}`,
      });
    }

    const peopleCount = parseInt(numberOfPeople, 10);
    if (isNaN(peopleCount) || peopleCount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Number of people must be at least 1.',
      });
    }

    let photoUrl = req.body.photoUrl || null;
    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
    }

    let calculatedPriority = 'High';
    if (customPriority && ['Normal', 'High', 'Critical'].includes(customPriority)) {
      calculatedPriority = customPriority;
    } else if (needs.includes('rescue') || peopleCount >= 5) {
      calculatedPriority = 'Critical';
    }

    const newSOS = new SOSRequest({
      victim: req.user._id,
      location: {
        latitude: latNum,
        longitude: lngNum,
        address: address ? String(address).trim() : '',
      },
      needs,
      numberOfPeople: peopleCount,
      photoUrl,
      description: description ? String(description).trim() : '',
      priority: calculatedPriority,
      status: 'Pending',
      statusHistory: [
        {
          status: 'Pending',
          changedBy: req.user._id,
          changedAt: new Date(),
          note: 'Emergency request submitted by victim.',
        },
      ],
    });

    await newSOS.save();
    await newSOS.populate('victim', 'name email');

    const io = req.app.get('io');
    const locationStr = newSOS.location.address || `GPS (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`;
    const needsStr = needs.join(', ').toUpperCase();

    if (io) {
      try {
        await sendNotification({
          io,
          type: 'sos',
          title: `🚨 Emergency SOS: ${needsStr}`,
          message: `${peopleCount} person(s) need immediate help at ${locationStr}.`,
          targetRole: 'Volunteer',
          relatedId: newSOS._id.toString(),
          relatedType: 'sos',
        });
      } catch (err) {
        console.error('Failed to notify volunteers:', err.message);
      }

      try {
        await sendNotification({
          io,
          type: 'sos',
          title: '🚨 New SOS Alert (Admin)',
          message: `SOS #${newSOS._id.toString().slice(-6)} filed by ${req.user.name} at ${locationStr}.`,
          targetRole: 'Admin',
          relatedId: newSOS._id.toString(),
          relatedType: 'sos',
        });
      } catch (err) {
        console.error('Failed to notify admins:', err.message);
      }

      try {
        await sendNotification({
          io,
          type: 'sos',
          title: `🚨 Relief Request: ${needsStr}`,
          message: `${peopleCount} people requesting ${needs.join(', ')} at ${locationStr}.`,
          targetRole: 'NGO',
          relatedId: newSOS._id.toString(),
          relatedType: 'sos',
        });
      } catch (err) {
        console.error('Failed to notify NGOs:', err.message);
      }

      try {
        await sendNotification({
          io,
          type: 'sos',
          title: '✅ SOS Request Dispatched',
          message: 'Your emergency request is received. Nearby rescue teams and coordinators are being mobilized.',
          recipientUserId: req.user._id.toString(),
          relatedId: newSOS._id.toString(),
          relatedType: 'sos',
        });
      } catch (err) {
        console.error('Failed to notify victim:', err.message);
      }

      io.emit('sos:created', newSOS);
    }

    return res.status(201).json({
      success: true,
      message: 'Emergency SOS request submitted successfully. Help is on the way.',
      data: newSOS,
    });
  } catch (error) {
    console.error('Error creating SOS request:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while submitting SOS request.',
    });
  }
};

const getMySOS = async (req, res) => {
  try {
    const requests = await SOSRequest.find({ victim: req.user._id })
      .populate('assignedVolunteer', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching my SOS requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching your SOS requests.',
    });
  }
};

const getSOSById = async (req, res) => {
  try {
    const sos = await SOSRequest.findById(req.params.id)
      .populate('victim', 'name email role')
      .populate('assignedVolunteer', 'name email role');

    if (!sos) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found.',
      });
    }

    const isOwner = sos.victim && sos.victim._id.toString() === req.user._id.toString();
    const isStaff = ['Admin', 'Volunteer', 'NGO'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own emergency requests.',
      });
    }

    return res.status(200).json({
      success: true,
      data: sos,
    });
  } catch (error) {
    console.error('Error fetching SOS request by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching SOS details.',
    });
  }
};

const getAllSOS = async (req, res) => {
  try {
    const { status, need, priority } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }
    if (need) {
      filter.needs = need.toLowerCase();
    }
    if (priority) {
      filter.priority = priority;
    }

    const requests = await SOSRequest.find(filter)
      .populate('victim', 'name email')
      .populate('assignedVolunteer', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching all SOS requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching SOS requests.',
    });
  }
};

const cancelSOS = async (req, res) => {
  try {
    const sos = await SOSRequest.findById(req.params.id);

    if (!sos) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found.',
      });
    }

    const isOwner = sos.victim.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'Admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this SOS request.',
      });
    }

    if (sos.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed emergency request.',
      });
    }

    sos.status = 'Cancelled';
    sos.statusHistory.push({
      status: 'Cancelled',
      changedBy: req.user._id,
      changedAt: new Date(),
      note: req.body.reason || 'Cancelled by user.',
    });

    await sos.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('sos:updated', sos);
    }

    return res.status(200).json({
      success: true,
      message: 'SOS request marked as cancelled.',
      data: sos,
    });
  } catch (error) {
    console.error('Error cancelling SOS request:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while cancelling SOS request.',
    });
  }
};

const updateSOSStatus = async (req, res) => {
  try {
    const { status, note, assignedVolunteer } = req.body;
    const validStatuses = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const sos = await SOSRequest.findById(req.params.id);
    if (!sos) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found.',
      });
    }

    sos.status = status;
    if (assignedVolunteer) {
      sos.assignedVolunteer = assignedVolunteer;
    }

    sos.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date(),
      note: note || `Status updated to ${status} by ${req.user.name}`,
    });

    await sos.save();
    await sos.populate('victim', 'name email');
    await sos.populate('assignedVolunteer', 'name email');

    const io = req.app.get('io');
    if (io && sos.victim) {
      try {
        await sendNotification({
          io,
          type: 'sos',
          title: `SOS Update: ${status}`,
          message: `Your emergency request status has been updated to "${status}".`,
          recipientUserId: sos.victim._id.toString(),
          relatedId: sos._id.toString(),
          relatedType: 'sos',
        });
      } catch (err) {
        console.error('Failed to notify victim on status change:', err.message);
      }

      io.emit('sos:updated', sos);
    }

    return res.status(200).json({
      success: true,
      message: `SOS status updated to ${status}.`,
      data: sos,
    });
  } catch (error) {
    console.error('Error updating SOS status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating SOS status.',
    });
  }
};

module.exports = {
  createSOS,
  getMySOS,
  getSOSById,
  getAllSOS,
  cancelSOS,
  updateSOSStatus,
};
