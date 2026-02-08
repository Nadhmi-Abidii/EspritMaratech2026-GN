const request = require('supertest');
const { app, createAndLoginUser } = require('./helpers');

describe('Visite API', () => {
  test('should create visite with explicit geolocation', async () => {
    const coordinator = await createAndLoginUser({
      email: 'coord_visit_geo@test.com',
      role: 'coordinator',
      assignedZones: ['north']
    });

    const familleResponse = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        name: 'Famille Geo',
        address: 'Rue 3',
        postalCode: '4000',
        zone: 'north',
        phone: '+21644444444',
        numberOfPeople: 3,
        aidTypes: ['alimentaire']
      });

    const volunteer = await createAndLoginUser({
      email: 'volunteer_visit_geo@test.com',
      role: 'volunteer',
      assignedFamilies: [familleResponse.body.data._id]
    });

    const visiteResponse = await request(app)
      .post('/api/v1/visites')
      .set('Authorization', `Bearer ${volunteer.token}`)
      .send({
        famille: familleResponse.body.data._id,
        visitDate: '2025-01-01T12:00:00.000Z',
        notes: 'Visit with explicit coordinates',
        geolocation: {
          latitude: 35.0,
          longitude: 9.5
        }
      });

    expect(visiteResponse.status).toBe(201);
    expect(visiteResponse.body.data.geolocation.latitude).toBe(35.0);
    expect(visiteResponse.body.meta.geolocationStatus).toBe('provided');
  });

  test('should fallback to famille geolocation when visit geolocation is missing', async () => {
    const coordinator = await createAndLoginUser({
      email: 'coord_visit_fallback@test.com',
      role: 'coordinator',
      assignedZones: ['north']
    });

    const familleResponse = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        name: 'Famille Fallback',
        address: 'Rue 4',
        postalCode: '5000',
        zone: 'north',
        phone: '+21655555555',
        numberOfPeople: 5,
        aidTypes: ['medicaments'],
        geolocation: {
          latitude: 34.5,
          longitude: 10.2
        }
      });

    const volunteer = await createAndLoginUser({
      email: 'volunteer_visit_fallback@test.com',
      role: 'volunteer',
      assignedFamilies: [familleResponse.body.data._id]
    });

    const visiteResponse = await request(app)
      .post('/api/v1/visites')
      .set('Authorization', `Bearer ${volunteer.token}`)
      .send({
        famille: familleResponse.body.data._id,
        notes: 'Visit without geolocation'
      });

    expect(visiteResponse.status).toBe(201);
    expect(visiteResponse.body.meta.geolocationStatus).toBe('family_fallback');
    expect(visiteResponse.body.data.geolocation.latitude).toBe(34.5);
  });

  test('should reject visite when aids belong to another famille', async () => {
    const coordinator = await createAndLoginUser({
      email: 'coord_visit_invalid_aide@test.com',
      role: 'coordinator',
      assignedZones: ['north', 'south']
    });

    const famille1 = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        name: 'Famille 1',
        address: 'Rue 11',
        postalCode: '1111',
        zone: 'north',
        phone: '+21611111110',
        numberOfPeople: 4,
        aidTypes: ['alimentaire']
      });

    const famille2 = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        name: 'Famille 2',
        address: 'Rue 22',
        postalCode: '2222',
        zone: 'south',
        phone: '+21622222220',
        numberOfPeople: 6,
        aidTypes: ['medicaments']
      });

    const volunteer = await createAndLoginUser({
      email: 'volunteer_visit_invalid_aide@test.com',
      role: 'volunteer',
      assignedFamilies: [famille1.body.data._id, famille2.body.data._id]
    });

    const aide = await request(app)
      .post('/api/v1/aides')
      .set('Authorization', `Bearer ${volunteer.token}`)
      .send({
        type: 'alimentaire',
        quantity: 1,
        famille: famille1.body.data._id
      });

    const invalidVisite = await request(app)
      .post('/api/v1/visites')
      .set('Authorization', `Bearer ${volunteer.token}`)
      .send({
        famille: famille2.body.data._id,
        aides: [aide.body.data._id],
        notes: 'Should fail'
      });

    expect(invalidVisite.status).toBe(400);
    expect(invalidVisite.body.error.code).toBe('INVALID_AIDES_FAMILY');
  });
});
