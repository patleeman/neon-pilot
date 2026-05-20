import { afterEach, describe, expect, it } from 'vitest';

import { buildLiveSessionExtensionFactoriesForRuntime, buildLiveSessionResourceOptionsForRuntime } from './runtimeAgentHooks.js';

const originalRepoRoot = process.env.NEON_PILOT_REPO_ROOT;
const originalProfile = process.env.NEON_PILOT_PROFILE;
const originalActiveProfile = process.env.NEON_PILOT_ACTIVE_PROFILE;

afterEach(() => {
  if (originalRepoRoot === undefined) {
    delete process.env.NEON_PILOT_REPO_ROOT;
  } else {
    process.env.NEON_PILOT_REPO_ROOT = originalRepoRoot;
  }

  if (originalProfile === undefined) {
    delete process.env.NEON_PILOT_PROFILE;
  } else {
    process.env.NEON_PILOT_PROFILE = originalProfile;
  }

  if (originalActiveProfile === undefined) {
    delete process.env.NEON_PILOT_ACTIVE_PROFILE;
  } else {
    process.env.NEON_PILOT_ACTIVE_PROFILE = originalActiveProfile;
  }
});

describe('runtime agent hooks', () => {
  it('builds live-session resources and extension factories before the app runtime registers builders', () => {
    process.env.NEON_PILOT_REPO_ROOT = process.cwd();
    process.env.NEON_PILOT_PROFILE = 'shared';
    delete process.env.NEON_PILOT_ACTIVE_PROFILE;

    const options = buildLiveSessionResourceOptionsForRuntime();
    const factories = buildLiveSessionExtensionFactoriesForRuntime();

    expect(options.additionalExtensionPaths).toEqual(expect.any(Array));
    expect(options.additionalSkillPaths).toEqual(expect.any(Array));
    expect(options.additionalPromptTemplatePaths).toEqual(expect.any(Array));
    expect(options.additionalThemePaths).toEqual(expect.any(Array));
    expect(factories.length).toBeGreaterThan(0);
  });
});
