const mongoose = require('mongoose');
const Zone = require('../models/Zone');
const Famille = require('../models/Famille');
const Utilisateur = require('../models/Utilisateur');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sanitizeUser = require('../utils/sanitizeUser');
const { parsePagination, parseSort, buildPaginationMeta } = require('../utils/query');
const { toAssignedZoneIds, toAssignedZoneNames } = require('../services/access.service');

const DEFAULT_RESPONSIBLE_PASSWORD = process.env.DEFAULT_RESPONSIBLE_PASSWORD || 'ChangeMe123!';

const normalizeZoneName = (value) => String(value || '').trim();
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const hasZoneAccess = (user, zone) => {
  if (!user || user.role === 'admin') {
    return true;
  }

  const zoneId = String(zone?._id || '');
  const zoneName = normalizeZoneName(zone?.name).toLowerCase();

  if (!zoneId && !zoneName) {
    return false;
  }

  return toAssignedZoneIds(user).includes(zoneId) || toAssignedZoneNames(user).includes(zoneName);
};

const ensureZoneAccess = (user, zone, action) => {
  if (hasZoneAccess(user, zone)) {
    return;
  }

  throw new AppError(403, 'AUTH_FORBIDDEN', `You are not allowed to ${action}.`);
};

const applyZoneScope = (user, filter = {}) => {
  if (!user || user.role === 'admin') {
    return filter;
  }

  const assignedZoneIds = toAssignedZoneIds(user);
  const assignedZoneNames = toAssignedZoneNames(user);
  const scopedFilter = { ...filter };

  if (!assignedZoneIds.length && !assignedZoneNames.length) {
    scopedFilter._id = { $in: [] };
    return scopedFilter;
  }

  const clauses = [];

  if (assignedZoneIds.length) {
    clauses.push({
      _id: {
        $in: assignedZoneIds.map((id) => new mongoose.Types.ObjectId(id))
      }
    });
  }

  if (assignedZoneNames.length) {
    clauses.push({
      name: {
        $in: assignedZoneNames.map((name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))
      }
    });
  }

  if (!clauses.length) {
    scopedFilter._id = { $in: [] };
    return scopedFilter;
  }

  if (clauses.length === 1) {
    return {
      ...scopedFilter,
      ...clauses[0]
    };
  }

  if (!Object.keys(scopedFilter).length) {
    return {
      $or: clauses
    };
  }

  return {
    $and: [scopedFilter, { $or: clauses }]
  };
};

const ensureZoneNameAvailable = async (name, excludeId = null) => {
  const existing = await Zone.findOne({
    name: {
      $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  }).select('_id');

  if (!existing) {
    return;
  }

  if (excludeId && String(existing._id) === String(excludeId)) {
    return;
  }

  throw new AppError(409, 'ZONE_NAME_EXISTS', 'A zone with this name already exists.');
};

const upsertResponsibleUserFromPayload = async (responsiblePayload = {}) => {
  const email = normalizeEmail(responsiblePayload.email);

  if (!email) {
    throw new AppError(422, 'ZONE_RESPONSIBLE_EMAIL_REQUIRED', 'Responsible email is required.');
  }

  const user = await Utilisateur.findOne({ email }).select('+password');

  if (user) {
    if (user.role === 'admin') {
      throw new AppError(409, 'ZONE_RESPONSIBLE_INVALID_ROLE', 'Admin users cannot be assigned as zone responsible.');
    }

    if (responsiblePayload.name !== undefined) {
      user.name = String(responsiblePayload.name).trim();
    }

    if (responsiblePayload.phone !== undefined) {
      user.phone = String(responsiblePayload.phone).trim();
    }

    if (responsiblePayload.password) {
      user.password = String(responsiblePayload.password);
    }

    user.role = 'responsible';
    user.isActive = true;
    await user.save();
    return user;
  }

  return Utilisateur.create({
    name: String(responsiblePayload.name || '').trim(),
    email,
    phone: String(responsiblePayload.phone || '').trim(),
    password: String(responsiblePayload.password || DEFAULT_RESPONSIBLE_PASSWORD),
    role: 'responsible',
    isActive: true,
    assignedZones: []
  });
};

const resolveResponsibleUser = async (payload = {}, existingZone = null) => {
  if (payload.responsibleId === null) {
    return null;
  }

  if (payload.responsibleId) {
    const user = await Utilisateur.findById(payload.responsibleId).select('+password');

    if (!user) {
      throw new AppError(404, 'ZONE_RESPONSIBLE_NOT_FOUND', 'Responsible user was not found.');
    }

    if (user.role === 'admin') {
      throw new AppError(409, 'ZONE_RESPONSIBLE_INVALID_ROLE', 'Admin users cannot be assigned as zone responsible.');
    }

    user.role = 'responsible';
    user.isActive = true;
    await user.save();
    return user;
  }

  if (payload.responsible) {
    return upsertResponsibleUserFromPayload(payload.responsible);
  }

  if (existingZone?.responsible) {
    return Utilisateur.findById(existingZone.responsible);
  }

  return null;
};

const assignZoneToResponsible = async (responsible, zoneId) => {
  if (!responsible) {
    return;
  }

  const zoneKey = String(zoneId);
  const assigned = new Set((responsible.assignedZones || []).map((item) => String(item)));
  assigned.add(zoneKey);
  responsible.assignedZones = Array.from(assigned);
  responsible.role = 'responsible';
  responsible.isActive = true;
  await responsible.save();
};

const removeZoneFromResponsible = async (responsibleId, zoneId) => {
  if (!responsibleId) {
    return;
  }

  const responsible = await Utilisateur.findById(responsibleId);
  if (!responsible) {
    return;
  }

  responsible.assignedZones = (responsible.assignedZones || [])
    .map((zone) => String(zone))
    .filter((zone) => zone !== String(zoneId));
  await responsible.save();
};

const mapZonePayload = (zoneDoc) => {
  const zone = zoneDoc.toObject ? zoneDoc.toObject() : zoneDoc;

  return {
    ...zone,
    responsible: sanitizeUser(zone.responsible)
  };
};

const listZones = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, 'name');

  const filter = {};

  if (req.query.search) {
    filter.name = {
      $regex: req.query.search,
      $options: 'i'
    };
  }

  if (req.query.responsibleId) {
    filter.responsible = req.query.responsibleId;
  }

  const scopedFilter = applyZoneScope(req.user, filter);

  const [zones, total] = await Promise.all([
    Zone.find(scopedFilter)
      .populate('responsible', 'name email phone role isActive assignedZones')
      .populate('assignedFamilies', 'name zone zoneId donationGoal totalRaised goalReached visited lastVisitedAt')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Zone.countDocuments(scopedFilter)
  ]);

  res.status(200).json({
    success: true,
    data: zones.map(mapZonePayload),
    meta: buildPaginationMeta(total, page, limit)
  });
});

const createZone = asyncHandler(async (req, res) => {
  const zoneName = normalizeZoneName(req.body.name);
  await ensureZoneNameAvailable(zoneName);

  const responsible = await resolveResponsibleUser(req.body);

  const zone = await Zone.create({
    name: zoneName,
    responsible: responsible?._id || null
  });

  if (responsible) {
    await assignZoneToResponsible(responsible, zone._id);
  }

  const createdZone = await Zone.findById(zone._id)
    .populate('responsible', 'name email phone role isActive assignedZones')
    .populate('assignedFamilies', 'name zone zoneId donationGoal totalRaised goalReached visited lastVisitedAt');

  res.status(201).json({
    success: true,
    data: mapZonePayload(createdZone)
  });
});

const getZoneById = asyncHandler(async (req, res) => {
  const zone = await Zone.findById(req.params.id)
    .populate('responsible', 'name email phone role isActive assignedZones')
    .populate('assignedFamilies', 'name zone zoneId donationGoal totalRaised goalReached visited lastVisitedAt');

  if (!zone) {
    throw new AppError(404, 'ZONE_NOT_FOUND', 'Zone not found.');
  }

  ensureZoneAccess(req.user, zone, 'view this zone');

  res.status(200).json({
    success: true,
    data: mapZonePayload(zone)
  });
});

const updateZone = asyncHandler(async (req, res) => {
  const zone = await Zone.findById(req.params.id);

  if (!zone) {
    throw new AppError(404, 'ZONE_NOT_FOUND', 'Zone not found.');
  }

  if (req.body.name !== undefined) {
    const nextName = normalizeZoneName(req.body.name);
    await ensureZoneNameAvailable(nextName, zone._id);

    if (nextName !== zone.name) {
      zone.name = nextName;
      await Famille.updateMany(
        {
          zoneId: zone._id
        },
        {
          $set: {
            zone: nextName
          }
        }
      );
    }
  }

  const previousResponsibleId = zone.responsible ? String(zone.responsible) : null;
  const nextResponsible = await resolveResponsibleUser(req.body, zone);
  const nextResponsibleId = nextResponsible ? String(nextResponsible._id) : null;

  zone.responsible = nextResponsible?._id || null;
  await zone.save();

  if (previousResponsibleId && previousResponsibleId !== nextResponsibleId) {
    await removeZoneFromResponsible(previousResponsibleId, zone._id);
  }

  if (nextResponsible) {
    await assignZoneToResponsible(nextResponsible, zone._id);
  }

  const updatedZone = await Zone.findById(zone._id)
    .populate('responsible', 'name email phone role isActive assignedZones')
    .populate('assignedFamilies', 'name zone zoneId donationGoal totalRaised goalReached visited lastVisitedAt');

  res.status(200).json({
    success: true,
    data: mapZonePayload(updatedZone)
  });
});

const deleteZone = asyncHandler(async (req, res) => {
  const zone = await Zone.findById(req.params.id);

  if (!zone) {
    throw new AppError(404, 'ZONE_NOT_FOUND', 'Zone not found.');
  }

  const familyCount = await Famille.countDocuments({
    zoneId: zone._id
  });

  if (familyCount > 0) {
    throw new AppError(
      409,
      'ZONE_HAS_FAMILIES',
      'This zone cannot be deleted while families are still assigned to it.'
    );
  }

  if (zone.responsible) {
    await removeZoneFromResponsible(zone.responsible, zone._id);
  }

  await Zone.findByIdAndDelete(zone._id);

  res.status(200).json({
    success: true,
    data: {
      id: req.params.id,
      deleted: true
    }
  });
});

module.exports = {
  listZones,
  createZone,
  getZoneById,
  updateZone,
  deleteZone
};
