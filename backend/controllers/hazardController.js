const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const HazardReport = require('../models/HazardReport');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');
const {
  TRUST_DELTAS,
  clampScore,
  getTrustTier,
  calculateCredibilityScore,
} = require('../utils/trustScoreCalculator');

const OFFICIAL_ROLES = ['Admin', 'NGO', 'Volunteer'];

const SEVERITY_ORDER = {
  Critical: 4,
  High: 3,
  Moderate: 2,
  Low: 1,
};

const broadcastSocket = (req, event, payload) => {
  try {
    const io = req.app ? req.app.get('io') : null;
    if (io) {
      io.emit(event, payload);
    }
  } catch (err) {
    console.error(`Socket broadcast failed for ${event}:`, err.message);
  }
};

const safeNotify = async (req, params) => {
  try {
    const io = req.app ? req.app.get('io') : null;
    if (io) {
      await sendNotification({ io, ...params });
    }
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

const recomputeReportCredibility = (report, reporterTrustScore) => {
  const officialVerificationsCount = (report.verifications || []).filter((v) =>
    OFFICIAL_ROLES.includes(v.userRole)
  ).length;
  const communityVerificationsCount =
    (report.verifications || []).length - officialVerificationsCount;

  report.credibilityScore = calculateCredibilityScore({
    reporterTrustScore:
      typeof reporterTrustScore === 'number'
        ? reporterTrustScore
        : report.reporterTrustSnapshot,
    hasPhoto: Boolean(report.photoUrl),
    upvotesCount: (report.upvotes || []).length,
    verificationsCount: communityVerificationsCount,
    officialVerificationsCount,
    fakeFlagsCount: (report.fakeFlags || []).length,
    status: report.status,
  });
};

const formatReportResponse = (reportDoc, currentUserId = null) => {
  const obj =
    typeof reportDoc.toObject === 'function' ? reportDoc.toObject() : { ...reportDoc };
  const reporterObj =
    obj.reporter && typeof obj.reporter === 'object' ? obj.reporter : null;
  const liveTrustScore =
    typeof reporterObj?.trustScore === 'number'
      ? reporterObj.trustScore
      : obj.reporterTrustSnapshot ?? 50;

  const userIdStr = currentUserId ? String(currentUserId) : null;
  const upvotes = obj.upvotes || [];
  const verifications = obj.verifications || [];
  const fakeFlags = obj.fakeFlags || [];

  return {
    ...obj,
    reporterTrustScore: liveTrustScore,
    reporterTrustTier: getTrustTier(liveTrustScore),
    upvoteCount: upvotes.length,
    verificationCount: verifications.length,
    fakeFlagCount: fakeFlags.length,
    hasUpvoted: userIdStr ? upvotes.some((id) => String(id) === userIdStr) : false,
    hasVerified: userIdStr
      ? verifications.some((v) => String(v.user) === userIdStr)
      : false,
    hasFlagged: userIdStr
      ? fakeFlags.some((f) => String(f.user) === userIdStr)
      : false,
  };
};

const createHazardReport = async (req, res) => {
  try {
    const {
      title,
      hazardType,
      severity,
      description,
      latitude,
      longitude,
      address,
      upazila,
      district,
      waterDepthFeet,
      roadPassable,
    } = req.body;

    const resolvedDistrict = String(district || '').trim();
    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Hazard report title is required.',
      });
    }

    if (!description || !String(description).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Hazard description is required.',
      });
    }

    if (!resolvedDistrict) {
      return res.status(400).json({
        success: false,
        message: 'District is required.',
      });
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (
      Number.isNaN(latNum) ||
      Number.isNaN(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS latitude (-90 to 90) and longitude (-180 to 180) are required.',
      });
    }

    let photoUrl = req.body.photoUrl ? String(req.body.photoUrl).trim() : null;
    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
    }

    const reporter = await User.findById(req.user._id);
    if (!reporter) {
      return res.status(404).json({
        success: false,
        message: 'Reporter account not found.',
      });
    }

    const reporterTrust = clampScore(reporter.trustScore ?? 50);
    const isAdminSubmission = req.user.role === 'Admin';
    const initialStatus = isAdminSubmission ? 'Verified' : 'Pending';

    const report = new HazardReport({
      title: String(title).trim(),
      hazardType: hazardType || 'Flooded Road',
      severity: severity || 'High',
      description: String(description).trim(),
      photoUrl,
      location: {
        type: 'Point',
        coordinates: [lngNum, latNum],
        latitude: latNum,
        longitude: lngNum,
        address: address ? String(address).trim() : '',
        upazila: upazila ? String(upazila).trim() : '',
        district: resolvedDistrict,
      },
      waterDepthFeet: Math.max(0, parseFloat(waterDepthFeet) || 0),
      roadPassable: roadPassable === true || roadPassable === 'true',
      reporter: reporter._id,
      reporterName: reporter.name,
      reporterTrustSnapshot: reporterTrust,
      status: initialStatus,
      verifiedBy: isAdminSubmission ? reporter._id : null,
      verifiedAt: isAdminSubmission ? new Date() : null,
      officialVerifyAwarded: isAdminSubmission,
    });

    recomputeReportCredibility(report, reporterTrust);
    await report.save();

    if (!reporter.hazardStats) {
      reporter.hazardStats = {
        reportsSubmitted: 0,
        reportsVerified: 0,
        reportsFlaggedFake: 0,
        verificationsCast: 0,
      };
    }
    reporter.hazardStats.reportsSubmitted += 1;
    if (isAdminSubmission) {
      reporter.hazardStats.reportsVerified += 1;
    }
    await reporter.save();

    const populated = await HazardReport.findById(report._id)
      .populate('reporter', 'name role trustScore hazardStats')
      .populate('verifiedBy', 'name role');

    const formatted = formatReportResponse(populated, req.user._id);

    broadcastSocket(req, 'hazardReport:created', formatted);

    if (report.severity === 'Critical' || report.severity === 'High') {
      await safeNotify(req, {
        type: 'weather',
        title: `New ${report.severity} Hazard Report: ${report.hazardType}`,
        message: `${report.title} reported in ${report.location.district} by ${reporter.name} (Trust: ${reporterTrust}/100).`,
        targetRole: 'Admin',
        relatedId: report._id,
        relatedType: 'HazardReport',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Hazard report submitted successfully.',
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit hazard report.',
    });
  }
};

const getAllHazardReports = async (req, res) => {
  try {
    const {
      status,
      hazardType,
      severity,
      district,
      search,
      sortBy = 'newest',
      mine,
    } = req.query;

    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (hazardType && hazardType !== 'All') {
      filter.hazardType = hazardType;
    }
    if (severity && severity !== 'All') {
      filter.severity = severity;
    }
    if (district && district !== 'All') {
      filter['location.district'] = new RegExp(district, 'i');
    }
    if (mine === 'true' && req.user) {
      filter.reporter = req.user._id;
    }
    if (search && String(search).trim()) {
      const term = String(search).trim();
      filter.$or = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { 'location.address': { $regex: term, $options: 'i' } },
        { 'location.upazila': { $regex: term, $options: 'i' } },
        { 'location.district': { $regex: term, $options: 'i' } },
        { reporterName: { $regex: term, $options: 'i' } },
      ];
    }

    let sortObj = { createdAt: -1 };
    if (sortBy === 'credibility') {
      sortObj = { credibilityScore: -1, createdAt: -1 };
    }

    const reports = await HazardReport.find(filter)
      .populate('reporter', 'name role trustScore hazardStats')
      .populate('verifiedBy', 'name role')
      .sort(sortObj)
      .lean();

    let formatted = reports.map((r) => formatReportResponse(r, req.user?._id));

    if (sortBy === 'upvotes') {
      formatted.sort(
        (a, b) =>
          b.upvoteCount + b.verificationCount - (a.upvoteCount + a.verificationCount) ||
          new Date(b.createdAt) - new Date(a.createdAt)
      );
    } else if (sortBy === 'severity') {
      formatted.sort(
        (a, b) =>
          (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0) ||
          b.credibilityScore - a.credibilityScore
      );
    }

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve hazard reports.',
    });
  }
};

const getNearbyHazardReports = async (req, res) => {
  try {
    const { lat, lng, radius = 15 } = req.query;
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusKm = Math.min(100, Math.max(0.5, parseFloat(radius) || 15));

    if (
      Number.isNaN(latNum) ||
      Number.isNaN(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS latitude and longitude are required.',
      });
    }

    const reports = await HazardReport.find({
      status: { $nin: ['Rejected'] },
      'location.coordinates': {
        $near: {
          $geometry: { type: 'Point', coordinates: [lngNum, latNum] },
          $maxDistance: radiusKm * 1000,
        },
      },
    })
      .populate('reporter', 'name role trustScore hazardStats')
      .populate('verifiedBy', 'name role')
      .limit(100)
      .lean();

    const formatted = reports.map((r) => formatReportResponse(r, req.user?._id));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      radiusKm,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Geospatial query for hazard reports failed.',
    });
  }
};

const getHazardStats = async (req, res) => {
  try {
    const [allReports, topReportersRaw] = await Promise.all([
      HazardReport.find().select('status severity hazardType credibilityScore location.district').lean(),
      User.find({ 'hazardStats.reportsSubmitted': { $gt: 0 } })
        .select('name role trustScore hazardStats')
        .sort({ trustScore: -1, 'hazardStats.reportsVerified': -1 })
        .limit(5)
        .lean(),
    ]);

    const stats = {
      total: allReports.length,
      pending: allReports.filter((r) => r.status === 'Pending').length,
      communityVerified: allReports.filter((r) => r.status === 'Community Verified').length,
      verified: allReports.filter((r) => r.status === 'Verified').length,
      resolved: allReports.filter((r) => r.status === 'Resolved').length,
      rejected: allReports.filter((r) => r.status === 'Rejected').length,
      criticalActive: allReports.filter(
        (r) =>
          (r.severity === 'Critical' || r.severity === 'High') &&
          !['Resolved', 'Rejected'].includes(r.status)
      ).length,
      avgCredibility:
        allReports.length > 0
          ? Math.round(
              allReports.reduce((sum, r) => sum + (r.credibilityScore || 0), 0) /
                allReports.length
            )
          : 0,
    };

    const leaderboard = topReportersRaw.map((u) => ({
      _id: u._id,
      name: u.name,
      role: u.role,
      trustScore: clampScore(u.trustScore ?? 50),
      trustTier: getTrustTier(u.trustScore ?? 50),
      hazardStats: u.hazardStats || {
        reportsSubmitted: 0,
        reportsVerified: 0,
        reportsFlaggedFake: 0,
        verificationsCast: 0,
      },
    }));

    return res.status(200).json({
      success: true,
      stats,
      leaderboard,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to compute hazard statistics.',
    });
  }
};

const getMyTrustProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'name email role trustScore hazardStats'
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const score = clampScore(user.trustScore ?? 50);
    const myReports = await HazardReport.find({ reporter: user._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      trustProfile: {
        userId: user._id,
        name: user.name,
        role: user.role,
        trustScore: score,
        trustTier: getTrustTier(score),
        hazardStats: user.hazardStats || {
          reportsSubmitted: 0,
          reportsVerified: 0,
          reportsFlaggedFake: 0,
          verificationsCast: 0,
        },
      },
      reports: myReports.map((r) => formatReportResponse(r, user._id)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve trust profile.',
    });
  }
};

const getHazardReportById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hazard report ID.',
      });
    }

    const report = await HazardReport.findById(id)
      .populate('reporter', 'name role trustScore hazardStats')
      .populate('verifiedBy', 'name role');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Hazard report not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: formatReportResponse(report, req.user?._id),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load hazard report.',
    });
  }
};

const toggleUpvoteHazard = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hazard report ID.',
      });
    }

    const report = await HazardReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Hazard report not found.',
      });
    }

    if (String(report.reporter) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot upvote your own hazard report.',
      });
    }

    if (report.status === 'Rejected') {
      return res.status(400).json({
        success: false,
        message: 'Cannot upvote a rejected report.',
      });
    }

    const reporter = await User.findById(report.reporter);
    const existingIdx = report.upvotes.findIndex(
      (uid) => String(uid) === String(req.user._id)
    );

    let action = 'upvoted';
    if (existingIdx >= 0) {
      report.upvotes.splice(existingIdx, 1);
      action = 'removed';
      if (reporter) {
        reporter.trustScore = clampScore(
          (reporter.trustScore ?? 50) - TRUST_DELTAS.UPVOTE_RECEIVED
        );
      }
    } else {
      report.upvotes.push(req.user._id);
      if (reporter) {
        reporter.trustScore = clampScore(
          (reporter.trustScore ?? 50) + TRUST_DELTAS.UPVOTE_RECEIVED
        );
      }
    }

    if (
      !report.communityVerifyAwarded &&
      report.status === 'Pending' &&
      (report.upvotes.length >= 3 ||
        report.upvotes.length + report.verifications.length >= 4)
    ) {
      report.status = 'Community Verified';
      report.communityVerifyAwarded = true;
      if (reporter) {
        reporter.trustScore = clampScore(
          (reporter.trustScore ?? 50) + TRUST_DELTAS.COMMUNITY_VERIFIED_BONUS
        );
        if (!reporter.hazardStats) {
          reporter.hazardStats = {
            reportsSubmitted: 0,
            reportsVerified: 0,
            reportsFlaggedFake: 0,
            verificationsCast: 0,
          };
        }
        reporter.hazardStats.reportsVerified += 1;
      }
    }

    const reporterScore = reporter ? reporter.trustScore : report.reporterTrustSnapshot;
    if (reporter) {
      report.reporterTrustSnapshot = reporterScore;
      await reporter.save();
    }

    recomputeReportCredibility(report, reporterScore);
    await report.save();

    const populated = await HazardReport.findById(report._id)
      .populate('reporter', 'name role trustScore hazardStats')
      .populate('verifiedBy', 'name role');

    const formatted = formatReportResponse(populated, req.user._id);
    broadcastSocket(req, 'hazardReport:updated', formatted);

    return res.status(200).json({
      success: true,
      action,
      message:
        action === 'upvoted'
          ? 'Upvote recorded and reporter trust updated.'
          : 'Upvote removed.',
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update upvote.',
    });
  }
};

const verifyHazardReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hazard report ID.',
      });
    }

    const report = await HazardReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Hazard report not found.',
      });
    }

    if (String(report.reporter) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot verify your own hazard report.',
      });
    }

    if (report.status === 'Rejected') {
      return res.status(400).json({
        success: false,
        message: 'Rejected reports cannot be verified directly.',
      });
    }

    const alreadyVerified = report.verifications.some(
      (v) => String(v.user) === String(req.user._id)
    );
    if (alreadyVerified) {
      return res.status(409).json({
        success: false,
        message: 'You have already verified this hazard report.',
      });
    }

    report.verifications.push({
      user: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      note: note ? String(note).trim() : '',
      verifiedAt: new Date(),
    });

    const verifier = await User.findById(req.user._id);
    if (verifier) {
      if (!verifier.hazardStats) {
        verifier.hazardStats = {
          reportsSubmitted: 0,
          reportsVerified: 0,
          reportsFlaggedFake: 0,
          verificationsCast: 0,
        };
      }
      verifier.hazardStats.verificationsCast += 1;
      verifier.trustScore = clampScore(
        (verifier.trustScore ?? 50) + TRUST_DELTAS.VERIFICATION_CAST
      );
      await verifier.save();
    }

    const reporter = await User.findById(report.reporter);
    const isOfficial = OFFICIAL_ROLES.includes(req.user.role);

    if (isOfficial) {
      report.status = 'Verified';
      report.verifiedBy = req.user._id;
      report.verifiedAt = new Date();
      if (!report.officialVerifyAwarded && reporter) {
        report.officialVerifyAwarded = true;
        reporter.trustScore = clampScore(
          (reporter.trustScore ?? 50) + TRUST_DELTAS.OFFICIAL_VERIFIED_BONUS
        );
        if (!report.communityVerifyAwarded) {
          if (!reporter.hazardStats) {
            reporter.hazardStats = {
              reportsSubmitted: 0,
              reportsVerified: 0,
              reportsFlaggedFake: 0,
              verificationsCast: 0,
            };
          }
          reporter.hazardStats.reportsVerified += 1;
        }
      }
    } else if (
      report.status === 'Pending' &&
      (report.verifications.length >= 2 ||
        report.verifications.length + report.upvotes.length >= 3)
    ) {
      report.status = 'Community Verified';
      if (!report.communityVerifyAwarded && reporter) {
        report.communityVerifyAwarded = true;
        reporter.trustScore = clampScore(
          (reporter.trustScore ?? 50) + TRUST_DELTAS.COMMUNITY_VERIFIED_BONUS
        );
        if (!reporter.hazardStats) {
          reporter.hazardStats = {
            reportsSubmitted: 0,
            reportsVerified: 0,
            reportsFlaggedFake: 0,
            verificationsCast: 0,
          };
        }
        reporter.hazardStats.reportsVerified += 1;
      }
    }

    const reporterScore = reporter ? reporter.trustScore : report.reporterTrustSnapshot;
    if (reporter) {
      report.reporterTrustSnapshot = reporterScore;
      await reporter.save();
    }

    recomputeReportCredibility(report, reporterScore);
    await report.save();

    const populated = await HazardReport.findById(report._id)
      .populate('reporter', 'name role trustScore hazardStats')
      .populate('verifiedBy', 'name role');

    const formatted = formatReportResponse(populated, req.user._id);
    broadcastSocket(req, 'hazardReport:updated', formatted);

    await safeNotify(req, {
      type: 'weather',
      title: `Hazard Report ${isOfficial ? 'Officially Verified' : 'Community Verified'}`,
      message: `Your hazard report "${report.title}" was verified by ${req.user.name}. Your trust score is now ${reporterScore}/100.`,
      recipientUserId: report.reporter,
      relatedId: report._id,
      relatedType: 'HazardReport',
    });

    return res.status(200).json({
      success: true,
      message: isOfficial
        ? 'Hazard report officially verified and reporter trust boosted.'
        : 'Verification recorded. Community consensus updated.',
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify hazard report.',
    });
  }
};

const flagFakeHazardReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hazard report ID.',
      });
    }

    const report = await HazardReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Hazard report not found.',
      });
    }

    if (String(report.reporter) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot flag your own report.',
      });
    }

    const alreadyFlagged = report.fakeFlags.some(
      (f) => String(f.user) === String(req.user._id)
    );
    if (alreadyFlagged) {
      return res.status(409).json({
        success: false,
        message: 'You have already flagged this report.',
      });
    }

    report.fakeFlags.push({
      user: req.user._id,
      userName: req.user.name,
      reason: reason ? String(reason).trim() : 'Suspected inaccurate or fake hazard',
      flaggedAt: new Date(),
    });

    const reporter = await User.findById(report.reporter);

    if (
      report.fakeFlags.length >= 3 &&
      report.status !== 'Verified' &&
      report.status !== 'Resolved'
    ) {
      report.status = 'Rejected';
      if (!report.fakePenaltyApplied && reporter) {
        report.fakePenaltyApplied = true;
        reporter.trustScore = clampScore(
          (reporter.trustScore ?? 50) + TRUST_DELTAS.FAKE_THRESHOLD_PENALTY
        );
        if (!reporter.hazardStats) {
          reporter.hazardStats = {
            reportsSubmitted: 0,
            reportsVerified: 0,
            reportsFlaggedFake: 0,
            verificationsCast: 0,
          };
        }
        reporter.hazardStats.reportsFlaggedFake += 1;
      }
    }

    const reporterScore = reporter ? reporter.trustScore : report.reporterTrustSnapshot;
    if (reporter) {
      report.reporterTrustSnapshot = reporterScore;
      await reporter.save();
    }

    recomputeReportCredibility(report, reporterScore);
    await report.save();

    const populated = await HazardReport.findById(report._id)
      .populate('reporter', 'name role trustScore hazardStats')
      .populate('verifiedBy', 'name role');

    const formatted = formatReportResponse(populated, req.user._id);
    broadcastSocket(req, 'hazardReport:updated', formatted);

    return res.status(200).json({
      success: true,
      message:
        report.status === 'Rejected'
          ? 'Report flagged and automatically rejected due to multiple fake reports.'
          : 'Fake report flag recorded for moderation.',
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to flag hazard report.',
    });
  }
};

const updateHazardStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hazard report ID.',
      });
    }

    if (!HazardReport.VALID_REPORT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${HazardReport.VALID_REPORT_STATUSES.join(', ')}`,
      });
    }

    const report = await HazardReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Hazard report not found.',
      });
    }

    const reporter = await User.findById(report.reporter);
    const previousStatus = report.status;
    report.status = status;

    if (resolutionNote !== undefined) {
      report.resolutionNote = String(resolutionNote).trim();
    }

    if (status === 'Verified') {
      report.verifiedBy = req.user._id;
      report.verifiedAt = new Date();
      if (!report.officialVerifyAwarded && reporter) {
        report.officialVerifyAwarded = true;
        reporter.trustScore = clampScore(
          (reporter.trustScore ?? 50) + TRUST_DELTAS.OFFICIAL_VERIFIED_BONUS
        );
        if (!report.communityVerifyAwarded) {
          if (!reporter.hazardStats) {
            reporter.hazardStats = {
              reportsSubmitted: 0,
              reportsVerified: 0,
              reportsFlaggedFake: 0,
              verificationsCast: 0,
            };
          }
          reporter.hazardStats.reportsVerified += 1;
        }
      }
      if (report.fakePenaltyApplied && reporter) {
        report.fakePenaltyApplied = false;
        reporter.trustScore = clampScore(
          (reporter.trustScore ?? 50) - TRUST_DELTAS.OFFICIAL_REJECTED_PENALTY
        );
      }
    } else if (status === 'Rejected') {
      if (!report.fakePenaltyApplied && reporter) {
        report.fakePenaltyApplied = true;
        reporter.trustScore = clampScore(
          (reporter.trustScore ?? 50) + TRUST_DELTAS.OFFICIAL_REJECTED_PENALTY
        );
        if (!reporter.hazardStats) {
          reporter.hazardStats = {
            reportsSubmitted: 0,
            reportsVerified: 0,
            reportsFlaggedFake: 0,
            verificationsCast: 0,
          };
        }
        reporter.hazardStats.reportsFlaggedFake += 1;
      }
    } else if (previousStatus === 'Rejected' && report.fakePenaltyApplied && reporter) {
      report.fakePenaltyApplied = false;
      reporter.trustScore = clampScore(
        (reporter.trustScore ?? 50) - TRUST_DELTAS.OFFICIAL_REJECTED_PENALTY
      );
    }

    const reporterScore = reporter ? reporter.trustScore : report.reporterTrustSnapshot;
    if (reporter) {
      report.reporterTrustSnapshot = reporterScore;
      await reporter.save();
    }

    recomputeReportCredibility(report, reporterScore);
    await report.save();

    const populated = await HazardReport.findById(report._id)
      .populate('reporter', 'name role trustScore hazardStats')
      .populate('verifiedBy', 'name role');

    const formatted = formatReportResponse(populated, req.user._id);
    broadcastSocket(req, 'hazardReport:updated', formatted);

    return res.status(200).json({
      success: true,
      message: `Hazard report status updated to ${status}.`,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update hazard status.',
    });
  }
};

const deleteHazardReport = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hazard report ID.',
      });
    }

    const report = await HazardReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Hazard report not found.',
      });
    }

    const isOwner = String(report.reporter) === String(req.user._id);
    const isAdmin = req.user.role === 'Admin';

    if (!isAdmin && !(isOwner && report.status === 'Pending')) {
      return res.status(403).json({
        success: false,
        message: 'Only Admins or the reporter (while Pending) can delete this hazard report.',
      });
    }

    if (report.photoUrl && report.photoUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', report.photoUrl);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.error('Could not remove hazard photo:', unlinkErr.message);
        }
      }
    }

    await HazardReport.findByIdAndDelete(id);
    broadcastSocket(req, 'hazardReport:deleted', { id });

    return res.status(200).json({
      success: true,
      message: 'Hazard report deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete hazard report.',
    });
  }
};

module.exports = {
  createHazardReport,
  getAllHazardReports,
  getNearbyHazardReports,
  getHazardStats,
  getMyTrustProfile,
  getHazardReportById,
  toggleUpvoteHazard,
  verifyHazardReport,
  flagFakeHazardReport,
  updateHazardStatus,
  deleteHazardReport,
  recomputeReportCredibility,
  formatReportResponse,
};
