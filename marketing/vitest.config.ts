import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Tests read the engine's single source directly from the mobile app.
      '@loan-engine/calculations': fileURLToPath(
        new URL('../mobile/src/lib/calculations.ts', import.meta.url),
      ),
      '@loan-engine/loan': fileURLToPath(new URL('../mobile/src/types/loan.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
});
