const express = require('express');
const {
  listVisites,
  createVisite,
  getVisiteById,
  updateVisite,
  deleteVisite
} = require('../controllers/visite.controller');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  createVisiteValidation,
  updateVisiteValidation,
  listVisiteValidation,
  visiteIdValidation
} = require('../validators/visite.validator');

const router = express.Router();

router.get('/', authorize('admin', 'coordinator', 'responsible', 'volunteer'), listVisiteValidation, validate, listVisites);
router.post('/', authorize('admin', 'coordinator', 'responsible', 'volunteer'), createVisiteValidation, validate, createVisite);
router.get('/:id', authorize('admin', 'coordinator', 'responsible', 'volunteer'), visiteIdValidation, validate, getVisiteById);
router.patch('/:id', authorize('admin', 'coordinator', 'responsible', 'volunteer'), updateVisiteValidation, validate, updateVisite);
router.put('/:id', authorize('admin', 'coordinator', 'responsible', 'volunteer'), updateVisiteValidation, validate, updateVisite);
router.delete('/:id', authorize('admin'), visiteIdValidation, validate, deleteVisite);

module.exports = router;
