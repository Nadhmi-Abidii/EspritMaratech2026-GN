const request = require('supertest');
const { app, createTestUser } = require('./helpers');

describe('Auth API', () => {
  test('POST /api/v1/login returns token for valid credentials', async () => {
    const { email, password } = await createTestUser({
      email: 'auth_success@test.com',
      password: 'Password123!'
    });

    const response = await request(app).post('/api/v1/login').send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.user.password).toBeUndefined();
  });

  test('POST /api/v1/login rejects invalid credentials', async () => {
    const { email } = await createTestUser({
      email: 'auth_failure@test.com',
      password: 'Password123!'
    });

    const response = await request(app).post('/api/v1/login').send({
      email,
      password: 'WrongPassword!'
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  test('GET /api/v1/familles requires JWT token', async () => {
    const response = await request(app).get('/api/v1/familles');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });
});
