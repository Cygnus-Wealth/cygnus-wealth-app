/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // To add only specific polyfills, add them here. If no option is passed, adds all polyfills
      include: ['buffer'],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    })
  ],
  optimizeDeps: {
    include: [
      '@cygnus-wealth/asset-valuator',
      '@cygnus-wealth/evm-integration',
      '@cygnus-wealth/data-models',
      '@cygnus-wealth/wallet-integration-system'
    ],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  resolve: {
    alias: {
      buffer: 'buffer'
    }
  },
  define: {
    global: 'globalThis'
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'e2e/**/*'],
    deps: {
      optimizer: {
        web: {
          include: ['@cygnus-wealth/wallet-integration-system']
        }
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/*',
        'e2e/**/*'
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 80,
        statements: 80
      }
    }
  }
});