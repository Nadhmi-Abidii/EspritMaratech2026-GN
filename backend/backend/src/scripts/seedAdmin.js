const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const Utilisateur = require('../models/Utilisateur');

const seedAdmin = async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be set.');
  }

  await connectDB();

  const existingAdmin = await Utilisateur.findOne({ email: ADMIN_EMAIL.toLowerCase() });

  if (existingAdmin) {
    // eslint-disable-next-line no-console
    console.log('Admin user already exists.');
    await disconnectDB();
    return;
  }

  await Utilisateur.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL.toLowerCase(),
    password: ADMIN_PASSWORD,
    role: 'admin',
    isActive: true
  });

  // eslint-disable-next-line no-console
  console.log('Admin user created successfully.');
  await disconnectDB();
};

seedAdmin()
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to seed admin user:', error.message);
    await disconnectDB();
    process.exit(1);
  })
  .finally(() => {
    if (env.nodeEnv !== 'test') {
      // eslint-disable-next-line no-console
      console.log('Seed command completed.');
    }
  });
