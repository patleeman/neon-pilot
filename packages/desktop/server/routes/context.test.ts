import { describe, expect, it } from 'vitest';

import type { LiveSessionResourceOptions, RegisterServerRoutesInput, ServerRouteContext } from './context.js';

describe('routes context contracts', () => {
  it('accepts complete server route contexts with live-session resource options', () => {
    const resourceOptions: LiveSessionResourceOptions = {
      additionalExtensionPaths: ['/extensions'],
      additionalSkillPaths: ['/skills'],
      additionalPromptTemplatePaths: ['/prompts'],
      additionalThemePaths: ['/themes'],
      custom: true,
    };
    const context: ServerRouteContext = {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getRuntimeConfigRoot: () => '/runtime-config',
      materializeWebRuntimeConfig: () => undefined,
      getSettingsFile: () => '/settings.json',
      getAuthFile: () => '/auth.json',
      getStateRoot: () => '/state',
      getServerPort: () => 3838,
      getDefaultWebCwd: () => '/repo',
      resolveRequestedCwd: (cwd) => cwd ?? undefined,
      buildLiveSessionResourceOptions: () => resourceOptions,
      buildLiveSessionResourceOptionsAsync: async () => resourceOptions,
      buildLiveSessionExtensionFactories: () => [],
      flushLiveDeferredResumes: async () => undefined,
      getSavedUiPreferences: () => ({}) as never,
      listTasksForRuntimeScope: () => [],
      listMemoryDocs: () => [],
      listSkillsForRuntimeScope: () => [],
      listProfileAgentItems: () => [],
      withTemporaryRuntimeAgentDir: async (_profile, run) => run('/tmp/agent'),
      getDurableRunSnapshot: async () => null,
    };
    const input: RegisterServerRoutesInput = { app: {} as never, context };

    expect(input.context.getRuntimeScope()).toBe('shared');
    expect(input.context.buildLiveSessionResourceOptions().additionalSkillPaths).toEqual(['/skills']);
    expect(input.context.buildLiveSessionResourceOptions().custom).toBe(true);
  });
});
