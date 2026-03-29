import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:8765', ws: true },
      '/map_data.json': { target: 'http://localhost:8765', changeOrigin: true },
      '/pokemon_catalog.json': { target: 'http://localhost:8765', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
