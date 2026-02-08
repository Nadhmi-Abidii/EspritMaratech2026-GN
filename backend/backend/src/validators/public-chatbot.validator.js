const { body } = require('express-validator');

const ALLOWED_ROLES = ['user', 'assistant'];

const askPublicChatbotValidation = [
  body('message')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('message is required')
    .isLength({ max: 1000 })
    .withMessage('message must be at most 1000 characters'),
  body('history')
    .optional()
    .isArray({ max: 10 })
    .withMessage('history must be an array with at most 10 messages'),
  body('history.*')
    .optional()
    .isObject()
    .withMessage('history items must be objects'),
  body('history.*.role')
    .optional()
    .isIn(ALLOWED_ROLES)
    .withMessage('history role must be user or assistant'),
  body('history.*.content')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('history content must be a non-empty string')
    .isLength({ max: 1000 })
    .withMessage('history content must be at most 1000 characters')
];

module.exports = {
  askPublicChatbotValidation
};
