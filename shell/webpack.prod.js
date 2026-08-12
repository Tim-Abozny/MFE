const createWebpackConfig = require('../config/webpack.config.js');

module.exports = createWebpackConfig({
  appDirectory: __dirname,
  port: 3000,
  mode: 'production',
  federationConfig: {
    name: 'shell',
    remotes: {}
  }
});
