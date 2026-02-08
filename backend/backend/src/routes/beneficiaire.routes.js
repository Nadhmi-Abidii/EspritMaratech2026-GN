const express = require('express');
const {
  listBeneficiaires,
  createBeneficiaire,
  getBeneficiaireById,
  updateBeneficiaire,
  deleteBeneficiaire
} = require('../controllers/beneficiaire.controller');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  createBeneficiaireValidation,
  updateBeneficiaireValidation,
  listBeneficiaireValidation,
  beneficiaireIdValidation
} = require('../validators/beneficiaire.validator');

const router = express.Router();

router.get(
  '/',
  authorize('admin', 'coordinator', 'responsible', 'volunteer'),
  listBeneficiaireValidation,
  validate,
  listBeneficiaires
);
router.post(
  '/',
  authorize('admin', 'coordinator', 'responsible', 'volunteer'),
  createBeneficiaireValidation,
  validate,
  createBeneficiaire
);
router.get(
  '/:id',
  authorize('admin', 'coordinator', 'responsible', 'volunteer'),
  beneficiaireIdValidation,
  validate,
  getBeneficiaireById
);
router.patch(
  '/:id',
  authorize('admin', 'coordinator', 'responsible'),
  updateBeneficiaireValidation,
  validate,
  updateBeneficiaire
);
router.put(
  '/:id',
  authorize('admin', 'coordinator', 'responsible'),
  updateBeneficiaireValidation,
  validate,
  updateBeneficiaire
);
router.delete('/:id', authorize('admin'), beneficiaireIdValidation, validate, deleteBeneficiaire);

module.exports = router;
