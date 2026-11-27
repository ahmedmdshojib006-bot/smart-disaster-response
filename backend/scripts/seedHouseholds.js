require('dotenv').config();
const QRCode = require('qrcode');
const connectDB = require('../config/db');
const Household = require('../models/Household');
const HouseholdDistribution = require('../models/HouseholdDistribution');
const User = require('../models/User');
const { generateSignature, buildQrPayload } = require('../controllers/householdController');

const SAMPLE_HOUSEHOLDS = [
  {
    householdId: 'HH-FEN-1001',
    headName: 'Abdul Karim Mia',
    phone: '01711223301',
    nationalId: '1985123456001',
    memberCount: 6,
    vulnerabilities: { children: 2, elderly: 1, pregnantWomen: 0, disabled: 0 },
    address: { villageOrWard: 'Ward 3, Kazirbag', unionOrMunicipality: 'Feni Sadar', upazila: 'Feni Sadar', district: 'Feni' },
    status: 'Active',
  },
  {
    householdId: 'HH-FEN-1002',
    headName: 'Rokeya Begum',
    phone: '01811223302',
    nationalId: '1991123456002',
    memberCount: 5,
    vulnerabilities: { children: 2, elderly: 0, pregnantWomen: 1, disabled: 0 },
    address: { villageOrWard: 'Paschim Chhagalnaiya', unionOrMunicipality: 'Chhagalnaiya', upazila: 'Chhagalnaiya', district: 'Feni' },
    status: 'Active',
  },
  {
    householdId: 'HH-SYL-2001',
    headName: 'Faruk Ahmed Chowdhury',
    phone: '01911223303',
    nationalId: '1978123456003',
    memberCount: 7,
    vulnerabilities: { children: 3, elderly: 2, pregnantWomen: 0, disabled: 1 },
    address: { villageOrWard: 'Tuker Bazar', unionOrMunicipality: 'Sylhet Sadar', upazila: 'Sylhet Sadar', district: 'Sylhet' },
    status: 'Active',
  },
  {
    householdId: 'HH-SYL-2002',
    headName: 'Momena Khatun',
    phone: '01611223304',
    nationalId: '1988123456004',
    memberCount: 4,
    vulnerabilities: { children: 1, elderly: 1, pregnantWomen: 0, disabled: 0 },
    address: { villageOrWard: 'Jaintapur Char', unionOrMunicipality: 'Jaintapur', upazila: 'Jaintapur', district: 'Sylhet' },
    status: 'Active',
  },
  {
    householdId: 'HH-NOA-3001',
    headName: 'Harun Ur Rashid',
    phone: '01511223305',
    nationalId: '1982123456005',
    memberCount: 5,
    vulnerabilities: { children: 2, elderly: 0, pregnantWomen: 0, disabled: 0 },
    address: { villageOrWard: 'Char Jabbar Ward 5', unionOrMunicipality: 'Subarnachar', upazila: 'Subarnachar', district: 'Noakhali' },
    status: 'Active',
  },
  {
    householdId: 'HH-SUN-4001',
    headName: 'Shirin Akter',
    phone: '01311223306',
    nationalId: '1994123456006',
    memberCount: 4,
    vulnerabilities: { children: 1, elderly: 0, pregnantWomen: 1, disabled: 0 },
    address: { villageOrWard: 'Tahirpur Haorpara', unionOrMunicipality: 'Tahirpur', upazila: 'Tahirpur', district: 'Sunamganj' },
    status: 'Active',
  },
];

const seedHouseholds = async () => {
  try {
    await connectDB();

    const adminUser = await User.findOne({ role: 'Admin' });
    const issuerId = adminUser ? adminUser._id : null;
    const issuerName = adminUser ? adminUser.name : 'System Coordinator';

    let createdCount = 0;

    for (const item of SAMPLE_HOUSEHOLDS) {
      const existing = await Household.findOne({ householdId: item.householdId });
      if (existing) continue;

      const sig = generateSignature(item.householdId);
      const qrPayload = buildQrPayload(item.householdId, sig);
      const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 320,
        margin: 2,
        color: { dark: '#1a237e', light: '#ffffff' },
      });

      const doc = new Household({
        ...item,
        verificationHash: sig,
        qrPayload,
        qrCodeDataUrl,
        registeredBy: issuerId,
        registeredByName: issuerName,
      });

      await doc.save();
      createdCount++;
    }

    if (adminUser) {
      const firstTwo = await Household.find({
        householdId: { $in: ['HH-FEN-1001', 'HH-SYL-2001'] },
      });

      const roundName = 'Round 1 - Emergency Food & Water';
      for (const hh of firstTwo) {
        const alreadyDist = await HouseholdDistribution.findOne({
          household: hh._id,
          distributionRound: roundName,
        });
        if (!alreadyDist) {
          await HouseholdDistribution.create({
            household: hh._id,
            householdIdCode: hh.householdId,
            headName: hh.headName,
            distributionRound: roundName,
            itemsProvided: [
              { itemName: 'Rice & Lentils Pack', quantity: 10, unit: 'kg' },
              { itemName: 'Safe Drinking Water', quantity: 12, unit: 'liters' },
            ],
            distributedBy: adminUser._id,
            distributedByName: adminUser.name,
            distributedByRole: adminUser.role === 'NGO' ? 'NGO' : 'Admin',
            distributionCenter: `${hh.address.district} Central Relief Camp`,
            district: hh.address.district,
            scanMethod: 'QR Camera',
          });
          hh.totalDistributionsReceived += 1;
          hh.lastDistributedAt = new Date();
          await hh.save();
        }
      }
    }

    console.log(`Seeded ${createdCount} households successfully.`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed households:', error.message);
    process.exit(1);
  }
};

seedHouseholds();
