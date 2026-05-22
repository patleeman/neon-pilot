import { describe, expect, it } from 'vitest';

import { readPortOverride, resolveNeonPilotRuntimeChannel, resolveNeonPilotRuntimeChannelConfig } from './runtime-channel.js';

describe('runtime channel resolution', () => {
  it('defaults to stable', () => {
    expect(resolveNeonPilotRuntimeChannel({})).toBe('stable');
    expect(resolveNeonPilotRuntimeChannelConfig({})).toEqual({
      channel: 'stable',
      stateRootSuffix: '',
      companionPort: 3842,
      codexPort: 3846,
      updatesEnabled: true,
    });
  });

  it('uses RC for packaged prerelease versions', () => {
    expect(resolveNeonPilotRuntimeChannel({}, { version: '0.8.0-rc.12', packaged: true })).toBe('rc');
    expect(resolveNeonPilotRuntimeChannelConfig({}, { version: '0.8.0-rc.12', packaged: true })).toMatchObject({
      channel: 'rc',
      companionPort: 3843,
      updatesEnabled: true,
    });
  });

  it('keeps unpackaged prerelease versions stable unless explicitly overridden', () => {
    expect(resolveNeonPilotRuntimeChannel({}, { version: '0.8.0-rc.12', packaged: false })).toBe('stable');
  });

  it('normalizes explicit dev and test aliases with ephemeral ports', () => {
    expect(resolveNeonPilotRuntimeChannel({ NEON_PILOT_RUNTIME_CHANNEL: 'development' })).toBe('dev');
    expect(resolveNeonPilotRuntimeChannel({ NEON_PILOT_DESKTOP_VARIANT: 'testing' })).toBe('test');
    expect(resolveNeonPilotRuntimeChannelConfig({ NEON_PILOT_RUNTIME_CHANNEL: 'development' })).toMatchObject({
      channel: 'dev',
      companionPort: 0,
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
