import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@neon-pilot/extensions/host': resolve(__dirname, 'src/extensions/host.ts'),
      '@neon-pilot/extensions/ui': resolve(__dirname, 'src/extensions/ui.ts'),
      '@neon-pilot/extensions/workbench': resolve(__dirname, 'src/extensions/workbench.ts'),
      '@neon-pilot/extensions/host-view-components': resolve(__dirname, '../../../packages/extensions/src/host-view-components.ts'),
      '@neon-pilot/extensions/workbench-artifacts': resolve(__dirname, 'src/extensions/workbench-artifacts.ts'),
      '@neon-pilot/extensions/workbench-browser': resolve(__dirname, 'src/extensions/workbench-browser.ts'),
      '@neon-pilot/extensions/workbench-diffs': resolve(__dirname, 'src/extensions/workbench-diffs.ts'),
      '@neon-pilot/extensions/workbench-files': resolve(__dirname, 'src/extensions/workbench-files.ts'),
      '@neon-pilot/extensions/workbench-runs': resolve(__dirname, 'src/extensions/workbench-runs.ts'),
      '@neon-pilot/extensions/workbench-transcript': resolve(__dirname, 'src/extensions/workbench-transcript.ts'),
      '@neon-pilot/extensions/data': resolve(__dirname, 'src/extensions/data.ts'),
      '@neon-pilot/extensions/settings': resolve(__dirname, 'src/extensions/settings.ts'),
      '@neon-pilot/extensions/excalidraw': resolve(__dirname, '../../../packages/extensions/src/excalidraw.ts'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    // Keep prior hashed chunks available for already-running desktop windows.
    // Clean/package flows remove ui/dist before building; incremental build:ui must not
    // break dynamic imports from a renderer that loaded the previous bundle.
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3741',
        changeOrigin: true,
      },
    },
  },
});
