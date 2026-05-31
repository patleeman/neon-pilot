import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import { importRuntimeExtensionBundle } from './extensionLifecycle.js';
import { findExtensionEntry, listExtensionInstallSummaries, setExtensionEnabled } from './extensionRegistry.js';

const GITHUB_RELEASE_BASE_URL = 'https://github.com/patleeman/neon-pilot/releases/download';
const MAX_EXTENSION_BUNDLE_BYTES = 80 * 1024 * 1024;

interface CatalogSeed {
  id: string;
  name: string;
  description: string;
  packageType?: MarketplacePackageType;
  ecosystem?: MarketplaceEcosystem;
  marketplaceSourceId?: string;
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
}

const MARKETPLACE_SOURCES: MarketplaceSource[] = [
  {
    id: 'neon-pilot-release',
    name: 'Neon Pilot Extensions',
    ecosystem: 'neon-pilot',
    description: 'First-party Neon Pilot extension bundles published with the current app release.',
    supportedPackageTypes: ['extension'],
    installStatus: 'supported',
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

const INSTALLABLE_EXTENSION_CATALOG: CatalogSeed[] = [
  {
    id: 'system-alleycat',
    name: 'Kitty Litter Mobile Pairing',
    description: 'Mobile pairing bridge for Kitty Litter clients.',
  },
  {
    id: 'system-browser',
    name: 'Browser',
    description: 'Browser automation tool and Workbench browser views.',
  },
  {
    id: 'system-duckduckgo-search',
    name: 'DuckDuckGo Search',
    description: 'Agent web search tool backed by DuckDuckGo HTML results.',
  },
  {
    id: 'system-exa-search',
    name: 'Exa Search',
    description: 'Agent tool for Exa web search.',
  },
  {
    id: 'system-local-models',
    name: 'Local Models',
    description: 'Local MLX and GGUF model management UI.',
  },
  {
    id: 'system-self-preservation',
    name: 'Self Preservation',
    description: 'Agent self-preservation instruction and context hooks.',
  },
  {
    id: 'system-suggested-context',
    name: 'Suggested Context',
    description: 'Suggests related conversations as pointer context for new prompts.',
  },
  {
    id: 'system-video-probe',
    name: 'Video Probe',
    description: 'Analyze UI recordings and videos with a video-capable model.',
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
  installed: boolean;
  installedVersion?: string;
  enabled?: boolean;
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
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const version = readJson(candidate)?.version;
    if (typeof version === 'string' && version.trim()) return version.trim();
  }
  return '0.0.0';
}

function bundleUrlFor(id: string, version: string): string {
  const tag = `v${version}`;
  return `${GITHUB_RELEASE_BASE_URL}/${encodeURIComponent(tag)}/${encodeURIComponent(id)}.neon-extension.zip`;
}

export function listInstallableExtensionCatalog(): {
  ok: true;
  version: string;
  tag: string;
  marketplaceSources: MarketplaceSource[];
  extensions: InstallableExtensionCatalogItem[];
  packages: InstallableExtensionCatalogItem[];
} {
  const version = resolveInstalledAppVersion();
  const tag = `v${version}`;
  const summaries = listExtensionInstallSummaries();
  const installedById = new Map(summaries.map((summary) => [summary.id, summary]));
  const packages: InstallableExtensionCatalogItem[] = INSTALLABLE_EXTENSION_CATALOG.map((item) => {
    const installed = installedById.get(item.id);
    return {
      ...item,
      version,
      tag,
      packageType: item.packageType ?? 'extension',
      ecosystem: item.ecosystem ?? 'neon-pilot',
      marketplaceSourceId: item.marketplaceSourceId ?? 'neon-pilot-release',
      bundleUrl: bundleUrlFor(item.id, version),
      defaultEnabled: false,
      source: 'github-release',
      installed: Boolean(installed),
      ...(installed?.version ? { installedVersion: installed.version } : {}),
      ...(installed ? { enabled: installed.enabled } : {}),
    };
  });
  return {
    ok: true,
    version,
    tag,
    marketplaceSources: MARKETPLACE_SOURCES,
    extensions: packages,
    packages,
  };
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

export async function installCatalogExtension(input: { id?: unknown }, stateRoot?: string) {
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!id) throw new Error('id is required.');
  const item = listInstallableExtensionCatalog().extensions.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown installable extension: ${id}`);
  if (item.packageType !== 'extension' || !item.bundleUrl) throw new Error(`Marketplace package ${id} is not an extension bundle.`);
  if (findExtensionEntry(id)) throw new Error(`Extension ${id} is already installed.`);
  return installExtensionBundleFromUrl({ url: item.bundleUrl, expectedId: id }, stateRoot);
}
