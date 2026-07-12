export interface RuntimeExtensionCreateOptions {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  template?: unknown;
  appearance?: unknown;
}

export interface RuntimeExtensionUpdateOptions {
  name?: unknown;
  description?: unknown;
  appearance?: unknown;
  source?: {
    frontend?: unknown;
    backend?: unknown;
  };
  autoBuild?: boolean;
}

export interface RuntimeExtensionResult {
  [key: string]: unknown;
}

/** Host-owned layout context for runtime extension lifecycle operations. */
export interface RuntimeExtensionOperationContext {
  desktopRootLayout?: unknown;
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

export async function buildRuntimeExtension(
  _extensionId: string,
  _context?: RuntimeExtensionOperationContext,
): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function createRuntimeExtension(
  _options: RuntimeExtensionCreateOptions,
  _context?: RuntimeExtensionOperationContext,
): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function listExtensionInstallSummaries(_context?: RuntimeExtensionOperationContext): Promise<ExtensionInstallSummary[]> {
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

export async function reloadExtensionBackend(
  _extensionId: string,
  _context?: RuntimeExtensionOperationContext,
): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function runExtensionSelfTest(
  _extensionId: string,
  _context?: RuntimeExtensionOperationContext,
): Promise<{ ok: boolean; extensionId: string; checks: Array<{ name: string; ok: boolean; error?: string }> }> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function invalidateExtensionRegistryReadCaches(_context?: RuntimeExtensionOperationContext): Promise<{ ok: true }> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function readRuntimeExtensionSource(
  _extensionId: string,
  _context?: RuntimeExtensionOperationContext,
): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function updateRuntimeExtension(
  _extensionId: string,
  _input: RuntimeExtensionUpdateOptions,
  _context?: RuntimeExtensionOperationContext,
): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function snapshotRuntimeExtension(
  _extensionId: string,
  _context?: RuntimeExtensionOperationContext,
): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function deleteRuntimeExtension(
  _extensionId: string,
  _context?: RuntimeExtensionOperationContext,
): Promise<RuntimeExtensionResult> {
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

export async function listInstallableExtensionCatalog(): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function installCatalogExtension(_input: { id?: unknown }): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function updateCatalogExtension(_input: { id?: unknown }): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}

export async function installExtensionBundleFromUrl(_input: { url?: unknown; expectedId?: unknown }): Promise<RuntimeExtensionResult> {
  throw new Error('@neon-pilot/extensions/backend/extensions must be resolved by the Neon Pilot host runtime.');
}
