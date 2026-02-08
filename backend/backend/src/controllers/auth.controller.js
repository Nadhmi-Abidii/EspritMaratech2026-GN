const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Utilisateur = require('../models/Utilisateur');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sanitizeUser = require('../utils/sanitizeUser');

const signToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn
    }
  );

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await Utilisateur.findOne({
    email: email.toLowerCase(),
    isActive: true
  }).select('+password');

  if (!user) {
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const token = signToken(user);

  res.status(200).json({
    success: true,
    data: {
      token,
      user: sanitizeUser(user)
    }
  });
});

const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: sanitizeUser(req.user)
  });
});

module.exports = {
  login,
  getMe
};
