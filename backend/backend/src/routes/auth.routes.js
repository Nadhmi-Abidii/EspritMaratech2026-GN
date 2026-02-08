const express = require('express');
const { login, getMe } = require('../controllers/auth.controller');
const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { authLimiter } = require('../middlewares/rateLimiters');
const { loginValidation } = require('../validators/auth.validator');

const router = express.Router();

router.post('/login', authLimiter, loginValidation, validate, login);
router.get('/me', authenticate, getMe);

module.exports = router;
