const Beneficiaire = require('../models/Beneficiaire');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, parseSort, buildPaginationMeta } = require('../utils/query');
const {
  loadFamilleAndAuthorize,
  applyRelatedFamilleScopeFilter
} = require('../services/access.service');

const buildBeneficiaireFilter = async ({ user, query = {}, forcedFamilleId = null }) => {
  const filter = {};
  const familleId = forcedFamilleId || query.familleId;

  if (familleId) {
    await loadFamilleAndAuthorize(user, familleId, 'view beneficiaries for this family');
    filter.famille = familleId;
  } else {
    Object.assign(filter, await applyRelatedFamilleScopeFilter(user, {}, 'famille'));
  }

  if (query.gender) {
    filter.gender = query.gender;
  }

  if (query.hasDisability !== undefined) {
    filter.hasDisability = String(query.hasDisability).toLowerCase() === 'true';
  }

  return filter;
};

const fetchBeneficiaires = async ({ user, query, forcedFamilleId = null }) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, 'createdAt');
  const filter = await buildBeneficiaireFilter({ user, query, forcedFamilleId });

  const [beneficiaires, total] = await Promise.all([
    Beneficiaire.find(filter)
      .populate('famille', 'name postalCode zone')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Beneficiaire.countDocuments(filter)
  ]);

  return {
    beneficiaires,
    meta: buildPaginationMeta(total, page, limit)
  };
};

const listBeneficiaires = asyncHandler(async (req, res) => {
  const result = await fetchBeneficiaires({
    user: req.user,
    query: req.query
  });

  res.status(200).json({
    success: true,
    data: result.beneficiaires,
    meta: result.meta
  });
});

const listBeneficiairesForFamille = asyncHandler(async (req, res) => {
  const result = await fetchBeneficiaires({
    user: req.user,
    query: req.query,
    forcedFamilleId: req.params.id
  });

  res.status(200).json({
    success: true,
    data: result.beneficiaires,
    meta: result.meta
  });
});

const createBeneficiaire = asyncHandler(async (req, res) => {
  await loadFamilleAndAuthorize(req.user, req.body.famille, 'add beneficiaries to this family');

  const beneficiaire = await Beneficiaire.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    birthDate: req.body.birthDate,
    gender: req.body.gender,
    hasDisability: req.body.hasDisability,
    healthHistory: req.body.healthHistory,
    famille: req.body.famille
  });

  await beneficiaire.populate('famille', 'name postalCode zone');

  res.status(201).json({
    success: true,
    data: beneficiaire
  });
});

const getBeneficiaireById = asyncHandler(async (req, res) => {
  const beneficiaire = await Beneficiaire.findById(req.params.id).populate(
    'famille',
    'name postalCode zone'
  );

  if (!beneficiaire) {
    throw new AppError(404, 'BENEFICIAIRE_NOT_FOUND', 'Beneficiaire not found.');
  }

  const familleId =
    typeof beneficiaire.famille === 'string' ? beneficiaire.famille : beneficiaire.famille?._id;
  await loadFamilleAndAuthorize(req.user, familleId, 'view this beneficiary');

  res.status(200).json({
    success: true,
    data: beneficiaire
  });
});

const updateBeneficiaire = asyncHandler(async (req, res) => {
  const beneficiaire = await Beneficiaire.findById(req.params.id);

  if (!beneficiaire) {
    throw new AppError(404, 'BENEFICIAIRE_NOT_FOUND', 'Beneficiaire not found.');
  }

  await loadFamilleAndAuthorize(req.user, beneficiaire.famille, 'update beneficiaries for this family');

  if (req.body.famille) {
    await loadFamilleAndAuthorize(req.user, req.body.famille, 'move beneficiary to this family');
  }

  const updatableFields = [
    'firstName',
    'lastName',
    'birthDate',
    'gender',
    'hasDisability',
    'healthHistory',
    'famille'
  ];

  updatableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      beneficiaire[field] = req.body[field];
    }
  });

  await beneficiaire.save();
  await beneficiaire.populate('famille', 'name postalCode zone');

  res.status(200).json({
    success: true,
    data: beneficiaire
  });
});

const deleteBeneficiaire = asyncHandler(async (req, res) => {
  const beneficiaire = await Beneficiaire.findById(req.params.id);

  if (!beneficiaire) {
    throw new AppError(404, 'BENEFICIAIRE_NOT_FOUND', 'Beneficiaire not found.');
  }

  await loadFamilleAndAuthorize(
    req.user,
    beneficiaire.famille,
    'delete beneficiaries from this family'
  );
  await Beneficiaire.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    data: {
      id: req.params.id,
      deleted: true
    }
  });
});

module.exports = {
  listBeneficiaires,
  listBeneficiairesForFamille,
  createBeneficiaire,
  getBeneficiaireById,
  updateBeneficiaire,
  deleteBeneficiaire
};
