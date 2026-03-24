import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:1337',
      '/csrfToken': 'http://localhost:1337',
      '/socket.io': {
        target: 'http://localhost:1337',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../.tmp/public',
    emptyOutDir: true,
  },
});
