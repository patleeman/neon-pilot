export interface RuntimeExtensionCreateOptions {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  template?: unknown;
}

export interface RuntimeExtensionResult {
  [key: string]: unknown;
}

export interface ExtensionInstallSummary {
  [key: string]: unknown;
}

export interface ExtensionSearchPathWriteOptions {
  runtimeDir?: string;
  runtimeSettingsFilePath?: string;
  paths?: string[];
}

export interface ExtensionCatalogSourceWriteOptions {
  runtimeDir?: string;
  runtimeSettingsFilePath?: string;
  sources?: unknown[];
}

export type ExtensionDoctorSeverity = 'error' | 'warning' | 'info';

export interface ExtensionDoctorFinding {
  severity: ExtensionDoctorSeverity;
  code: string;
  message: string;
  path?: string;
  fix?: string;
}

export interface ExtensionDoctorReport {
  ok?: boolean;
  findings?: ExtensionDoctorFinding[];
  [key: string]: unknown;
}

export type MarketplacePackageInstallTarget = 'local';

export interface MarketplacePackageSourceInstallOptions {
  source?: unknown;
  target?: unknown;
  sourceBaseDir?: unknown;
}

export interface MarketplacePackageSourceInstallResult {
  installed: boolean;
  alreadyPresent: boolean;
  source: string;
  target: MarketplacePackageInstallTarget;
  settingsPath: string;
}

export interface ImportedMarketplacePackageExtensionResult extends MarketplacePackageSourceInstallResult {
  extension: {
    id: string;
    packageRoot: string;
    skillCount: number;
    copiedSource: boolean;
  };
}

export async function buildRuntimeExtension(_extensionId: string): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function createRuntimeExtension(_options: RuntimeExtensionCreateOptions): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function listExtensionInstallSummaries(): Promise<ExtensionInstallSummary[]> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function installMarketplacePackageSource(
  _options: MarketplacePackageSourceInstallOptions,
): Promise<MarketplacePackageSourceInstallResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function installMarketplacePackageAsExtension(_options: {
  ecosystem?: unknown;
  packageType?: unknown;
  source?: unknown;
  target?: unknown;
  sourceBaseDir?: unknown;
  runtimeDir?: unknown;
}): Promise<ImportedMarketplacePackageExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function reloadExtensionBackend(_extensionId: string): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function snapshotRuntimeExtension(_extensionId: string): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function validateExtensionPackage(_options: { extensionId?: string; packageRoot?: string }): Promise<ExtensionDoctorReport> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function writeAdditionalExtensionSearchPaths(_options: ExtensionSearchPathWriteOptions): Promise<{ ok: true }> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function readExtensionCatalogSources(): Promise<{ ok: true; sources: unknown[] }> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function writeExtensionCatalogSources(
  _options: ExtensionCatalogSourceWriteOptions,
): Promise<{ ok: true; sources: unknown[] }> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}
