import { importServerExtensionModule } from './serverModuleResolver.js';
import { importServerModule } from './serverModuleResolver.js';

type ExtensionLifecycleModule = typeof import('../extensionLifecycle.js');
type ExtensionBackendModule = typeof import('../extensionBackend.js');
type ExtensionDoctorModule = typeof import('../extensionDoctor.js');
type ExtensionRegistryModule = typeof import('../extensionRegistry.js');
type ExtensionCatalogModule = typeof import('../extensionCatalog.js');
type CoreModule = typeof import('@neon-pilot/core');

type RuntimeExtensionCreateOptions = Parameters<ExtensionLifecycleModule['createRuntimeExtension']>[0];
type ValidateExtensionPackageOptions = Parameters<ExtensionDoctorModule['validateExtensionPackage']>[0];

async function importExtensionLifecycle(): Promise<ExtensionLifecycleModule> {
  return importServerExtensionModule<ExtensionLifecycleModule>('../extensionLifecycle.js');
}

async function importExtensionBackend(): Promise<ExtensionBackendModule> {
  return importServerExtensionModule<ExtensionBackendModule>('../extensionBackend.js');
}

async function importExtensionDoctor(): Promise<ExtensionDoctorModule> {
  return importServerExtensionModule<ExtensionDoctorModule>('../extensionDoctor.js');
}

async function importExtensionRegistry(): Promise<ExtensionRegistryModule> {
  return importServerExtensionModule<ExtensionRegistryModule>('../extensionRegistry.js');
}

async function importExtensionCatalog(): Promise<ExtensionCatalogModule> {
  return importServerExtensionModule<ExtensionCatalogModule>('../extensionCatalog.js');
}

async function importCore(): Promise<CoreModule> {
  return importServerModule<CoreModule>('@neon-pilot/core');
}

export async function buildRuntimeExtension(extensionId: string) {
  const module = await importExtensionLifecycle();
  return module.buildRuntimeExtension(extensionId);
}

export async function createRuntimeExtension(options: RuntimeExtensionCreateOptions) {
  const module = await importExtensionLifecycle();
  return module.createRuntimeExtension(options);
}

export async function snapshotRuntimeExtension(extensionId: string) {
  const module = await importExtensionLifecycle();
  return module.snapshotRuntimeExtension(extensionId);
}

export async function reloadExtensionBackend(extensionId: string) {
  const module = await importExtensionBackend();
  return module.reloadExtensionBackend(extensionId);
}

export async function validateExtensionPackage(options: ValidateExtensionPackageOptions) {
  const module = await importExtensionDoctor();
  return module.validateExtensionPackage(options);
}

export async function listExtensionInstallSummaries() {
  const module = await importExtensionRegistry();
  return module.listExtensionInstallSummaries();
}

export async function installMarketplacePackageSource(input: { source?: unknown; target?: unknown; sourceBaseDir?: unknown }) {
  const source = typeof input.source === 'string' ? input.source.trim() : '';
  if (!source) throw new Error('marketplace package source is required.');
  const target = input.target === 'local' || input.target === undefined ? 'local' : undefined;
  if (!target) throw new Error('marketplace package target must be local.');
  const sourceBaseDir = typeof input.sourceBaseDir === 'string' && input.sourceBaseDir.trim() ? input.sourceBaseDir : undefined;
  const module = await importCore();
  return module.installPackageSource({ source, target, sourceBaseDir });
}

export async function listInstallableExtensionCatalog() {
  const module = await importExtensionCatalog();
  return module.listInstallableExtensionCatalog();
}

export async function installCatalogExtension(input: { id?: unknown }) {
  const module = await importExtensionCatalog();
  return module.installCatalogExtension(input);
}

export async function installExtensionBundleFromUrl(input: { url?: unknown; expectedId?: unknown }) {
  const module = await importExtensionCatalog();
  return module.installExtensionBundleFromUrl(input);
}

export type { ExtensionDoctorFinding, ExtensionDoctorReport, ExtensionDoctorSeverity } from '../extensionDoctor.js';
