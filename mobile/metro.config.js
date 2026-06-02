const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Allow importing the shared loan engine via the mobile/shared symlink.
// The shim files in src/lib/ and src/types/ import from '../../shared/loan-engine/'
// which resolves through mobile/shared -> ../../shared (a symlink at the mobile
// project root). Metro indexes symlinks within the projectRoot, so the files get
// hashed correctly. watchFolders is kept for completeness / dev-server hot reload.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '..'),
];

module.exports = config;
