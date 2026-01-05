const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    rules: {
      'import/no-unresolved': 'off',
      'import/namespace': 'off',
    },
  },
];
