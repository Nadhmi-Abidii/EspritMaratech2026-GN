const { body, param, query } = require('express-validator');

const associationTypeEnum = ['none', 'family', 'beneficiary'];

const listPublicPostValidation = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
];

const basePostBodyValidation = [
  body('title')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('title must be a non-empty string')
    .isLength({ max: 180 })
    .withMessage('title must be at most 180 characters'),
  body('content')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('content must be a non-empty string')
    .isLength({ max: 4000 })
    .withMessage('content must be at most 4000 characters'),
  body('donationGoal')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('donationGoal must be a positive number'),
  body('associationType')
    .optional()
    .isIn(associationTypeEnum)
    .withMessage('associationType must be one of none, family, or beneficiary'),
  body('family')
    .optional({ nullable: true })
    .custom((value) => value === null || value === '' || /^[a-fA-F0-9]{24}$/.test(String(value)))
    .withMessage('family must be a valid MongoDB ObjectId'),
  body('beneficiary')
    .optional({ nullable: true })
    .custom((value) => value === null || value === '' || /^[a-fA-F0-9]{24}$/.test(String(value)))
    .withMessage('beneficiary must be a valid MongoDB ObjectId')
];

const createPublicPostValidation = [
  ...basePostBodyValidation,
  body('title')
    .exists({ checkFalsy: true })
    .withMessage('title is required'),
  body('content')
    .exists({ checkFalsy: true })
    .withMessage('content is required'),
  body('donationGoal')
    .exists()
    .withMessage('donationGoal is required')
];

const publicPostIdValidation = [param('id').isMongoId().withMessage('id must be a valid MongoDB ObjectId')];

const updatePublicPostValidation = [...publicPostIdValidation, ...basePostBodyValidation];

const deletePublicPostValidation = [...publicPostIdValidation];

const donateToPublicPostValidation = [
  ...publicPostIdValidation,
  body('amount').isFloat({ min: 1 }).withMessage('amount must be at least 1')
];

const createPublicPostDonationCheckoutValidation = [
  ...publicPostIdValidation,
  body('amount').isFloat({ min: 1 }).withMessage('amount must be at least 1'),
  body('currency')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage('currency must be a 3-letter currency code')
];

const confirmPublicPostDonationCheckoutValidation = [
  ...publicPostIdValidation,
  body('sessionId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('sessionId is required')
];

module.exports = {
  listPublicPostValidation,
  createPublicPostValidation,
  updatePublicPostValidation,
  deletePublicPostValidation,
  donateToPublicPostValidation,
  createPublicPostDonationCheckoutValidation,
  confirmPublicPostDonationCheckoutValidation
};
