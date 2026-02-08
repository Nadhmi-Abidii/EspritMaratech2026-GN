const request = require('supertest');
const { app, createAndLoginUser, loginAs } = require('./helpers');

describe('Zone and Responsible Workflow', () => {
  test('admin can create a zone and a responsible user', async () => {
    const admin = await createAndLoginUser({
      email: 'zone_admin@test.com',
      role: 'admin'
    });

    const response = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Sfax',
        responsible: {
          name: 'Sfax Manager',
          email: 'sfax_manager@test.com',
          phone: '+21650111222',
          password: 'Password123!'
        }
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Sfax');
    expect(response.body.data.responsible.role).toBe('responsible');
    expect(response.body.data.responsible.assignedZones).toContain(response.body.data._id);
  });

  test('responsible can only manage families inside assigned zones', async () => {
    const admin = await createAndLoginUser({
      email: 'zone_scope_admin@test.com',
      role: 'admin'
    });

    const zoneNorth = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'North',
        responsible: {
          name: 'North Responsible',
          email: 'north_responsible@test.com',
          phone: '+21651000001',
          password: 'Password123!'
        }
      });

    const zoneSouth = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'South',
        responsible: {
          name: 'South Responsible',
          email: 'south_responsible@test.com',
          phone: '+21651000002',
          password: 'Password123!'
        }
      });

    const responsibleLogin = await loginAs({
      email: 'north_responsible@test.com',
      password: 'Password123!'
    });

    const responsibleToken = responsibleLogin.body.data.token;
    expect(responsibleToken).toBeDefined();

    const createInOwnZone = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${responsibleToken}`)
      .send({
        name: 'North Family',
        address: 'North Address',
        postalCode: '1000',
        zoneId: zoneNorth.body.data._id,
        phone: '+21670000001',
        numberOfPeople: 4,
        donationGoal: 1500,
        aidTypes: ['alimentaire']
      });

    const createOutsideZone = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${responsibleToken}`)
      .send({
        name: 'South Family',
        address: 'South Address',
        postalCode: '2000',
        zoneId: zoneSouth.body.data._id,
        phone: '+21670000002',
        numberOfPeople: 3,
        donationGoal: 2000,
        aidTypes: ['medicaments']
      });

    const listedFamilies = await request(app)
      .get('/api/v1/familles')
      .set('Authorization', `Bearer ${responsibleToken}`);

    expect(createInOwnZone.status).toBe(201);
    expect(createOutsideZone.status).toBe(403);
    expect(listedFamilies.status).toBe(200);
    expect(listedFamilies.body.data.length).toBe(1);
    expect(listedFamilies.body.data[0].name).toBe('North Family');
  });

  test('family visit and donation progress are tracked automatically', async () => {
    const admin = await createAndLoginUser({
      email: 'tracking_admin@test.com',
      role: 'admin'
    });

    const zone = await request(app)
      .post('/api/v1/zones')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Tunis',
        responsible: {
          name: 'Tunis Responsible',
          email: 'tunis_responsible@test.com',
          phone: '+21652000003',
          password: 'Password123!'
        }
      });

    const family = await request(app)
      .post('/api/v1/familles')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Tracked Family',
        address: 'Tunis Address',
        postalCode: '3000',
        zoneId: zone.body.data._id,
        phone: '+21673000003',
        numberOfPeople: 5,
        donationGoal: 1000,
        aidTypes: ['alimentaire']
      });

    const post = await request(app)
      .post('/api/v1/public/posts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Tracked Family Support',
        content: 'Fundraising for one tracked family.',
        donationGoal: 1000,
        associationType: 'family',
        family: family.body.data._id
      });

    const firstDonation = await request(app)
      .post(`/api/v1/public/posts/${post.body.data._id}/donations`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        amount: 600
      });

    expect(firstDonation.status).toBe(200);

    const afterFirstDonation = await request(app)
      .get(`/api/v1/familles/${family.body.data._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(afterFirstDonation.body.data.totalRaised).toBe(600);
    expect(afterFirstDonation.body.data.goalReached).toBe(false);

    const secondDonation = await request(app)
      .post(`/api/v1/public/posts/${post.body.data._id}/donations`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        amount: 500
      });

    expect(secondDonation.status).toBe(200);

    const afterSecondDonation = await request(app)
      .get(`/api/v1/familles/${family.body.data._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(afterSecondDonation.body.data.totalRaised).toBe(1100);
    expect(afterSecondDonation.body.data.goalReached).toBe(true);
    expect(afterSecondDonation.body.data.visited).toBe(false);

    const visit = await request(app)
      .post('/api/v1/visites')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        famille: family.body.data._id,
        visitDate: '2026-01-10T09:00:00.000Z',
        notes: 'Initial field visit'
      });

    expect(visit.status).toBe(201);

    const afterVisit = await request(app)
      .get(`/api/v1/familles/${family.body.data._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(afterVisit.body.data.visited).toBe(true);
    expect(afterVisit.body.data.lastVisitedAt).toBeTruthy();

    const deleteVisit = await request(app)
      .delete(`/api/v1/visites/${visit.body.data._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(deleteVisit.status).toBe(200);

    const afterDeleteVisit = await request(app)
      .get(`/api/v1/familles/${family.body.data._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(afterDeleteVisit.body.data.visited).toBe(false);
    expect(afterDeleteVisit.body.data.lastVisitedAt).toBeNull();
  });
});
