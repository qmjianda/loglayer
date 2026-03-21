import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    root: 'frontend',
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
        }
      },
      allowedHosts: ['localhost', 'frp2.ccszxc.xin'],
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            radix: [
              '@radix-ui/react-context-menu',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-dialog',
            ],
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './frontend/src'),
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: [],
    },
  };
});