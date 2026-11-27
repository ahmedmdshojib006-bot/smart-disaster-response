const crypto = require('crypto');
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const Household = require('../models/Household');
const HouseholdDistribution = require('../models/HouseholdDistribution');

let Resource = null;
try {
  Resource = require('../models/Resource');
} catch (err) {
  Resource = null;
}

const DEFAULT_ROUNDS = [
  'Round 1 - Emergency Food & Water',
  'Round 2 - Medical & Hygiene Kit',
  'Round 3 - Shelter & Blankets',
];

const getHmacSecret = () => {
  return process.env.QR_SECRET || process.env.JWT_SECRET || 'reliefsync-household-secret';
};

const generateSignature = (householdId) => {
  return crypto
    .createHmac('sha256', getHmacSecret())
    .update(String(householdId).trim().toUpperCase())
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
};

const buildQrPayload = (householdId, signature) => {
  return `RELIEFSYNC:HH:${householdId}:${signature}`;
};

const parseQrInput = (rawInput) => {
  if (!rawInput || typeof rawInput !== 'string') {
    return { householdId: null, signature: null };
  }

  const trimmed = rawInput.trim();

  if (trimmed.toUpperCase().startsWith('RELIEFSYNC:HH:')) {
    const parts = trimmed.split(':');
    return {
      householdId: parts[2] ? parts[2].trim().toUpperCase() : null,
      signature: parts[3] ? parts[3].trim().toUpperCase() : null,
    };
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        householdId: parsed.householdId ? String(parsed.householdId).trim().toUpperCase() : null,
        signature: parsed.signature ? String(parsed.signature).trim().toUpperCase() : null,
      };
    } catch {
      return { householdId: null, signature: null };
    }
  }

  return {
    householdId: trimmed.toUpperCase(),
    signature: null,
  };
};

const buildDistrictPrefix = (district) => {
  const letters = String(district || 'BD')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  if (letters.length >= 3) return letters.slice(0, 3);
  return letters.padEnd(3, 'X');
};

const generateUniqueHouseholdId = async (district) => {
  const prefix = buildDistrictPrefix(district);
  for (let attempt = 0; attempt < 15; attempt++) {
    const code = Math.floor(1000 + Math.random() * 9000);
    const candidate = `HH-${prefix}-${code}`;
    const existing = await Household.findOne({ householdId: candidate }).select('_id').lean();
    if (!existing) {
      return candidate;
    }
  }
  const fallbackSuffix = Date.now().toString().slice(-6);
  return `HH-${prefix}-${fallbackSuffix}`;
};

const generateQrDataUrl = async (payload) => {
  return QRCode.toDataURL(payload, {
    width: 320,
    margin: 2,
    color: {
      dark: '#1a237e',
      light: '#ffffff',
    },
  });
};

const broadcastSocket = (req, event, data) => {
  try {
    const io = req.app ? req.app.get('io') : null;
    if (io) {
      io.emit(event, data);
    }
  } catch (err) {
    console.error(`Socket broadcast error for ${event}:`, err.message);
  }
};

const registerHousehold = async (req, res) => {
  try {
    const {
      headName,
      phone,
      nationalId,
      memberCount,
      vulnerabilities,
      address,
      district,
      villageOrWard,
      unionOrMunicipality,
      upazila,
    } = req.body;

    const resolvedDistrict = (address?.district || district || '').trim();
    if (!headName || !headName.trim() || !phone || !phone.trim() || !resolvedDistrict) {
      return res.status(400).json({
        success: false,
        message: 'Household head name, contact phone, and district are required.',
      });
    }

    const membersNum = parseInt(memberCount, 10);
    if (isNaN(membersNum) || membersNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Member count must be at least 1.',
      });
    }

    const cleanPhone = phone.trim();
    const cleanNid = nationalId && nationalId.trim() ? nationalId.trim() : undefined;

    const duplicateQuery = [{ phone: cleanPhone }];
    if (cleanNid) {
      duplicateQuery.push({ nationalId: cleanNid });
    }

    const existingHousehold = await Household.findOne({ $or: duplicateQuery }).lean();
    if (existingHousehold) {
      return res.status(409).json({
        success: false,
        message: `A household with this phone number or National ID is already registered (${existingHousehold.householdId}).`,
        existingHouseholdId: existingHousehold.householdId,
      });
    }

    const householdId = await generateUniqueHouseholdId(resolvedDistrict);
    const verificationHash = generateSignature(householdId);
    const qrPayload = buildQrPayload(householdId, verificationHash);
    const qrCodeDataUrl = await generateQrDataUrl(qrPayload);

    const household = new Household({
      householdId,
      headName: headName.trim(),
      phone: cleanPhone,
      nationalId: cleanNid,
      memberCount: membersNum,
      vulnerabilities: {
        children: Math.max(0, parseInt(vulnerabilities?.children, 10) || 0),
        elderly: Math.max(0, parseInt(vulnerabilities?.elderly, 10) || 0),
        pregnantWomen: Math.max(0, parseInt(vulnerabilities?.pregnantWomen, 10) || 0),
        disabled: Math.max(0, parseInt(vulnerabilities?.disabled, 10) || 0),
      },
      address: {
        villageOrWard: (address?.villageOrWard || villageOrWard || '').trim(),
        unionOrMunicipality: (address?.unionOrMunicipality || unionOrMunicipality || '').trim(),
        upazila: (address?.upazila || upazila || '').trim(),
        district: resolvedDistrict,
      },
      qrPayload,
      verificationHash,
      qrCodeDataUrl,
      registeredBy: req.user._id,
      registeredByName: req.user.name,
      citizenUser: req.user.role === 'Citizen' ? req.user._id : null,
    });

    await household.save();

    broadcastSocket(req, 'household:registered', {
      householdId: household.householdId,
      headName: household.headName,
      district: household.address.district,
    });

    return res.status(201).json({
      success: true,
      message: `Household registered with ID ${household.householdId}`,
      household,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate household phone number or National ID detected.',
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to register household.',
    });
  }
};

const getAllHouseholds = async (req, res) => {
  try {
    const { search, district, status, round, coverageFilter } = req.query;
    const filter = {};

    if (req.user.role === 'Citizen') {
      filter.$or = [{ citizenUser: req.user._id }, { registeredBy: req.user._id }];
    }

    if (search && search.trim()) {
      const term = search.trim();
      const searchCond = [
        { householdId: { $regex: term, $options: 'i' } },
        { headName: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { 'address.villageOrWard': { $regex: term, $options: 'i' } },
        { 'address.upazila': { $regex: term, $options: 'i' } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchCond }];
        delete filter.$or;
      } else {
        filter.$or = searchCond;
      }
    }

    if (district && district !== 'All') {
      filter['address.district'] = { $regex: district.trim(), $options: 'i' };
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    const households = await Household.find(filter).sort({ createdAt: -1 }).lean();

    const activeRound = round && round.trim() ? round.trim() : DEFAULT_ROUNDS[0];
    const householdIds = households.map((h) => h._id);
    const distributions = await HouseholdDistribution.find({
      household: { $in: householdIds },
      distributionRound: activeRound,
    }).lean();

    const distMap = new Map();
    distributions.forEach((d) => {
      distMap.set(String(d.household), d);
    });

    let enriched = households.map((h) => {
      const distRecord = distMap.get(String(h._id)) || null;
      return {
        ...h,
        receivedInRound: Boolean(distRecord),
        roundDistribution: distRecord,
      };
    });

    if (coverageFilter === 'received') {
      enriched = enriched.filter((h) => h.receivedInRound);
    } else if (coverageFilter === 'missed') {
      enriched = enriched.filter((h) => !h.receivedInRound);
    }

    return res.status(200).json({
      success: true,
      round: activeRound,
      count: enriched.length,
      households: enriched,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve households.',
    });
  }
};

const getDistributionCoverage = async (req, res) => {
  try {
    const { round, district } = req.query;
    const activeRound = round && round.trim() ? round.trim() : DEFAULT_ROUNDS[0];

    const householdFilter = { status: 'Active' };
    if (district && district !== 'All') {
      householdFilter['address.district'] = { $regex: district.trim(), $options: 'i' };
    }

    const activeHouseholds = await Household.find(householdFilter).sort({ 'address.district': 1, householdId: 1 }).lean();
    const householdIds = activeHouseholds.map((h) => h._id);

    const distributions = await HouseholdDistribution.find({
      household: { $in: householdIds },
      distributionRound: activeRound,
    })
      .sort({ distributedAt: -1 })
      .lean();

    const distributedSet = new Set(distributions.map((d) => String(d.household)));

    const coveredHouseholds = [];
    const missedHouseholds = [];
    let totalPeopleCovered = 0;
    let totalPeopleMissed = 0;

    activeHouseholds.forEach((h) => {
      if (distributedSet.has(String(h._id))) {
        coveredHouseholds.push(h);
        totalPeopleCovered += h.memberCount || 0;
      } else {
        missedHouseholds.push(h);
        totalPeopleMissed += h.memberCount || 0;
      }
    });

    const totalHouseholds = activeHouseholds.length;
    const coveragePercent = totalHouseholds > 0 ? Math.round((coveredHouseholds.length / totalHouseholds) * 100) : 0;

    const districtSummaryMap = {};
    activeHouseholds.forEach((h) => {
      const dist = h.address?.district || 'Unknown';
      if (!districtSummaryMap[dist]) {
        districtSummaryMap[dist] = { district: dist, total: 0, covered: 0, missed: 0 };
      }
      districtSummaryMap[dist].total += 1;
      if (distributedSet.has(String(h._id))) {
        districtSummaryMap[dist].covered += 1;
      } else {
        districtSummaryMap[dist].missed += 1;
      }
    });

    return res.status(200).json({
      success: true,
      round: activeRound,
      summary: {
        totalHouseholds,
        coveredCount: coveredHouseholds.length,
        missedCount: missedHouseholds.length,
        coveragePercent,
        totalPeopleCovered,
        totalPeopleMissed,
      },
      districtBreakdown: Object.values(districtSummaryMap),
      missedHouseholds,
      recentDistributions: distributions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate relief coverage metrics.',
    });
  }
};

const getAvailableRounds = async (req, res) => {
  try {
    const dbRounds = await HouseholdDistribution.distinct('distributionRound');
    const combined = Array.from(new Set([...DEFAULT_ROUNDS, ...dbRounds.filter(Boolean)]));
    return res.status(200).json({
      success: true,
      rounds: combined,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch relief rounds.',
    });
  }
};

const findAndVerifyHousehold = async (qrData, householdIdParam) => {
  const rawInput = qrData || householdIdParam;
  const parsed = parseQrInput(rawInput);

  if (!parsed.householdId) {
    return { errorStatus: 400, errorMessage: 'Invalid QR code or Household ID format.' };
  }

  const household = await Household.findOne({ householdId: parsed.householdId }).lean();
  if (!household) {
    return { errorStatus: 404, errorMessage: `No registered household found for ID "${parsed.householdId}".` };
  }

  let signatureVerified = true;
  if (parsed.signature) {
    const expectedSig = generateSignature(household.householdId);
    signatureVerified = parsed.signature === expectedSig && parsed.signature === household.verificationHash;
    if (!signatureVerified) {
      return {
        errorStatus: 403,
        errorMessage: 'QR code verification failed: invalid or tampered cryptographic signature.',
      };
    }
  }

  return { household, signatureVerified, scanMethodDetected: parsed.signature ? 'QR Scan' : 'Manual ID' };
};

const verifyHouseholdScan = async (req, res) => {
  try {
    const { qrData, householdId, distributionRound } = req.body;
    const activeRound = distributionRound && distributionRound.trim() ? distributionRound.trim() : DEFAULT_ROUNDS[0];

    const lookup = await findAndVerifyHousehold(qrData, householdId);
    if (lookup.errorStatus) {
      return res.status(lookup.errorStatus).json({
        success: false,
        eligible: false,
        message: lookup.errorMessage,
      });
    }

    const { household, signatureVerified } = lookup;

    if (household.status === 'Inactive') {
      return res.status(400).json({
        success: false,
        eligible: false,
        household,
        message: `Household ${household.householdId} is marked as Inactive.`,
      });
    }

    const existingDist = await HouseholdDistribution.findOne({
      household: household._id,
      distributionRound: activeRound,
    }).lean();

    const history = await HouseholdDistribution.find({ household: household._id })
      .sort({ distributedAt: -1 })
      .limit(10)
      .lean();

    if (existingDist) {
      return res.status(200).json({
        success: true,
        eligible: false,
        isDuplicate: true,
        signatureVerified,
        round: activeRound,
        message: `DUPLICATE BLOCKED: Household ${household.householdId} (${household.headName}) already received relief for "${activeRound}".`,
        household,
        existingDistribution: existingDist,
        history,
      });
    }

    return res.status(200).json({
      success: true,
      eligible: true,
      isDuplicate: false,
      signatureVerified,
      round: activeRound,
      message: `VERIFIED ELIGIBLE: Household ${household.householdId} (${household.headName}) has not received "${activeRound}".`,
      household,
      history,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error verifying household QR code.',
    });
  }
};

const distributeToHousehold = async (req, res) => {
  try {
    const {
      qrData,
      householdId,
      distributionRound,
      itemsProvided,
      resourceId,
      resourceQuantity,
      distributionCenter,
      scanMethod,
      notes,
    } = req.body;

    const activeRound = distributionRound && distributionRound.trim() ? distributionRound.trim() : DEFAULT_ROUNDS[0];

    const lookup = await findAndVerifyHousehold(qrData, householdId);
    if (lookup.errorStatus) {
      return res.status(lookup.errorStatus).json({
        success: false,
        message: lookup.errorMessage,
      });
    }

    const { household } = lookup;

    if (household.status === 'Inactive') {
      return res.status(400).json({
        success: false,
        message: `Household ${household.householdId} is inactive and cannot receive relief.`,
      });
    }

    const existingDist = await HouseholdDistribution.findOne({
      household: household._id,
      distributionRound: activeRound,
    }).lean();

    if (existingDist) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: `Duplicate distribution blocked: Household ${household.householdId} already received "${activeRound}" on ${new Date(existingDist.distributedAt).toLocaleString()}.`,
        existingDistribution: existingDist,
      });
    }

    let deductedQty = 0;
    let linkedResourceId = null;
    const normalizedItems = Array.isArray(itemsProvided)
      ? itemsProvided
          .filter((item) => item && item.itemName && Number(item.quantity) > 0)
          .map((item) => ({
            itemName: String(item.itemName).trim(),
            quantity: parseInt(item.quantity, 10),
            unit: item.unit ? String(item.unit).trim() : 'units',
          }))
      : [];

    if (resourceId && Resource) {
      const qtyToDeduct = Math.max(1, parseInt(resourceQuantity, 10) || 1);
      const resourceDoc = await Resource.findById(resourceId);
      if (!resourceDoc) {
        return res.status(404).json({
          success: false,
          message: 'Selected relief inventory item not found.',
        });
      }
      if (resourceDoc.quantityAvailable < qtyToDeduct) {
        return res.status(400).json({
          success: false,
          message: `Insufficient inventory stock for ${resourceDoc.name}. Available: ${resourceDoc.quantityAvailable} ${resourceDoc.unit}.`,
        });
      }
      resourceDoc.quantityAvailable -= qtyToDeduct;
      resourceDoc.totalDistributed = (resourceDoc.totalDistributed || 0) + qtyToDeduct;
      await resourceDoc.save();
      deductedQty = qtyToDeduct;
      linkedResourceId = resourceDoc._id;

      if (normalizedItems.length === 0) {
        normalizedItems.push({
          itemName: resourceDoc.name,
          quantity: qtyToDeduct,
          unit: resourceDoc.unit,
        });
      }
    }

    if (normalizedItems.length === 0) {
      normalizedItems.push({
        itemName: 'Standard Family Relief Kit',
        quantity: 1,
        unit: 'kit',
      });
    }

    const distribution = new HouseholdDistribution({
      household: household._id,
      householdIdCode: household.householdId,
      headName: household.headName,
      distributionRound: activeRound,
      itemsProvided: normalizedItems,
      resource: linkedResourceId,
      resourceQuantityDeducted: deductedQty,
      distributedBy: req.user._id,
      distributedByName: req.user.name,
      distributedByRole: req.user.role,
      distributionCenter: distributionCenter ? distributionCenter.trim() : '',
      district: household.address?.district || '',
      scanMethod: ['QR Camera', 'QR Image', 'Manual ID'].includes(scanMethod) ? scanMethod : 'Manual ID',
      notes: notes ? notes.trim() : '',
    });

    await distribution.save();

    await Household.findByIdAndUpdate(household._id, {
      $inc: { totalDistributionsReceived: 1 },
      $set: { lastDistributedAt: distribution.distributedAt },
    });

    broadcastSocket(req, 'household:distributed', {
      householdId: household.householdId,
      headName: household.headName,
      round: activeRound,
      district: household.address?.district,
      distributedBy: req.user.name,
    });

    return res.status(201).json({
      success: true,
      message: `Relief distribution confirmed for ${household.householdId} (${household.headName}).`,
      distribution,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: 'Duplicate distribution blocked by database uniqueness safeguard.',
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to record household relief distribution.',
    });
  }
};

const getHouseholdById = async (req, res) => {
  try {
    const idParam = req.params.id;
    let query;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
      query = { $or: [{ _id: idParam }, { householdId: idParam.toUpperCase() }] };
    } else {
      query = { householdId: idParam.toUpperCase() };
    }

    const household = await Household.findOne(query);
    if (!household) {
      return res.status(404).json({
        success: false,
        message: 'Household not found.',
      });
    }

    if (
      req.user.role === 'Citizen' &&
      String(household.citizenUser) !== String(req.user._id) &&
      String(household.registeredBy) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this household record.',
      });
    }

    if (!household.qrCodeDataUrl) {
      household.qrCodeDataUrl = await generateQrDataUrl(household.qrPayload);
      await household.save();
    }

    const distributions = await HouseholdDistribution.find({ household: household._id })
      .sort({ distributedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      household,
      distributions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load household details.',
    });
  }
};

const updateHousehold = async (req, res) => {
  try {
    const household = await Household.findById(req.params.id);
    if (!household) {
      return res.status(404).json({
        success: false,
        message: 'Household not found.',
      });
    }

    const { headName, phone, memberCount, vulnerabilities, address, status } = req.body;

    if (headName && headName.trim()) household.headName = headName.trim();
    if (phone && phone.trim()) household.phone = phone.trim();
    if (memberCount !== undefined) {
      const m = parseInt(memberCount, 10);
      if (isNaN(m) || m < 1) {
        return res.status(400).json({ success: false, message: 'Member count must be at least 1.' });
      }
      household.memberCount = m;
    }
    if (vulnerabilities) {
      household.vulnerabilities = {
        children: Math.max(0, parseInt(vulnerabilities.children, 10) || 0),
        elderly: Math.max(0, parseInt(vulnerabilities.elderly, 10) || 0),
        pregnantWomen: Math.max(0, parseInt(vulnerabilities.pregnantWomen, 10) || 0),
        disabled: Math.max(0, parseInt(vulnerabilities.disabled, 10) || 0),
      };
    }
    if (address) {
      if (address.villageOrWard !== undefined) household.address.villageOrWard = address.villageOrWard.trim();
      if (address.unionOrMunicipality !== undefined) household.address.unionOrMunicipality = address.unionOrMunicipality.trim();
      if (address.upazila !== undefined) household.address.upazila = address.upazila.trim();
      if (address.district && address.district.trim()) household.address.district = address.district.trim();
    }
    if (status && ['Active', 'Relocated', 'Inactive'].includes(status)) {
      household.status = status;
    }

    await household.save();

    return res.status(200).json({
      success: true,
      message: 'Household updated successfully.',
      household,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update household.',
    });
  }
};

const deleteHousehold = async (req, res) => {
  try {
    const household = await Household.findByIdAndDelete(req.params.id);
    if (!household) {
      return res.status(404).json({
        success: false,
        message: 'Household not found.',
      });
    }

    await HouseholdDistribution.deleteMany({ household: household._id });

    return res.status(200).json({
      success: true,
      message: 'Household and associated distribution records deleted.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete household.',
    });
  }
};

module.exports = {
  registerHousehold,
  getAllHouseholds,
  getDistributionCoverage,
  getAvailableRounds,
  verifyHouseholdScan,
  distributeToHousehold,
  getHouseholdById,
  updateHousehold,
  deleteHousehold,
  generateSignature,
  buildQrPayload,
  parseQrInput,
};
