const request = require('supertest');
const app = require('../src/app');
const Utilisateur = require('../src/models/Utilisateur');

const createTestUser = async ({
  name = 'Test User',
  email = `user_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.com`,
  password = 'Password123!',
  role = 'admin',
  isActive = true,
  assignedZones = [],
  assignedFamilies = []
} = {}) => {
  const user = await Utilisateur.create({
    name,
    email,
    password,
    role,
    isActive,
    assignedZones,
    assignedFamilies
  });

  return {
    user,
    email,
    password
  };
};

const loginAs = async ({ email, password }) => {
  const response = await request(app).post('/api/v1/login').send({ email, password });

  return response;
};

const createAndLoginUser = async (overrides = {}) => {
  const credentials = await createTestUser(overrides);
  const loginResponse = await loginAs({
    email: credentials.email,
    password: credentials.password
  });

  return {
    ...credentials,
    loginResponse,
    token: loginResponse.body?.data?.token
  };
};

module.exports = {
  app,
  createTestUser,
  loginAs,
  createAndLoginUser
};
