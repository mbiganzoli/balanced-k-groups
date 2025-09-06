import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'bench/',
        'scripts/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.spec.ts',
        '**/*.test.ts'
      ],
      include: ['src/**/*.ts'],
      thresholds: {
        global: {
          branches: 80,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    setupFiles: ['tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
