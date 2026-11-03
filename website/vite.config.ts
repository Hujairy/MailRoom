import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative paths, so the website works from any folder on the web server.
  base: './',
  // Always the same local address, so it can be registered for sign-in.
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  // Emit images as files rather than inline data URLs, which a strict
  // content security policy may block.
  build: { assetsInlineLimit: 0 },
});
