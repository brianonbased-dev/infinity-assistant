import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Changed from jsdom for service tests
    include: [
      'src/components/__tests__/**/*.test.tsx',
      'src/lib/**/__tests__/**/*.test.ts',
      'src/services/**/__tests__/**/*.test.ts'
    ],
    setupFiles: [],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: [
        'src/components/**/*.tsx',
        'src/lib/**/*.ts',
        'src/services/**/*.ts'
      ],
    },
  },
});
