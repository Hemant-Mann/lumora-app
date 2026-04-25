export default {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/helpers/',
  ],
  moduleNameMapper: {
    '^lumora/(.*)$': '<rootDir>/node_modules/lumora/$1',
  },
}
