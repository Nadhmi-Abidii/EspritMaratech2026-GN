const Visite = require('../models/Visite');
const Aide = require('../models/Aide');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, parseSort, buildPaginationMeta } = require('../utils/query');
const {
  extractGeolocationFromPayload,
  resolveVisiteGeolocation
} = require('../services/geocoding.service');
const {
  loadFamilleAndAuthorize,
  applyRelatedFamilleScopeFilter
} = require('../services/access.service');
const { markFamilyVisited, refreshFamilyVisitStatus } = require('../services/family-tracking.service');

const validateAidesForFamille = async (aides = [], familleId) => {
  if (!aides.length) {
    return;
  }

  const existingAides = await Aide.find({ _id: { $in: aides } });

  if (existingAides.length !== aides.length) {
    throw new AppError(400, 'INVALID_AIDES', 'One or more aide references are invalid.');
  }

  const hasCrossFamilyAide = existingAides.some(
    (aide) => aide.famille.toString() !== familleId.toString()
  );

  if (hasCrossFamilyAide) {
    throw new AppError(400, 'INVALID_AIDES_FAMILY', 'All aides must belong to the same famille.');
  }
};

const buildVisiteFilter = async ({ user, query = {}, forcedFamilleId = null }) => {
  const filter = {};
  const familleId = forcedFamilleId || query.familleId;

  if (familleId) {
    await loadFamilleAndAuthorize(user, familleId, 'view visits for this family');
    filter.famille = familleId;
  } else {
    Object.assign(filter, await applyRelatedFamilleScopeFilter(user, {}, 'famille'));
  }

  if (query.fromDate || query.toDate) {
    filter.visitDate = {};

    if (query.fromDate) {
      filter.visitDate.$gte = new Date(query.fromDate);
    }

    if (query.toDate) {
      filter.visitDate.$lte = new Date(query.toDate);
    }
  }

  return filter;
};

const fetchVisites = async ({ user, query, forcedFamilleId = null }) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query, 'visitDate');
  const filter = await buildVisiteFilter({ user, query, forcedFamilleId });

  const [visites, total] = await Promise.all([
    Visite.find(filter)
      .populate('famille', 'name postalCode zone')
      .populate('aides')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Visite.countDocuments(filter)
  ]);

  return {
    visites,
    meta: buildPaginationMeta(total, page, limit)
  };
};

const listVisites = asyncHandler(async (req, res) => {
  const result = await fetchVisites({
    user: req.user,
    query: req.query
  });

  res.status(200).json({
    success: true,
    data: result.visites,
    meta: result.meta
  });
});

const listVisitesForFamille = asyncHandler(async (req, res) => {
  const result = await fetchVisites({
    user: req.user,
    query: req.query,
    forcedFamilleId: req.params.id
  });

  res.status(200).json({
    success: true,
    data: result.visites,
    meta: result.meta
  });
});

const createVisite = asyncHandler(async (req, res) => {
  const famille = await loadFamilleAndAuthorize(
    req.user,
    req.body.famille,
    'record visits for this family'
  );

  if (req.body.aides?.length) {
    await validateAidesForFamille(req.body.aides, famille._id);
  }

  const geolocationResult = await resolveVisiteGeolocation({
    payload: req.body,
    famille
  });

  const visiteData = {
    visitDate: req.body.visitDate,
    notes: req.body.notes,
    aides: req.body.aides,
    famille: req.body.famille
  };

  if (geolocationResult.geolocation) {
    visiteData.geolocation = geolocationResult.geolocation;
  }

  const visite = await Visite.create(visiteData);
  await markFamilyVisited(famille._id, visite.visitDate);
  await visite.populate('famille', 'name postalCode zone');
  await visite.populate('aides');

  res.status(201).json({
    success: true,
    data: visite,
    meta: {
      geolocationStatus: geolocationResult.status
    }
  });
});

const getVisiteById = asyncHandler(async (req, res) => {
  const visite = await Visite.findById(req.params.id)
    .populate('famille', 'name postalCode zone')
    .populate('aides');

  if (!visite) {
    throw new AppError(404, 'VISITE_NOT_FOUND', 'Visite not found.');
  }

  const familleId = typeof visite.famille === 'string' ? visite.famille : visite.famille?._id;
  await loadFamilleAndAuthorize(req.user, familleId, 'view this visit');

  res.status(200).json({
    success: true,
    data: visite
  });
});

const updateVisite = asyncHandler(async (req, res) => {
  const visite = await Visite.findById(req.params.id);

  if (!visite) {
    throw new AppError(404, 'VISITE_NOT_FOUND', 'Visite not found.');
  }

  await loadFamilleAndAuthorize(req.user, visite.famille, 'update visits for this family');
  const previousFamilleId = String(visite.famille);

  const famille = req.body.famille
    ? await loadFamilleAndAuthorize(req.user, req.body.famille, 'move visit to this family')
    : await loadFamilleAndAuthorize(req.user, visite.famille, 'update visits for this family');

  if (req.body.aides?.length) {
    await validateAidesForFamille(req.body.aides, famille._id);
  }

  const updatableFields = ['visitDate', 'notes', 'aides', 'famille'];

  updatableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      visite[field] = req.body[field];
    }
  });

  let geolocationStatus = 'unchanged';

  if (req.body.geolocation === null) {
    visite.geolocation = null;
    geolocationStatus = 'cleared';
  } else {
    const providedGeolocation = extractGeolocationFromPayload(req.body);

    if (providedGeolocation) {
      visite.geolocation = providedGeolocation;
      geolocationStatus = 'provided';
    } else if (req.body.famille) {
      const geolocationResult = await resolveVisiteGeolocation({
        payload: {},
        famille
      });

      if (geolocationResult.geolocation) {
        visite.geolocation = geolocationResult.geolocation;
      }

      geolocationStatus = geolocationResult.status;
    }
  }

  await visite.save();
  await markFamilyVisited(visite.famille, visite.visitDate);

  if (String(visite.famille) !== previousFamilleId) {
    await refreshFamilyVisitStatus(previousFamilleId);
  }

  await visite.populate('famille', 'name postalCode zone');
  await visite.populate('aides');

  res.status(200).json({
    success: true,
    data: visite,
    meta: {
      geolocationStatus
    }
  });
});

const deleteVisite = asyncHandler(async (req, res) => {
  const visite = await Visite.findById(req.params.id);

  if (!visite) {
    throw new AppError(404, 'VISITE_NOT_FOUND', 'Visite not found.');
  }

  await loadFamilleAndAuthorize(req.user, visite.famille, 'delete visits for this family');
  const familleId = String(visite.famille);
  await Visite.findByIdAndDelete(req.params.id);
  await refreshFamilyVisitStatus(familleId);

  res.status(200).json({
    success: true,
    data: {
      id: req.params.id,
      deleted: true
    }
  });
});

module.exports = {
  listVisites,
  listVisitesForFamille,
  createVisite,
  getVisiteById,
  updateVisite,
  deleteVisite
};
