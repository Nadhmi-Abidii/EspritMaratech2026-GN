const { body, query } = require('express-validator');
const { paginationValidation, mongoIdParam } = require('./common.validator');

const geolocationValidation = [
  body('geolocation.latitude').optional().isFloat({ min: -90, max: 90 }),
  body('geolocation.longitude').optional().isFloat({ min: -180, max: 180 }),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 })
];

const createVisiteValidation = [
  body('visitDate').optional().isISO8601().withMessage('visitDate must be a valid date'),
  body('notes').optional().isString(),
  body('aides').optional().isArray(),
  body('aides.*').optional().isMongoId(),
  body('famille').isMongoId().withMessage('famille must be a valid id'),
  ...geolocationValidation
];

const updateVisiteValidation = [
  ...mongoIdParam('id'),
  body('visitDate').optional().isISO8601(),
  body('notes').optional().isString(),
  body('aides').optional().isArray(),
  body('aides.*').optional().isMongoId(),
  body('famille').optional().isMongoId(),
  ...geolocationValidation
];

const listVisiteValidation = [
  ...paginationValidation,
  query('familleId').optional().isMongoId(),
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601()
];

module.exports = {
  createVisiteValidation,
  updateVisiteValidation,
  listVisiteValidation,
  visiteIdValidation: mongoIdParam('id')
};
