export type NeonPilotRuntimeChannel = 'stable' | 'rc' | 'dev' | 'test';

export interface NeonPilotRuntimeChannelConfig {
  channel: NeonPilotRuntimeChannel;
  stateRootSuffix: '' | '-rc' | '-dev' | '-testing';
  companionPort: number;
  codexPort: number;
  updatesEnabled: boolean;
}

const CHANNEL_CONFIGS: Record<NeonPilotRuntimeChannel, NeonPilotRuntimeChannelConfig> = {
  stable: { channel: 'stable', stateRootSuffix: '', companionPort: 3842, codexPort: 3846, updatesEnabled: true },
  rc: { channel: 'rc', stateRootSuffix: '-rc', companionPort: 3843, codexPort: 3847, updatesEnabled: false },
  dev: { channel: 'dev', stateRootSuffix: '-dev', companionPort: 0, codexPort: 0, updatesEnabled: false },
  test: { channel: 'test', stateRootSuffix: '-testing', companionPort: 0, codexPort: 0, updatesEnabled: false },
};

function isRcVersion(version?: string): boolean {
  return typeof version === 'string' && /-rc(?:\.|$)/iu.test(version);
}

function normalizeRuntimeChannel(value: string | undefined): NeonPilotRuntimeChannel | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'stable' || normalized === 'prod' || normalized === 'production') return 'stable';
  if (normalized === 'rc') return 'rc';
  if (normalized === 'dev' || normalized === 'development') return 'dev';
  if (normalized === 'test' || normalized === 'testing') return 'test';
  return null;
}

export function resolveNeonPilotRuntimeChannel(
  env: NodeJS.ProcessEnv = process.env,
  options: { version?: string; packaged?: boolean } = {},
): NeonPilotRuntimeChannel {
  const explicit = normalizeRuntimeChannel(env.NEON_PILOT_RUNTIME_CHANNEL ?? env.NEON_PILOT_DESKTOP_VARIANT);
  if (explicit) return explicit;
  if (env.NEON_PILOT_DESKTOP_DEV_BUNDLE === '1') return 'test';
  if (options.packaged && isRcVersion(options.version)) return 'rc';
  return 'stable';
}

export function getNeonPilotRuntimeChannelConfig(channel: NeonPilotRuntimeChannel): NeonPilotRuntimeChannelConfig {
  return CHANNEL_CONFIGS[channel];
}

export function resolveNeonPilotRuntimeChannelConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { version?: string; packaged?: boolean } = {},
): NeonPilotRuntimeChannelConfig {
  return getNeonPilotRuntimeChannelConfig(resolveNeonPilotRuntimeChannel(env, options));
}

export function readPortOverride(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const port = Number(value);
  return Number.isSafeInteger(port) && port >= 0 && port <= 65535 ? port : undefined;
}
