const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Utilisateur = require('../models/Utilisateur');
const AppError = require('../utils/AppError');

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

const authenticate = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication token is required.'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);

    const user = await Utilisateur.findOne({
      _id: payload.sub,
      isActive: true
    });

    if (!user) {
      return next(new AppError(401, 'AUTH_INVALID_USER', 'Authenticated user is no longer active.'));
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid or expired authentication token.'));
  }
};

module.exports = authenticate;
