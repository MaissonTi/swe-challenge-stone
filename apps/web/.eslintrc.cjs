module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.app.json', 'tsconfig.test.json'],
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  env: {
    browser: true,
    es2021: true,
  },
  rules: {
    // TypeScript's own checker already catches undefined identifiers;
    // this core rule doesn't know about ambient/global types (e.g.
    // vitest's `globals: true`) and false-positives on them.
    'no-undef': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      files: ['test/**/*.ts', 'test/**/*.tsx'],
      env: { node: true },
    },
  ],
};
