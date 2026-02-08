const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

const start = async () => {
  try {
    await connectDB();
    app.listen(env.port, () => {
      if (env.nodeEnv !== 'production') {
        const keyInfo = env.openaiApiKey
          ? `len=${env.openaiApiKey.length} suffix=${env.openaiApiKey.slice(-4)}`
          : 'missing';
        // eslint-disable-next-line no-console
        console.log(`OpenAI key loaded: ${keyInfo}`);
      }

      // eslint-disable-next-line no-console
      console.log(`Server is running on port ${env.port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to start server:', error.message);
    process.exit(1);
  }
};

start();
