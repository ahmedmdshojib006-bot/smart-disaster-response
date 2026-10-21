const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
}

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error(
        'MONGO_URI is missing in backend/.env. Please add your MongoDB Atlas connection string (or local mongodb://localhost:27017/disaster-response) into backend/.env'
      );
    }

    const conn = await mongoose.connect(mongoUri);

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);

    throw error;
  }
};

module.exports = connectDB;
