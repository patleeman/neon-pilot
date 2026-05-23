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
}

const INSTALLABLE_EXTENSION_CATALOG: CatalogSeed[] = [
  {
    id: 'system-acp',
    name: 'ACP Protocol',
    description: 'Agent Client Protocol experiments.',
  },
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
    id: 'system-clean-room-spec',
    name: 'Clean-room Spec Generator',
    description: 'Generate sanitized specs from untrusted extension source.',
  },
  {
    id: 'system-exa-search',
    name: 'Exa Search',
    description: 'Agent tool for Exa web search.',
  },
  {
    id: 'system-gateways',
    name: 'Telegram Gateway',
    description: 'Telegram gateway UI/runtime while gateway routing is still experimental.',
  },
  {
    id: 'system-images',
    name: 'Images',
    description: 'Image generation tooling while provider behavior and UX are still experimental.',
  },
  {
    id: 'system-local-models',
    name: 'Local Models',
    description: 'Local MLX and GGUF model management UI.',
  },
  {
    id: 'system-loose-ends',
    name: 'Loose Ends',
    description: 'Conversation-scoped notes for assumptions, risks, and follow-ups.',
  },
  {
    id: 'system-self-preservation',
    name: 'Self Preservation',
    description: 'Agent self-preservation instruction and context hooks.',
  },
  {
    id: 'system-session-exchange',
    name: 'Session Exchange',
    description: 'Import/export flow for conversation session handoff experiments.',
  },
  {
    id: 'system-speechmike',
    name: 'SpeechMike',
    description: 'SpeechMike hardware integration.',
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
  bundleUrl: string;
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
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'app.asar', 'package.json') : null,
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'package.json') : null,
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
  extensions: InstallableExtensionCatalogItem[];
} {
  const version = resolveInstalledAppVersion();
  const tag = `v${version}`;
  const summaries = listExtensionInstallSummaries();
  const installedById = new Map(summaries.map((summary) => [summary.id, summary]));
  return {
    ok: true,
    version,
    tag,
    extensions: INSTALLABLE_EXTENSION_CATALOG.map((item) => {
      const installed = installedById.get(item.id);
      return {
        ...item,
        version,
        tag,
        bundleUrl: bundleUrlFor(item.id, version),
        defaultEnabled: false,
        source: 'github-release' as const,
        installed: Boolean(installed),
        ...(installed?.version ? { installedVersion: installed.version } : {}),
        ...(installed ? { enabled: installed.enabled } : {}),
      };
    }),
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
  if (findExtensionEntry(id)) throw new Error(`Extension ${id} is already installed.`);
  return installExtensionBundleFromUrl({ url: item.bundleUrl, expectedId: id }, stateRoot);
}
