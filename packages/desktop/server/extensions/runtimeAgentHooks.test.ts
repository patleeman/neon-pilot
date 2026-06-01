import { describe, expect, it } from 'vitest';

import { buildLiveSessionExtensionFactoriesForRuntime, buildLiveSessionResourceOptionsForRuntime } from './runtimeAgentHooks.js';

describe('runtime agent hooks', () => {
  it('builds live-session resources and extension factories before the app runtime registers builders', () => {
    process.env.NEON_PILOT_REPO_ROOT = process.cwd();

    const options = buildLiveSessionResourceOptionsForRuntime();
    const factories = buildLiveSessionExtensionFactoriesForRuntime();

    expect(options.additionalExtensionPaths).toEqual(expect.any(Array));
    expect(options.additionalSkillPaths).toEqual([]);
    expect(options.additionalPromptTemplatePaths).toEqual(expect.any(Array));
    expect(options.additionalThemePaths).toEqual(expect.any(Array));
    expect(factories.length).toBeGreaterThan(0);
  });
});
