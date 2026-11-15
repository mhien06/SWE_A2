import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    include: ['../../tests/task52/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
