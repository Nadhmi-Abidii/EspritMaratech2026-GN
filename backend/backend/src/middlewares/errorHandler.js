const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (error.name === 'CastError') {
    error = new AppError(400, 'INVALID_ID', `Invalid identifier for ${error.path}.`);
  }

  if (error.name === 'ValidationError') {
    error = new AppError(
      422,
      'VALIDATION_ERROR',
      'Model validation failed.',
      Object.values(error.errors).map((item) => ({
        field: item.path,
        message: item.message
      }))
    );
  }

  if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
    error = new AppError(409, 'DUPLICATE_RESOURCE', `${duplicateField} already exists.`);
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    error = new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid or expired authentication token.');
  }

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred.',
      details: error.details || null
    }
  });
};

module.exports = errorHandler;
