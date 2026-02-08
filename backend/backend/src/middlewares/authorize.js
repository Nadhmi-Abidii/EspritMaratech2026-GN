const AppError = require('../utils/AppError');

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication token is required.'));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(new AppError(403, 'AUTH_FORBIDDEN', 'You do not have permission to perform this action.'));
  }

  return next();
};

module.exports = authorize;
