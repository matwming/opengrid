import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 44731, strictPort: true, headers },
  preview: { host: '127.0.0.1', port: 44731, strictPort: true, headers },
  optimizeDeps: { exclude: ['opengrid', 'opengrid-react'] },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
});
