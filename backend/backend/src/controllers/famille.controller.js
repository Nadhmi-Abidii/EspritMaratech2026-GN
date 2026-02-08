const Famille = require('../models/Famille');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, parseSort, buildPaginationMeta } = require('../utils/query');
const {
  extractGeolocationFromPayload,
  resolveFamilyGeolocation
} = require('../services/geocoding.service');
const {
  ensureCanAccessFamille,
  ensureCanCreateFamilleInZone,
  applyFamilleScopeFilter
} = require('../services/access.service');
const { resolveZone, syncFamilyZoneMembership } = require('../services/zone.service');

const toBoolean = (value) => String(value).toLowerCase() === 'true';

const resolveFamilyZone = async ({ zone, zoneId, allowCreate = false }) => {
  const resolved = await resolveZone({
    zoneName: zone,
    zoneId,
    allowCreate
  });

  if (!resolved) {
    throw new AppError(404, 'ZONE_NOT_FOUND', 'Zone not found.');
  }

  return resolved;
};

const listFamilles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, 'createdAt');

  const filter = {};

  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { address: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  if (req.query.postalCode) {
    filter.postalCode = req.query.postalCode;
  }

  if (req.query.zone) {
    filter.zone = req.query.zone;
  }

  if (req.query.zoneId) {
    filter.zoneId = req.query.zoneId;
  }

  if (req.query.aidType) {
    filter.aidTypes = req.query.aidType;
  }

  if (req.query.visited !== undefined) {
    filter.visited = toBoolean(req.query.visited);
  }

  if (req.query.goalReached !== undefined) {
    filter.goalReached = toBoolean(req.query.goalReached);
  }

  const scopedFilter = applyFamilleScopeFilter(req.user, filter);

  const [familles, total] = await Promise.all([
    Famille.find(scopedFilter).sort(sort).skip(skip).limit(limit),
    Famille.countDocuments(scopedFilter)
  ]);

  res.status(200).json({
    success: true,
    data: familles,
    meta: buildPaginationMeta(total, page, limit)
  });
});

const createFamille = asyncHandler(async (req, res) => {
  const zone = await resolveFamilyZone({
    zone: req.body.zone,
    zoneId: req.body.zoneId,
    allowCreate: true
  });

  ensureCanCreateFamilleInZone(req.user, zone.name, zone._id);

  const geolocationResult = await resolveFamilyGeolocation({
    payload: req.body,
    address: req.body.address,
    postalCode: req.body.postalCode
  });

  const familleData = {
    name: req.body.name,
    address: req.body.address,
    postalCode: req.body.postalCode,
    zone: zone.name,
    zoneId: zone._id,
    phone: req.body.phone,
    email: req.body.email,
    numberOfPeople: req.body.numberOfPeople,
    date_de_naissance: req.body.date_de_naissance,
    nombre_enfants: req.body.nombre_enfants,
    occupation: req.body.occupation,
    revenu_mensuel: req.body.revenu_mensuel,
    situation_logement: req.body.situation_logement,
    aidTypes: req.body.aidTypes,
    observations: req.body.observations,
    donationGoal: req.body.donationGoal,
    totalRaised: req.body.totalRaised,
    visited: req.body.visited
  };

  if (geolocationResult.geolocation) {
    familleData.geolocation = geolocationResult.geolocation;
  }

  const famille = await Famille.create(familleData);

  if (famille.visited && !famille.lastVisitedAt) {
    famille.lastVisitedAt = new Date();
    await famille.save();
  }

  await syncFamilyZoneMembership({
    familyId: famille._id,
    previousZoneId: null,
    nextZoneId: zone._id
  });

  res.status(201).json({
    success: true,
    data: famille,
    meta: {
      geolocationStatus: geolocationResult.status
    }
  });
});

const getFamilleById = asyncHandler(async (req, res) => {
  const famille = await Famille.findById(req.params.id);

  if (!famille) {
    throw new AppError(404, 'FAMILLE_NOT_FOUND', 'Famille not found.');
  }

  ensureCanAccessFamille(req.user, famille, 'view this family');

  res.status(200).json({
    success: true,
    data: famille
  });
});

const updateFamille = asyncHandler(async (req, res) => {
  const famille = await Famille.findById(req.params.id);

  if (!famille) {
    throw new AppError(404, 'FAMILLE_NOT_FOUND', 'Famille not found.');
  }

  ensureCanAccessFamille(req.user, famille, 'update this family');

  const previousZoneId = famille.zoneId || null;
  let nextZone = null;

  if (req.body.zone !== undefined || req.body.zoneId !== undefined) {
    nextZone = await resolveFamilyZone({
      zone: req.body.zone ?? famille.zone,
      zoneId: req.body.zoneId ?? famille.zoneId,
      allowCreate: true
    });

    ensureCanCreateFamilleInZone(req.user, nextZone.name, nextZone._id);
  }

  const updatableFields = [
    'name',
    'address',
    'postalCode',
    'phone',
    'email',
    'numberOfPeople',
    'date_de_naissance',
    'nombre_enfants',
    'occupation',
    'revenu_mensuel',
    'situation_logement',
    'aidTypes',
    'observations',
    'donationGoal',
    'totalRaised',
    'visited'
  ];

  updatableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      famille[field] = req.body[field];
    }
  });

  if (nextZone) {
    famille.zone = nextZone.name;
    famille.zoneId = nextZone._id;
  }

  if (req.body.visited !== undefined) {
    if (req.body.visited === true) {
      famille.lastVisitedAt = famille.lastVisitedAt || new Date();
    } else if (req.body.visited === false) {
      famille.lastVisitedAt = null;
    }
  }

  let geolocationStatus = 'unchanged';

  if (req.body.geolocation === null) {
    famille.geolocation = null;
    geolocationStatus = 'cleared';
  } else {
    const providedGeolocation = extractGeolocationFromPayload(req.body);

    if (providedGeolocation) {
      famille.geolocation = providedGeolocation;
      geolocationStatus = 'provided';
    } else if (req.body.address !== undefined || req.body.postalCode !== undefined) {
      const geolocationResult = await resolveFamilyGeolocation({
        payload: {},
        address: famille.address,
        postalCode: famille.postalCode
      });

      if (geolocationResult.geolocation) {
        famille.geolocation = geolocationResult.geolocation;
      }

      geolocationStatus = geolocationResult.status;
    }
  }

  await famille.save();

  await syncFamilyZoneMembership({
    familyId: famille._id,
    previousZoneId,
    nextZoneId: famille.zoneId || null
  });

  res.status(200).json({
    success: true,
    data: famille,
    meta: {
      geolocationStatus
    }
  });
});

const deleteFamille = asyncHandler(async (req, res) => {
  const famille = await Famille.findById(req.params.id);

  if (!famille) {
    throw new AppError(404, 'FAMILLE_NOT_FOUND', 'Famille not found.');
  }

  ensureCanAccessFamille(req.user, famille, 'delete this family');
  await Famille.findByIdAndDelete(req.params.id);

  await syncFamilyZoneMembership({
    familyId: famille._id,
    previousZoneId: famille.zoneId || null,
    nextZoneId: null
  });

  res.status(200).json({
    success: true,
    data: {
      id: req.params.id,
      deleted: true
    }
  });
});

module.exports = {
  listFamilles,
  createFamille,
  getFamilleById,
  updateFamille,
  deleteFamille
};
