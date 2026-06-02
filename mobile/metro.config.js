const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Allow importing the shared loan engine from the repo root (../shared)
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '..')];

module.exports = config;
