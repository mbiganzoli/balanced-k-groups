// Test setup file for Vitest
import { beforeAll, afterAll } from 'vitest';

// Global test setup
beforeAll(() => {
  // Set up any global test environment
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Clean up any global test environment
});
