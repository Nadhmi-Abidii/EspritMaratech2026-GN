const request = require('supertest');
const { app, createAndLoginUser, createTestUser } = require('./helpers');
const Famille = require('../src/models/Famille');
const Beneficiaire = require('../src/models/Beneficiaire');
const Aide = require('../src/models/Aide');
const Visite = require('../src/models/Visite');

const seedPublicData = async () => {
  const { user } = await createTestUser({
    email: 'public_seed@test.com',
    role: 'admin'
  });

  const familyNorth = await Famille.create({
    name: 'Family North',
    address: 'North Street',
    postalCode: '1000',
    zone: 'north',
    phone: '+21610000000',
    numberOfPeople: 4,
    aidTypes: ['alimentaire']
  });

  const familySouth = await Famille.create({
    name: 'Family South',
    address: 'South Street',
    postalCode: '2000',
    zone: 'south',
    phone: '+21620000000',
    numberOfPeople: 3,
    aidTypes: ['aide_specifique']
  });

  await Beneficiaire.create([
    {
      firstName: 'Amina',
      lastName: 'North',
      birthDate: '2008-05-20T00:00:00.000Z',
      gender: 'female',
      hasDisability: false,
      famille: familyNorth._id
    },
    {
      firstName: 'Youssef',
      lastName: 'South',
      birthDate: '2010-02-11T00:00:00.000Z',
      gender: 'male',
      hasDisability: false,
      famille: familySouth._id
    }
  ]);

  const [aidNorth, aidSouth] = await Aide.create([
    {
      type: 'alimentaire',
      quantity: 5,
      aidDate: '2025-05-10T10:00:00.000Z',
      famille: familyNorth._id,
      createdBy: user._id
    },
    {
      type: 'medication',
      quantity: 2,
      aidDate: '2025-06-01T10:00:00.000Z',
      famille: familySouth._id,
      createdBy: user._id
    }
  ]);

  await Visite.create([
    {
      visitDate: '2025-05-15T10:00:00.000Z',
      famille: familyNorth._id,
      aides: [aidNorth._id]
    },
    {
      visitDate: '2025-06-06T10:00:00.000Z',
      famille: familySouth._id,
      aides: [aidSouth._id]
    }
  ]);
};

describe('Public API', () => {
  test('GET /api/v1/public/info returns public charity information without authentication', async () => {
    await seedPublicData();

    const response = await request(app).get('/api/v1/public/info');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.organization.name).toBe('Omnia Charity');
    expect(response.body.data.impactOverview.familiesHelped).toBe(2);
    expect(response.body.data.impactOverview.beneficiariesSupported).toBe(2);
    expect(Array.isArray(response.body.data.testimonials)).toBe(true);
    expect(response.body.data.callToAction.primaryLabel).toBe('Support Our Cause');
  });

  test('GET /api/v1/public/impact returns aggregated impact metrics', async () => {
    await seedPublicData();

    const response = await request(app).get('/api/v1/public/impact');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.familiesHelped).toBe(2);
    expect(response.body.data.summary.aidRecords).toBe(2);
    expect(response.body.data.summary.aidUnitsDistributed).toBe(7);
    expect(response.body.data.summary.areasServed).toBe(2);
    expect(response.body.data.aidDistribution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: expect.any(String),
          label: expect.any(String),
          totalQuantity: expect.any(Number)
        })
      ])
    );
  });

  test('GET /api/v1/public/reports returns report metadata and supports filtering', async () => {
    await seedPublicData();

    const response = await request(app).get('/api/v1/public/reports');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.reports.length).toBeGreaterThan(0);
    expect(response.body.data.financialSummary.breakdown.length).toBeGreaterThan(0);

    const financialResponse = await request(app)
      .get('/api/v1/public/reports')
      .query({ type: 'financial' });

    expect(financialResponse.status).toBe(200);
    expect(financialResponse.body.data.reports.every((report) => report.type === 'financial')).toBe(
      true
    );
  });

  test('POST /api/v1/public/chatbot/ask returns a chatbot response without authentication', async () => {
    await seedPublicData();

    const response = await request(app).post('/api/v1/public/chatbot/ask').send({
      message: 'What is the charity mission?'
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.reply).toBe('string');
    expect(response.body.data.reply.length).toBeGreaterThan(0);
    expect(['openai', 'fallback']).toContain(response.body.data.provider);
    expect(response.body.data.generatedAt).toEqual(expect.any(String));
  });

  test('POST /api/v1/public/chatbot/ask validates payload', async () => {
    const response = await request(app).post('/api/v1/public/chatbot/ask').send({
      message: '   '
    });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('report view and download links are publicly accessible and return pdf content', async () => {
    await seedPublicData();

    const reportsResponse = await request(app).get('/api/v1/public/reports');
    const firstReport = reportsResponse.body.data.reports[0];

    expect(firstReport).toBeDefined();

    const viewPath = new URL(firstReport.viewUrl).pathname;
    const downloadPath = new URL(firstReport.downloadUrl).pathname;

    const viewResponse = await request(app).get(viewPath).buffer(true);
    const downloadResponse = await request(app).get(downloadPath).buffer(true);

    expect(viewResponse.status).toBe(200);
    expect(viewResponse.headers['content-type']).toMatch(/application\/pdf/);
    expect(viewResponse.headers['content-disposition']).toContain('inline');

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers['content-type']).toMatch(/application\/pdf/);
    expect(downloadResponse.headers['content-disposition']).toContain('attachment');
  });

  test('admin can create public donation posts and everyone can list them', async () => {
    const admin = await createAndLoginUser({
      email: 'public_post_admin@test.com',
      role: 'admin'
    });

    const createResponse = await request(app)
      .post('/api/v1/public/posts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Help Families in Need',
        content: 'Our goal is to raise funds for family emergency support.',
        donationGoal: 5000
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.title).toBe('Help Families in Need');
    expect(createResponse.body.data.donationGoal).toBe(5000);
    expect(createResponse.body.data.amountRaised).toBe(0);
    expect(createResponse.body.data.progressPercent).toBe(0);

    const listResponse = await request(app).get('/api/v1/public/posts');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.data.length).toBe(1);
    expect(listResponse.body.data[0].title).toBe('Help Families in Need');
  });

  test('non-admin users cannot create public donation posts', async () => {
    const volunteer = await createAndLoginUser({
      email: 'public_post_volunteer@test.com',
      role: 'volunteer'
    });

    const response = await request(app)
      .post('/api/v1/public/posts')
      .set('Authorization', `Bearer ${volunteer.token}`)
      .send({
        title: 'Volunteer post',
        content: 'This should not be allowed.',
        donationGoal: 1200
      });

    expect(response.status).toBe(403);
  });

  test('admin can associate post to family or beneficiary and manage post lifecycle', async () => {
    const admin = await createAndLoginUser({
      email: 'public_post_manage_admin@test.com',
      role: 'admin'
    });

    const family = await Famille.create({
      name: 'Linked Family',
      address: 'Admin Street',
      postalCode: '3000',
      zone: 'central',
      phone: '+21630000000',
      numberOfPeople: 5,
      aidTypes: ['alimentaire']
    });

    const beneficiary = await Beneficiaire.create({
      firstName: 'Salma',
      lastName: 'Linked',
      birthDate: '2011-04-11T00:00:00.000Z',
      gender: 'female',
      hasDisability: false,
      famille: family._id
    });

    const createResponse = await request(app)
      .post('/api/v1/public/posts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Family Support Goal',
        content: 'Help this family recover after emergency expenses.',
        donationGoal: 4000,
        associationType: 'family',
        family: family._id.toString()
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.associationType).toBe('family');
    expect(createResponse.body.data.association.family._id).toBe(family._id.toString());

    const postId = createResponse.body.data._id;

    const updateResponse = await request(app)
      .patch(`/api/v1/public/posts/${postId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Beneficiary Medical Goal',
        associationType: 'beneficiary',
        beneficiary: beneficiary._id.toString()
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.title).toBe('Beneficiary Medical Goal');
    expect(updateResponse.body.data.associationType).toBe('beneficiary');
    expect(updateResponse.body.data.association.beneficiary._id).toBe(beneficiary._id.toString());

    const deleteResponse = await request(app)
      .delete(`/api/v1/public/posts/${postId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data.deleted).toBe(true);
  });

  test('non-admin users cannot update or delete posts', async () => {
    const admin = await createAndLoginUser({
      email: 'public_post_owner_admin@test.com',
      role: 'admin'
    });

    const volunteer = await createAndLoginUser({
      email: 'public_post_owner_volunteer@test.com',
      role: 'volunteer'
    });

    const createResponse = await request(app)
      .post('/api/v1/public/posts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Owner post',
        content: 'Only admins should edit me.',
        donationGoal: 1900
      });

    const postId = createResponse.body.data._id;

    const updateResponse = await request(app)
      .patch(`/api/v1/public/posts/${postId}`)
      .set('Authorization', `Bearer ${volunteer.token}`)
      .send({
        title: 'Unauthorized update'
      });

    const deleteResponse = await request(app)
      .delete(`/api/v1/public/posts/${postId}`)
      .set('Authorization', `Bearer ${volunteer.token}`);

    expect(updateResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
  });

  test('public donations update raised amount and progress percentage in real time', async () => {
    const admin = await createAndLoginUser({
      email: 'public_post_donation_admin@test.com',
      role: 'admin'
    });

    const createResponse = await request(app)
      .post('/api/v1/public/posts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Medical Aid Fund',
        content: 'Support medical kits for vulnerable families.',
        donationGoal: 3000
      });

    const postId = createResponse.body.data._id;

    expect(postId).toBeDefined();

    const donationResponse = await request(app)
      .post(`/api/v1/public/posts/${postId}/donations`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        amount: 1500
      });

    expect(donationResponse.status).toBe(200);
    expect(donationResponse.body.success).toBe(true);
    expect(donationResponse.body.data.amountRaised).toBe(1500);
    expect(donationResponse.body.data.progressPercent).toBe(50);
    expect(donationResponse.body.data.donationCount).toBe(1);

    const overGoalDonationResponse = await request(app)
      .post(`/api/v1/public/posts/${postId}/donations`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        amount: 2000
      });

    expect(overGoalDonationResponse.status).toBe(200);
    expect(overGoalDonationResponse.body.data.amountRaised).toBe(3500);
    expect(overGoalDonationResponse.body.data.progressPercent).toBe(100);
    expect(overGoalDonationResponse.body.data.goalReached).toBe(true);
  });

  test('donation checkout creates a payment session and confirms donation exactly once', async () => {
    const admin = await createAndLoginUser({
      email: 'public_post_checkout_admin@test.com',
      role: 'admin'
    });

    const createResponse = await request(app)
      .post('/api/v1/public/posts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'School Supplies Fund',
        content: 'Help us provide school kits for children.',
        donationGoal: 1000
      });

    const postId = createResponse.body.data._id;

    const checkoutResponse = await request(app)
      .post(`/api/v1/public/posts/${postId}/donations/checkout`)
      .send({
        amount: 125
      });

    expect(checkoutResponse.status).toBe(201);
    expect(checkoutResponse.body.success).toBe(true);
    expect(checkoutResponse.body.data.sessionId).toContain('mock_');
    expect(checkoutResponse.body.data.checkoutUrl).toContain('donationStatus=success');

    const confirmResponse = await request(app)
      .post(`/api/v1/public/posts/${postId}/donations/confirm`)
      .send({
        sessionId: checkoutResponse.body.data.sessionId
      });

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.success).toBe(true);
    expect(confirmResponse.body.data.post.amountRaised).toBe(125);
    expect(confirmResponse.body.data.post.donationCount).toBe(1);
    expect(confirmResponse.body.data.post.progressPercent).toBe(12.5);
    expect(confirmResponse.body.data.donation.alreadyProcessed).toBe(false);

    const secondConfirmResponse = await request(app)
      .post(`/api/v1/public/posts/${postId}/donations/confirm`)
      .send({
        sessionId: checkoutResponse.body.data.sessionId
      });

    expect(secondConfirmResponse.status).toBe(200);
    expect(secondConfirmResponse.body.success).toBe(true);
    expect(secondConfirmResponse.body.data.post.amountRaised).toBe(125);
    expect(secondConfirmResponse.body.data.post.donationCount).toBe(1);
    expect(secondConfirmResponse.body.data.donation.alreadyProcessed).toBe(true);
  });
});
