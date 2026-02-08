const { query, param } = require('express-validator');

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('sort').optional().isString().trim(),
  query('order').optional().isIn(['asc', 'desc'])
];

const mongoIdParam = (name = 'id') => [
  param(name).isMongoId().withMessage(`${name} must be a valid MongoDB ObjectId`)
];

module.exports = {
  paginationValidation,
  mongoIdParam
};
