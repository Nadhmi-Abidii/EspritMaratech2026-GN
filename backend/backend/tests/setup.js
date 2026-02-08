const path = require('path');
const fs = require('fs/promises');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.setTimeout(120000);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_EXPIRES_IN = '12h';
process.env.GEO_AUTOLOOKUP = 'false';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.PUBLIC_SITE_URL = 'http://localhost:4200';
process.env.DONATION_CURRENCY = 'usd';
process.env.OPENAI_API_KEY = 'test_openai_api_key';

let mongoServer;
let dbReady = false;

beforeAll(async () => {
  process.env.MONGOMS_PREFER_GLOBAL_PATH = 'false';
  process.env.MONGOMS_DOWNLOAD_DIR = path.join(process.cwd(), '.cache', 'mongodb-binaries');

  await fs.mkdir(process.env.MONGOMS_DOWNLOAD_DIR, { recursive: true });

  mongoServer = await MongoMemoryServer.create({
    binary: {
      downloadDir: process.env.MONGOMS_DOWNLOAD_DIR
    }
  });

  await mongoose.connect(mongoServer.getUri());
  dbReady = true;
});

afterEach(async () => {
  if (!dbReady || mongoose.connection.readyState !== 1) {
    return;
  }

  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});
