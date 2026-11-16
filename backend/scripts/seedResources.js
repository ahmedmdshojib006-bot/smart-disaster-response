require('dotenv').config();
const mongoose = require('mongoose');
const Resource = require('../models/Resource');
const DistributionRecord = require('../models/DistributionRecord');
let Shelter = null;
try {
  Shelter = require('../models/Shelter');
} catch (e) {

}

const resourcesData = [

  {
    name: 'Miniket Rice Relief Bags (25kg)',
    category: 'Food',
    unit: 'bags',
    quantityAvailable: 450,
    totalReceived: 600,
    totalDistributed: 150,
    thresholdLowStock: 80,
    warehouse: {
      name: 'Feni Central Government Relief Depot',
      district: 'Feni',
      address: 'Grand Trunk Road, Feni Sadar',
    },
    donor: {
      name: 'Bangladesh Red Crescent Society (BDRCS)',
      contact: '+8801711002233',
    },
    notes: 'Stored in moisture-proof pallets. High priority for flood-submerged upazilas.',
  },
  {
    name: 'High-Protein Emergency Biscuits (Cartons)',
    category: 'Food',
    unit: 'cartons',
    quantityAvailable: 280,
    totalReceived: 500,
    totalDistributed: 220,
    thresholdLowStock: 60,
    warehouse: {
      name: 'Sylhet Division Disaster Relief Hub',
      district: 'Sylhet',
      address: 'Tilagarh, Sylhet Sadar',
    },
    donor: {
      name: 'UN World Food Programme (WFP)',
      contact: '+8801822334455',
    },
    notes: 'Ready-to-eat ration for stranded victims without cooking gas/fuel.',
  },
  {
    name: 'Infant Milk & Nutrition Cereal (Tins)',
    category: 'Food',
    unit: 'tins',
    quantityAvailable: 12,
    totalReceived: 100,
    totalDistributed: 88,
    thresholdLowStock: 25,
    warehouse: {
      name: 'Sunamganj Sadar Emergency Stockpile',
      district: 'Sunamganj',
      address: 'Jubilee Road, Sunamganj',
    },
    donor: {
      name: 'UNICEF Bangladesh',
      contact: '+8801933445566',
    },
    notes: 'Strictly allocated for children under 5 and pregnant/lactating mothers.',
  },
  {
    name: 'Emergency Flattened Rice (Chira) & Molasses Packs',
    category: 'Food',
    unit: 'packs',
    quantityAvailable: 0,
    totalReceived: 350,
    totalDistributed: 350,
    thresholdLowStock: 40,
    warehouse: {
      name: 'Noakhali District Relief Warehouse',
      district: 'Noakhali',
      address: 'Maijdee Court, Noakhali',
    },
    donor: {
      name: 'BRAC Humanitarian Disaster Fund',
      contact: '+8801744556677',
    },
    notes: 'Stock completely exhausted after recent high tides in Companiganj.',
  },

  {
    name: 'Purified Bottled Drinking Water (5 Litres)',
    category: 'Water',
    unit: 'bottles',
    quantityAvailable: 1200,
    totalReceived: 1800,
    totalDistributed: 600,
    thresholdLowStock: 200,
    warehouse: {
      name: 'Feni Central Government Relief Depot',
      district: 'Feni',
      address: 'Grand Trunk Road, Feni Sadar',
    },
    donor: {
      name: 'Department of Public Health Engineering (DPHE)',
      contact: '+8801755667788',
    },
    notes: 'Crucial due to tubewell contamination from flood waters in Parshuram & Fulgazi.',
  },
  {
    name: 'Water Purification Halazone Tablets (Strips of 10)',
    category: 'Water',
    unit: 'strips',
    quantityAvailable: 4500,
    totalReceived: 6000,
    totalDistributed: 1500,
    thresholdLowStock: 500,
    warehouse: {
      name: 'Sylhet Division Disaster Relief Hub',
      district: 'Sylhet',
      address: 'Tilagarh, Sylhet Sadar',
    },
    donor: {
      name: 'Oxfam Bangladesh',
      contact: '+8801866778899',
    },
    notes: 'Each tablet purifies 10L of water. Distribute with instructions flyer.',
  },
  {
    name: 'Heavy-Duty Collapsible Water Jerrycans (10L)',
    category: 'Water',
    unit: 'jerrycans',
    quantityAvailable: 18,
    totalReceived: 200,
    totalDistributed: 182,
    thresholdLowStock: 30,
    warehouse: {
      name: 'Noakhali District Relief Warehouse',
      district: 'Noakhali',
      address: 'Maijdee Court, Noakhali',
    },
    donor: {
      name: 'WaterAid Bangladesh',
      contact: '+8801977889900',
    },
    notes: 'Food-grade plastic containers for community water carriage.',
  },


  {
    name: 'Oral Rehydration Solution (ORS) Sachets (Boxes of 100)',
    category: 'Medicine',
    unit: 'boxes',
    quantityAvailable: 350,
    totalReceived: 500,
    totalDistributed: 150,
    thresholdLowStock: 75,
    warehouse: {
      name: 'Feni Central Government Relief Depot',
      district: 'Feni',
      address: 'Grand Trunk Road, Feni Sadar',
    },
    donor: {
      name: 'SMC Enterprise Ltd & Directorate General of Health Services (DGHS)',
      contact: '+8801788990011',
    },
    notes: 'Vital treatment for diarrhea and waterborne dehydration.',
  },
  {
    name: 'Emergency Medical Trauma & First Aid Kits',
    category: 'Medicine',
    unit: 'kits',
    quantityAvailable: 65,
    totalReceived: 100,
    totalDistributed: 35,
    thresholdLowStock: 20,
    warehouse: {
      name: 'Sylhet Division Disaster Relief Hub',
      district: 'Sylhet',
      address: 'Tilagarh, Sylhet Sadar',
    },
    donor: {
      name: 'Doctors for Relief & Civil Defence',
      contact: '+8801899001122',
    },
    notes: 'Includes bandages, gauze, antiseptic povidone, scissors, tourniquets.',
  },
  {
    name: 'Waterborne Disease Antibiotics & Antipyretic Packs',
    category: 'Medicine',
    unit: 'packs',
    quantityAvailable: 8,
    totalReceived: 150,
    totalDistributed: 142,
    thresholdLowStock: 25,
    warehouse: {
      name: 'Sunamganj Sadar Emergency Stockpile',
      district: 'Sunamganj',
      address: 'Jubilee Road, Sunamganj',
    },
    donor: {
      name: 'Square Pharmaceuticals CSR Relief',
      contact: '+8801900112233',
    },
    notes: 'Critical shortage! Resupply needed urgently for remote haor health camps.',
  },


  {
    name: 'Heavy Fleece Thermal Blankets (Winter & Storm Relief)',
    category: 'Blankets',
    unit: 'pieces',
    quantityAvailable: 850,
    totalReceived: 1200,
    totalDistributed: 350,
    thresholdLowStock: 150,
    warehouse: {
      name: 'Sylhet Division Disaster Relief Hub',
      district: 'Sylhet',
      address: 'Tilagarh, Sylhet Sadar',
    },
    donor: {
      name: 'Islamic Relief Worldwide (Bangladesh)',
      contact: '+8801711223344',
    },
    notes: 'Essential for flood-affected families staying in open shelters and school corridors.',
  },
  {
    name: 'Waterproof Thermal Sleeping Mats (Chatai)',
    category: 'Blankets',
    unit: 'pieces',
    quantityAvailable: 420,
    totalReceived: 600,
    totalDistributed: 180,
    thresholdLowStock: 100,
    warehouse: {
      name: 'Feni Central Government Relief Depot',
      district: 'Feni',
      address: 'Grand Trunk Road, Feni Sadar',
    },
    donor: {
      name: 'Bangladesh Army Disaster Relief Cell',
      contact: '+8801822334455',
    },
    notes: 'Heavy polyethylene insulation mats to prevent ground dampness.',
  },
  {
    name: 'Heavy Woolen Family Blankets',
    category: 'Blankets',
    unit: 'pieces',
    quantityAvailable: 0,
    totalReceived: 250,
    totalDistributed: 250,
    thresholdLowStock: 50,
    warehouse: {
      name: 'Noakhali District Relief Warehouse',
      district: 'Noakhali',
      address: 'Maijdee Court, Noakhali',
    },
    donor: {
      name: 'Local Community Philanthropists',
      contact: '+8801933445566',
    },
    notes: 'All blankets distributed to submerged coastal villages in Subarnachar.',
  },


  {
    name: 'Family Hygiene & Sanitation Kits',
    category: 'Sanitation',
    unit: 'kits',
    quantityAvailable: 310,
    totalReceived: 500,
    totalDistributed: 190,
    thresholdLowStock: 60,
    warehouse: {
      name: 'Feni Central Government Relief Depot',
      district: 'Feni',
      address: 'Grand Trunk Road, Feni Sadar',
    },
    donor: {
      name: 'CARE Bangladesh',
      contact: '+8801744556677',
    },
    notes: 'Includes soap, detergent, sanitary pads, toothpaste, and towels.',
  },
  {
    name: 'Emergency Tarpaulin Waterproof Sheets (15x18 ft)',
    category: 'Emergency Kits',
    unit: 'sheets',
    quantityAvailable: 190,
    totalReceived: 300,
    totalDistributed: 110,
    thresholdLowStock: 50,
    warehouse: {
      name: 'Sunamganj Sadar Emergency Stockpile',
      district: 'Sunamganj',
      address: 'Jubilee Road, Sunamganj',
    },
    donor: {
      name: 'International Federation of Red Cross (IFRC)',
      contact: '+8801855667788',
    },
    notes: 'Heavy UV-resistant tarps for rapid temporary roofing in washed-out houses.',
  },
];

async function seed() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB successfully.');

  
    let existingShelters = [];
    if (Shelter) {
      existingShelters = await Shelter.find().limit(5).lean();
    }

    console.log('Clearing existing resources and distribution records...');
    await Resource.deleteMany({});
    await DistributionRecord.deleteMany({});

    console.log(`Seeding ${resourcesData.length} relief inventory items...`);
    const insertedResources = await Resource.insertMany(resourcesData);
    console.log(`Inserted ${insertedResources.length} resources.`);


    const distributionsData = [
      {
        resource: insertedResources[0]._id, // Rice
        resourceName: insertedResources[0].name,
        category: insertedResources[0].category,
        quantity: 100,
        unit: insertedResources[0].unit,
        recipientType: 'Shelter',
        shelter: existingShelters[0]?._id || null,
        shelterName: existingShelters[0]?.name || 'Feni Central High School Shelter',
        destination: {
          name: existingShelters[0]?.name || 'Feni Central High School Shelter',
          district: 'Feni',
          upazila: 'Feni Sadar',
          address: 'Trunk Road, Feni',
        },
        beneficiaryCount: 350,
        distributionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        distributedBy: new mongoose.Types.ObjectId(),
        distributedByName: 'Minhaz Chowdhury (Admin Coordinator)',
        distributedByRole: 'Admin',
        status: 'Delivered',
        transportMethod: 'Army Heavy Truck',
        notes: 'Delivered for daily meal program serving 350 displaced citizens.',
      },
      {
        resource: insertedResources[4]._id, 
        resourceName: insertedResources[4].name,
        category: insertedResources[4].category,
        quantity: 400,
        unit: insertedResources[4].unit,
        recipientType: 'Affected Community',
        destination: {
          name: 'Parshuram Submerged Union 4',
          district: 'Feni',
          upazila: 'Parshuram',
          address: 'Muhuri River Embankment Breach Area',
        },
        beneficiaryCount: 520,
        distributionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        distributedBy: new mongoose.Types.ObjectId(),
        distributedByName: 'Red Crescent Response Team (NGO)',
        distributedByRole: 'NGO',
        status: 'Delivered',
        transportMethod: 'Motorized Rescue Speedboat',
        notes: 'Clean water delivered directly to marooned rooftop families.',
      },
      {
        resource: insertedResources[7]._id, 
        resourceName: insertedResources[7].name,
        category: insertedResources[7].category,
        quantity: 150,
        unit: insertedResources[7].unit,
        recipientType: 'Shelter',
        destination: {
          name: 'Sylhet Government College Cyclone Shelter',
          district: 'Sylhet',
          upazila: 'Sylhet Sadar',
          address: 'Tilagarh, Sylhet',
        },
        beneficiaryCount: 280,
        distributionDate: new Date(Date.now() - 12 * 60 * 60 * 1000),
        distributedBy: new mongoose.Types.ObjectId(),
        distributedByName: 'BDRCS Field Officer',
        distributedByRole: 'NGO',
        status: 'Delivered',
        transportMethod: 'Emergency Medical Van',
        notes: 'Replenished medical clinic stock to address post-flood gastrointestinal cases.',
      },
      {
        resource: insertedResources[10]._id, 
        resourceName: insertedResources[10].name,
        category: insertedResources[10].category,
        quantity: 200,
        unit: insertedResources[10].unit,
        recipientType: 'Relief Camp',
        destination: {
          name: 'Sunamganj Jubilee Flood Camp',
          district: 'Sunamganj',
          upazila: 'Sunamganj Town',
          address: 'Court Road Camp',
        },
        beneficiaryCount: 410,
        distributionDate: new Date(Date.now() - 4 * 60 * 60 * 1000),
        distributedBy: new mongoose.Types.ObjectId(),
        distributedByName: 'Minhaz Chowdhury (Admin Coordinator)',
        distributedByRole: 'Admin',
        status: 'Delivered',
        transportMethod: 'Pickup Van',
        notes: 'Prioritized distribution to mothers with infants and elderly persons.',
      },
    ];

    const insertedDistributions = await DistributionRecord.insertMany(distributionsData);
    console.log(`Inserted ${insertedDistributions.length} distribution records.`);

    console.log('\nSeed Summary:');
    console.log(`- Relief Resources: ${insertedResources.length}`);
    console.log(`- Distributions Logged: ${insertedDistributions.length}`);
    console.log('Relief resource database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
