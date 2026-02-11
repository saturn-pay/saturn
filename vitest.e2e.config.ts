import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    setupFiles: [],
    sequence: {
      concurrent: false,
    },
    // Run tests in sequence to avoid race conditions with shared account state
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
  },
});
