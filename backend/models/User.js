const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,           
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,         
    lowercase: true,      
    trim: true,
  },

  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
  },

  role: {
    type: String,
    enum: ['Admin', 'Volunteer', 'NGO', 'Citizen', 'Donor'],
    default: 'Citizen',
  },

  skills: {
    type: [String],
    default: [],
  },

  availability: {
    type: String,
    enum: ['Available', 'Busy', 'Unavailable'],
    default: 'Available',
  },

  serviceArea: {
    type: String,
    trim: true,
    default: '',
  },

  phone: {
    type: String,
    trim: true,
    default: '',
  },

  address: {
    type: String,
    trim: true,
    default: '',
  },

  bio: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }

  try {
    const saltRounds = 12;
    const salt = await bcrypt.genSalt(saltRounds);

    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);

    next(); 
  } catch (err) {
    next(err); 
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
