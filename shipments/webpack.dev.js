const createWebpackConfig = require('../config/webpack.config.js');

module.exports = createWebpackConfig({
  appDirectory: __dirname,
  port: 3002,
  mode: 'development',
  federationConfig: {
    name: 'shipments',
    filename: 'remoteEntry.js',
    exposes: {
      './ShipmentsApp': './src/ShipmentsApp'
    }
  }
});
