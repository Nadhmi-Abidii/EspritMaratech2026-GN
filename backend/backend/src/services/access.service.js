const mongoose = require('mongoose');
const Famille = require('../models/Famille');
const AppError = require('../utils/AppError');

const ZONE_MANAGER_ROLES = new Set(['coordinator', 'responsible']);

const normalizeZoneValue = (value) => String(value || '').trim();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toAssignedZones = (user) =>
  (user?.assignedZones || [])
    .map((zone) => normalizeZoneValue(zone))
    .filter(Boolean);

const toAssignedZoneIds = (user) =>
  toAssignedZones(user).filter((zone) => mongoose.Types.ObjectId.isValid(zone));

const toAssignedZoneNames = (user) =>
  toAssignedZones(user)
    .filter((zone) => !mongoose.Types.ObjectId.isValid(zone))
    .map((zone) => zone.toLowerCase());

const toAssignedFamilyIds = (user) =>
  (user?.assignedFamilies || [])
    .map((id) => String(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

const toFamilleZoneId = (famille) => {
  if (!famille?.zoneId) {
    return null;
  }

  const value = typeof famille.zoneId === 'object' && famille.zoneId._id ? famille.zoneId._id : famille.zoneId;
  const asString = String(value);

  if (!mongoose.Types.ObjectId.isValid(asString)) {
    return null;
  }

  return asString;
};

const userCanAccessFamilleByZone = (user, famille) => {
  const assignedZoneIds = toAssignedZoneIds(user);
  const assignedZoneNames = new Set(toAssignedZoneNames(user));

  const familleZoneId = toFamilleZoneId(famille);
  const familleZoneName = normalizeZoneValue(famille?.zone).toLowerCase();

  if (familleZoneId && assignedZoneIds.includes(familleZoneId)) {
    return true;
  }

  if (familleZoneName && assignedZoneNames.has(familleZoneName)) {
    return true;
  }

  return false;
};

const ensureCanAccessFamille = (user, famille, action = 'access this family') => {
  if (!user || user.role === 'admin') {
    return;
  }

  if (ZONE_MANAGER_ROLES.has(user.role)) {
    if (!userCanAccessFamilleByZone(user, famille)) {
      throw new AppError(403, 'AUTH_FORBIDDEN', `You are not allowed to ${action}.`);
    }

    return;
  }

  if (user.role === 'volunteer') {
    const assignedFamilies = new Set(toAssignedFamilyIds(user));
    if (!famille?._id || !assignedFamilies.has(String(famille._id))) {
      throw new AppError(403, 'AUTH_FORBIDDEN', `You are not allowed to ${action}.`);
    }
    return;
  }

  throw new AppError(403, 'AUTH_FORBIDDEN', `You are not allowed to ${action}.`);
};

const loadFamilleAndAuthorize = async (user, familleId, action = 'access this family') => {
  const famille = await Famille.findById(familleId);

  if (!famille) {
    throw new AppError(404, 'FAMILLE_NOT_FOUND', 'Famille not found.');
  }

  ensureCanAccessFamille(user, famille, action);
  return famille;
};

const ensureCanCreateFamilleInZone = (user, zoneName, zoneId) => {
  if (!user || user.role === 'admin') {
    return;
  }

  if (!ZONE_MANAGER_ROLES.has(user.role)) {
    throw new AppError(403, 'AUTH_FORBIDDEN', 'You are not allowed to create families.');
  }

  const assignedZoneIds = toAssignedZoneIds(user);
  const assignedZoneNames = new Set(toAssignedZoneNames(user));
  const normalizedZoneName = normalizeZoneValue(zoneName).toLowerCase();
  const normalizedZoneId = normalizeZoneValue(zoneId);

  if (!assignedZoneIds.length && assignedZoneNames.size === 0) {
    throw new AppError(
      403,
      'AUTH_FORBIDDEN',
      'Responsible user must be assigned to at least one zone.'
    );
  }

  if (normalizedZoneId && assignedZoneIds.includes(normalizedZoneId)) {
    return;
  }

  if (normalizedZoneName && assignedZoneNames.has(normalizedZoneName)) {
    return;
  }

  throw new AppError(
    403,
    'AUTH_FORBIDDEN',
    'Responsible users can only create families inside assigned zones.'
  );
};

const mergeWithConstraint = (baseFilter, constraint) => {
  if (!constraint || Object.keys(constraint).length === 0) {
    return { ...baseFilter };
  }

  if (!baseFilter || Object.keys(baseFilter).length === 0) {
    return { ...constraint };
  }

  return {
    $and: [baseFilter, constraint]
  };
};

const buildZoneScopeConstraint = ({ assignedZoneIds, assignedZoneNames, requestedZone, requestedZoneId }) => {
  if (!assignedZoneIds.length && !assignedZoneNames.length) {
    return {
      _id: {
        $in: []
      }
    };
  }

  const normalizedZone = normalizeZoneValue(requestedZone);
  const normalizedZoneId = normalizeZoneValue(requestedZoneId);

  if (normalizedZoneId) {
    if (!mongoose.Types.ObjectId.isValid(normalizedZoneId) || !assignedZoneIds.includes(normalizedZoneId)) {
      return {
        _id: {
          $in: []
        }
      };
    }

    return {
      zoneId: new mongoose.Types.ObjectId(normalizedZoneId)
    };
  }

  if (normalizedZone) {
    if (mongoose.Types.ObjectId.isValid(normalizedZone)) {
      if (!assignedZoneIds.includes(normalizedZone)) {
        return {
          _id: {
            $in: []
          }
        };
      }

      return {
        zoneId: new mongoose.Types.ObjectId(normalizedZone)
      };
    }

    if (!assignedZoneNames.includes(normalizedZone.toLowerCase())) {
      return {
        _id: {
          $in: []
        }
      };
    }

    return {
      zone: new RegExp(`^${escapeRegExp(normalizedZone)}$`, 'i')
    };
  }

  const zoneClauses = [];

  if (assignedZoneIds.length) {
    zoneClauses.push({
      zoneId: {
        $in: assignedZoneIds.map((id) => new mongoose.Types.ObjectId(id))
      }
    });
  }

  if (assignedZoneNames.length) {
    zoneClauses.push({
      zone: {
        $in: assignedZoneNames.map((name) => new RegExp(`^${escapeRegExp(name)}$`, 'i'))
      }
    });
  }

  if (zoneClauses.length === 1) {
    return zoneClauses[0];
  }

  return {
    $or: zoneClauses
  };
};

const applyFamilleScopeFilter = (user, filter = {}) => {
  const scopedFilter = { ...filter };

  if (!user || user.role === 'admin') {
    return scopedFilter;
  }

  if (ZONE_MANAGER_ROLES.has(user.role)) {
    const assignedZoneIds = toAssignedZoneIds(user);
    const assignedZoneNames = toAssignedZoneNames(user);
    const constraint = buildZoneScopeConstraint({
      assignedZoneIds,
      assignedZoneNames,
      requestedZone: scopedFilter.zone,
      requestedZoneId: scopedFilter.zoneId
    });

    delete scopedFilter.zone;
    delete scopedFilter.zoneId;
    return mergeWithConstraint(scopedFilter, constraint);
  }

  if (user.role === 'volunteer') {
    const assignedFamilies = toAssignedFamilyIds(user).map((id) => new mongoose.Types.ObjectId(id));
    scopedFilter._id = { $in: assignedFamilies };
    return scopedFilter;
  }

  scopedFilter._id = { $in: [] };
  return scopedFilter;
};

const getScopedFamilleIds = async (user) => {
  if (!user || user.role === 'admin') {
    return null;
  }

  const filter = applyFamilleScopeFilter(user);
  const familles = await Famille.find(filter).select('_id');
  return familles.map((famille) => famille._id);
};

const applyRelatedFamilleScopeFilter = async (user, filter = {}, familyField = 'famille') => {
  const scopedFilter = { ...filter };

  if (!user || user.role === 'admin') {
    return scopedFilter;
  }

  const familleIds = await getScopedFamilleIds(user);
  scopedFilter[familyField] = { $in: familleIds || [] };
  return scopedFilter;
};

module.exports = {
  ZONE_MANAGER_ROLES,
  toAssignedZones,
  toAssignedZoneIds,
  toAssignedZoneNames,
  toAssignedFamilyIds,
  ensureCanAccessFamille,
  loadFamilleAndAuthorize,
  ensureCanCreateFamilleInZone,
  applyFamilleScopeFilter,
  getScopedFamilleIds,
  applyRelatedFamilleScopeFilter
};
