import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules/**',
      'tests/**', // Exclude Playwright tests
      '**/*.e2e.{test,spec}.ts',
      '**/*.spec.ts', // Exclude .spec.ts files (Playwright)
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/currency.ts',
        'src/lib/utils.ts',
        'src/lib/safe-redirect.ts',
        'src/lib/design-cost-guard.ts',
        'src/lib/embroidery-config.ts',
        'src/lib/providers/**/*.ts',
        'src/components/common/SafeMarkdown.tsx',
        'src/components/design-studio/**/*.{ts,tsx}',
        'src/hooks/useCanvas*.ts',
        'src/hooks/useDesign*.ts',
        'src/app/api/designs/**/*.ts',
        'src/lib/pod/**/*.ts',
      ],
      exclude: [
        'node_modules/**',
        'src/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
