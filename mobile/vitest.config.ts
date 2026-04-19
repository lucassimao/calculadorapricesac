import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'test/mocks/react-native.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: [path.resolve(__dirname, 'test/vitest.setup.ts')],
  },
});
