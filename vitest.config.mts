import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@neon-pilot/core': resolve(process.cwd(), 'packages/core/src/index.ts'),
      '@neon-pilot/daemon': resolve(process.cwd(), 'packages/desktop/server/daemon/index.ts'),
      '@testing-library/react': resolve(process.cwd(), 'packages/desktop/node_modules/@testing-library/react'),
      '@neon-pilot/extensions/host': resolve(process.cwd(), 'packages/desktop/ui/src/extensions/host.ts'),
      '@neon-pilot/extensions/ui': resolve(process.cwd(), 'packages/desktop/ui/src/extensions/ui.ts'),
      '@neon-pilot/extensions/workbench': resolve(process.cwd(), 'packages/desktop/ui/src/extensions/workbench.ts'),
      '@neon-pilot/extensions/workbench-browser': resolve(process.cwd(), 'packages/desktop/ui/src/extensions/workbench-browser.ts'),
      '@neon-pilot/extensions/workbench-diffs': resolve(process.cwd(), 'packages/desktop/ui/src/extensions/workbench-diffs.ts'),
      '@neon-pilot/extensions/host-view-components': resolve(process.cwd(), 'packages/extensions/src/host-view-components.ts'),
      '@neon-pilot/extensions/data': resolve(process.cwd(), 'packages/desktop/ui/src/extensions/data.ts'),
      '@neon-pilot/extensions/settings': resolve(process.cwd(), 'packages/desktop/ui/src/extensions/settings.ts'),
      '@neon-pilot/extensions/excalidraw': resolve(process.cwd(), 'packages/extensions/src/excalidraw.ts'),
      '@neon-pilot/extensions/backend/agent': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/agent.ts'),
      '@neon-pilot/extensions/backend/artifacts': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/artifacts.ts'),
      '@neon-pilot/extensions/backend/automations': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/automations.ts'),
      '@neon-pilot/extensions/backend/browser': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/browser.ts'),
      '@neon-pilot/extensions/backend/checkpoints': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/checkpoints.ts'),
      '@neon-pilot/extensions/backend/compaction': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/compaction.ts'),
      '@neon-pilot/extensions/backend/conversations': resolve(
        process.cwd(),
        'packages/desktop/server/extensions/backendApi/conversations.ts',
      ),
      '@neon-pilot/extensions/backend/events': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/events.ts'),
      '@neon-pilot/extensions/backend/images': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/images.ts'),
      '@neon-pilot/extensions/backend/knowledge': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/knowledge.ts'),
      '@neon-pilot/extensions/backend/knowledgeVault': resolve(
        process.cwd(),
        'packages/desktop/server/extensions/backendApi/knowledgeVault.ts',
      ),
      '@neon-pilot/extensions/backend/mcp': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/mcp.ts'),
      '@neon-pilot/extensions/backend/runs': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/runs.ts'),
      '@neon-pilot/extensions/backend/runtime': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/runtime.ts'),
      '@neon-pilot/extensions/backend/telemetry': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/telemetry.ts'),
      '@neon-pilot/extensions/backend/slackMcpGateway': resolve(
        process.cwd(),
        'packages/desktop/server/extensions/backendApi/slackMcpGateway.ts',
      ),
      '@neon-pilot/extensions/backend/webContent': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/webContent.ts'),
      '@neon-pilot/extensions/backend': resolve(process.cwd(), 'packages/desktop/server/extensions/backendApi/index.ts'),
      '@neon-pilot/extensions': resolve(process.cwd(), 'packages/extensions/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['vitest.setup.ts'],
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
