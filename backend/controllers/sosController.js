// controllers/sosController.js
// ─────────────────────────────────────────────────────────────────────────────
// Emergency SOS / Help Request Controller (Member-2)
//
// Module 1:
//   - Submission, GPS handling, photos, filtering, and real-time alerts.
// Module 2:
//   - Automated Priority Score calculation based on vulnerability factors
//     (children, elderly people, pregnant women, injuries, urgent needs).
//   - Priority-ranked queries ensuring most urgent requests are at the top of admin list.
//   - GeoJSON coordinates synchronization for MongoDB 2dsphere spatial indexing.
// ─────────────────────────────────────────────────────────────────────────────

const SOSRequest = require('../models/SOSRequest');
const { sendNotification } = require('../services/notificationService');
const { calculatePriorityScore } = require('../utils/priorityCalculator');

/**
 * Helper to parse needs input from JSON or multipart/form-data
 */
const parseNeeds = (rawNeeds) => {
  if (!rawNeeds) return [];
  if (Array.isArray(rawNeeds)) return rawNeeds.map((n) => String(n).trim().toLowerCase());
  if (typeof rawNeeds === 'string') {
    try {
      const parsed = JSON.parse(rawNeeds);
      if (Array.isArray(parsed)) return parsed.map((n) => String(n).trim().toLowerCase());
    } catch {
      // not JSON, fallback to comma split
    }
    return rawNeeds
      .split(',')
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

/**
 * Helper to parse vulnerability demographic factors
 */
const parseVulnerabilities = (body) => {
  let parsed = {
    children: 0,
    elderly: 0,
    pregnantWomen: 0,
    injured: 0,
  };

  if (body.vulnerabilities) {
    if (typeof body.vulnerabilities === 'string') {
      try {
        const obj = JSON.parse(body.vulnerabilities);
        parsed = { ...parsed, ...obj };
      } catch {
        // ignore
      }
    } else if (typeof body.vulnerabilities === 'object') {
      parsed = { ...parsed, ...body.vulnerabilities };
    }
  }

  // Also support direct top-level fields
  if (body.children !== undefined) parsed.children = parseInt(body.children, 10) || 0;
  if (body.elderly !== undefined) parsed.elderly = parseInt(body.elderly, 10) || 0;
  if (body.pregnantWomen !== undefined) parsed.pregnantWomen = parseInt(body.pregnantWomen, 10) || 0;
  if (body.injured !== undefined) parsed.injured = parseInt(body.injured, 10) || 0;

  parsed.children = Math.max(0, parsed.children);
  parsed.elderly = Math.max(0, parsed.elderly);
  parsed.pregnantWomen = Math.max(0, parsed.pregnantWomen);
  parsed.injured = Math.max(0, parsed.injured);

  return parsed;
};

/**
 * POST /api/sos
 * Submit a new emergency SOS request
 * Authenticated user: Citizen / Victim (or any user in distress)
 */
const createSOS = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      address,
      district,
      needs: rawNeeds,
      numberOfPeople,
      description,
      priority: customPriority,
    } = req.body;

    // ── 1. Validation ─────────────────────────────────────────────────────────
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

    // ── 2. Handle Photo Upload ────────────────────────────────────────────────
    let photoUrl = req.body.photoUrl || null;
    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
    }

    // ── 3. Module 2: Automated Priority Score Calculation ─────────────────────
    const parsedVulnerabilities = parseVulnerabilities(req.body);

    const priorityResult = calculatePriorityScore({
      vulnerabilities: parsedVulnerabilities,
      needs,
      numberOfPeople: peopleCount,
      description: description || '',
    });

    let calculatedPriority = priorityResult.priority;
    if (customPriority && ['Low', 'Medium', 'Normal', 'High', 'Critical'].includes(customPriority)) {
      calculatedPriority = customPriority;
    }

    // ── 4. Create and Save SOS Document ──────────────────────────────────────
    const newSOS = new SOSRequest({
      victim: req.user._id,
      location: {
        type: 'Point',
        coordinates: [lngNum, latNum], // GeoJSON order: [longitude, latitude]
        latitude: latNum,
        longitude: lngNum,
        address: address ? String(address).trim() : '',
        district: district ? String(district).trim() : '',
      },
      needs,
      numberOfPeople: peopleCount,
      vulnerabilities: priorityResult.vulnerabilities,
      priorityScore: priorityResult.score,
      priorityFactors: priorityResult.factors,
      photoUrl,
      description: description ? String(description).trim() : '',
      priority: calculatedPriority,
      status: 'Pending',
      statusHistory: [
        {
          status: 'Pending',
          changedBy: req.user._id,
          changedAt: new Date(),
          note: `Emergency request submitted. Automated Urgency Score: ${priorityResult.score}/100 (${calculatedPriority}).`,
        },
      ],
    });

    await newSOS.save();
    await newSOS.populate('victim', 'name email');

    // ── 5. Trigger Real-Time Alerts via Notification Service & Socket.IO ─────
    const io = req.app.get('io');
    const locationStr = newSOS.location.address || `GPS (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`;
    const needsStr = needs.join(', ').toUpperCase();

    if (io) {
      // 5a. Alert Volunteers
      try {
        await sendNotification({
          io,
          type: 'sos',
          title: `🚨 Emergency SOS [Priority: ${priorityResult.score} - ${calculatedPriority}]: ${needsStr}`,
          message: `${peopleCount} person(s) need immediate help at ${locationStr}. Priority: ${priorityResult.score}/100.`,
          targetRole: 'Volunteer',
          relatedId: newSOS._id.toString(),
          relatedType: 'sos',
        });
      } catch (err) {
        console.error('Failed to notify volunteers:', err.message);
      }

      // 5b. Alert Admins
      try {
        await sendNotification({
          io,
          type: 'sos',
          title: `🚨 New Urgent SOS [Score: ${priorityResult.score}] (Admin)`,
          message: `SOS #${newSOS._id.toString().slice(-6)} filed by ${req.user.name} at ${locationStr}. Urgency: ${calculatedPriority}.`,
          targetRole: 'Admin',
          relatedId: newSOS._id.toString(),
          relatedType: 'sos',
        });
      } catch (err) {
        console.error('Failed to notify admins:', err.message);
      }

      // 5c. Alert NGOs
      try {
        await sendNotification({
          io,
          type: 'sos',
          title: `🚨 Relief Request: ${needsStr}`,
          message: `${peopleCount} people requesting ${needs.join(', ')} at ${locationStr}. Priority Score: ${priorityResult.score}.`,
          targetRole: 'NGO',
          relatedId: newSOS._id.toString(),
          relatedType: 'sos',
        });
      } catch (err) {
        console.error('Failed to notify NGOs:', err.message);
      }

      // 5d. Confirm to Victim
      try {
        await sendNotification({
          io,
          type: 'sos',
          title: '✅ SOS Request Dispatched',
          message: `Your emergency request is received (Priority: ${calculatedPriority}, Score: ${priorityResult.score}/100). Responders are mobilized.`,
          recipientUserId: req.user._id.toString(),
          relatedId: newSOS._id.toString(),
          relatedType: 'sos',
        });
      } catch (err) {
        console.error('Failed to notify victim:', err.message);
      }

      // 5e. Real-time broadcast for live dispatch maps and task feeds
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

/**
 * GET /api/sos/my
 * Fetch all SOS requests submitted by the logged-in user
 */
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

/**
 * GET /api/sos/:id
 * Fetch single SOS request by ID
 */
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

/**
 * GET /api/sos
 * Fetch all SOS requests with optional filtering and priority-based sorting.
 * Defaults to priorityScore DESC so the most urgent appear at top of admin list.
 */
const getAllSOS = async (req, res) => {
  try {
    const { status, need, priority, sortBy, order } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (need && need !== 'All') {
      filter.needs = need.toLowerCase();
    }
    if (priority && priority !== 'All') {
      filter.priority = priority;
    }

    // Module 2 Requirement 1:
    // "so the most urgent requests appear at the top of the admin's list."
    // Default sorting is by priorityScore DESC, then createdAt DESC.
    let sortOptions = { priorityScore: -1, createdAt: -1 };

    if (sortBy === 'createdAt') {
      sortOptions = { createdAt: order === 'asc' ? 1 : -1 };
    } else if (sortBy === 'priorityScore') {
      sortOptions = { priorityScore: order === 'asc' ? 1 : -1, createdAt: -1 };
    }

    const requests = await SOSRequest.find(filter)
      .populate('victim', 'name email')
      .populate('assignedVolunteer', 'name email')
      .sort(sortOptions);

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

/**
 * GET /api/sos/prioritized
 * Dedicated triage endpoint returning active requests sorted by priorityScore
 * along with detailed vulnerability and priority breakdown analytics.
 */
const getPrioritizedSOS = async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    } else {
      filter.status = { $in: ['Pending', 'Assigned', 'In Progress'] };
    }

    const requests = await SOSRequest.find(filter)
      .populate('victim', 'name email')
      .populate('assignedVolunteer', 'name email')
      .sort({ priorityScore: -1, createdAt: -1 })
      .limit(parseInt(limit, 10) || 100);

    // Compute vulnerability metrics
    const stats = {
      totalActive: requests.length,
      criticalCount: requests.filter((r) => r.priorityScore >= 70).length,
      highCount: requests.filter((r) => r.priorityScore >= 45 && r.priorityScore < 70).length,
      mediumCount: requests.filter((r) => r.priorityScore >= 25 && r.priorityScore < 45).length,
      lowCount: requests.filter((r) => r.priorityScore < 25).length,
      vulnerablePersons: {
        children: requests.reduce((sum, r) => sum + (r.vulnerabilities?.children || 0), 0),
        elderly: requests.reduce((sum, r) => sum + (r.vulnerabilities?.elderly || 0), 0),
        pregnantWomen: requests.reduce((sum, r) => sum + (r.vulnerabilities?.pregnantWomen || 0), 0),
        injured: requests.reduce((sum, r) => sum + (r.vulnerabilities?.injured || 0), 0),
      },
    };

    return res.status(200).json({
      success: true,
      stats,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching prioritized SOS:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching prioritized SOS requests.',
    });
  }
};

/**
 * PATCH /api/sos/:id/cancel
 * Cancel an SOS request by the victim (if safe or submitted in error)
 */
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

/**
 * PATCH /api/sos/:id/status
 * Update the status of an SOS request (Admin / Volunteer / NGO)
 */
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
  getPrioritizedSOS,
  cancelSOS,
  updateSOSStatus,
};
