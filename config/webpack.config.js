const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { merge } = require('webpack-merge');

/**
 * Единая фабрика конфигурации Webpack
 * @param {Object} options
 * @param {string} options.appDirectory - Абсолютный путь к папке приложения (__dirname)
 * @param {number} options.port - Порт для сервера разработки
 * @param {string} options.mode - Режим 'development' или 'production'
 */
module.exports = function createWebpackConfig({ appDirectory, port, mode }) {
  const isProd = mode === 'production';

  const commonConfig = {
    mode: mode,
    entry: path.resolve(appDirectory, 'src/index.tsx'),
    output: {
      path: path.resolve(appDirectory, 'dist'),
      filename: 'bundle.js',
      clean: true,
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
      },
    });
  }
};
