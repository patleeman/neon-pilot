import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@neon-pilot/core': resolve(repoRoot, 'packages/core/src/index.ts'),
      '@neon-pilot/daemon': resolve(repoRoot, 'packages/desktop/server/daemon/index.ts'),
      '@testing-library/react': resolve(repoRoot, 'packages/desktop/node_modules/@testing-library/react'),
      '@neon-pilot/extensions/host': resolve(repoRoot, 'packages/desktop/ui/src/extensions/host.ts'),
      '@neon-pilot/extensions/ui': resolve(repoRoot, 'packages/desktop/ui/src/extensions/ui.ts'),
      '@neon-pilot/extensions/workbench': resolve(repoRoot, 'packages/desktop/ui/src/extensions/workbench.ts'),
      '@neon-pilot/extensions/workbench-browser': resolve(repoRoot, 'packages/desktop/ui/src/extensions/workbench-browser.ts'),
      '@neon-pilot/extensions/workbench-diffs': resolve(repoRoot, 'packages/desktop/ui/src/extensions/workbench-diffs.ts'),
      '@neon-pilot/extensions/host-view-components': resolve(repoRoot, 'packages/extensions/src/host-view-components.ts'),
      '@neon-pilot/extensions/data': resolve(repoRoot, 'packages/desktop/ui/src/extensions/data.ts'),
      '@neon-pilot/extensions/settings': resolve(repoRoot, 'packages/desktop/ui/src/extensions/settings.ts'),
      '@neon-pilot/extensions/excalidraw': resolve(repoRoot, 'packages/extensions/src/excalidraw.ts'),
      '@neon-pilot/extensions/backend/agent': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/agent.ts'),
      '@neon-pilot/extensions/backend/artifacts': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/artifacts.ts'),
      '@neon-pilot/extensions/backend/automations': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/automations.ts'),
      '@neon-pilot/extensions/backend/browser': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/browser.ts'),
      '@neon-pilot/extensions/backend/checkpoints': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/checkpoints.ts'),
      '@neon-pilot/extensions/backend/cli': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/cli.ts'),
      '@neon-pilot/extensions/backend/compaction': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/compaction.ts'),
      '@neon-pilot/extensions/backend/conversations': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/conversations.ts'),
      '@neon-pilot/extensions/backend/events': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/events.ts'),
      '@neon-pilot/extensions/backend/images': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/images.ts'),
      '@neon-pilot/extensions/backend/knowledge': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/knowledge.ts'),
      '@neon-pilot/extensions/backend/mcp': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/mcp.ts'),
      '@neon-pilot/extensions/backend/promptAssembly': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/promptAssembly.ts'),
      '@neon-pilot/extensions/backend/runs': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/runs.ts'),
      '@neon-pilot/extensions/backend/runtime': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/runtime.ts'),
      '@neon-pilot/extensions/backend/settings': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/settings.ts'),
      '@neon-pilot/extensions/backend/skills': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/skills.ts'),
      '@neon-pilot/extensions/backend/telemetry': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/telemetry.ts'),
      '@neon-pilot/extensions/backend/terminal': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/terminal.ts'),
      '@neon-pilot/extensions/backend/webContent': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/webContent.ts'),
      '@neon-pilot/extensions/backend': resolve(repoRoot, 'packages/desktop/server/extensions/backendApi/index.ts'),
      '@neon-pilot/extensions': resolve(repoRoot, 'packages/extensions/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    setupFiles: [resolve(repoRoot, 'vitest.setup.ts')],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.taskfactory/**'],
    coverage: {
      include: [
        'packages/*/src/**/*.ts',
        'packages/desktop/ui/src/**/*.tsx',
        'packages/desktop/ui/src/**/*.ts',
        'packages/desktop/server/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.test.tsx',
        '**/*.spec.tsx',
        '**/node_modules/**',
        '**/dist/**',
        'packages/**/src/**/types.ts',
      ],
      reporter: ['text', 'text-summary', 'json-summary'],
    },
  },
});
