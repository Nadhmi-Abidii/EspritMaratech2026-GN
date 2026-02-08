const { body, query } = require('express-validator');
const { paginationValidation, mongoIdParam } = require('./common.validator');

const createBeneficiaireValidation = [
  body('firstName').isString().trim().notEmpty().withMessage('firstName is required'),
  body('lastName').isString().trim().notEmpty().withMessage('lastName is required'),
  body('birthDate').isISO8601().withMessage('birthDate must be a valid date'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('hasDisability').optional().isBoolean(),
  body('healthHistory').optional().isString(),
  body('famille').isMongoId().withMessage('famille must be a valid id')
];

const updateBeneficiaireValidation = [
  ...mongoIdParam('id'),
  body('firstName').optional().isString().trim().notEmpty(),
  body('lastName').optional().isString().trim().notEmpty(),
  body('birthDate').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('hasDisability').optional().isBoolean(),
  body('healthHistory').optional().isString(),
  body('famille').optional().isMongoId()
];

const listBeneficiaireValidation = [
  ...paginationValidation,
  query('familleId').optional().isMongoId(),
  query('gender').optional().isIn(['male', 'female', 'other']),
  query('hasDisability').optional().isBoolean()
];

module.exports = {
  createBeneficiaireValidation,
  updateBeneficiaireValidation,
  listBeneficiaireValidation,
  beneficiaireIdValidation: mongoIdParam('id')
};
