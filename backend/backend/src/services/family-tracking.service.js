const mongoose = require('mongoose');
const Famille = require('../models/Famille');
const Visite = require('../models/Visite');
const PublicPost = require('../models/PublicPost');

const toObjectId = (value) => {
  if (!value) {
    return null;
  }

  const raw = typeof value === 'object' && value._id ? value._id : value;
  const stringValue = String(raw);

  if (!mongoose.Types.ObjectId.isValid(stringValue)) {
    return null;
  }

  return new mongoose.Types.ObjectId(stringValue);
};

const sanitizeAmount = (value) => Number(Number(value || 0).toFixed(2));

const markFamilyVisited = async (familyId, visitDate) => {
  const objectId = toObjectId(familyId);

  if (!objectId) {
    return null;
  }

  const update = {
    $set: {
      visited: true
    }
  };

  if (visitDate) {
    const parsed = new Date(visitDate);
    if (!Number.isNaN(parsed.getTime())) {
      update.$max = {
        lastVisitedAt: parsed
      };
    }
  }

  return Famille.findByIdAndUpdate(objectId, update, {
    new: true
  });
};

const refreshFamilyVisitStatus = async (familyId) => {
  const objectId = toObjectId(familyId);

  if (!objectId) {
    return null;
  }

  const latestVisit = await Visite.findOne({
    famille: objectId
  })
    .sort({ visitDate: -1 })
    .select('visitDate');

  return Famille.findByIdAndUpdate(
    objectId,
    {
      $set: {
        visited: !!latestVisit,
        lastVisitedAt: latestVisit?.visitDate || null
      }
    },
    {
      new: true
    }
  );
};

const refreshFamilyDonationTotals = async (familyId) => {
  const objectId = toObjectId(familyId);

  if (!objectId) {
    return null;
  }

  const family = await Famille.findById(objectId);
  if (!family) {
    return null;
  }

  const totals = await PublicPost.aggregate([
    {
      $match: {
        family: objectId
      }
    },
    {
      $group: {
        _id: null,
        totalRaised: {
          $sum: '$amountRaised'
        }
      }
    }
  ]);

  family.totalRaised = sanitizeAmount(totals[0]?.totalRaised || 0);
  family.goalReached = Number(family.donationGoal || 0) > 0 && family.totalRaised >= family.donationGoal;
  await family.save();

  return family;
};

const refreshFamiliesDonationTotals = async (familyIds = []) => {
  const unique = Array.from(
    new Set(
      familyIds
        .map((id) => toObjectId(id))
        .filter(Boolean)
        .map((id) => String(id))
    )
  );

  if (!unique.length) {
    return [];
  }

  return Promise.all(unique.map((id) => refreshFamilyDonationTotals(id)));
};

module.exports = {
  markFamilyVisited,
  refreshFamilyVisitStatus,
  refreshFamilyDonationTotals,
  refreshFamiliesDonationTotals
};
