import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      MCP_JWT_SECRET: 'test-secret-for-vitest-minimum-32-chars',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/auth/oauth-provider.ts',
        'src/middleware/rate-limit.ts',
        'src/session.ts',
        'src/lib/image-utils.ts',
        'src/lib/response.ts',
        'src/tools/search-products.ts',
        'src/tools/get-cart.ts',
        'src/tools/create-checkout.ts',
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test-*.ts',
        '**/test-*.mjs',
        '**/__tests__/**',
        'check-products.ts',
        'create-test-order.mjs',
        'src/index.ts',
        'src/lib/**',
        'src/prompts/**',
        'src/resources/**',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
