const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../../.env');

// Load once without override so production env vars (and NODE_ENV) can win.
dotenv.config({ path: envPath });

const nodeEnv = process.env.NODE_ENV || 'development';

// In non-production, prefer the .env file so stale terminal vars don't win.
// In test, keep setupFilesAfterEnv-controlled variables (e.g., PAYMENT_PROVIDER=mock).
if (nodeEnv !== 'production' && nodeEnv !== 'test') {
  dotenv.config({ path: envPath, override: true });
}

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/omnia_charity',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  geoProvider: process.env.GEO_PROVIDER || 'nominatim',
  geoAutoLookup: toBoolean(process.env.GEO_AUTOLOOKUP, true),
  nominatimBaseUrl: process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org',
  nominatimUserAgent: process.env.NOMINATIM_USER_AGENT || 'omnia-charity-tracking/1.0',
  paymentProvider: String(process.env.PAYMENT_PROVIDER || 'stripe').toLowerCase(),
  donationCurrency: String(process.env.DONATION_CURRENCY || 'usd').toLowerCase(),
  publicSiteUrl: process.env.PUBLIC_SITE_URL || 'http://localhost:4200',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  openaiApiBaseUrl: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
  openaiTimeoutMs: Math.max(Number(process.env.OPENAI_TIMEOUT_MS) || 15000, 1000)
};

if (env.nodeEnv === 'production' && env.jwtSecret === 'dev_jwt_secret_change_me') {
  throw new Error('JWT_SECRET must be set in production environment.');
}

module.exports = env;
