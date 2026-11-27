require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const connectDB = require('../config/db');
const HazardReport = require('../models/HazardReport');
const User = require('../models/User');
const { calculateCredibilityScore } = require('../utils/trustScoreCalculator');

const seedHazardReports = async () => {
  try {
    await connectDB();

    let citizenA = await User.findOne({ email: 'citizen.feni@reliefsync.org' });
    if (!citizenA) {
      citizenA = await User.create({
        name: 'Kamrul Hasan',
        email: 'citizen.feni@reliefsync.org',
        passwordHash: 'Password123!',
        role: 'Citizen',
        trustScore: 86,
        hazardStats: {
          reportsSubmitted: 2,
          reportsVerified: 2,
          reportsFlaggedFake: 0,
          verificationsCast: 4,
        },
      });
    }

    let citizenB = await User.findOne({ email: 'citizen.sylhet@reliefsync.org' });
    if (!citizenB) {
      citizenB = await User.create({
        name: 'Tasnim Akter',
        email: 'citizen.sylhet@reliefsync.org',
        passwordHash: 'Password123!',
        role: 'Citizen',
        trustScore: 68,
        hazardStats: {
          reportsSubmitted: 2,
          reportsVerified: 1,
          reportsFlaggedFake: 0,
          verificationsCast: 2,
        },
      });
    }

    let volunteer = await User.findOne({ role: 'Volunteer' });
    if (!volunteer) {
      volunteer = await User.create({
        name: 'Sajib Rahman',
        email: 'volunteer.hazard@reliefsync.org',
        passwordHash: 'Password123!',
        role: 'Volunteer',
        trustScore: 90,
      });
    }

    const sampleReports = [
      {
        title: 'Feni-Parshuram Highway Submerged Near Fulchhari Bazar',
        hazardType: 'Flooded Road',
        severity: 'Critical',
        description:
          'Approximately 1.2 km stretch of the main evacuation road is under 4.5 feet of fast-moving water. Small trucks and ambulances cannot pass.',
        location: {
          type: 'Point',
          coordinates: [91.4045, 23.0358],
          latitude: 23.0358,
          longitude: 91.4045,
          address: 'Fulchhari Bazar Main Road, Parshuram',
          upazila: 'Parshuram',
          district: 'Feni',
        },
        waterDepthFeet: 4.5,
        roadPassable: false,
        reporter: citizenA._id,
        reporterName: citizenA.name,
        reporterTrustSnapshot: citizenA.trustScore,
        upvotes: [citizenB._id, volunteer._id],
        verifications: [
          {
            user: volunteer._id,
            userName: volunteer.name,
            userRole: volunteer.role,
            note: 'Confirmed on site with rescue boat team. Road completely impassable.',
          },
        ],
        status: 'Verified',
        officialVerifyAwarded: true,
        verifiedBy: volunteer._id,
        verifiedAt: new Date(),
      },
      {
        title: 'Broken Bailey Bridge Connecting Kadirpur & Begumganj',
        hazardType: 'Broken Bridge',
        severity: 'Critical',
        description:
          'Northern abutment of the Bailey bridge collapsed due to strong canal current. Pedestrian and vehicle crossing is unsafe.',
        location: {
          type: 'Point',
          coordinates: [91.1065, 22.9285],
          latitude: 22.9285,
          longitude: 91.1065,
          address: 'Kadirpur Canal Crossing',
          upazila: 'Begumganj',
          district: 'Noakhali',
        },
        waterDepthFeet: 5.5,
        roadPassable: false,
        reporter: citizenA._id,
        reporterName: citizenA.name,
        reporterTrustSnapshot: citizenA.trustScore,
        upvotes: [citizenB._id],
        verifications: [
          {
            user: citizenB._id,
            userName: citizenB.name,
            userRole: citizenB.role,
            note: 'Verified by local youth volunteers; detour via Chowmuhani.',
          },
        ],
        status: 'Community Verified',
        communityVerifyAwarded: true,
      },
      {
        title: 'Kazirbazar Approach Road Waterlogging & Downed Pole',
        hazardType: 'Power Line Down',
        severity: 'High',
        description:
          'Electric utility pole tilted into knee-deep floodwater near the bridge approach. Dangerous for pedestrians wading through.',
        location: {
          type: 'Point',
          coordinates: [91.8642, 24.8921],
          latitude: 24.8921,
          longitude: 91.8642,
          address: 'Kazirbazar Link Road, Ward 12',
          upazila: 'Sylhet Sadar',
          district: 'Sylhet',
        },
        waterDepthFeet: 2.2,
        roadPassable: false,
        reporter: citizenB._id,
        reporterName: citizenB.name,
        reporterTrustSnapshot: citizenB.trustScore,
        upvotes: [citizenA._id],
        verifications: [],
        status: 'Pending',
      },
      {
        title: 'Rangamati-Chittagong Hill Road Minor Landslide',
        hazardType: 'Landslide',
        severity: 'High',
        description:
          'Mud and uprooted trees blocking one lane of the highway after overnight heavy rain. Single-lane slow movement only.',
        location: {
          type: 'Point',
          coordinates: [92.1184, 22.6412],
          latitude: 22.6412,
          longitude: 92.1184,
          address: 'Ghagra Hill Slope Section',
          upazila: 'Kawkhali',
          district: 'Chittagong',
        },
        waterDepthFeet: 0,
        roadPassable: true,
        reporter: citizenB._id,
        reporterName: citizenB.name,
        reporterTrustSnapshot: citizenB.trustScore,
        upvotes: [],
        verifications: [],
        status: 'Pending',
      },
    ];

    for (const spec of sampleReports) {
      const existing = await HazardReport.findOne({ title: spec.title });
      if (!existing) {
        const doc = new HazardReport({
          ...spec,
          credibilityScore: calculateCredibilityScore({
            reporterTrustScore: spec.reporterTrustSnapshot,
            hasPhoto: Boolean(spec.photoUrl),
            upvotesCount: spec.upvotes.length,
            verificationsCount: spec.verifications.length,
            officialVerificationsCount: spec.status === 'Verified' ? 1 : 0,
            fakeFlagsCount: 0,
            status: spec.status,
          }),
        });
        await doc.save();
        console.log(`Seeded hazard report: ${doc.title}`);
      }
    }

    console.log('Crowdsourced hazard reports seeded successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed hazard reports:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedHazardReports();
}

module.exports = seedHazardReports;
