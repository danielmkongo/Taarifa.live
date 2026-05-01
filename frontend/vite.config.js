import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8001,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:3000',  ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:    ['react', 'react-dom', 'react-router-dom'],
          charts:    ['recharts'],
          maps:      ['@react-google-maps/api'],
          query:     ['@tanstack/react-query'],
          clusterer: ['@googlemaps/markerclusterer'],
        },
      },
    },
  },
});
