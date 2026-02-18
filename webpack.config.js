const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

// Load API keys from gitignored secrets file (injected at build time)
let apiKeysConfig = {};
try {
  apiKeysConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'src/config/.keys.json'), 'utf8'));
} catch {
  console.warn('No .keys.json found. API keys will need to be set in chrome.storage manually.');
}

module.exports = {
  // 5 entry points: popup, content script, background, break overlay, HUD overlay
  entry: {
    popup: './src/popup/index.js',
    contentScript: './src/content/contentScript.js',
    background: './src/background/background.js',
    breakOverlayInjector: './src/content/breakOverlayInjector.js',
    hudInjector: './src/content/hudInjector.js',
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },

  module: {
    rules: [
      // Babel for JS/JSX
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
      // CSS with Tailwind/PostCSS
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
        ],
      },
    ],
  },

  plugins: [
    // Inject API keys at build time from .keys.json
    new webpack.DefinePlugin({
      '__API_KEYS__': JSON.stringify(apiKeysConfig),
    }),

    // Extract CSS into separate file
    new MiniCssExtractPlugin({
      filename: 'main.css',
    }),

    // Copy static files to dist/
    new CopyPlugin({
      patterns: [
        // manifest.json from project root
        { from: 'manifest.json', to: 'manifest.json' },
        // popup.html
        { from: 'public/popup.html', to: 'popup.html' },
        // Assets (images, sounds)
        {
          from: 'src/assets',
          to: 'assets',
          noErrorOnMissing: true,
        },
        // Break overlay CSS (if it exists as a standalone file)
        {
          from: 'src/styles/breakOverlay.css',
          to: 'breakOverlay.css',
          noErrorOnMissing: true,
        },
        // HUD overlay CSS
        {
          from: 'src/styles/hud.css',
          to: 'hud.css',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],

  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  optimization: {
    minimizer: [
      '...', // keep default JS minimizer
      new CssMinimizerPlugin(),
    ],
  },

  // Chrome extensions don't use eval
  devtool: 'cheap-module-source-map',
};