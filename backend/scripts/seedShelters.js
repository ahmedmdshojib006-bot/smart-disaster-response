require('dotenv').config();
const mongoose = require('mongoose');
const Shelter = require('../models/Shelter');

const sheltersData = [
  {
    name: 'Sylhet Government College Cyclone & Flood Shelter',
    location: {
      latitude: 24.8949,
      longitude: 91.8687,
      address: 'Tilagarh, Sylhet Sadar',
      district: 'Sylhet',
    },
    capacity: {
      total: 450,
      occupied: 180,
    },
    facilities: {
      toilet: true,
      medicalCare: true,
      womenOnlySection: true,
      drinkingWater: true,
      electricityBackup: true,
    },
    status: 'Open',
    contactPerson: 'Rahim Uddin (Camp Manager)',
    contactPhone: '01711223344',
    notes: 'Main administrative shelter with permanent doctor and separate female wing.',
  },
  {
    name: 'Sunamganj Jubilee High School Emergency Shelter',
    location: {
      latitude: 25.0659,
      longitude: 91.4074,
      address: 'Court Road, Sunamganj Town',
      district: 'Sunamganj',
    },
    capacity: {
      total: 300,
      occupied: 285,
    },
    facilities: {
      toilet: true,
      medicalCare: false,
      womenOnlySection: true,
      drinkingWater: true,
      electricityBackup: false,
    },
    status: 'Open',
    contactPerson: 'Md. Faruk Hossain',
    contactPhone: '01822334455',
    notes: 'Near full capacity. Priority given to families with young children.',
  },
  {
    name: 'Feni Central Government Primary School Shelter',
    location: {
      latitude: 23.0159,
      longitude: 91.3976,
      address: 'Trunk Road, Feni Sadar',
      district: 'Feni',
    },
    capacity: {
      total: 350,
      occupied: 120,
    },
    facilities: {
      toilet: true,
      medicalCare: true,
      womenOnlySection: true,
      drinkingWater: true,
      electricityBackup: true,
    },
    status: 'Open',
    contactPerson: 'Nurul Islam',
    contactPhone: '01933445566',
    notes: 'Equipped with solar power backup and clean filtration water plant.',
  },
  {
    name: 'Chittagong Port Coastal Cyclone Shelter #12',
    location: {
      latitude: 22.3129,
      longitude: 91.7997,
      address: 'Patenga Beach Road, Chittagong',
      district: 'Chittagong',
    },
    capacity: {
      total: 600,
      occupied: 600,
    },
    facilities: {
      toilet: true,
      medicalCare: true,
      womenOnlySection: true,
      drinkingWater: true,
      electricityBackup: true,
    },
    status: 'Full',
    contactPerson: 'Captain S. Rahman',
    contactPhone: '01511223344',
    notes: 'Currently at full capacity. Redirecting new arrivals to Shelter #13.',
  },
  {
    name: 'Cox\'s Bazar Teknaf Multipurpose Cyclone Shelter',
    location: {
      latitude: 20.8656,
      longitude: 92.2989,
      address: 'Main Road, Teknaf',
      district: 'Cox\'s Bazar',
    },
    capacity: {
      total: 500,
      occupied: 210,
    },
    facilities: {
      toilet: true,
      medicalCare: true,
      womenOnlySection: true,
      drinkingWater: true,
      electricityBackup: true,
    },
    status: 'Open',
    contactPerson: 'Alamgir Kabir',
    contactPhone: '01755667788',
    notes: 'Red Crescent relief team on site with emergency food rations.',
  },
  {
    name: 'Kurigram Chilmari Flood Refuge Center',
    location: {
      latitude: 25.5562,
      longitude: 89.6738,
      address: 'River Ghat, Chilmari, Kurigram',
      district: 'Kurigram',
    },
    capacity: {
      total: 250,
      occupied: 90,
    },
    facilities: {
      toilet: true,
      medicalCare: false,
      womenOnlySection: false,
      drinkingWater: true,
      electricityBackup: false,
    },
    status: 'Open',
    contactPerson: 'Matiur Rahman',
    contactPhone: '01677889900',
    notes: 'Raised platform building safe from river water overflow.',
  },
  {
    name: 'Dhaka Mirpur Indoor Stadium Relief Center',
    location: {
      latitude: 23.8069,
      longitude: 90.3687,
      address: 'Mirpur-10, Dhaka',
      district: 'Dhaka',
    },
    capacity: {
      total: 800,
      occupied: 150,
    },
    facilities: {
      toilet: true,
      medicalCare: true,
      womenOnlySection: true,
      drinkingWater: true,
      electricityBackup: true,
    },
    status: 'Open',
    contactPerson: 'Major T. Ahmed',
    contactPhone: '01799001122',
    notes: 'National central relief hub with medical team and dry food supplies.',
  },
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      process.exit(1);
    }

    await mongoose.connect(mongoUri);

    await Shelter.deleteMany({});
    await Shelter.insertMany(sheltersData);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}

seed();
