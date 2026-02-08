const request = require('supertest');
const { app, createAndLoginUser } = require('./helpers');

describe('RBAC', () => {
  test('volunteer cannot update or delete familles', async () => {
    const volunteer = await createAndLoginUser({
      email: 'volunteer_rbac@test.com',
      role: 'volunteer'
    });

    const coordinator = await createAndLoginUser({
      email: 'coord_rbac@test.com',
      role: 'coordinator',
      assignedZones: ['north']
    });

    const famille = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        name: 'Famille RBAC',
        address: 'Rue RBAC',
        postalCode: '6000',
        zone: 'north',
        phone: '+21666666666',
        numberOfPeople: 4,
        aidTypes: ['alimentaire']
      });

    const patchResponse = await request(app)
      .patch(`/api/v1/familles/${famille.body.data._id}`)
      .set('Authorization', `Bearer ${volunteer.token}`)
      .send({ numberOfPeople: 7 });

    const deleteResponse = await request(app)
      .delete(`/api/v1/familles/${famille.body.data._id}`)
      .set('Authorization', `Bearer ${volunteer.token}`);

    expect(patchResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
  });

  test('coordinator can manage operational resources', async () => {
    const coordinator = await createAndLoginUser({
      email: 'coord_operational@test.com',
      role: 'coordinator',
      assignedZones: ['north']
    });

    const famille = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        name: 'Famille Ops',
        address: 'Rue Ops',
        postalCode: '7000',
        zone: 'north',
        phone: '+21677777777',
        numberOfPeople: 3,
        aidTypes: ['alimentaire']
      });

    const beneficiaire = await request(app)
      .post('/api/v1/beneficiaires')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        firstName: 'Lina',
        lastName: 'Ops',
        birthDate: '2000-01-01',
        gender: 'female',
        famille: famille.body.data._id
      });

    expect(famille.status).toBe(201);
    expect(beneficiaire.status).toBe(201);
  });

  test('admin can access user management endpoints', async () => {
    const admin = await createAndLoginUser({
      email: 'admin_rbac@test.com',
      role: 'admin'
    });

    const createUserResponse = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Managed User',
        email: 'managed_user@test.com',
        password: 'Password123!',
        role: 'volunteer'
      });

    const listUsersResponse = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${admin.token}`);

    const deleteUserResponse = await request(app)
      .delete(`/api/v1/users/${createUserResponse.body.data._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    const getDeletedUserResponse = await request(app)
      .get(`/api/v1/users/${createUserResponse.body.data._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(createUserResponse.status).toBe(201);
    expect(listUsersResponse.status).toBe(200);
    expect(listUsersResponse.body.data.length).toBeGreaterThanOrEqual(1);
    expect(deleteUserResponse.status).toBe(200);
    expect(getDeletedUserResponse.status).toBe(404);
  });
});
