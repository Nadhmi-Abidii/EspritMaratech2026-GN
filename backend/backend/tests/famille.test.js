const request = require('supertest');
const { app, createAndLoginUser } = require('./helpers');

describe('Famille API', () => {
  test('should create, retrieve, update and delete a famille', async () => {
    const coordinator = await createAndLoginUser({
      email: 'coord_famille@test.com',
      role: 'coordinator',
      assignedZones: ['north']
    });

    const admin = await createAndLoginUser({
      email: 'admin_famille@test.com',
      role: 'admin'
    });

    const createResponse = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        name: 'Famille Ben Salah',
        address: '10 Avenue Habib Bourguiba',
        postalCode: '1000',
        zone: 'north',
        phone: '+21611111111',
        email: 'famille@test.com',
        numberOfPeople: 5,
        date_de_naissance: '1985-04-12',
        nombre_enfants: 3,
        occupation: 'Artisan',
        revenu_mensuel: 1800,
        situation_logement: 'locataire',
        aidTypes: ['alimentaire', 'medicaments'],
        observations: 'Initial record',
        geolocation: {
          latitude: 36.8065,
          longitude: 10.1815
        }
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.geolocation.latitude).toBe(36.8065);
    expect(createResponse.body.meta.geolocationStatus).toBe('provided');

    const familleId = createResponse.body.data._id;

    const getResponse = await request(app)
      .get(`/api/v1/familles/${familleId}`)
      .set('Authorization', `Bearer ${coordinator.token}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.name).toBe('Famille Ben Salah');
    expect(getResponse.body.data.nombre_enfants).toBe(3);
    expect(getResponse.body.data.occupation).toBe('Artisan');
    expect(getResponse.body.data.situation_logement).toBe('locataire');

    const updateResponse = await request(app)
      .patch(`/api/v1/familles/${familleId}`)
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        numberOfPeople: 6,
        nombre_enfants: 4,
        revenu_mensuel: 2200,
        observations: 'Updated record'
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.numberOfPeople).toBe(6);
    expect(updateResponse.body.data.nombre_enfants).toBe(4);
    expect(updateResponse.body.data.revenu_mensuel).toBe(2200);

    const deleteResponse = await request(app)
      .delete(`/api/v1/familles/${familleId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data.deleted).toBe(true);
  });

  test('should return validation error for invalid famille payload', async () => {
    const coordinator = await createAndLoginUser({
      email: 'coord_invalid_famille@test.com',
      role: 'coordinator',
      assignedZones: ['north']
    });

    const response = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${coordinator.token}`)
      .send({
        name: '',
        address: 'Some Address',
        postalCode: '1234',
        zone: 'north',
        phone: '+21600000000',
        numberOfPeople: 0,
        date_de_naissance: '2050-01-01',
        nombre_enfants: -1
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
