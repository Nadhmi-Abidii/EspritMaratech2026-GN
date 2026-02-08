const { body, query } = require('express-validator');
const { paginationValidation, mongoIdParam } = require('./common.validator');

const aidTypeEnum = ['alimentaire', 'medicaments', 'aide_specifique'];
const housingSituationEnum = ['proprietaire', 'locataire', 'heberge', 'sans_logement', 'autre'];

const geolocationValidation = [
  body('geolocation.latitude').optional().isFloat({ min: -90, max: 90 }),
  body('geolocation.longitude').optional().isFloat({ min: -180, max: 180 }),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 })
];

const createFamilleValidation = [
  body('name').isString().trim().notEmpty().withMessage('name is required'),
  body('address').isString().trim().notEmpty().withMessage('address is required'),
  body('postalCode').isString().trim().notEmpty().withMessage('postalCode is required'),
  body('zone').optional().isString().trim().notEmpty().withMessage('zone must be a non-empty string'),
  body('zoneId').optional().isMongoId().withMessage('zoneId must be a valid id'),
  body().custom((payload) => {
    if (!payload.zone && !payload.zoneId) {
      throw new Error('zone or zoneId is required');
    }

    return true;
  }),
  body('phone').isString().trim().notEmpty().withMessage('phone is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('email must be valid').normalizeEmail(),
  body('numberOfPeople').isInt({ min: 1 }).withMessage('numberOfPeople must be >= 1'),
  body('date_de_naissance')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('date_de_naissance must be a valid date')
    .toDate()
    .custom((value) => value <= new Date())
    .withMessage('date_de_naissance must be in the past'),
  body('nombre_enfants')
    .optional()
    .isInt({ min: 0 })
    .withMessage('nombre_enfants must be a non-negative integer')
    .toInt(),
  body('occupation')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .notEmpty()
    .withMessage('occupation must not be empty')
    .isLength({ max: 120 }),
  body('revenu_mensuel')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('revenu_mensuel must be a non-negative number')
    .toFloat(),
  body('situation_logement').optional({ checkFalsy: true }).isIn(housingSituationEnum),
  body('aidTypes').optional().isArray(),
  body('aidTypes.*').optional().isIn(aidTypeEnum),
  body('observations').optional().isString(),
  body('donationGoal')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('donationGoal must be a non-negative number')
    .toFloat(),
  body('totalRaised')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('totalRaised must be a non-negative number')
    .toFloat(),
  body('visited').optional().isBoolean().withMessage('visited must be a boolean'),
  ...geolocationValidation
];

const updateFamilleValidation = [
  ...mongoIdParam('id'),
  body('name').optional().isString().trim().notEmpty(),
  body('address').optional().isString().trim().notEmpty(),
  body('postalCode').optional().isString().trim().notEmpty(),
  body('zone').optional().isString().trim().notEmpty(),
  body('zoneId').optional().isMongoId(),
  body('phone').optional().isString().trim().notEmpty(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('numberOfPeople').optional().isInt({ min: 1 }),
  body('date_de_naissance')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('date_de_naissance must be a valid date')
    .toDate()
    .custom((value) => value <= new Date())
    .withMessage('date_de_naissance must be in the past'),
  body('nombre_enfants')
    .optional()
    .isInt({ min: 0 })
    .withMessage('nombre_enfants must be a non-negative integer')
    .toInt(),
  body('occupation')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .notEmpty()
    .withMessage('occupation must not be empty')
    .isLength({ max: 120 }),
  body('revenu_mensuel')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('revenu_mensuel must be a non-negative number')
    .toFloat(),
  body('situation_logement').optional({ checkFalsy: true }).isIn(housingSituationEnum),
  body('aidTypes').optional().isArray(),
  body('aidTypes.*').optional().isIn(aidTypeEnum),
  body('observations').optional().isString(),
  body('donationGoal').optional().isFloat({ min: 0 }).toFloat(),
  body('totalRaised').optional().isFloat({ min: 0 }).toFloat(),
  body('visited').optional().isBoolean(),
  ...geolocationValidation
];

const listFamilleValidation = [
  ...paginationValidation,
  query('search').optional().isString().trim(),
  query('postalCode').optional().isString().trim(),
  query('zone').optional().isString().trim(),
  query('zoneId').optional().isMongoId(),
  query('aidType').optional().isIn(aidTypeEnum)
];

module.exports = {
  createFamilleValidation,
  updateFamilleValidation,
  listFamilleValidation,
  familleIdValidation: mongoIdParam('id')
};
