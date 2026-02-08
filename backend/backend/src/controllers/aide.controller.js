const Aide = require('../models/Aide');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, parseSort, buildPaginationMeta } = require('../utils/query');
const {
  loadFamilleAndAuthorize,
  applyRelatedFamilleScopeFilter
} = require('../services/access.service');

const buildAideFilter = async ({ user, query = {}, forcedFamilleId = null }) => {
  const filter = {};
  const familleId = forcedFamilleId || query.familleId;

  if (familleId) {
    await loadFamilleAndAuthorize(user, familleId, 'view aids for this family');
    filter.famille = familleId;
  } else {
    Object.assign(filter, await applyRelatedFamilleScopeFilter(user, {}, 'famille'));
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.fromDate || query.toDate) {
    filter.aidDate = {};

    if (query.fromDate) {
      filter.aidDate.$gte = new Date(query.fromDate);
    }

    if (query.toDate) {
      filter.aidDate.$lte = new Date(query.toDate);
    }
  }

  return filter;
};

const fetchAides = async ({ user, query, forcedFamilleId = null }) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, 'aidDate');
  const filter = await buildAideFilter({ user, query, forcedFamilleId });

  const [aides, total] = await Promise.all([
    Aide.find(filter)
      .populate('famille', 'name postalCode zone')
      .populate('createdBy', 'name email role')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Aide.countDocuments(filter)
  ]);

  return {
    aides,
    meta: buildPaginationMeta(total, page, limit)
  };
};

const listAides = asyncHandler(async (req, res) => {
  const result = await fetchAides({
    user: req.user,
    query: req.query
  });

  res.status(200).json({
    success: true,
    data: result.aides,
    meta: result.meta
  });
});

const listAidesForFamille = asyncHandler(async (req, res) => {
  const result = await fetchAides({
    user: req.user,
    query: req.query,
    forcedFamilleId: req.params.id
  });

  res.status(200).json({
    success: true,
    data: result.aides,
    meta: result.meta
  });
});

const createAide = asyncHandler(async (req, res) => {
  await loadFamilleAndAuthorize(req.user, req.body.famille, 'record aids for this family');

  const aide = await Aide.create({
    type: req.body.type,
    quantity: req.body.quantity,
    aidDate: req.body.aidDate,
    observations: req.body.observations,
    famille: req.body.famille,
    createdBy: req.user._id
  });

  await aide.populate('famille', 'name postalCode zone');
  await aide.populate('createdBy', 'name email role');

  res.status(201).json({
    success: true,
    data: aide
  });
});

const getAideById = asyncHandler(async (req, res) => {
  const aide = await Aide.findById(req.params.id)
    .populate('famille', 'name postalCode zone')
    .populate('createdBy', 'name email role');

  if (!aide) {
    throw new AppError(404, 'AIDE_NOT_FOUND', 'Aide not found.');
  }

  const familleId = typeof aide.famille === 'string' ? aide.famille : aide.famille?._id;
  await loadFamilleAndAuthorize(req.user, familleId, 'view this aid');

  res.status(200).json({
    success: true,
    data: aide
  });
});

const updateAide = asyncHandler(async (req, res) => {
  const aide = await Aide.findById(req.params.id);

  if (!aide) {
    throw new AppError(404, 'AIDE_NOT_FOUND', 'Aide not found.');
  }

  await loadFamilleAndAuthorize(req.user, aide.famille, 'update aids for this family');

  if (req.body.famille) {
    await loadFamilleAndAuthorize(req.user, req.body.famille, 'move aid to this family');
  }

  const updatableFields = ['type', 'quantity', 'aidDate', 'observations', 'famille'];

  updatableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      aide[field] = req.body[field];
    }
  });

  await aide.save();
  await aide.populate('famille', 'name postalCode zone');
  await aide.populate('createdBy', 'name email role');

  res.status(200).json({
    success: true,
    data: aide
  });
});

const deleteAide = asyncHandler(async (req, res) => {
  const aide = await Aide.findById(req.params.id);

  if (!aide) {
    throw new AppError(404, 'AIDE_NOT_FOUND', 'Aide not found.');
  }

  await loadFamilleAndAuthorize(req.user, aide.famille, 'delete aids from this family');
  await Aide.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    data: {
      id: req.params.id,
      deleted: true
    }
  });
});

module.exports = {
  listAides,
  listAidesForFamille,
  createAide,
  getAideById,
  updateAide,
  deleteAide
};
