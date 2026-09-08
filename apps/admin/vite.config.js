import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // Bez ovoga se istorija poziva vi.fn() mockova prenosi iz testa u test
    // (restoreAllMocks vraca samo spy-jeve), pa toHaveBeenCalled vidi tudje
    // pozive.
    clearMocks: true,
  },
  server: {
    port: 5173,
    // Telefon otvara panel preko tunela (`npm run dev:tunel`) ili preko imena
    // racunara na mrezi. Vite inace odbija svaki Host koji ne poznaje, pa bi
    // umesto panela stigla poruka "Blocked request".
    allowedHosts: ['.trycloudflare.com', '.local'],
    // Backend je na 3001. Preko proxy-ja frontend zove /api i /uploads na
    // istom origin-u, pa nema CORS-a ni hardkodovanog URL-a u kodu.
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
