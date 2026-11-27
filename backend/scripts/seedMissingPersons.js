require('dotenv').config();
const mongoose = require('mongoose');
const MissingPerson = require('../models/MissingPerson');

const sampleMissingPersons = [
  {
    fullName: 'Mohammad Rafiqul Islam',
    age: 45,
    gender: 'Male',
    lastSeenLocation: {
      district: 'Feni',
      area: 'Parshuram Bazar, near Muhuri River Embankment',
      landmark: 'Near the Union Parishad building',
    },
    physicalDescription: 'Height 5ft 6in, wearing green lungi and white genji. Has a scar on left wrist.',
    medicalNeeds: 'Diabetic patient requiring regular insulin.',
    status: 'Missing',
    contactPerson: {
      name: 'Salma Begum',
      phone: '01712345678',
      relationship: 'Spouse',
      email: 'salma.begum@example.com',
    },
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    notes: 'Swept away during rapid flash flood while moving cattle. Contact immediately if seen.',
  },
  {
    fullName: 'Jannatul Ferdous Mim',
    age: 9,
    gender: 'Female',
    lastSeenLocation: {
      district: 'Feni',
      area: 'Fulgazi, Munshirhat Road',
      landmark: 'Near Fulgazi Primary School',
    },
    physicalDescription: 'Height 4ft, fair complexion, wearing floral yellow dress. Hair in two ponytails.',
    medicalNeeds: 'None',
    status: 'Found / Safe',
    contactPerson: {
      name: 'Jahirul Islam',
      phone: '01819234567',
      relationship: 'Father',
    },
    safetyUpdate: {
      reportedSafeAt: new Date(Date.now() - 3600000 * 4),
      currentLocation: 'Feni Central Government Primary School Shelter, Room 102',
      updatedBy: 'Red Crescent Rescue Volunteer Team',
      safetyNotes: 'Rescued by Bangladesh Army boat and safely transferred to government shelter camp.',
    },
    photoUrl: 'https://images.unsplash.com/photo-1544717302-de2939b7ef71?w=400&auto=format&fit=crop&q=80',
    notes: 'Separated from family during midnight rescue operation.',
  },
  {
    fullName: 'Abdul Motin Mia',
    age: 68,
    gender: 'Male',
    lastSeenLocation: {
      district: 'Noakhali',
      area: 'Begumganj, Chowmuhani Bazar',
      landmark: 'Near railway station track crossing',
    },
    physicalDescription: 'Elderly, grey beard, walks with a bamboo stick, wearing white panjabi.',
    medicalNeeds: 'High blood pressure medication, slight hearing impairment.',
    status: 'Missing',
    contactPerson: {
      name: 'Kamrul Hasan',
      phone: '01911445566',
      relationship: 'Son',
    },
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    notes: 'Last seen walking towards high ground near Chowmuhani bypass.',
  },
  {
    fullName: 'Taslima Akter',
    age: 26,
    gender: 'Female',
    lastSeenLocation: {
      district: 'Sylhet',
      area: 'Companiganj, Bholaganj Ropeway area',
      landmark: 'Near Sadar Upazila Health Complex',
    },
    physicalDescription: 'Wearing blue salwar kameez and black hijab. Carrying a brown shoulder bag.',
    medicalNeeds: '7 months pregnant, requires urgent prenatal maternal care.',
    status: 'Missing',
    contactPerson: {
      name: 'Dr. Shahabuddin',
      phone: '01733889900',
      relationship: 'Brother',
    },
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
    notes: 'High priority missing person due to late-stage pregnancy. Rescue boats alerted.',
  },
  {
    fullName: 'Shuvo Barua',
    age: 21,
    gender: 'Male',
    lastSeenLocation: {
      district: 'Chattogram',
      area: 'Mirsharai, Baraiyarhat',
      landmark: 'Dhaka-Chattogram highway bridge',
    },
    physicalDescription: 'Medium build, 5ft 8in, wearing black t-shirt and jeans sneakers.',
    medicalNeeds: 'Minor foot injury',
    status: 'Found / Safe',
    contactPerson: {
      name: 'Prosenjit Barua',
      phone: '01611223344',
      relationship: 'Cousin',
    },
    safetyUpdate: {
      reportedSafeAt: new Date(Date.now() - 3600000 * 12),
      currentLocation: 'Mirsharai High School Cyclone Shelter',
      updatedBy: 'Local Youth Volunteer Club',
      safetyNotes: 'Contacted family via shelter satellite emergency phone.',
    },
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
    notes: 'Volunteered during evacuation and got stranded across river bank.',
  },
  {
    fullName: 'Ayesha Siddiqua',
    age: 72,
    gender: 'Female',
    lastSeenLocation: {
      district: 'Sunamganj',
      area: 'Tahirpur, dekat Tanguar Haor',
      landmark: 'Golabari boat ghat',
    },
    physicalDescription: 'Elderly woman, 4ft 11in, speaks Sylheti dialect, wearing traditional cotton saree.',
    medicalNeeds: 'Hypertension and arthritis.',
    status: 'Missing',
    contactPerson: {
      name: 'Mahmudur Rahman',
      phone: '01815667788',
      relationship: 'Grandson',
    },
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
    notes: 'Evacuated by boat from flood-inundated haor village; family lost contact during transit.',
  },
];

async function seedMissingPersons() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-disaster-response';
  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully.');
    const existingCount = await MissingPerson.countDocuments();
    if (existingCount > 0) {
      console.log(`MissingPerson collection already contains ${existingCount} documents.`);
      console.log('Refreshing sample data...');
      await MissingPerson.deleteMany({});
    }

    const inserted = await MissingPerson.insertMany(sampleMissingPersons);
    console.log(` Successfully seeded ${inserted.length} missing person records (Missing & Found/Safe cases).`);
  } catch (err) {
    console.error(' Seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
    process.exit(0);
  }
}

seedMissingPersons();
