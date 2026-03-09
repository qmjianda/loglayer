import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./frontend/src/test/setup.ts'],
    include: ['frontend/src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'frontend/src/hooks/**/*.{ts,tsx}',
        'frontend/src/utils/**/*.{ts,tsx}',
        'frontend/src/components/**/*.{ts,tsx}',
        'frontend/src/contexts/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'frontend/src/test/**',
      ],
      // thresholds: {
      //   lines: 40,
      //   functions: 40,
      //   branches: 35,
      //   statements: 40,
      // },
    },
  },
});