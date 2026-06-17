import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ resolveNeonPilotRuntimeChannelConfig: vi.fn(() => ({ companionPort: 3838 })) }));
const tailscale = vi.hoisted(() => ({ resolveCompanionTailscaleUrl: vi.fn(() => undefined as string | undefined) }));

vi.mock('@neon-pilot/core', () => core);
vi.mock('../tailscale-serve.js', () => tailscale);

import { buildCompanionSetupState } from './setup-links.js';

describe('companion setup links', () => {
  const pairing = { id: 'pair-1', code: 'ABCD-EFGH-JKLM', createdAt: 'now', expiresAt: 'later' };
  const baseInput = { pairing, hostLabel: 'Host Label', hostInstanceId: 'host-1' };

  beforeEach(() => {
    vi.clearAllMocks();
    tailscale.resolveCompanionTailscaleUrl.mockReturnValue(undefined);
  });

  it('warns for loopback-only access when no tailnet URL is available', () => {
    expect(buildCompanionSetupState({ ...baseInput, config: { companion: { host: 'localhost' } } as never })).toEqual({
      pairing,
      links: [],
      warnings: ['Companion access is still bound to loopback only. Enable local-network phone access before pairing from your phone.'],
    });
  });

  it('defaults omitted companion hosts to loopback-only access', () => {
    expect(buildCompanionSetupState({ ...baseInput, config: { companion: {} } as never })).toMatchObject({
      links: [],
      warnings: ['Companion access is still bound to loopback only. Enable local-network phone access before pairing from your phone.'],
    });
  });

  it('prefers tailnet URLs and encodes setup parameters', () => {
    tailscale.resolveCompanionTailscaleUrl.mockReturnValueOnce('https://machine.tailnet.ts.net');
    const state = buildCompanionSetupState({ ...baseInput, config: { companion: { host: '127.0.0.1', port: 4444 } } as never });

    expect(tailscale.resolveCompanionTailscaleUrl).toHaveBeenCalledWith(4444);
    expect(state.warnings).toEqual([]);
    expect(state.links).toEqual([
      {
        id: '1',
        label: 'Tailnet · machine.tailnet.ts.net',
        baseUrl: 'https://machine.tailnet.ts.net',
        setupUrl:
          'pa-companion://pair?base=https%3A%2F%2Fmachine.tailnet.ts.net&code=ABCD-EFGH-JKLM&label=Host+Label&hostInstanceId=host-1',
      },
    ]);
  });

  it('builds wildcard host links from prioritized non-loopback IPv4 interfaces and de-dupes tailnet URLs', () => {
    const state = buildCompanionSetupState({
      ...baseInput,
      config: { companion: { host: '0.0.0.0', port: 3838 } } as never,
      resolveTailnetUrl: () => 'http://192.168.1.2:3838',
      readNetworkInterfaces: () => ({
        utun3: [{ address: '100.64.0.2', family: 'IPv4', internal: false }],
        en0: [
          { address: '127.0.0.1', family: 'IPv4', internal: false },
          { address: '192.168.1.2', family: 'IPv4', internal: false },
          { address: '169.254.1.1', family: 'IPv4', internal: false },
        ],
        Ethernet: [{ address: '10.0.0.5', family: 4, internal: false }],
      }),
    });

    expect(state.warnings).toEqual([]);
    expect(state.links.map((link) => [link.label, link.baseUrl])).toEqual([
      ['Tailnet · 192.168.1.2:3838', 'http://192.168.1.2:3838'],
      ['Ethernet · 10.0.0.5', 'http://10.0.0.5:3838'],
      ['utun3 · 100.64.0.2', 'http://100.64.0.2:3838'],
    ]);
  });

  it('warns when wildcard binding has no usable network addresses', () => {
    const state = buildCompanionSetupState({
      ...baseInput,
      config: { companion: { host: '::' } } as never,
      readNetworkInterfaces: () => ({ lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }] }),
    });
    expect(state.links).toEqual([]);
    expect(state.warnings).toEqual([
      'No non-loopback IPv4 network address is available for QR pairing. Connect the host machine to Wi-Fi or Ethernet, or bind the companion host to a specific reachable address.',
    ]);
  });

  it('builds configured host links and formats IPv6 hosts', () => {
    expect(buildCompanionSetupState({ ...baseInput, config: { companion: { host: '192.168.1.10' } } as never }).links[0]).toMatchObject({
      label: 'Configured host',
      baseUrl: 'http://192.168.1.10:3838',
    });
    expect(
      buildCompanionSetupState({ ...baseInput, config: { companion: { host: 'fd00::1', port: 9999 } } as never }).links[0],
    ).toMatchObject({
      label: 'Configured host',
      baseUrl: 'http://[fd00::1]:9999',
    });
  });
});
