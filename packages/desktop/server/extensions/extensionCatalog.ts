import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import { getStateRoot } from '@neon-pilot/core';

import { deleteRuntimeExtension, importRuntimeExtensionBundle } from './extensionLifecycle.js';
import { findExtensionEntry, listExtensionInstallSummaries, setExtensionEnabled } from './extensionRegistry.js';
import { INSTALLABLE_EXTENSION_CATALOG } from './installableExtensionCatalog.generated.js';

const EXTENSION_SOURCES_SETTING = 'extensions.sources';
const FIRST_PARTY_SOURCE_ID = 'neon-pilot';
const FIRST_PARTY_REPO = { owner: 'patleeman', repo: 'neon-pilot-extensions' };
const MAX_EXTENSION_BUNDLE_BYTES = 80 * 1024 * 1024;

export interface CatalogSeed {
  id: string;
  name: string;
  description: string;
  version?: string;
  tag?: string;
  artifact?: string;
  path?: string;
  packageType?: MarketplacePackageType;
  ecosystem?: MarketplaceEcosystem;
  marketplaceSourceId?: string;
  sourceRepo?: GithubExtensionSourceRepo;
}

export interface GithubExtensionSourceRepo {
  owner: string;
  repo: string;
}

export interface ExtensionCatalogSource {
  id: string;
  type: 'github';
  owner: string;
  repo: string;
  enabled: boolean;
  name?: string;
}

export type MarketplaceEcosystem = 'neon-pilot' | 'codex' | 'claude';
export type MarketplacePackageType = 'extension' | 'skill' | 'instruction-pack' | 'agent' | 'template';

export interface MarketplaceSource {
  id: string;
  name: string;
  ecosystem: MarketplaceEcosystem;
  description: string;
  supportedPackageTypes: MarketplacePackageType[];
  installStatus: 'supported' | 'planned';
  owner?: string;
  repo?: string;
}

const MARKETPLACE_SOURCES: MarketplaceSource[] = [
  {
    id: 'neon-pilot-release',
    name: 'Neon Pilot Extensions',
    ecosystem: 'neon-pilot',
    description: 'First-party Neon Pilot extension bundles published from patleeman/neon-pilot-extensions.',
    supportedPackageTypes: ['extension'],
    installStatus: 'supported',
    owner: FIRST_PARTY_REPO.owner,
    repo: FIRST_PARTY_REPO.repo,
  },
  {
    id: 'codex',
    name: 'Codex Marketplace',
    ecosystem: 'codex',
    description: 'Codex-style capability packages such as skills, AGENTS.md instruction packs, templates, and agents.',
    supportedPackageTypes: ['skill', 'instruction-pack', 'agent', 'template'],
    installStatus: 'planned',
  },
  {
    id: 'claude',
    name: 'Claude Marketplace',
    ecosystem: 'claude',
    description: 'Claude-style capability packages such as SKILL.md skill folders, instruction packs, templates, and agents.',
    supportedPackageTypes: ['skill', 'instruction-pack', 'agent', 'template'],
    installStatus: 'planned',
  },
];

export interface InstallableExtensionCatalogItem extends CatalogSeed {
  version: string;
  tag: string;
  packageType: MarketplacePackageType;
  ecosystem: MarketplaceEcosystem;
  marketplaceSourceId: string;
  bundleUrl?: string;
  packageSource?: string;
  defaultEnabled: boolean;
  source: 'github-release';
  sourceRepo: GithubExtensionSourceRepo;
  installed: boolean;
  installedVersion?: string;
  enabled?: boolean;
  availableVersion?: string;
  updateAvailable: boolean;
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function resolveInstalledAppVersion(): string {
  const candidates = [
    process.env.NEON_PILOT_REPO_ROOT ? resolve(process.env.NEON_PILOT_REPO_ROOT, 'package.json') : null,
    resolve(process.cwd(), 'package.json'),
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'app.asar', 'package.json') : null,
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'package.json') : null,
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const version = readJson(candidate)?.version;
    if (typeof version === 'string' && version.trim()) return version.trim();
  }
  return '0.0.0';
}

function bundleUrlForRepo(repo: GithubExtensionSourceRepo, id: string, tag: string, artifact?: string): string {
  const assetName = artifact && artifact.trim() ? artifact.trim() : `${id}.neon-extension.zip`;
  return `https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`;
}

function localBundlePathFor(id: string): string | null {
  const candidates = [
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'installable-extension-bundles') : null,
  ].filter((value): value is string => Boolean(value));
  for (const root of candidates) {
    const bundlePath = resolve(root, `${id}.neon-extension.zip`);
    if (existsSync(bundlePath)) return bundlePath;
  }
  return null;
}

export async function listInstallableExtensionCatalog(stateRoot: string = getStateRoot()): Promise<{
  ok: true;
  version: string;
  tag: string;
  marketplaceSources: MarketplaceSource[];
  extensions: InstallableExtensionCatalogItem[];
  packages: InstallableExtensionCatalogItem[];
  sourceErrors: Array<{ sourceId: string; message: string }>;
}> {
  const version = resolveInstalledAppVersion();
  const tag = `v${version}`;
  const summaries = listExtensionInstallSummaries(stateRoot);
  const installedById = new Map(summaries.map((summary) => [summary.id, summary]));
  const configured = readConfiguredExtensionCatalogSources(stateRoot);
  const enabledConfigured = configured.filter((source) => source.enabled);
  const sourceErrors: Array<{ sourceId: string; message: string }> = [];
  const firstPartySeeds = await fetchFirstPartyReleaseCatalog(tag).catch((error) => {
    sourceErrors.push({ sourceId: FIRST_PARTY_SOURCE_ID, message: error instanceof Error ? error.message : String(error) });
    return INSTALLABLE_EXTENSION_CATALOG;
  });
  const remoteSeeds = (
    await Promise.all(
      enabledConfigured
        .filter((source) => source.id !== FIRST_PARTY_SOURCE_ID)
        .map(async (source) => {
          try {
            return await fetchGithubSourceCatalog(source);
          } catch (error) {
            sourceErrors.push({ sourceId: source.id, message: error instanceof Error ? error.message : String(error) });
            return [];
          }
        }),
    )
  ).flat();
  const packages: InstallableExtensionCatalogItem[] = [...firstPartySeeds, ...remoteSeeds].map((item) => {
    const installed = installedById.get(item.id);
    const explicitVersion = item.version;
    const itemVersion = explicitVersion ?? installed?.version ?? version;
    const itemTag = item.tag ?? (explicitVersion ? `v${explicitVersion}` : tag);
    const sourceRepo = item.sourceRepo ?? FIRST_PARTY_REPO;
    const updateAvailable = Boolean(explicitVersion && installed?.version && installed.version !== explicitVersion);
    return {
      ...item,
      version: itemVersion,
      tag: itemTag,
      packageType: item.packageType ?? 'extension',
      ecosystem: item.ecosystem ?? 'neon-pilot',
      marketplaceSourceId: item.marketplaceSourceId ?? 'neon-pilot-release',
      bundleUrl: bundleUrlForRepo(sourceRepo, item.id, itemTag, item.artifact),
      defaultEnabled: false,
      source: 'github-release',
      sourceRepo,
      installed: Boolean(installed),
      ...(installed?.version ? { installedVersion: installed.version } : {}),
      ...(installed ? { enabled: installed.enabled } : {}),
      ...(explicitVersion ? { availableVersion: explicitVersion } : {}),
      updateAvailable,
    };
  });
  const marketplaceSources = [
    ...MARKETPLACE_SOURCES,
    ...enabledConfigured
      .filter((source) => source.id !== FIRST_PARTY_SOURCE_ID)
      .map((source): MarketplaceSource => ({
        id: source.id,
        name: source.name ?? `${source.owner}/${source.repo}`,
        ecosystem: 'neon-pilot',
        description: `Extensions from ${source.owner}/${source.repo}.`,
        supportedPackageTypes: ['extension'],
        installStatus: 'supported',
        owner: source.owner,
        repo: source.repo,
      })),
  ];
  return {
    ok: true,
    version,
    tag,
    marketplaceSources,
    extensions: packages,
    packages,
    sourceErrors,
  };
}

export function readConfiguredExtensionCatalogSources(stateRoot: string = getStateRoot()): ExtensionCatalogSource[] {
  const configured = normalizeExtensionCatalogSources(readJson(join(stateRoot, 'settings.json'))?.[EXTENSION_SOURCES_SETTING]).filter(
    (source) => !isFirstPartyRepo(source),
  );
  return mergeExtensionCatalogSources([defaultExtensionCatalogSource(), ...configured]);
}

function defaultExtensionCatalogSource(): ExtensionCatalogSource {
  return {
    id: FIRST_PARTY_SOURCE_ID,
    type: 'github',
    owner: FIRST_PARTY_REPO.owner,
    repo: FIRST_PARTY_REPO.repo,
    enabled: true,
    name: 'Neon Pilot Extensions',
  };
}

function normalizeExtensionCatalogSources(value: unknown): ExtensionCatalogSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const urlRepo = typeof record.url === 'string' ? parseGithubRepoUrl(record.url) : null;
    const owner = typeof record.owner === 'string' && record.owner.trim() ? record.owner.trim() : urlRepo?.owner;
    const repo = typeof record.repo === 'string' && record.repo.trim() ? record.repo.trim() : urlRepo?.repo;
    if (!owner || !repo) return [];
    const id =
      typeof record.id === 'string' && record.id.trim()
        ? record.id.trim()
        : `${owner.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${repo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return [
      {
        id,
        type: 'github' as const,
        owner,
        repo,
        enabled: record.enabled !== false,
        ...(typeof record.name === 'string' && record.name.trim() ? { name: record.name.trim() } : {}),
      },
    ];
  });
}

function mergeExtensionCatalogSources(sources: ExtensionCatalogSource[]): ExtensionCatalogSource[] {
  const byRepo = new Map<string, ExtensionCatalogSource>();
  for (const source of sources) {
    byRepo.set(`${source.owner.toLowerCase()}/${source.repo.toLowerCase()}`, source);
  }
  return [...byRepo.values()];
}

function isFirstPartyRepo(source: GithubExtensionSourceRepo): boolean {
  return source.owner.toLowerCase() === FIRST_PARTY_REPO.owner && source.repo.toLowerCase() === FIRST_PARTY_REPO.repo;
}

function parseGithubRepoUrl(value: string): GithubExtensionSourceRepo | null {
  const trimmed = value.trim();
  const shorthand = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2].replace(/\.git$/, '') };
  try {
    const url = new URL(trimmed);
    if (url.hostname !== 'github.com') return null;
    const [owner, repo] = url.pathname.replace(/^\/+/, '').split('/');
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

async function fetchGithubSourceCatalog(source: ExtensionCatalogSource): Promise<CatalogSeed[]> {
  const manifest = await fetchGithubSourceManifest(source);
  const packages = Array.isArray(manifest.packages) ? manifest.packages : [];
  return packages.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : '';
    if (!id) return [];
    return [
      {
        id,
        name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : id,
        description: typeof record.description === 'string' && record.description.trim() ? record.description.trim() : `Extension from ${source.owner}/${source.repo}.`,
        ...(typeof record.version === 'string' && record.version.trim() ? { version: record.version.trim() } : {}),
        ...(typeof record.tag === 'string' && record.tag.trim() ? { tag: record.tag.trim() } : {}),
        ...(typeof record.path === 'string' && record.path.trim() ? { path: record.path.trim() } : {}),
        packageType: 'extension',
        ecosystem: 'neon-pilot',
        marketplaceSourceId: source.id,
        sourceRepo: { owner: source.owner, repo: source.repo },
      },
    ];
  });
}

async function fetchGithubSourceManifest(source: ExtensionCatalogSource): Promise<Record<string, unknown>> {
  const branches = ['main', 'master'];
  for (const branch of branches) {
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/${encodeURIComponent(branch)}/neon.extensions.json`;
    const response = await fetch(url);
    if (response.ok) {
      const parsed = (await response.json()) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      throw new Error(`${source.owner}/${source.repo} neon.extensions.json is not an object.`);
    }
    if (response.status !== 404) throw new Error(`Failed to fetch ${source.owner}/${source.repo}: HTTP ${response.status}`);
  }
  throw new Error(`${source.owner}/${source.repo} does not contain neon.extensions.json on main or master.`);
}

async function fetchFirstPartyReleaseCatalog(tag: string): Promise<CatalogSeed[]> {
  const url = `https://github.com/${encodeURIComponent(FIRST_PARTY_REPO.owner)}/${encodeURIComponent(FIRST_PARTY_REPO.repo)}/releases/download/${encodeURIComponent(tag)}/neon-extension-catalog.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch first-party extension release catalog: HTTP ${response.status}`);
  const parsed = (await response.json()) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('First-party extension release catalog is not an object.');
  }
  const parsedRecord = parsed as Record<string, unknown>;
  const packages: unknown[] = Array.isArray(parsedRecord.packages) ? parsedRecord.packages : [];
  const bakedById = new Map(INSTALLABLE_EXTENSION_CATALOG.map((item) => [item.id, item]));
  return packages.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : '';
    if (!id) return [];
    const baked = bakedById.get(id);
    return [
      {
        id,
        name: baked?.name ?? titleFromExtensionId(id),
        description: baked?.description ?? `Install ${titleFromExtensionId(id)} from the Neon Pilot extension release catalog.`,
        ...(baked?.version ? { version: baked.version } : {}),
        ...(typeof record.tag === 'string' && record.tag.trim() ? { tag: record.tag.trim() } : { tag }),
        ...(typeof record.artifact === 'string' && record.artifact.trim() ? { artifact: record.artifact.trim() } : {}),
        ...(typeof record.path === 'string' && record.path.trim() ? { path: record.path.trim() } : baked?.path ? { path: baked.path } : {}),
        packageType: 'extension' as const,
        ecosystem: 'neon-pilot' as const,
        marketplaceSourceId: 'neon-pilot-release',
        sourceRepo: FIRST_PARTY_REPO,
      },
    ];
  });
}

function titleFromExtensionId(id: string): string {
  return id
    .replace(/^system-/, '')
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function assertSafeExtensionBundleUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Extension bundle URL must use https.');
  if (url.hostname !== 'github.com') throw new Error('Only github.com extension bundle URLs are supported.');
  if (!url.pathname.endsWith('.neon-extension.zip')) throw new Error('Extension bundle URL must end with .neon-extension.zip.');
  return url;
}

async function downloadBundle(url: URL, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download extension bundle: HTTP ${response.status}`);
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_EXTENSION_BUNDLE_BYTES) {
    throw new Error('Extension bundle is too large.');
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength > MAX_EXTENSION_BUNDLE_BYTES) throw new Error('Extension bundle is too large.');
  writeFileSync(destination, body);
}

export async function installExtensionBundleFromUrl(input: { url?: unknown; expectedId?: unknown }, stateRoot?: string) {
  const rawUrl = typeof input.url === 'string' ? input.url.trim() : '';
  if (!rawUrl) throw new Error('url is required.');
  const expectedId = typeof input.expectedId === 'string' && input.expectedId.trim() ? input.expectedId.trim() : undefined;
  const url = assertSafeExtensionBundleUrl(rawUrl);
  const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-extension-download-'));
  const zipPath = join(tempRoot, basename(url.pathname));
  try {
    await downloadBundle(url, zipPath);
    const result = importRuntimeExtensionBundle({ zipPath }, stateRoot);
    if (expectedId && result.extension?.id !== expectedId) {
      throw new Error(`Downloaded extension id ${result.extension?.id ?? 'unknown'} did not match expected id ${expectedId}.`);
    }
    if (result.extension?.id) {
      setExtensionEnabled(result.extension.id, false, stateRoot);
      const disabled = listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === result.extension?.id);
      return { ...result, extension: disabled ?? result.extension };
    }
    return result;
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function installExtensionBundleFromPath(input: { path?: unknown; expectedId?: unknown }, stateRoot?: string) {
  const rawPath = typeof input.path === 'string' ? input.path.trim() : '';
  if (!rawPath) throw new Error('path is required.');
  const expectedId = typeof input.expectedId === 'string' && input.expectedId.trim() ? input.expectedId.trim() : undefined;
  const zipPath = resolve(rawPath);
  if (!existsSync(zipPath)) throw new Error(`Extension bundle not found: ${zipPath}`);
  if (!zipPath.endsWith('.neon-extension.zip')) throw new Error('Extension bundle path must end with .neon-extension.zip.');
  const result = importRuntimeExtensionBundle({ zipPath }, stateRoot);
  if (expectedId && result.extension?.id !== expectedId) {
    throw new Error(`Extension id ${result.extension?.id ?? 'unknown'} did not match expected id ${expectedId}.`);
  }
  if (result.extension?.id) {
    setExtensionEnabled(result.extension.id, false, stateRoot);
    const disabled = listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === result.extension?.id);
    return { ...result, extension: disabled ?? result.extension };
  }
  return result;
}

export async function installCatalogExtension(input: { id?: unknown }, stateRoot?: string) {
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!id) throw new Error('id is required.');
  const item = (await listInstallableExtensionCatalog(stateRoot)).extensions.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown installable extension: ${id}`);
  if (item.packageType !== 'extension' || !item.bundleUrl) throw new Error(`Marketplace package ${id} is not an extension bundle.`);
  if (findExtensionEntry(id, stateRoot)) throw new Error(`Extension ${id} is already installed.`);
  const localBundlePath = localBundlePathFor(id);
  if (localBundlePath) return installExtensionBundleFromPath({ path: localBundlePath, expectedId: id }, stateRoot);
  return installExtensionBundleFromUrl({ url: item.bundleUrl, expectedId: id }, stateRoot);
}

export async function updateCatalogExtension(input: { id?: unknown }, stateRoot?: string) {
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!id) throw new Error('id is required.');
  const catalog = await listInstallableExtensionCatalog(stateRoot);
  const item = catalog.extensions.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown installable extension: ${id}`);
  if (item.packageType !== 'extension' || !item.bundleUrl) throw new Error(`Marketplace package ${id} is not an extension bundle.`);
  const installed = listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === id);
  if (!installed) throw new Error(`Extension ${id} is not installed.`);
  if (installed.packageType === 'system') throw new Error('Packaged system extensions cannot be updated from the catalog.');
  const wasEnabled = installed.enabled;

  await deleteRuntimeExtension(id, stateRoot);
  const localBundlePath = localBundlePathFor(id);
  const result = localBundlePath
    ? installExtensionBundleFromPath({ path: localBundlePath, expectedId: id }, stateRoot)
    : await installExtensionBundleFromUrl({ url: item.bundleUrl, expectedId: id }, stateRoot);
  if (result.extension?.id) {
    setExtensionEnabled(result.extension.id, wasEnabled, stateRoot);
    const updated = listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === result.extension?.id);
    return { ...result, updated: true as const, extension: updated ?? result.extension };
  }
  return { ...result, updated: true as const };
}
