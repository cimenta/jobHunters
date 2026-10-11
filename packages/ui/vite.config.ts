import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte(), viteSingleFile()],
  // Svelte 5 resolves its server build under Node unless the browser condition is set for tests.
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    name: 'ui',
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/setup.ts'],
  },
});
