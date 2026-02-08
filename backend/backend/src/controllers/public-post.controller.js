const PublicPost = require('../models/PublicPost');
const Famille = require('../models/Famille');
const Beneficiaire = require('../models/Beneficiaire');
const Aide = require('../models/Aide');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const {
  createDonationCheckoutSession,
  fetchDonationCheckoutSession
} = require('../services/payment.service');
const { loadFamilleAndAuthorize } = require('../services/access.service');
const { refreshFamiliesDonationTotals } = require('../services/family-tracking.service');

const ASSOCIATION_TYPES = new Set(['none', 'family', 'beneficiary']);

const clampProgress = (amountRaised, donationGoal) => {
  if (!donationGoal || donationGoal <= 0) {
    return 0;
  }

  return Math.min(100, Number(((amountRaised / donationGoal) * 100).toFixed(2)));
};

const normalizeDonationAmount = (amount) => Number(Number(amount || 0).toFixed(2));

const toIdString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value._id) {
    return String(value._id);
  }

  return String(value);
};

const normalizeOptionalId = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  return toIdString(value);
};

const isProvided = (value) => value !== undefined;

const resolvePostFamilyId = (post) => {
  if (!post) {
    return null;
  }

  const familyId = toIdString(post.family);

  if (familyId) {
    return familyId;
  }

  if (post.beneficiary && typeof post.beneficiary === 'object') {
    const beneficiaryFamily =
      post.beneficiary.famille && typeof post.beneficiary.famille === 'object'
        ? post.beneficiary.famille
        : post.beneficiary.famille;

    return toIdString(beneficiaryFamily);
  }

  return null;
};

const createAideForDonation = async ({ post, amount, createdBy, note, donationSessionId = null }) => {
  const familleId = resolvePostFamilyId(post);
  const creatorId = toIdString(createdBy);

  if (!familleId || !creatorId) {
    return null;
  }

  const normalizedAmount = normalizeDonationAmount(amount);

  if (!normalizedAmount || normalizedAmount <= 0) {
    return null;
  }

  try {
    return await Aide.create({
      type: 'aide_specifique',
      quantity: normalizedAmount,
      publicPost: post?._id || null,
      donationSessionId: donationSessionId || undefined,
      observations: note || 'Donation collecte via une campagne publique.',
      famille: familleId,
      createdBy: creatorId
    });
  } catch (error) {
    // Avoid failing the donation flow if the auxiliary aid record cannot be persisted (e.g. duplicate session id).
    const code = error && typeof error === 'object' ? error.code : null;
    if (code === 11000) {
      return null;
    }

    return null;
  }
};

const populatePostRelations = (query) =>
  query
    .populate('createdBy', 'name role')
    .populate('family', 'name zone zoneId postalCode donationGoal totalRaised goalReached visited')
    .populate({
      path: 'beneficiary',
      select: 'firstName lastName famille',
      populate: {
        path: 'famille',
        select: 'name zone zoneId postalCode donationGoal totalRaised goalReached visited'
      }
    });

const populatePostDocument = async (post) => {
  await post.populate('createdBy', 'name role');
  await post.populate('family', 'name zone zoneId postalCode donationGoal totalRaised goalReached visited');
  await post.populate({
    path: 'beneficiary',
    select: 'firstName lastName famille',
    populate: {
      path: 'famille',
      select: 'name zone zoneId postalCode donationGoal totalRaised goalReached visited'
    }
  });

  return post;
};

const ensureResponsibleCanManagePost = async (user, post, action) => {
  if (!user || user.role === 'admin') {
    return;
  }

  const familyId = toIdString(post?.family);

  if (!familyId) {
    throw new AppError(
      403,
      'AUTH_FORBIDDEN',
      'Responsible users can only manage posts linked to families in their assigned zones.'
    );
  }

  await loadFamilleAndAuthorize(user, familyId, action);
};

const resolveAssociation = async (payload, existingPost = null, user = null) => {
  const associationType =
    payload.associationType !== undefined
      ? payload.associationType
      : existingPost?.associationType || 'none';

  if (!ASSOCIATION_TYPES.has(associationType)) {
    throw new AppError(422, 'PUBLIC_POST_ASSOCIATION_INVALID', 'Invalid association type.');
  }

  const nextFamilyId = isProvided(payload.family)
    ? normalizeOptionalId(payload.family)
    : toIdString(existingPost?.family);
  const nextBeneficiaryId = isProvided(payload.beneficiary)
    ? normalizeOptionalId(payload.beneficiary)
    : toIdString(existingPost?.beneficiary);

  if (associationType === 'none') {
    if (user?.role === 'responsible') {
      throw new AppError(
        422,
        'PUBLIC_POST_ASSOCIATION_REQUIRED',
        'Responsible users must associate posts to a family or beneficiary.'
      );
    }

    return {
      associationType: 'none',
      family: null,
      beneficiary: null
    };
  }

  if (associationType === 'family') {
    if (!nextFamilyId) {
      throw new AppError(
        422,
        'PUBLIC_POST_ASSOCIATION_REQUIRED',
        'family is required when associationType is family.'
      );
    }

    const family = await Famille.findById(nextFamilyId).select('_id name zone zoneId');

    if (!family) {
      throw new AppError(404, 'PUBLIC_POST_FAMILY_NOT_FOUND', 'Associated family was not found.');
    }

    if (user && user.role !== 'admin') {
      await loadFamilleAndAuthorize(user, family._id, 'associate a post with this family');
    }

    return {
      associationType: 'family',
      family: family._id,
      beneficiary: null
    };
  }

  if (!nextBeneficiaryId) {
    throw new AppError(
      422,
      'PUBLIC_POST_ASSOCIATION_REQUIRED',
      'beneficiary is required when associationType is beneficiary.'
    );
  }

  const beneficiary = await Beneficiaire.findById(nextBeneficiaryId).select('_id famille');

  if (!beneficiary) {
    throw new AppError(404, 'PUBLIC_POST_BENEFICIARY_NOT_FOUND', 'Associated beneficiary was not found.');
  }

  if (user && user.role !== 'admin') {
    if (!beneficiary.famille) {
      throw new AppError(
        422,
        'PUBLIC_POST_BENEFICIARY_FAMILY_REQUIRED',
        'Beneficiary must be linked to a family before creating a responsible post.'
      );
    }

    await loadFamilleAndAuthorize(user, beneficiary.famille, 'associate a post with this beneficiary');
  }

  return {
    associationType: 'beneficiary',
    family: beneficiary.famille || null,
    beneficiary: beneficiary._id
  };
};

const mapPublicPost = (post) => {
  const createdBy =
    post.createdBy && typeof post.createdBy === 'object'
      ? {
          _id: post.createdBy._id,
          name: post.createdBy.name,
          role: post.createdBy.role
        }
      : null;

  const family =
    post.family && typeof post.family === 'object'
      ? {
          _id: post.family._id,
          name: post.family.name,
          zone: post.family.zone,
          zoneId: post.family.zoneId || null,
          postalCode: post.family.postalCode,
          donationGoal: Number(post.family.donationGoal || 0),
          totalRaised: Number(post.family.totalRaised || 0),
          goalReached: !!post.family.goalReached,
          visited: !!post.family.visited
        }
      : null;

  const beneficiary =
    post.beneficiary && typeof post.beneficiary === 'object'
      ? {
          _id: post.beneficiary._id,
          firstName: post.beneficiary.firstName,
          lastName: post.beneficiary.lastName,
          family:
            post.beneficiary.famille && typeof post.beneficiary.famille === 'object'
              ? {
                  _id: post.beneficiary.famille._id,
                  name: post.beneficiary.famille.name,
                  zone: post.beneficiary.famille.zone,
                  zoneId: post.beneficiary.famille.zoneId || null,
                  postalCode: post.beneficiary.famille.postalCode,
                  donationGoal: Number(post.beneficiary.famille.donationGoal || 0),
                  totalRaised: Number(post.beneficiary.famille.totalRaised || 0),
                  goalReached: !!post.beneficiary.famille.goalReached,
                  visited: !!post.beneficiary.famille.visited
                }
              : null
        }
      : null;

  const donationGoal = Number(post.donationGoal || 0);
  const amountRaised = Number(post.amountRaised || 0);

  return {
    _id: post._id,
    title: post.title,
    content: post.content,
    donationGoal,
    amountRaised,
    donationCount: Number(post.donationCount || 0),
    remainingAmount: Math.max(donationGoal - amountRaised, 0),
    progressPercent: clampProgress(amountRaised, donationGoal),
    goalReached: amountRaised >= donationGoal,
    associationType: post.associationType || 'none',
    familyId: family?._id || null,
    beneficiaryId: beneficiary?._id || null,
    association: {
      type: post.associationType || 'none',
      family,
      beneficiary
    },
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    createdBy
  };
};

const listPublicPosts = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);

  const posts = await populatePostRelations(PublicPost.find({}))
    .sort({ createdAt: -1 })
    .limit(limit);

  res.status(200).json({
    success: true,
    data: posts.map(mapPublicPost)
  });
});

const createPublicPost = asyncHandler(async (req, res) => {
  const association = await resolveAssociation(req.body, null, req.user);

  const post = await PublicPost.create({
    title: req.body.title,
    content: req.body.content,
    donationGoal: req.body.donationGoal,
    amountRaised: 0,
    donationCount: 0,
    associationType: association.associationType,
    family: association.family,
    beneficiary: association.beneficiary,
    createdBy: req.user._id
  });

  await refreshFamiliesDonationTotals([association.family]);
  await populatePostDocument(post);

  res.status(201).json({
    success: true,
    data: mapPublicPost(post)
  });
});

const updatePublicPost = asyncHandler(async (req, res) => {
  const post = await PublicPost.findById(req.params.id);

  if (!post) {
    throw new AppError(404, 'PUBLIC_POST_NOT_FOUND', 'Public post was not found.');
  }

  await ensureResponsibleCanManagePost(req.user, post, 'update this post');
  const previousFamilyId = toIdString(post.family);

  if (req.body.title !== undefined) {
    post.title = req.body.title;
  }

  if (req.body.content !== undefined) {
    post.content = req.body.content;
  }

  if (req.body.donationGoal !== undefined) {
    post.donationGoal = req.body.donationGoal;
  }

  const association = await resolveAssociation(req.body, post, req.user);
  post.associationType = association.associationType;
  post.family = association.family;
  post.beneficiary = association.beneficiary;

  await post.save();
  await refreshFamiliesDonationTotals([previousFamilyId, association.family]);
  await populatePostDocument(post);

  res.status(200).json({
    success: true,
    data: mapPublicPost(post)
  });
});

const deletePublicPost = asyncHandler(async (req, res) => {
  const existingPost = await PublicPost.findById(req.params.id);

  if (!existingPost) {
    throw new AppError(404, 'PUBLIC_POST_NOT_FOUND', 'Public post was not found.');
  }

  await ensureResponsibleCanManagePost(req.user, existingPost, 'delete this post');

  const familyId = toIdString(existingPost.family);
  await PublicPost.findByIdAndDelete(req.params.id);
  await refreshFamiliesDonationTotals([familyId]);

  res.status(200).json({
    success: true,
    data: {
      id: req.params.id,
      deleted: true
    }
  });
});

const donateToPublicPost = asyncHandler(async (req, res) => {
  const amount = normalizeDonationAmount(req.body.amount);
  const postToValidate = await PublicPost.findById(req.params.id).select('_id family');

  if (!postToValidate) {
    throw new AppError(404, 'PUBLIC_POST_NOT_FOUND', 'Public post was not found.');
  }

  await ensureResponsibleCanManagePost(req.user, postToValidate, 'register donations for this post');

  const post = await populatePostRelations(
    PublicPost.findByIdAndUpdate(
      req.params.id,
      {
        $inc: {
          amountRaised: amount,
          donationCount: 1
        }
      },
      {
        new: true,
        runValidators: true
      }
    )
  );

  if (!post) {
    throw new AppError(404, 'PUBLIC_POST_NOT_FOUND', 'Public post was not found.');
  }

  await createAideForDonation({
    post,
    amount,
    createdBy: req.user?._id,
    note: `Donation enregistree depuis une campagne publique: ${post.title}.`
  });

  await refreshFamiliesDonationTotals([post.family]);

  res.status(200).json({
    success: true,
    data: mapPublicPost(post)
  });
});

const createPublicPostDonationCheckout = asyncHandler(async (req, res) => {
  const post = await PublicPost.findById(req.params.id).select('_id title donationGoal');

  if (!post) {
    throw new AppError(404, 'PUBLIC_POST_NOT_FOUND', 'Public post was not found.');
  }

  const amount = normalizeDonationAmount(req.body.amount);

  const checkout = await createDonationCheckoutSession({
    postId: post._id.toString(),
    postTitle: post.title,
    donationGoal: Number(post.donationGoal || 0),
    amount,
    currency: req.body.currency
  });

  res.status(201).json({
    success: true,
    data: {
      ...checkout,
      amount
    }
  });
});

const confirmPublicPostDonationCheckout = asyncHandler(async (req, res) => {
  const sessionId = String(req.body.sessionId || '').trim();
  const checkoutSession = await fetchDonationCheckoutSession(sessionId);

  if (!checkoutSession.postId || checkoutSession.postId !== req.params.id) {
    throw new AppError(
      400,
      'PAYMENT_SESSION_MISMATCH',
      'This payment session does not belong to the requested post.'
    );
  }

  if (checkoutSession.paymentStatus !== 'paid') {
    throw new AppError(
      409,
      'DONATION_NOT_COMPLETED',
      'Donation payment is not completed yet. Please finish checkout first.'
    );
  }

  const confirmedAmount = normalizeDonationAmount(checkoutSession.amount);

  if (!confirmedAmount || confirmedAmount <= 0) {
    throw new AppError(422, 'INVALID_DONATION_AMOUNT', 'Invalid donation amount returned by payment provider.');
  }

  let post = await populatePostRelations(
    PublicPost.findOneAndUpdate(
      {
        _id: req.params.id,
        processedDonationSessions: {
          $ne: sessionId
        }
      },
      {
        $inc: {
          amountRaised: confirmedAmount,
          donationCount: 1
        },
        $addToSet: {
          processedDonationSessions: sessionId
        }
      },
      {
        new: true,
        runValidators: true
      }
    )
  );

  let alreadyProcessed = false;

  if (!post) {
    const existingPost = await populatePostRelations(PublicPost.findById(req.params.id));

    if (!existingPost) {
      throw new AppError(404, 'PUBLIC_POST_NOT_FOUND', 'Public post was not found.');
    }

    post = existingPost;
    alreadyProcessed = true;
  }

  await createAideForDonation({
    post,
    amount: confirmedAmount,
    createdBy: post.createdBy,
    donationSessionId: sessionId,
    note: `Donation confirmee via paiement: ${post.title}.`
  });

  await refreshFamiliesDonationTotals([post.family]);

  res.status(200).json({
    success: true,
    data: {
      post: mapPublicPost(post),
      donation: {
        sessionId,
        amount: confirmedAmount,
        currency: String(checkoutSession.currency || 'usd').toUpperCase(),
        provider: checkoutSession.provider,
        alreadyProcessed
      },
      message: alreadyProcessed
        ? 'Donation already confirmed. Thank you for your support.'
        : 'Thank you for your donation!'
    }
  });
});

module.exports = {
  listPublicPosts,
  createPublicPost,
  updatePublicPost,
  deletePublicPost,
  donateToPublicPost,
  createPublicPostDonationCheckout,
  confirmPublicPostDonationCheckout
};
