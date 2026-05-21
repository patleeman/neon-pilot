import { afterEach, describe, expect, it } from 'vitest';

import { buildLiveSessionExtensionFactoriesForRuntime, buildLiveSessionResourceOptionsForRuntime } from './runtimeAgentHooks.js';

const originalRepoRoot = process.env.NEON_PILOT_REPO_ROOT;
const originalRuntimeScope = process.env.NEON_PILOT_RUNTIME_SCOPE;

afterEach(() => {
  if (originalRepoRoot === undefined) {
    delete process.env.NEON_PILOT_REPO_ROOT;
  } else {
    process.env.NEON_PILOT_REPO_ROOT = originalRepoRoot;
  }

  if (originalRuntimeScope === undefined) {
    delete process.env.NEON_PILOT_RUNTIME_SCOPE;
  } else {
    process.env.NEON_PILOT_RUNTIME_SCOPE = originalRuntimeScope;
  }
});

describe('runtime agent hooks', () => {
  it('builds live-session resources and extension factories before the app runtime registers builders', () => {
    process.env.NEON_PILOT_REPO_ROOT = process.cwd();
    process.env.NEON_PILOT_RUNTIME_SCOPE = 'shared';

    const options = buildLiveSessionResourceOptionsForRuntime();
    const factories = buildLiveSessionExtensionFactoriesForRuntime();

    expect(options.additionalExtensionPaths).toEqual(expect.any(Array));
    expect(options.additionalSkillPaths).toEqual(expect.any(Array));
    expect(options.additionalPromptTemplatePaths).toEqual(expect.any(Array));
    expect(options.additionalThemePaths).toEqual(expect.any(Array));
    expect(factories.length).toBeGreaterThan(0);
  });
});
