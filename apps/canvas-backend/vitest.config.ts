import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    env: {
      // Stub SpacetimeDB env vars so client.ts module-level code
      // doesn't throw when imported by unit tests (no real network calls made).
      SPACETIMEDB_URL: 'wss://test.example.com',
      SPACETIMEDB_DB_NAME: 'test-db',
    },
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/utils/**', 'src/routes/**', 'src/mastra/tools/**'],
      thresholds: {
        lines: 28,
        functions: 26,
        branches: 23,
      },
    },
  },
});
