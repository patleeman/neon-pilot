export interface NeonPilotCliInstallStatus {
  target: string;
  binDir: string;
  linkPath: string;
  globallyInstalled: boolean;
  removed?: boolean;
}

export async function readNeonPilotCliInstallStatus(): Promise<NeonPilotCliInstallStatus> {
  throw new Error('@neon-pilot/extensions/backend/cli must be resolved by the Neon Pilot host runtime.');
}

export async function installNeonPilotUserCli(): Promise<NeonPilotCliInstallStatus> {
  throw new Error('@neon-pilot/extensions/backend/cli must be resolved by the Neon Pilot host runtime.');
}

export async function uninstallNeonPilotUserCli(): Promise<NeonPilotCliInstallStatus> {
  throw new Error('@neon-pilot/extensions/backend/cli must be resolved by the Neon Pilot host runtime.');
}
