const express = require('express');
const {
  listFamilles,
  createFamille,
  getFamilleById,
  updateFamille,
  deleteFamille
} = require('../controllers/famille.controller');
const {
  listBeneficiairesForFamille
} = require('../controllers/beneficiaire.controller');
const { listVisitesForFamille } = require('../controllers/visite.controller');
const { listAidesForFamille } = require('../controllers/aide.controller');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  createFamilleValidation,
  updateFamilleValidation,
  listFamilleValidation,
  familleIdValidation
} = require('../validators/famille.validator');
const { listBeneficiaireValidation } = require('../validators/beneficiaire.validator');
const { listVisiteValidation } = require('../validators/visite.validator');
const { listAideValidation } = require('../validators/aide.validator');

const router = express.Router();

router.get(
  '/',
  authorize('admin', 'coordinator', 'responsible', 'volunteer'),
  listFamilleValidation,
  validate,
  listFamilles
);
router.post(
  '/',
  authorize('admin', 'coordinator', 'responsible'),
  createFamilleValidation,
  validate,
  createFamille
);
router.get(
  '/:id/beneficiaires',
  authorize('admin', 'coordinator', 'responsible', 'volunteer'),
  familleIdValidation,
  listBeneficiaireValidation,
  validate,
  listBeneficiairesForFamille
);
router.get(
  '/:id/visites',
  authorize('admin', 'coordinator', 'responsible', 'volunteer'),
  familleIdValidation,
  listVisiteValidation,
  validate,
  listVisitesForFamille
);
router.get(
  '/:id/aides',
  authorize('admin', 'coordinator', 'responsible', 'volunteer'),
  familleIdValidation,
  listAideValidation,
  validate,
  listAidesForFamille
);
router.get(
  '/:id',
  authorize('admin', 'coordinator', 'responsible', 'volunteer'),
  familleIdValidation,
  validate,
  getFamilleById
);
router.patch(
  '/:id',
  authorize('admin', 'coordinator', 'responsible'),
  updateFamilleValidation,
  validate,
  updateFamille
);
router.put(
  '/:id',
  authorize('admin', 'coordinator', 'responsible'),
  updateFamilleValidation,
  validate,
  updateFamille
);
router.delete('/:id', authorize('admin'), familleIdValidation, validate, deleteFamille);

module.exports = router;
