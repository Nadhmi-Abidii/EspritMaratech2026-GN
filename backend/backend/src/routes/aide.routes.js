const express = require('express');
const {
  listAides,
  createAide,
  getAideById,
  updateAide,
  deleteAide
} = require('../controllers/aide.controller');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  createAideValidation,
  updateAideValidation,
  listAideValidation,
  aideIdValidation
} = require('../validators/aide.validator');

const router = express.Router();

router.get('/', authorize('admin', 'coordinator', 'responsible', 'volunteer'), listAideValidation, validate, listAides);
router.post('/', authorize('admin', 'coordinator', 'responsible', 'volunteer'), createAideValidation, validate, createAide);
router.get('/:id', authorize('admin', 'coordinator', 'responsible', 'volunteer'), aideIdValidation, validate, getAideById);
router.patch('/:id', authorize('admin', 'coordinator', 'responsible'), updateAideValidation, validate, updateAide);
router.put('/:id', authorize('admin', 'coordinator', 'responsible'), updateAideValidation, validate, updateAide);
router.delete('/:id', authorize('admin'), aideIdValidation, validate, deleteAide);

module.exports = router;
