import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/components/__tests__/**/*.test.tsx'],
    setupFiles: [],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/components/**/*.tsx'],
    },
  },
});
