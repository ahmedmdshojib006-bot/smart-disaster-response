const SOSRequest = require('../models/SOSRequest');
const { sendNotification } = require('../services/notificationService');
const { calculatePriorityScore } = require('../utils/priorityCalculator');

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
      }
    } else if (typeof body.vulnerabilities === 'object') {
      parsed = { ...parsed, ...body.vulnerabilities };
    }
  }

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

    const newSOS = new SOSRequest({
      victim: req.user._id,
      location: {
        type: 'Point',
        coordinates: [lngNum, latNum],
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

    const io = req.app.get('io');
    const locationStr = newSOS.location.address || `GPS (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`;
    const needsStr = needs.join(', ').toUpperCase();

    if (io) {
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
const syncOfflineSOS = async (req, res) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No offline requests provided for synchronization.',
      });
    }

    const io = req.app.get('io');
    const syncedResults = [];

    for (const item of requests) {
      const lat = parseFloat(item.latitude);
      const lng = parseFloat(item.longitude);

      if (isNaN(lat) || isNaN(lng)) continue;

      const parsedNeeds = parseNeeds(item.needs);
      if (parsedNeeds.length === 0) continue;

      const peopleCount = Math.max(1, parseInt(item.numberOfPeople, 10) || 1);
      const vulnerabilities = parseVulnerabilities(item);

      const { priorityScore, priorityFactors, priorityLevel } = calculatePriorityScore({
        needs: parsedNeeds,
        numberOfPeople: peopleCount,
        vulnerabilities,
        createdAt: item.offlineLoggedAt ? new Date(item.offlineLoggedAt) : new Date(),
      });

      const sosDoc = new SOSRequest({
        victim: req.user._id,
        location: {
          latitude: lat,
          longitude: lng,
          address: item.address ? item.address.trim() : '',
          district: item.district ? item.district.trim() : '',
        },
        needs: parsedNeeds,
        numberOfPeople: peopleCount,
        vulnerabilities,
        priorityScore,
        priorityFactors,
        priority: priorityLevel,
        description: item.description ? `[Offline Synced] ${item.description.trim()}` : '[Offline Synced]',
        status: 'Pending',
        isOfflineSync: true,
        offlineLoggedAt: item.offlineLoggedAt ? new Date(item.offlineLoggedAt) : new Date(),
        submissionSource: 'PWA_OFFLINE',
        statusHistory: [
          {
            status: 'Pending',
            changedBy: req.user._id,
            changedAt: new Date(),
            note: 'Automatically synced from local PWA cache after network recovery.',
          },
        ],
      });

      await sosDoc.save();
      syncedResults.push(sosDoc);

      if (io) {
        io.emit('sos:created', sosDoc);
        io.emit('sos:offline-synced', {
          sosId: sosDoc._id,
          priority: sosDoc.priority,
          victimName: req.user.name,
          district: sosDoc.location.district,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully synchronized ${syncedResults.length} offline emergency request(s).`,
      count: syncedResults.length,
      syncedRequests: syncedResults,
    });
  } catch (error) {
    console.error('Error in syncOfflineSOS:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process offline SOS synchronization.',
      error: error.message,
    });
  }
};
const handleSMSFallback = async (req, res) => {
  try {
    const { senderPhone, messageText, latitude, longitude, needs, numberOfPeople } = req.body;

    if (!senderPhone || !senderPhone.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Sender phone number is required for SMS emergency dispatch.',
      });
    }

    let lat = parseFloat(latitude);
    let lng = parseFloat(longitude);
    let detectedNeeds = parseNeeds(needs);
    let peopleCount = parseInt(numberOfPeople, 10) || 1;
    if (messageText && (isNaN(lat) || isNaN(lng))) {
      const coordMatch = messageText.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
      if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lng = parseFloat(coordMatch[2]);
      }
      if (detectedNeeds.length === 0) {
        if (/water/i.test(messageText)) detectedNeeds.push('water');
        if (/food/i.test(messageText)) detectedNeeds.push('food');
        if (/med/i.test(messageText)) detectedNeeds.push('medicine');
        if (/rescue|save/i.test(messageText)) detectedNeeds.push('rescue');
      }
    }
    if (isNaN(lat) || isNaN(lng)) {
      lat = 23.8103;
      lng = 90.4125;
    }
    if (detectedNeeds.length === 0) {
      detectedNeeds = ['rescue', 'food'];
    }

    const vulnerabilities = { children: 0, elderly: 0, pregnantWomen: 0, injured: 1 };
    const { priorityScore, priorityFactors, priorityLevel } = calculatePriorityScore({
      needs: detectedNeeds,
      numberOfPeople: peopleCount,
      vulnerabilities,
      createdAt: new Date(),
    });

    const io = req.app.get('io');
    const sosDoc = new SOSRequest({
      victim: req.user ? req.user._id : '000000000000000000000000', 
      location: {
        latitude: lat,
        longitude: lng,
        address: `SMS Dispatch from: ${senderPhone.trim()}`,
        district: 'SMS Gateway',
      },
      needs: detectedNeeds,
      numberOfPeople: peopleCount,
      vulnerabilities,
      priorityScore: Math.max(80, priorityScore), 
      priorityFactors,
      priority: 'Critical',
      description: `[SMS FALLBACK DISPATCH] From: ${senderPhone}. Text: "${messageText || 'Emergency rescue requested via SMS'}".`,
      status: 'Pending',
      submissionSource: 'SMS_FALLBACK',
      statusHistory: [
        {
          status: 'Pending',
          changedAt: new Date(),
          note: `Received via SMS gateway from ${senderPhone}. Cellular backup activated.`,
        },
      ],
    });
    await sosDoc.save({ validateBeforeSave: false });

    if (io) {
      io.emit('sos:created', sosDoc);
      io.emit('sos:sms-alert', {
        sosId: sosDoc._id,
        senderPhone,
        priority: 'Critical',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Emergency SMS dispatch logged successfully.',
      sosId: sosDoc._id,
      smsConfirmation: `SMS received! Rescue teams alerted for coordinates ${lat},${lng}. Keep your phone on.`,
    });
  } catch (error) {
    console.error('Error in handleSMSFallback:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process SMS fallback alert.',
      error: error.message,
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
  syncOfflineSOS,
  handleSMSFallback,
};
