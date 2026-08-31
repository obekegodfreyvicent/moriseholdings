import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sprint 16 (Customer Storefront) — a second, separate Vite app alongside
// mbms/frontend (the staff Admin app), sharing the same backend but never
// the same origin/port, so a customer and staff session can coexist in the
// same browser without their tokens colliding (see src/lib/api.js's
// storefront.* localStorage keys, distinct from the admin app's mbms.*
// ones).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
