const express = require('express');
const {
  getPublicOverview,
  getPublicInfo,
  getPublicImpact,
  getPublicReports,
  getPublicReportView,
  getPublicReportDownload,
  askPublicChatbot
} = require('../controllers/public.controller');
const {
  listPublicPosts,
  createPublicPost,
  updatePublicPost,
  deletePublicPost,
  donateToPublicPost,
  createPublicPostDonationCheckout,
  confirmPublicPostDonationCheckout
} = require('../controllers/public-post.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  listPublicPostValidation,
  createPublicPostValidation,
  updatePublicPostValidation,
  deletePublicPostValidation,
  donateToPublicPostValidation,
  createPublicPostDonationCheckoutValidation,
  confirmPublicPostDonationCheckoutValidation
} = require('../validators/public-post.validator');
const { askPublicChatbotValidation } = require('../validators/public-chatbot.validator');
const { publicChatbotLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.get('/', getPublicOverview);
router.get('/info', getPublicInfo);
router.get('/impact', getPublicImpact);
router.get('/posts', listPublicPostValidation, validate, listPublicPosts);
router.post(
  '/posts',
  authenticate,
  authorize('admin', 'responsible'),
  createPublicPostValidation,
  validate,
  createPublicPost
);
router.patch(
  '/posts/:id',
  authenticate,
  authorize('admin', 'responsible'),
  updatePublicPostValidation,
  validate,
  updatePublicPost
);
router.put(
  '/posts/:id',
  authenticate,
  authorize('admin', 'responsible'),
  updatePublicPostValidation,
  validate,
  updatePublicPost
);
router.delete(
  '/posts/:id',
  authenticate,
  authorize('admin', 'responsible'),
  deletePublicPostValidation,
  validate,
  deletePublicPost
);
router.post(
  '/posts/:id/donations',
  authenticate,
  authorize('admin', 'responsible'),
  donateToPublicPostValidation,
  validate,
  donateToPublicPost
);
router.post(
  '/posts/:id/donations/checkout',
  createPublicPostDonationCheckoutValidation,
  validate,
  createPublicPostDonationCheckout
);
router.post(
  '/posts/:id/donations/confirm',
  confirmPublicPostDonationCheckoutValidation,
  validate,
  confirmPublicPostDonationCheckout
);
router.get('/reports', getPublicReports);
router.get('/reports/:slug/view', getPublicReportView);
router.get('/reports/:slug/download', getPublicReportDownload);
router.post('/chatbot/ask', publicChatbotLimiter, askPublicChatbotValidation, validate, askPublicChatbot);

module.exports = router;
