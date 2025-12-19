const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Handle CSS imports (without CSS modules)
    '^.+\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    // Handle image imports
    '^.+\\.(png|jpg|jpeg|gif|webp|avif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
    // Optional alias example: import x from '@/foo' -> <rootDir>/foo
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)',
    '<rootDir>/**/*.(test|spec).(ts|tsx|js|jsx)'
  ],
  transform: {},
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
