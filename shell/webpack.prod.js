const createWebpackConfig = require('../config/webpack.config.js');

module.exports = createWebpackConfig({
  appDirectory: __dirname,
  port: 3000,
  mode: 'production',
  federationConfig: {
    name: 'shell',
    remotes: {
      orders: 'orders@http://localhost:3001/remoteEntry.js',
      shipments: 'shipments@http://localhost:3002/remoteEntry.js'
    }
  }
});
