const express = require('express');
const {
  listZones,
  createZone,
  getZoneById,
  updateZone,
  deleteZone
} = require('../controllers/zone.controller');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  listZoneValidation,
  createZoneValidation,
  updateZoneValidation,
  zoneIdValidation
} = require('../validators/zone.validator');

const router = express.Router();

router.get('/', authorize('admin', 'responsible', 'coordinator'), listZoneValidation, validate, listZones);
router.post('/', authorize('admin'), createZoneValidation, validate, createZone);
router.get('/:id', authorize('admin', 'responsible', 'coordinator'), zoneIdValidation, validate, getZoneById);
router.patch('/:id', authorize('admin'), updateZoneValidation, validate, updateZone);
router.put('/:id', authorize('admin'), updateZoneValidation, validate, updateZone);
router.delete('/:id', authorize('admin'), zoneIdValidation, validate, deleteZone);

module.exports = router;
