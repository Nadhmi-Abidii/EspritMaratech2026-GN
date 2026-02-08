const request = require('supertest');
const { app, createAndLoginUser } = require('./helpers');

describe('Beneficiaire API', () => {
  test('should create beneficiary for a valid famille', async () => {
    const coordinator = await createAndLoginUser({
      email: 'coord_benef@test.com',
      role: 'coordinator',
      assignedZones: ['north']
    });

    const familleResponse = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        name: 'Famille Trabelsi',
        address: 'Rue 1',
        postalCode: '2000',
        zone: 'north',
        phone: '+21622222222',
        numberOfPeople: 4,
        aidTypes: ['alimentaire']
      });

    const response = await request(app)
      .post('/api/v1/beneficiaires')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        firstName: 'Ali',
        lastName: 'Trabelsi',
        birthDate: '1990-01-10',
        gender: 'male',
        hasDisability: false,
        healthHistory: 'None',
        famille: familleResponse.body.data._id
      });

    expect(response.status).toBe(201);
    expect(response.body.data.firstName).toBe('Ali');
    expect(response.body.data.famille._id).toBe(familleResponse.body.data._id);
  });

  test('should reject beneficiary creation with unknown famille', async () => {
    const coordinator = await createAndLoginUser({
      email: 'coord_benef_invalid@test.com',
      role: 'coordinator',
      assignedZones: ['north']
    });

    const response = await request(app)
      .post('/api/v1/beneficiaires')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        firstName: 'Sara',
        lastName: 'Doe',
        birthDate: '1995-04-10',
        gender: 'female',
        famille: '507f191e810c19729de860ea'
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('FAMILLE_NOT_FOUND');
  });
});
