import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    exclude: ['**/node_modules/**', '**/test/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Import the shared package's TypeScript source directly instead of
      // its built CommonJS dist/ - apps/api (Node/ts-node) needs that CJS
      // build, but routing Vite/Rollup through it hits a CJS/ESM interop
      // dead end with symlinked workspace packages (named exports from a
      // dist compiled with __exportStar/Object.defineProperty aren't
      // statically visible the way Rollup needs). Vite/esbuild transpiles
      // this .ts source the same way it does apps/web's own code.
      '@swe-challenge-stone/common': path.resolve(
        __dirname,
        '../../packages/common/src/index.ts',
      ),
    },
  },
  server: {
    port: 5173,
  },
});
