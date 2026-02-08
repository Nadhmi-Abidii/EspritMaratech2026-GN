const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async (uri = env.mongoUri) => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);

  if (env.nodeEnv !== 'test') {
    // eslint-disable-next-line no-console
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
};

module.exports = {
  connectDB,
  disconnectDB
};
