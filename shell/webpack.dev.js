const createWebpackConfig = require('../config/webpack.config.js');

module.exports = createWebpackConfig({
  appDirectory: __dirname,
  port: 3000,
  mode: 'development',
  federationConfig: {
    name: 'shell',
    remotes: {
      orders: 'orders@http://localhost:3001/remoteEntry.js'
    }
  }
});
