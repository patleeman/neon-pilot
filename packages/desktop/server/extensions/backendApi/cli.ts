import { callServerModuleExport } from './serverModuleResolver.js';

export interface NeonPilotCliInstallStatus {
  target: string;
  binDir: string;
  linkPath: string;
  globallyInstalled: boolean;
  removed?: boolean;
}

type CliEnvironmentExport = 'readNeonPilotCliInstallStatus' | 'installNeonPilotUserCli' | 'uninstallNeonPilotUserCli';

function resolveCliRepoRoot(): string {
  return process.env.NEON_PILOT_REPO_ROOT || process.resourcesPath || process.cwd();
}

async function callCliEnvironment(name: CliEnvironmentExport): Promise<NeonPilotCliInstallStatus> {
  return callServerModuleExport<NeonPilotCliInstallStatus>('../../cliEnvironment.js', name, {
    repoRoot: resolveCliRepoRoot(),
  });
}

export async function readNeonPilotCliInstallStatus(): Promise<NeonPilotCliInstallStatus> {
  return callCliEnvironment('readNeonPilotCliInstallStatus');
}

export async function installNeonPilotUserCli(): Promise<NeonPilotCliInstallStatus> {
  return callCliEnvironment('installNeonPilotUserCli');
}

export async function uninstallNeonPilotUserCli(): Promise<NeonPilotCliInstallStatus> {
  return callCliEnvironment('uninstallNeonPilotUserCli');
}
