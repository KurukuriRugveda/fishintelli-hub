// PM2 ecosystem config — used for local production runs
// Start with: npx pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'aqua-hub-api',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 10000,
        MONGODB_URI: 'mongodb://localhost:27017/aqua_hub',
        CORS_ORIGINS: 'https://fisheries-intelligent-hub.vercel.app',
      },
    },
  ],
};
