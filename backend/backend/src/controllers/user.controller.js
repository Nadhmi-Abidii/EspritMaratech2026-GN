const Utilisateur = require('../models/Utilisateur');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sanitizeUser = require('../utils/sanitizeUser');
const { parsePagination, parseSort, buildPaginationMeta } = require('../utils/query');
const { toAssignedZones, toAssignedFamilyIds } = require('../services/access.service');

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, 'createdAt');

  const filter = {};

  if (req.query.role) {
    filter.role = req.query.role;
  }

  if (req.query.isActive !== undefined) {
    filter.isActive = String(req.query.isActive).toLowerCase() === 'true';
  }

  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  if (req.query.assignedZone) {
    filter.assignedZones = req.query.assignedZone;
  }

  const [users, total] = await Promise.all([
    Utilisateur.find(filter).sort(sort).skip(skip).limit(limit),
    Utilisateur.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: users.map(sanitizeUser),
    meta: buildPaginationMeta(total, page, limit)
  });
});

const createUser = asyncHandler(async (req, res) => {
  const existingUser = await Utilisateur.findOne({
    email: req.body.email.toLowerCase()
  });

  if (existingUser) {
    throw new AppError(409, 'USER_EXISTS', 'A user with this email already exists.');
  }

  const assignedZones = toAssignedZones(req.body);
  const assignedFamilies = toAssignedFamilyIds(req.body).map((id) => id);

  const user = await Utilisateur.create({
    name: req.body.name,
    email: req.body.email.toLowerCase(),
    phone: req.body.phone || '',
    password: req.body.password,
    role: req.body.role,
    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    assignedZones,
    assignedFamilies
  });

  res.status(201).json({
    success: true,
    data: sanitizeUser(user)
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await Utilisateur.findById(req.params.id);

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  res.status(200).json({
    success: true,
    data: sanitizeUser(user)
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await Utilisateur.findById(req.params.id).select('+password');

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  if (req.body.email && req.body.email.toLowerCase() !== user.email) {
    const emailTaken = await Utilisateur.findOne({ email: req.body.email.toLowerCase() });

    if (emailTaken) {
      throw new AppError(409, 'USER_EXISTS', 'A user with this email already exists.');
    }

    user.email = req.body.email.toLowerCase();
  }

  if (req.body.name !== undefined) {
    user.name = req.body.name;
  }

  if (req.body.phone !== undefined) {
    user.phone = req.body.phone;
  }

  if (req.body.password !== undefined) {
    user.password = req.body.password;
  }

  if (req.body.role !== undefined) {
    user.role = req.body.role;
  }

  if (req.body.isActive !== undefined) {
    user.isActive = req.body.isActive;
  }

  if (req.body.assignedZones !== undefined) {
    user.assignedZones = toAssignedZones(req.body);
  }

  if (req.body.assignedFamilies !== undefined) {
    user.assignedFamilies = toAssignedFamilyIds(req.body);
  }

  await user.save();

  res.status(200).json({
    success: true,
    data: sanitizeUser(user)
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await Utilisateur.findByIdAndDelete(req.params.id);

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  res.status(200).json({
    success: true,
    data: sanitizeUser(user)
  });
});

module.exports = {
  listUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser
};
