const { body, query } = require('express-validator');
const { paginationValidation, mongoIdParam } = require('./common.validator');

const createZoneValidation = [
  body('name').isString().trim().notEmpty().withMessage('name is required'),
  body('responsibleId').optional({ nullable: true }).isMongoId().withMessage('responsibleId must be a valid id'),
  body('responsible').optional().isObject().withMessage('responsible must be an object'),
  body('responsible.name')
    .if(body('responsibleId').not().exists())
    .isString()
    .trim()
    .notEmpty()
    .withMessage('responsible.name is required when responsibleId is not provided'),
  body('responsible.email')
    .if(body('responsibleId').not().exists())
    .isEmail()
    .withMessage('responsible.email is required and must be valid')
    .normalizeEmail(),
  body('responsible.phone')
    .if(body('responsibleId').not().exists())
    .isString()
    .trim()
    .notEmpty()
    .withMessage('responsible.phone is required when responsibleId is not provided'),
  body('responsible.password')
    .optional({ nullable: true })
    .isString()
    .isLength({ min: 8 })
    .withMessage('responsible.password must be at least 8 characters')
];

const updateZoneValidation = [
  ...mongoIdParam('id'),
  body('name').optional().isString().trim().notEmpty(),
  body('responsibleId').optional({ nullable: true }).isMongoId(),
  body('responsible').optional().isObject(),
  body('responsible.name').optional().isString().trim().notEmpty(),
  body('responsible.email').optional().isEmail().normalizeEmail(),
  body('responsible.phone').optional().isString().trim().notEmpty(),
  body('responsible.password').optional().isString().isLength({ min: 8 })
];

const listZoneValidation = [
  ...paginationValidation,
  query('search').optional().isString().trim(),
  query('responsibleId').optional().isMongoId()
];

module.exports = {
  createZoneValidation,
  updateZoneValidation,
  listZoneValidation,
  zoneIdValidation: mongoIdParam('id')
};
