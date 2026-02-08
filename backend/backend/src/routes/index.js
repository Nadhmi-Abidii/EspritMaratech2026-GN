const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authRoutes = require('./auth.routes');
const publicRoutes = require('./public.routes');
const userRoutes = require('./user.routes');
const zoneRoutes = require('./zone.routes');
const familleRoutes = require('./famille.routes');
const beneficiaireRoutes = require('./beneficiaire.routes');
const aideRoutes = require('./aide.routes');
const visiteRoutes = require('./visite.routes');

const router = express.Router();

router.use('/', authRoutes);
router.use('/public', publicRoutes);
router.use('/users', authenticate, userRoutes);
router.use('/zones', authenticate, zoneRoutes);
router.use('/familles', authenticate, familleRoutes);
router.use('/beneficiaires', authenticate, beneficiaireRoutes);
router.use('/aides', authenticate, aideRoutes);
router.use('/visites', authenticate, visiteRoutes);

module.exports = router;
