import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => ({
  root: 'frontend',
  // .env 位于仓库根目录（与原 loadEnv(mode, '.', '') 行为一致）
  envDir: __dirname,
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:12345',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:12345',
        ws: true,
      },
    },
  },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]react(?:-dom)?[\\/]/.test(id) || /[\\/]scheduler[\\/]/.test(id)) {
            return 'react-vendor';
          }
          if (/[\\/]dockview(?:-react)?[\\/]/.test(id)) return 'dockview';
          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // 限制并发，避免高核机器一次启动过多 worker 导致 CI 随机超时。
    pool: 'threads',
    maxWorkers: 4,
  },
}));
