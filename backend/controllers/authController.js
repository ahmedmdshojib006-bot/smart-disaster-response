const jwt = require('jsonwebtoken');
const { validationResult, body } = require('express-validator');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const crypto = require('crypto');

const signToken = (userId) => {
  return jwt.sign(
    { id: userId },                    
    process.env.JWT_SECRET,            
    { expiresIn: process.env.JWT_EXPIRES_IN } 
  );
};

const registerValidationRules = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(), 

  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),

  body('role')
    .optional()
    .isIn(['Volunteer', 'NGO', 'Citizen', 'Donor'])
    .withMessage('Invalid role. Admin role cannot be assigned via registration.'),
];

const loginValidationRules = [
  body('email').notEmpty().withMessage('Email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const register = [
  ...registerValidationRules,

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({
          success: false,
          errors: errors.array().map((e) => e.msg),
        });
      }

      const { name, email, password, role, skills, availability, serviceArea, phone } = req.body;

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered.',
        });
      }

      const userData = {
        name,
        email,
        passwordHash: password, 
        role: role || 'Citizen',  
      };

      if (Array.isArray(skills)) {
        userData.skills = skills;
      } else if (typeof skills === 'string' && skills.trim()) {
        userData.skills = skills.split(',').map((s) => s.trim()).filter(Boolean);
      }

      if (availability) {
        userData.availability = availability;
      }
      if (serviceArea) {
        userData.serviceArea = serviceArea;
      }
      if (phone) {
        userData.phone = phone;
      }

      const user = new User(userData);

      await user.save(); 

      const token = signToken(user._id);

      return res.status(201).json({
        success: true,
        message: 'Registration successful.',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          skills: user.skills || [],
          availability: user.availability || 'Available',
          serviceArea: user.serviceArea || '',
          phone: user.phone || '',
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during registration.',
      });
    }
  },
];

const login = [
  ...loginValidationRules,

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({
          success: false,
          errors: errors.array().map((e) => e.msg),
        });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });

      const passwordMatch = user ? await user.comparePassword(password) : false;

      if (!user || !passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      const token = signToken(user._id);

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          skills: user.skills || [],
          availability: user.availability || 'Available',
          serviceArea: user.serviceArea || '',
          phone: user.phone || '',
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during login.',
      });
    }
  },
];

const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};

const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully. Please remove the token from client storage.',
  });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If this email exists, a reset token has been generated.',
        resetToken: null,
      });
    }

    await PasswordResetToken.deleteMany({ userId: user._id });

    const token = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PasswordResetToken.create({
      userId: user._id,
      token,
      expiresAt,
    });

    return res.status(200).json({
      success: true,
      message: 'Reset token generated. Use this token to reset your password.',
      resetToken: token,
      expiresIn: '15 minutes',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error generating reset token.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(422).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const tokenDoc = await PasswordResetToken.findOne({
      token: token.trim().toUpperCase(),
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      return res.status(400).json({ success: false, message: 'Reset token is invalid or has expired.' });
    }

    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.passwordHash = newPassword;
    await user.save();

    tokenDoc.used = true;
    await tokenDoc.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error resetting password.' });
  }
};

module.exports = { register, login, getMe, logout, forgotPassword, resetPassword };
