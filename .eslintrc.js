module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Turn off warnings that are not critical for production
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'react/no-unescaped-entities': 'error', // Keep this as error since it can break rendering
    'prefer-const': 'warn',
  },
}