// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // Editorial copy is full of apostrophes; React escapes text nodes anyway.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
