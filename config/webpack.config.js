const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { merge } = require('webpack-merge');
const { ModuleFederationPlugin } = require('webpack').container;

/**
 * Единая фабрика конфигурации Webpack
 * @param {Object} options
 * @param {string} options.appDirectory - Абсолютный путь к папке приложения (__dirname)
 * @param {number} options.port - Порт для сервера разработки
 * @param {string} options.mode - Режим 'development' или 'production'
 * @param {Object} options.federationConfig - локальные настройки Module Federation пакета
 */
module.exports = function createWebpackConfig({ appDirectory, port, mode, federationConfig }) {
  const isProd = mode === 'production';

  const pkg = require(path.resolve(appDirectory, 'package.json'));
  const dependencies = pkg.dependencies || {};

  const commonConfig = {
    mode: mode,
    entry: path.resolve(appDirectory, 'src/index.ts'),
    output: {
      path: path.resolve(appDirectory, 'dist'),
      filename: 'bundle.js',
      clean: true,
      publicPath: 'auto',
      uniqueName: federationConfig.name,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cwd: appDirectory, 
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { 'runtime': 'automatic' }],
                '@babel/preset-typescript'
              ]
            },
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({}),
      new ModuleFederationPlugin({
        ...federationConfig,
        shared: {
          react: {
            singleton: true,
            requiredVersion: dependencies.react,
          },
        },
      }),
    ],
  };

  if (isProd) {
    return merge(commonConfig, {
      devtool: false,
    });
  } else {
    return merge(commonConfig, {
      devtool: 'eval-source-map',
      devServer: {
        port: port || 3000,
        open: true,
        hot: true,
        historyApiFallback: true,
      },
    });
  }
};
