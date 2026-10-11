// config/db.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles the MongoDB connection using Mongoose.
// This function is called once when the server starts up.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from the .env file into process.env
dotenv.config();

/**
 * connectDB
 * Asynchronously connects Mongoose to the MongoDB cluster.
 * The connection URI comes from the MONGO_URI environment variable.
 * If the connection fails, we throw the error so the server startup
 * process can catch it and exit gracefully instead of running without a DB.
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error(
        'MONGO_URI is missing in backend/.env. Please add your MongoDB Atlas connection string (or local mongodb://localhost:27017/disaster-response) into backend/.env'
      );
    }

    // mongoose.connect returns a promise; we await it so errors are catchable
    const conn = await mongoose.connect(mongoUri);

    // Log which host Mongoose connected to (helpful for debugging env issues)
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    // Log the specific error so the developer can see what went wrong
    console.error(`❌ MongoDB connection error: ${error.message}`);

    // Re-throw so the caller (server.js) can decide what to do
    // (typically: process.exit(1) to stop the server)
    throw error;
  }
};

module.exports = connectDB;
