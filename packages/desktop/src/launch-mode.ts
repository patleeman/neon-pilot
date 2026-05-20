import { resolveNeonPilotRuntimeChannel } from '@neon-pilot/core';

type DesktopLaunchMode = 'stable' | 'rc' | 'dev' | 'testing';

export interface DesktopLaunchPresentation {
  mode: DesktopLaunchMode;
  appName: string;
  launchLabel?: string;
}

const DEFAULT_APP_NAME = 'Neon Pilot';
const RC_APP_NAME = 'Neon Pilot RC';
const DEV_APP_NAME = 'Neon Pilot Dev';
const TESTING_APP_NAME = 'Neon Pilot Testing';

export function resolveDesktopLaunchPresentation(
  env: NodeJS.ProcessEnv = process.env,
  options: { version?: string; packaged?: boolean } = {},
): DesktopLaunchPresentation {
  const channel = resolveNeonPilotRuntimeChannel(env, options);

  if (channel === 'test') {
    return {
      mode: 'testing',
      appName: TESTING_APP_NAME,
      launchLabel: 'Testing',
    };
  }

  if (channel === 'dev') {
    return {
      mode: 'dev',
      appName: DEV_APP_NAME,
      launchLabel: 'Dev',
    };
  }

  if (channel === 'rc') {
    return {
      mode: 'rc',
      appName: RC_APP_NAME,
      launchLabel: 'RC',
    };
  }

  return {
    mode: 'stable',
    appName: DEFAULT_APP_NAME,
  };
}
