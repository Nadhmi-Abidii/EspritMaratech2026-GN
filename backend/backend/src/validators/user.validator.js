const { body, query } = require('express-validator');
const { paginationValidation, mongoIdParam } = require('./common.validator');

const createUserValidation = [
  body('name').isString().trim().notEmpty().withMessage('name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').optional().isString().trim().notEmpty().withMessage('phone must be a non-empty string'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters long'),
  body('role').isIn(['admin', 'volunteer', 'coordinator', 'responsible']).withMessage('Invalid role'),
  body('assignedZones').optional().isArray(),
  body('assignedZones.*').optional().isString().trim().notEmpty(),
  body('assignedFamilies').optional().isArray(),
  body('assignedFamilies.*').optional().isMongoId()
];

const updateUserValidation = [
  ...mongoIdParam('id'),
  body('name').optional().isString().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim().notEmpty(),
  body('password').optional().isString().isLength({ min: 8 }),
  body('role').optional().isIn(['admin', 'volunteer', 'coordinator', 'responsible']),
  body('isActive').optional().isBoolean(),
  body('assignedZones').optional().isArray(),
  body('assignedZones.*').optional().isString().trim().notEmpty(),
  body('assignedFamilies').optional().isArray(),
  body('assignedFamilies.*').optional().isMongoId()
];

const listUserValidation = [
  ...paginationValidation,
  query('role').optional().isIn(['admin', 'volunteer', 'coordinator', 'responsible']),
  query('isActive').optional().isBoolean(),
  query('search').optional().isString().trim(),
  query('assignedZone').optional().isString().trim()
];

module.exports = {
  createUserValidation,
  updateUserValidation,
  listUserValidation,
  userIdValidation: mongoIdParam('id')
};
