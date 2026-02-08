const mongoose = require('mongoose');
const Zone = require('../models/Zone');

const normalizeZoneName = (value) => String(value || '').trim();

const toZoneObjectId = (value) => {
  if (!value) {
    return null;
  }

  const raw = typeof value === 'object' && value._id ? value._id : value;

  if (!mongoose.Types.ObjectId.isValid(String(raw))) {
    return null;
  }

  return new mongoose.Types.ObjectId(String(raw));
};

const findZoneByName = async (name) => {
  const normalized = normalizeZoneName(name);

  if (!normalized) {
    return null;
  }

  return Zone.findOne({
    name: {
      $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  });
};

const resolveZone = async ({ zoneId, zoneName, allowCreate = false }) => {
  const normalizedName = normalizeZoneName(zoneName);
  const objectId = toZoneObjectId(zoneId);

  if (objectId) {
    const zoneById = await Zone.findById(objectId);

    if (!zoneById) {
      return null;
    }

    if (!normalizedName || zoneById.name.toLowerCase() === normalizedName.toLowerCase()) {
      return zoneById;
    }

    if (allowCreate) {
      zoneById.name = normalizedName;
      await zoneById.save();
    }

    return zoneById;
  }

  const zoneByName = await findZoneByName(normalizedName);
  if (zoneByName) {
    return zoneByName;
  }

  if (!allowCreate || !normalizedName) {
    return null;
  }

  return Zone.create({ name: normalizedName });
};

const syncFamilyZoneMembership = async ({ familyId, previousZoneId, nextZoneId }) => {
  const prevId = toZoneObjectId(previousZoneId);
  const nextId = toZoneObjectId(nextZoneId);

  if (prevId && (!nextId || String(prevId) !== String(nextId))) {
    await Zone.findByIdAndUpdate(prevId, {
      $pull: {
        assignedFamilies: familyId
      }
    });
  }

  if (nextId) {
    await Zone.findByIdAndUpdate(nextId, {
      $addToSet: {
        assignedFamilies: familyId
      }
    });
  }
};

module.exports = {
  normalizeZoneName,
  toZoneObjectId,
  findZoneByName,
  resolveZone,
  syncFamilyZoneMembership
};
