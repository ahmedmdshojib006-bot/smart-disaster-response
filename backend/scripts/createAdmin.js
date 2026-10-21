require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@disaster.org';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin12345';
    const adminName = process.env.ADMIN_NAME || 'System Administrator';

    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      console.log(`ℹ️ Admin account already exists: ${adminEmail}`);
      admin.role = 'Admin';
      admin.passwordHash = adminPassword; 
      await admin.save();
      console.log(`✅ Admin credentials reset successfully!`);
    } else {
      admin = new User({
        name: adminName,
        email: adminEmail,
        passwordHash: adminPassword, 
        role: 'Admin',
      });
      await admin.save();
      console.log(`✅ New Admin account created successfully!`);
    }

    console.log(`──────────────────────────────────────────`);
    console.log(`📧 Admin Email   : ${adminEmail}`);
    console.log(`🔑 Admin Password: ${adminPassword}`);
    console.log(`👑 Role          : Admin`);
    console.log(`──────────────────────────────────────────`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create admin account:', error.message);
    process.exit(1);
  }
};

seedAdmin();
