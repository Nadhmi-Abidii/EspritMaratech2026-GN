const { body, query } = require('express-validator');
const { paginationValidation, mongoIdParam } = require('./common.validator');

const aideTypeEnum = ['alimentaire', 'medication', 'aide_specifique'];

const createAideValidation = [
  body('type').isIn(aideTypeEnum).withMessage('type is invalid'),
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be > 0'),
  body('aidDate').optional().isISO8601().withMessage('aidDate must be a valid date'),
  body('observations').optional().isString(),
  body('famille').isMongoId().withMessage('famille must be a valid id')
];

const updateAideValidation = [
  ...mongoIdParam('id'),
  body('type').optional().isIn(aideTypeEnum),
  body('quantity').optional().isFloat({ gt: 0 }),
  body('aidDate').optional().isISO8601(),
  body('observations').optional().isString(),
  body('famille').optional().isMongoId()
];

const listAideValidation = [
  ...paginationValidation,
  query('familleId').optional().isMongoId(),
  query('type').optional().isIn(aideTypeEnum),
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601()
];

module.exports = {
  createAideValidation,
  updateAideValidation,
  listAideValidation,
  aideIdValidation: mongoIdParam('id')
};
