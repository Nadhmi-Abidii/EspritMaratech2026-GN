const request = require('supertest');
const { app, createAndLoginUser } = require('./helpers');

describe('Aide API', () => {
  test('should create aide and filter aides by type/date/famille', async () => {
    const coordinator = await createAndLoginUser({
      email: 'coord_aide@test.com',
      role: 'coordinator',
      assignedZones: ['north']
    });

    const familleResponse = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        name: 'Famille Aide',
        address: 'Rue 2',
        postalCode: '3000',
        zone: 'north',
        phone: '+21633333333',
        numberOfPeople: 3,
        aidTypes: ['alimentaire']
      });

    const familleId = familleResponse.body.data._id;

    const volunteer = await createAndLoginUser({
      email: 'volunteer_aide@test.com',
      role: 'volunteer',
      assignedFamilies: [familleId]
    });

    const createAideResponse = await request(app)
      .post('/api/v1/aides')
      .set('Authorization', `Bearer ${volunteer.token}`)
      .send({
        type: 'alimentaire',
        quantity: 2,
        aidDate: '2025-01-01T10:00:00.000Z',
        observations: 'Food parcel',
        famille: familleId
      });

    expect(createAideResponse.status).toBe(201);
    expect(createAideResponse.body.data.type).toBe('alimentaire');

    await request(app)
      .post('/api/v1/aides')
      .set('Authorization', `Bearer ${volunteer.token}`)
      .send({
        type: 'medication',
        quantity: 1,
        aidDate: '2024-01-01T10:00:00.000Z',
        observations: 'Medicines',
        famille: familleId
      });

    const filtered = await request(app)
      .get(`/api/v1/aides?familleId=${familleId}&type=alimentaire&fromDate=2024-12-31&toDate=2025-12-31`)
      .set('Authorization', `Bearer ${volunteer.token}`);

    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].type).toBe('alimentaire');
  });
});
