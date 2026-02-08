const express = require('express');
const {
  listUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/user.controller');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  createUserValidation,
  updateUserValidation,
  listUserValidation,
  userIdValidation
} = require('../validators/user.validator');

const router = express.Router();

router.get('/', authorize('admin'), listUserValidation, validate, listUsers);
router.post('/', authorize('admin'), createUserValidation, validate, createUser);
router.get('/:id', authorize('admin'), userIdValidation, validate, getUserById);
router.patch('/:id', authorize('admin'), updateUserValidation, validate, updateUser);
router.put('/:id', authorize('admin'), updateUserValidation, validate, updateUser);
router.delete('/:id', authorize('admin'), userIdValidation, validate, deleteUser);

module.exports = router;
