const createWebpackConfig = require('../config/webpack.config.js');

module.exports = createWebpackConfig({
  appDirectory: __dirname,
  port: 3001,
  mode: 'production',
  federationConfig: {
    name: 'orders',
    filename: 'remoteEntry.js',
    exposes: {
      './OrdersApp': './src/OrdersApp'
    }
  }
});
