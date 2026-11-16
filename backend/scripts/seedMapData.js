require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const SOSRequest = require('../models/SOSRequest');
const HazardZone = require('../models/HazardZone');
const ReliefCamp = require('../models/ReliefCamp');
const User = require('../models/User');
const { calculatePriorityScore } = require('../utils/priorityCalculator');

const sampleHazards = [
  {
    name: 'Feni Muhuri River Embankment Breach',
    hazardType: 'Embankment Collapse',
    severity: 'Critical',
    location: {
      type: 'Point',
      coordinates: [91.3986, 23.0159],
      latitude: 23.0159,
      longitude: 91.3986,
      address: 'Near Parshuram Border Embankment, Feni',
      district: 'Feni',
    },
    radiusMeters: 4500,
    waterLevelFeet: 8.5,
    status: 'Active',
    description:
      'Major embankment breach along Muhuri River. Water flowing at catastrophic velocity across 14 villages.',
  },
  {
    name: 'Fulgazi Submerged Highway & Rail Track',
    hazardType: 'Submerged Road',
    severity: 'Critical',
    location: {
      type: 'Point',
      coordinates: [91.412, 23.0784],
      latitude: 23.0784,
      longitude: 91.412,
      address: 'Feni-Belonia Regional Highway, Fulgazi',
      district: 'Feni',
    },
    radiusMeters: 3000,
    waterLevelFeet: 6.2,
    status: 'Active',
    description:
      'Road completely submerged under 6+ feet of rapid flood current. Rescue boats required, no vehicular access.',
  },
  {
    name: 'Sylhet Surma River Overtopping & Flash Flood',
    hazardType: 'Flash Flood',
    severity: 'High',
    location: {
      type: 'Point',
      coordinates: [91.8687, 24.8949],
      latitude: 24.8949,
      longitude: 91.8687,
      address: 'Kazirbazar Bridge & Surma River Bank, Sylhet',
      district: 'Sylhet',
    },
    radiusMeters: 3500,
    waterLevelFeet: 4.8,
    status: 'Active',
    description:
      'Surma river water flowing 75 cm above danger level. Low-lying urban settlements inundated.',
  },
  {
    name: 'Begumganj Broken Wooden Bridge',
    hazardType: 'Broken Bridge',
    severity: 'High',
    location: {
      type: 'Point',
      coordinates: [91.1025, 22.9247],
      latitude: 22.9247,
      longitude: 91.1025,
      address: 'Chowmuhani-Begumganj Connecting Canal Bridge, Noakhali',
      district: 'Noakhali',
    },
    radiusMeters: 1800,
    waterLevelFeet: 5.0,
    status: 'Active',
    description:
      'Connecting bridge washed away by torrential water. Evacuation route severed for approximately 800 households.',
  },
  {
    name: 'Dhaka Mirpur Section-10 Waterlogging Hazard',
    hazardType: 'Waterlogging',
    severity: 'Moderate',
    location: {
      type: 'Point',
      coordinates: [90.3685, 23.8071],
      latitude: 23.8071,
      longitude: 90.3685,
      address: 'Mirpur-10 Roundabout & Senpara Parbata',
      district: 'Dhaka',
    },
    radiusMeters: 1200,
    waterLevelFeet: 2.5,
    status: 'Monitored',
    description:
      'Severe rainwater accumulation causing vehicle engine failure and electrical hazard from submerged distribution boxes.',
  },
];

const sampleReliefCamps = [
  {
    name: 'Bangladesh Army Emergency Relief Hub - Feni',
    operatingAgency: 'Bangladesh Army (33 Infantry Division)',
    location: {
      type: 'Point',
      coordinates: [91.3995, 23.0185],
      latitude: 23.0185,
      longitude: 91.3995,
      address: 'Feni Government Pilot High School Grounds',
      district: 'Feni',
    },
    itemsAvailable: [
      'Cooked Hot Meals',
      'High-Energy Dry Biscuits',
      'Purified Water Jerrycans (5L)',
      'Water Purification Tablets',
      'Life Jackets',
      'Emergency First-Aid Kits',
    ],
    dailyCapacityBeneficiaries: 2500,
    status: 'Active',
    contactPerson: 'Major T. Rahman',
    contactPhone: '+8801711000111',
    notes: 'Equipped with 6 rescue speedboats and satellite communications.',
  },
  {
    name: 'Red Crescent Disaster Response Base - Noakhali',
    operatingAgency: 'Bangladesh Red Crescent Society (BDRCS)',
    location: {
      type: 'Point',
      coordinates: [91.0982, 22.8698],
      latitude: 22.8698,
      longitude: 91.0982,
      address: 'Maijdee Court Red Crescent Unit, Noakhali',
      district: 'Noakhali',
    },
    itemsAvailable: [
      'Dry Food Packs (Rice, Dal, Oil)',
      'Oral Rehydration Saline (ORS)',
      'Baby Food & Formula',
      'Sanitary Napkins & Dignity Kits',
      'Water Purifiers',
    ],
    dailyCapacityBeneficiaries: 1800,
    status: 'Active',
    contactPerson: 'K. Alam (Unit Officer)',
    contactPhone: '+8801819223344',
    notes: 'Distribution teams operating via motorized country boats.',
  },
  {
    name: 'As-Sunnah Foundation Relief & Medical Camp - Sylhet',
    operatingAgency: 'As-Sunnah Foundation & Local Youth Volunteer Network',
    location: {
      type: 'Point',
      coordinates: [91.8715, 24.8892],
      latitude: 24.8892,
      longitude: 91.8715,
      address: 'Madan Mohan College Campus, Sylhet',
      district: 'Sylhet',
    },
    itemsAvailable: [
      'Cooked Khichuri Packs',
      'Chira, Gur & Mineral Water',
      'Essential Medicines & Paracetamol',
      'Dry Clothes & Blankets',
    ],
    dailyCapacityBeneficiaries: 3000,
    status: 'Active',
    contactPerson: 'A. H. Siddique',
    contactPhone: '+8801912334455',
    notes: 'Free mobile medical clinic with volunteer doctors available daily 9 AM - 6 PM.',
  },
];

const seedMapData = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();

    console.log('Finding or creating a test citizen user for SOS seeding...');
    let citizen = await User.findOne({ role: 'Citizen' });
    if (!citizen) {
      citizen = new User({
        name: 'Rahim Uddin (Victim)',
        email: 'victim.seed@example.com',
        passwordHash: '$2a$12$e9g0W.G4Lg7T7PzYd.1mde8q9G5O8K4G2M9B6N7P8Q9R0S1T2U3V4',
        role: 'Citizen',
      });
      await citizen.save();
    }

    // 1. Seed Hazard Zones
    console.log('Clearing existing seed hazard zones...');
    await HazardZone.deleteMany({ name: { $in: sampleHazards.map((h) => h.name) } });
    const insertedHazards = await HazardZone.insertMany(sampleHazards);
    console.log(`✅ Seeded ${insertedHazards.length} Hazard Zones.`);

    // 2. Seed Relief Camps
    console.log('Clearing existing seed relief camps...');
    await ReliefCamp.deleteMany({ name: { $in: sampleReliefCamps.map((rc) => rc.name) } });
    const insertedRelief = await ReliefCamp.insertMany(sampleReliefCamps);
    console.log(`✅ Seeded ${insertedRelief.length} Relief Camps.`);

    // 3. Seed Realistic Priority-Scored SOS Requests
    console.log('Seeding sample priority-calculated SOS requests...');
    const sampleSOSSpecs = [
      {
        location: {
          latitude: 23.018,
          longitude: 91.399,
          address: 'North Parshuram, Char Majlishpur, Feni',
          district: 'Feni',
        },
        needs: ['rescue', 'medicine', 'water'],
        numberOfPeople: 6,
        vulnerabilities: {
          children: 2,
          elderly: 1,
          pregnantWomen: 1,
          injured: 1,
        },
        description: 'Water rising rapidly above chest level. Pregnant woman in labor pain and 2 infants trapped on tin roof. Immediate boat rescue needed!',
      },
      {
        location: {
          latitude: 23.075,
          longitude: 91.415,
          address: 'Munshirhat Bazar, Fulgazi, Feni',
          district: 'Feni',
        },
        needs: ['rescue', 'food', 'water'],
        numberOfPeople: 4,
        vulnerabilities: {
          children: 1,
          elderly: 2,
          pregnantWomen: 0,
          injured: 0,
        },
        description: 'Two paralyzed elderly seniors stranded on second floor. No clean water since yesterday, phone battery at 4%.',
      },
      {
        location: {
          latitude: 24.892,
          longitude: 91.865,
          address: 'Ghashitola, Ward 10, Sylhet',
          district: 'Sylhet',
        },
        needs: ['food', 'water', 'medicine'],
        numberOfPeople: 5,
        vulnerabilities: {
          children: 3,
          elderly: 0,
          pregnantWomen: 0,
          injured: 1,
        },
        description: 'Diabetic patient without insulin for 48 hours, plus three small children needing dry food rations.',
      },
      {
        location: {
          latitude: 22.921,
          longitude: 91.105,
          address: 'Kadirpur, Begumganj, Noakhali',
          district: 'Noakhali',
        },
        needs: ['water', 'food'],
        numberOfPeople: 3,
        vulnerabilities: {
          children: 0,
          elderly: 1,
          pregnantWomen: 0,
          injured: 0,
        },
        description: 'Tubewell contaminated by flood runoff. Drinking water urgently requested.',
      },
      {
        location: {
          latitude: 23.805,
          longitude: 90.37,
          address: 'Mirpur-2 Block A, Dhaka',
          district: 'Dhaka',
        },
        needs: ['water', 'food'],
        numberOfPeople: 2,
        vulnerabilities: {
          children: 0,
          elderly: 0,
          pregnantWomen: 0,
          injured: 0,
        },
        description: 'Ground floor waterlogged, request clean drinking water bottles.',
      },
    ];

    for (const spec of sampleSOSSpecs) {
      const calc = calculatePriorityScore({
        vulnerabilities: spec.vulnerabilities,
        needs: spec.needs,
        numberOfPeople: spec.numberOfPeople,
        description: spec.description,
      });

      const existing = await SOSRequest.findOne({
        'location.address': spec.location.address,
      });

      if (!existing) {
        const sosDoc = new SOSRequest({
          victim: citizen._id,
          location: {
            type: 'Point',
            coordinates: [spec.location.longitude, spec.location.latitude],
            latitude: spec.location.latitude,
            longitude: spec.location.longitude,
            address: spec.location.address,
            district: spec.location.district,
          },
          needs: spec.needs,
          numberOfPeople: spec.numberOfPeople,
          vulnerabilities: calc.vulnerabilities,
          priorityScore: calc.score,
          priorityFactors: calc.factors,
          priority: calc.priority,
          status: 'Pending',
          description: spec.description,
          statusHistory: [
            {
              status: 'Pending',
              changedBy: citizen._id,
              changedAt: new Date(),
              note: `Seed distress record. Urgency Score: ${calc.score}/100 (${calc.priority}).`,
            },
          ],
        });
        await sosDoc.save();
        console.log(
          `  Created SOS: Score ${calc.score} (${calc.priority}) at ${spec.location.address}`
        );
      }
    }

    console.log('🎉 Live disaster map data and priority-scored SOS seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedMapData();
}

module.exports = seedMapData;
