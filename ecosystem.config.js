module.exports = {
  apps: [
    {
      name: "app",
      script: "./dist/index.js",
      instances: "max",
      env: {
        NODE_ENV: "development",
        APP_URL: "https://peaceful-woodland-02086.herokuapp.com",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
