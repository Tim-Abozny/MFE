const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { merge } = require('webpack-merge');
const { ModuleFederationPlugin } = require('webpack').container;
const fs = require('fs');
const CopyWebpackPlugin = require('copy-webpack-plugin');

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
  const publicPathValue = federationConfig.name === 'shell' ? '/' : 'auto';

  const commonConfig = {
    mode: mode,
    entry: path.resolve(appDirectory, 'src/index.ts'),
    output: {
      path: path.resolve(appDirectory, 'dist'),
      filename: 'bundle.js',
      clean: true,
      publicPath: publicPathValue,
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
                ['@babel/preset-react', { runtime: 'automatic', development: !isProd }],
                '@babel/preset-typescript'
              ]
            },
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'template.html'),
        title: federationConfig.name,
        excludeChunks: [federationConfig.name],
      }),
      new ModuleFederationPlugin({
        ...federationConfig,
        shared: {
          react: {
          singleton: true,
          requiredVersion: dependencies.react,
          },

          'react-dom': {
            singleton: true,
            requiredVersion: dependencies['react-dom'],
          },

          'react-router-dom': {
            singleton: true,
            requiredVersion: dependencies['react-router-dom'],
          },

          'react-router': {
            singleton: true,
            requiredVersion: dependencies['react-router'],
          },
        },
      }),
      ...(fs.existsSync(path.resolve(appDirectory, 'public'))
        ? [
            new CopyWebpackPlugin({
              patterns: [{ from: path.resolve(appDirectory, 'public'), to: '.' }],
            }),
          ]
        : []),
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
        open: port === 3000,
        hot: true,
        historyApiFallback: true,
        
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
        },

        allowedHosts: 'all',
      },
    });
  }
};
