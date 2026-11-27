const Donation = require('../models/Donation');
const Resource = require('../models/Resource');
const DistributionRecord = require('../models/DistributionRecord');

let Shelter = null;
try {
  Shelter = require('../models/Shelter');
} catch {
  Shelter = null;
}

const generateUniqueReceiptNo = async () => {
  for (let i = 0; i < 10; i++) {
    const code = Math.floor(100000 + Math.random() * 900000);
    const receiptNo = `DON-2026-${code}`;
    const existing = await Donation.findOne({ receiptNo }).select('_id').lean();
    if (!existing) return receiptNo;
  }
  return `DON-2026-${Date.now().toString().slice(-6)}`;
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

const createDonation = async (req, res) => {
  try {
    const {
      donationType,
      amountBDT,
      paymentMethod,
      transactionRef,
      supplyDetails,
      targetDistrict,
      targetShelterId,
      targetResourceId,
      notes,
    } = req.body;

    const resolvedType = donationType === 'Supplies' ? 'Supplies' : 'Monetary';
    const districtVal = targetDistrict && targetDistrict.trim() ? targetDistrict.trim() : 'General Relief Fund';

    let finalAmount = 0;
    let finalPayment = paymentMethod || 'bKash';
    let finalSupply = {
      category: 'Food',
      itemName: '',
      quantity: 0,
      unit: '',
    };

    if (resolvedType === 'Monetary') {
      const parsedAmount = Number(amountBDT);
      if (isNaN(parsedAmount) || parsedAmount < 10) {
        return res.status(400).json({
          success: false,
          message: 'Minimum monetary donation is 10 BDT.',
        });
      }
      finalAmount = Math.round(parsedAmount);
      if (!['bKash', 'Nagad', 'Bank Transfer', 'Card'].includes(finalPayment)) {
        finalPayment = 'bKash';
      }
    } else {
      const itemName = supplyDetails?.itemName ? String(supplyDetails.itemName).trim() : '';
      const qty = parseInt(supplyDetails?.quantity, 10);
      const unit = supplyDetails?.unit ? String(supplyDetails.unit).trim() : 'units';
      const category = supplyDetails?.category || 'Food';

      if (!itemName || isNaN(qty) || qty < 1) {
        return res.status(400).json({
          success: false,
          message: 'Supply item name and quantity (at least 1) are required.',
        });
      }

      finalPayment = 'Direct Supply';
      finalSupply = {
        category,
        itemName,
        quantity: qty,
        unit,
      };
    }

    let resolvedShelterId = null;
    let resolvedShelterName = '';
    if (targetShelterId && Shelter) {
      try {
        const shelterDoc = await Shelter.findById(targetShelterId).lean();
        if (shelterDoc) {
          resolvedShelterId = shelterDoc._id;
          resolvedShelterName = shelterDoc.name;
        }
      } catch {
      }
    }

    let resolvedResourceId = null;
    let initialStatus = 'Confirmed';
    if (resolvedType === 'Supplies' && targetResourceId) {
      try {
        const resourceDoc = await Resource.findById(targetResourceId);
        if (resourceDoc) {
          resourceDoc.quantityAvailable += finalSupply.quantity;
          resourceDoc.totalReceived += finalSupply.quantity;
          resourceDoc.donor.name = req.user.name;
          await resourceDoc.save();
          resolvedResourceId = resourceDoc._id;
          initialStatus = 'Allocated';

          broadcastSocket(req, 'resource:restocked', {
            resourceId: resourceDoc._id,
            name: resourceDoc.name,
            added: finalSupply.quantity,
            newAvailable: resourceDoc.quantityAvailable,
            status: resourceDoc.status,
          });
        }
      } catch {
      }
    }

    const receiptNo = await generateUniqueReceiptNo();

    const donation = new Donation({
      receiptNo,
      donor: req.user._id,
      donorName: req.user.name,
      donorEmail: req.user.email,
      donationType: resolvedType,
      amountBDT: finalAmount,
      paymentMethod: finalPayment,
      transactionRef: transactionRef ? String(transactionRef).trim() : '',
      supplyDetails: finalSupply,
      targetDistrict: districtVal,
      targetShelter: resolvedShelterId,
      targetShelterName: resolvedShelterName,
      targetResource: resolvedResourceId,
      status: initialStatus,
      notes: notes ? String(notes).trim() : '',
    });

    await donation.save();

    broadcastSocket(req, 'donation:created', {
      receiptNo: donation.receiptNo,
      donorName: donation.donorName,
      donationType: donation.donationType,
      amountBDT: donation.amountBDT,
      targetDistrict: donation.targetDistrict,
    });

    return res.status(201).json({
      success: true,
      message: `Thank you! Your contribution has been recorded (Receipt: ${donation.receiptNo}).`,
      donation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to record donation.',
    });
  }
};

const getMyDonations = async (req, res) => {
  try {
    const donations = await Donation.find({ donor: req.user._id })
      .sort({ donatedAt: -1 })
      .lean();

    let totalMonetaryBDT = 0;
    let totalSupplyUnits = 0;
    donations.forEach((d) => {
      if (d.donationType === 'Monetary') {
        totalMonetaryBDT += d.amountBDT || 0;
      } else {
        totalSupplyUnits += d.supplyDetails?.quantity || 0;
      }
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalDonations: donations.length,
        totalMonetaryBDT,
        totalSupplyUnits,
      },
      donations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve your donation history.',
    });
  }
};

const getDonorOverview = async (req, res) => {
  try {
    const [resources, distributions, allDonations] = await Promise.all([
      Resource.find().lean(),
      DistributionRecord.find().sort({ distributionDate: -1 }).limit(8).lean(),
      Donation.find().select('donationType amountBDT supplyDetails').lean(),
    ]);

    let totalAvailableStock = 0;
    let totalDistributedStock = 0;
    const urgentNeeds = [];
    const categoryTotals = {};

    resources.forEach((r) => {
      totalAvailableStock += r.quantityAvailable || 0;
      totalDistributedStock += r.totalDistributed || 0;

      if (!categoryTotals[r.category]) {
        categoryTotals[r.category] = { category: r.category, available: 0, distributed: 0 };
      }
      categoryTotals[r.category].available += r.quantityAvailable || 0;
      categoryTotals[r.category].distributed += r.totalDistributed || 0;

      if (r.status === 'Low Stock' || r.status === 'Out of Stock') {
        urgentNeeds.push({
          _id: r._id,
          name: r.name,
          category: r.category,
          unit: r.unit,
          quantityAvailable: r.quantityAvailable,
          thresholdLowStock: r.thresholdLowStock,
          status: r.status,
          district: r.warehouse?.district || 'Central Hub',
          warehouseName: r.warehouse?.name || 'Central Relief Hub',
        });
      }
    });

    let totalPlatformFundingBDT = 0;
    allDonations.forEach((d) => {
      if (d.donationType === 'Monetary') {
        totalPlatformFundingBDT += d.amountBDT || 0;
      }
    });

    const totalBeneficiariesReached = distributions.reduce(
      (sum, d) => sum + (d.beneficiaryCount || 0),
      0
    );

    const allDistCount = await DistributionRecord.countDocuments();
    const openSheltersCount = Shelter ? await Shelter.countDocuments({ status: 'Open' }) : 0;

    return res.status(200).json({
      success: true,
      overview: {
        totalAvailableStock,
        totalDistributedStock,
        totalDistributionsCount: allDistCount,
        totalBeneficiariesReached,
        totalPlatformFundingBDT,
        totalPlatformDonations: allDonations.length,
        openSheltersCount,
        urgentNeedsCount: urgentNeeds.length,
        urgentNeeds,
        categoryBreakdown: Object.values(categoryTotals),
        recentDistributions: distributions,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load donor impact overview.',
    });
  }
};

const getAllDonations = async (req, res) => {
  try {
    const donations = await Donation.find().sort({ donatedAt: -1 }).limit(100).lean();
    return res.status(200).json({
      success: true,
      count: donations.length,
      donations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch donations.',
    });
  }
};

const updateDonationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Confirmed', 'Allocated', 'Delivered'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid donation status.',
      });
    }

    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Donation ${donation.receiptNo} marked as ${status}.`,
      donation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update donation status.',
    });
  }
};

module.exports = {
  createDonation,
  getMyDonations,
  getDonorOverview,
  getAllDonations,
  updateDonationStatus,
};
