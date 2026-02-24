import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/app/api/auth/**/*.ts',
        'src/app/api/products/**/*.ts',
        'src/app/api/orders/**/*.ts',
        'src/app/api/designs/**/*.ts',
      ],
      exclude: [
        'node_modules/**',
        '.next/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test-*.ts',
        '**/test-*.mjs',
        '**/__tests__/**',
      ],
      thresholds: {
        lines: 30,
        functions: 40,
        branches: 25,
        statements: 30,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
