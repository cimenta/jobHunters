import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'node', include: ['packages/{core,gas}/src/**/*.test.ts'], environment: 'node' } },
      'packages/ui',
    ],
  },
});
