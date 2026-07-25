import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev the Vite server proxies /api to the FastAPI process so the browser only
// ever talks to one origin. In the container the same job is done by nginx, so
// the frontend code never needs an API base URL of its own.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libraries out of the app chunk so the
        // first paint of the playbook library is not blocked on the chart and
        // syntax-highlighting code.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          highlight: ['react-syntax-highlighter'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
