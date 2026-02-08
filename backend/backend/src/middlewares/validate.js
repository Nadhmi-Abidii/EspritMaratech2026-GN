const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return next(
    new AppError(422, 'VALIDATION_ERROR', 'Request validation failed.', errors.array())
  );
};

module.exports = validate;
