import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo at https://<user>.github.io/syncbeat/ —
  // this tells Vite to build asset paths for that subfolder instead of "/".
  // Not needed for Vercel or Azure Static Web Apps (root-domain hosting),
  // only for GitHub Pages specifically.
  base: process.env.GITHUB_PAGES ? '/syncbeat/' : '/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
