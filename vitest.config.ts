import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/vitest/setup.ts'],
    include: ['tests/vitest/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    alias: [
      { find: /^~\/(.+)/, replacement: path.resolve(__dirname, './frontend/src/$1') },
      { find: /^@\/(.+)/, replacement: path.resolve(__dirname, './frontend/src/$1') },
      { find: /^ shortcuts\/registry$/, replacement: path.resolve(__dirname, './frontend/src/shortcuts/registry.ts') },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './tests/.outputs/vitest/coverage',
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
        'tests/vitest/**',
      ],
    },
  },
});