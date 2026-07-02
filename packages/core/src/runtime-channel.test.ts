import { describe, expect, it } from 'vitest';

import { readPortOverride, resolveNeonPilotRuntimeChannel, resolveNeonPilotRuntimeChannelConfig } from './runtime-channel.js';

describe('runtime channel resolution', () => {
  it('defaults to stable', () => {
    expect(resolveNeonPilotRuntimeChannel({})).toBe('stable');
    expect(resolveNeonPilotRuntimeChannelConfig({})).toEqual({
      channel: 'stable',
      stateRootSuffix: '',
      codexPort: 3846,
      updatesEnabled: true,
    });
  });

  it('uses RC for packaged prerelease versions', () => {
    expect(resolveNeonPilotRuntimeChannel({}, { version: '0.8.0-rc.12', packaged: true })).toBe('rc');
    expect(resolveNeonPilotRuntimeChannelConfig({}, { version: '0.8.0-rc.12', packaged: true })).toMatchObject({
      channel: 'rc',
      updatesEnabled: true,
    });
  });

  it('keeps an installed RC app on the RC runtime channel after stable-version updates', () => {
    expect(resolveNeonPilotRuntimeChannel({}, { version: '0.9.0', packaged: true, appName: 'Neon Pilot RC' })).toBe('rc');
    expect(resolveNeonPilotRuntimeChannel({}, { version: '0.9.0', packaged: true, appId: 'com.neon-pilot.desktop.rc' })).toBe('rc');
  });

  it('keeps unpackaged prerelease versions stable unless explicitly overridden', () => {
    expect(resolveNeonPilotRuntimeChannel({}, { version: '0.8.0-rc.12', packaged: false })).toBe('stable');
  });

  it('normalizes explicit dev and test aliases with ephemeral ports', () => {
    expect(resolveNeonPilotRuntimeChannel({ NEON_PILOT_RUNTIME_CHANNEL: 'development' })).toBe('dev');
    expect(resolveNeonPilotRuntimeChannel({ NEON_PILOT_DESKTOP_VARIANT: 'testing' })).toBe('test');
    expect(resolveNeonPilotRuntimeChannelConfig({ NEON_PILOT_RUNTIME_CHANNEL: 'development' })).toMatchObject({
      channel: 'dev',
      codexPort: 0,
    });
  });

  it('validates optional port overrides', () => {
    expect(readPortOverride('3844')).toBe(3844);
    expect(readPortOverride('0')).toBe(0);
    expect(readPortOverride('nope')).toBeUndefined();
    expect(readPortOverride('70000')).toBeUndefined();
  });
});
