/**
 * ESLint Plugin for Activity Hub
 * Enforces styling standards and best practices across all apps
 */

const requireSharedCss = require('./rules/require-shared-css');
const noHardcodedColors = require('./rules/no-hardcoded-colors');
const preferAhClasses = require('./rules/prefer-ah-classes');

module.exports = {
  rules: {
    'require-shared-css': requireSharedCss,
    'no-hardcoded-colors': noHardcodedColors,
    'prefer-ah-classes': preferAhClasses,
  },
  configs: {
    recommended: {
      plugins: ['activity-hub'],
      rules: {
        'activity-hub/require-shared-css': 'error',
        'activity-hub/no-hardcoded-colors': 'warn',
        'activity-hub/prefer-ah-classes': 'warn',
      },
    },
  },
};
