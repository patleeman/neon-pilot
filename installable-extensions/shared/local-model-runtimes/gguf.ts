import { createWriteStream, existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { access, chmod, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { get } from 'node:https';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

type DownloadModelInput = { repo?: string; filename?: string };
type DownloadJob = {
  id: string;
  repo: string;
  filename: string;
  destination: string;
  partial: string;
  downloadedBytes: number;
  totalBytes: number | null;
  status: 'running' | 'succeeded' | 'failed' | 'cancelled';
  message: string;
  error: string | null;
  startedAt: number;
  updatedAt: number;
  abort: AbortController;
};
type RunPromptInput = {
  modelPath?: string;
  prompt?: string;
  contextSize?: number;
  gpuLayers?: number;
  maxTokens?: number;
  specType?: 'none' | 'draft-mtp';
  specDraftNMax?: number;
};
type ServerInput = {
  modelPath?: string;
  contextSize?: number;
  gpuLayers?: number;
  threads?: number;
  batchSize?: number;
  ubatchSize?: number;
  topK?: number;
  topP?: number;
  minP?: number;
  temperature?: number;
  repeatPenalty?: number;
  seed?: number;
  parallel?: number;
  flashAttention?: boolean;
  extraArgs?: string;
  specType?: 'none' | 'draft-mtp';
  specDraftNMax?: number;
};
type RevealInput = { modelPath?: string };

const here = dirname(fileURLToPath(import.meta.url));
const runtimeRoot = join(here, '..');
const repoRoot = process.env.NEON_PILOT_REPO_ROOT?.trim();
const sourceRuntimeRoot = repoRoot ? join(repoRoot, 'installable-extensions', 'shared', 'local-model-runtimes') : runtimeRoot;
const runtimeCacheRoot = join(homedir(), '.cache', 'neon-pilot', 'llama-cpp');
const runtimeBinDir = join(runtimeCacheRoot, 'bin', 'darwin-arm64');
function bundledRuntimePath(name: string) {
  const installedPath = join(runtimeBinDir, name);
  if (existsSync(installedPath)) return installedPath;
  const localPath = join(runtimeRoot, 'bin', 'darwin-arm64', name);
  if (existsSync(localPath)) return localPath;
  return join(sourceRuntimeRoot, 'bin', 'darwin-arm64', name);
}
// Computed lazily on each call so that binaries installed at runtime (into runtimeBinDir)
// are picked up without requiring a module reload.
function bundledCli() {
  return bundledRuntimePath('llama-cli');
}
function bundledServer() {
  return bundledRuntimePath('llama-server');
}
const modelCacheRoot = join(runtimeCacheRoot, 'models');
const LOG_FILE = join(modelCacheRoot, '..', 'latest.log');
const SERVER_PID_KEY = 'gguf/process/serverPid';
const MODEL_PATH_KEY = 'gguf/settings/modelPath';
const SERVING_SETTINGS_KEY = 'gguf/settings/serving';
const SERVER_ENABLED_KEY = 'gguf/settings/serverEnabled';

type ServingSettings = {
  contextSize?: number;
  gpuLayers?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  repeatPenalty?: number;
  seed?: number;
  threads?: number;
  batchSize?: number;
  ubatchSize?: number;
  parallel?: number;
  flashAttention?: boolean;
  extraArgs?: string;
  specType?: 'none' | 'draft-mtp';
  specDraftNMax?: number;
  maxTokens?: number;
};
const MODEL_PORT = 8012;
const BASE_URL = `http://127.0.0.1:${MODEL_PORT}/v1`;
const downloadJobs = new Map<string, DownloadJob>();
const metadataCache = new Map<string, { detectedContextLength: number | null; recommendedContextSize: number }>();
const runtimeUpdateCache: { checkedAt: number; latestTag: string | null; error: string | null } = {
  checkedAt: 0,
  latestTag: null,
  error: null,
};
const MAX_RECOMMENDED_CONTEXT = 131072;
const FALLBACK_CONTEXT = 32768;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function finitePositiveInt(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function appendOptionalArg(args: string[], flag: string, value: unknown) {
  const number = finiteNumber(value);
  if (number === null) return;
  args.push(flag, String(number));
}

function appendOptionalPositiveIntArg(args: string[], flag: string, value: unknown) {
  const number = finitePositiveInt(value);
  if (number === null) return;
  args.push(flag, String(number));
}

async function runProcess(
  ctx: ExtensionBackendContext,
  command: string,
  args: string[],
  options?: { timeoutMs?: number; maxBuffer?: number },
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const result = await ctx.shell.exec({ command, args, timeoutMs: options?.timeoutMs, maxBuffer: options?.maxBuffer });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { exitCode: 1, stdout: '', stderr: error instanceof Error ? error.message : String(error) };
  }
}

function download(url: string, destination: string, job: DownloadJob, redirects = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = get(url, { signal: job.abort.signal }, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        if (redirects > 5) {
          reject(new Error('Too many redirects while downloading model.'));
          return;
        }
        download(new URL(location, url).toString(), destination, job, redirects + 1).then(resolve, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Model download failed with HTTP ${statusCode}.`));
        return;
      }

      const contentLength = Number(response.headers['content-length']);
      if (Number.isFinite(contentLength) && contentLength > 0) job.totalBytes = contentLength;
      const file = createWriteStream(destination);
      response.on('data', (chunk: Buffer) => {
        job.downloadedBytes += chunk.length;
        job.updatedAt = Date.now();
        job.message = `Downloading ${job.filename}`;
      });
      response.pipe(file);
      file.on('finish', () => file.close((error) => (error ? reject(error) : resolve())));
      file.on('error', reject);
    });

    request.on('error', reject);
  });
}

async function readPid(ctx: ExtensionBackendContext) {
  const stored = await ctx.storage.get(SERVER_PID_KEY).catch(() => null);
  const pid = typeof stored === 'number' ? stored : Number(stored);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

async function isPidRunning(ctx: ExtensionBackendContext, pid: number | null) {
  if (!pid) return false;
  const result = await ctx.shell.exec({ command: 'sh', args: ['-c', `kill -0 ${pid} >/dev/null 2>&1 && echo yes || true`] });
  return result.stdout.trim() === 'yes';
}

async function selectedModelPath(ctx: ExtensionBackendContext) {
  const stored = await ctx.storage.get(MODEL_PATH_KEY).catch(() => null);
  return typeof stored === 'string' && stored.trim() ? stored.trim() : '';
}

async function loadServingSettings(ctx: ExtensionBackendContext): Promise<ServingSettings> {
  const stored = await ctx.storage.get(SERVING_SETTINGS_KEY).catch(() => null);
  if (stored && typeof stored === 'object') return stored as ServingSettings;
  return {};
}

async function saveServingSettings(ctx: ExtensionBackendContext, settings: ServingSettings) {
  await ctx.storage.put(SERVING_SETTINGS_KEY, settings);
}

async function setSelectedModelPath(ctx: ExtensionBackendContext, modelPath: string) {
  const normalized = modelPath.trim();
  if (!normalized) throw new Error('modelPath is required. Select or download a GGUF model first.');
  if (!(await exists(normalized))) throw new Error(`Model file does not exist: ${normalized}`);
  await ctx.storage.put(MODEL_PATH_KEY, normalized);
  return normalized;
}

function readLog() {
  if (!existsSync(LOG_FILE)) return '';
  return readFileSync(LOG_FILE, 'utf8').slice(-30000);
}

function serializeDownloadJob(job: DownloadJob) {
  return {
    id: job.id,
    repo: job.repo,
    filename: job.filename,
    downloadedBytes: job.downloadedBytes,
    totalBytes: job.totalBytes,
    progress: job.totalBytes ? Math.min(99, Math.round((job.downloadedBytes / job.totalBytes) * 100)) : null,
    status: job.status,
    message: job.message,
    error: job.error,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
  };
}

function recommendedContextSize(detected: number | null) {
  if (!detected || detected <= 0) return FALLBACK_CONTEXT;
  return Math.min(detected, MAX_RECOMMENDED_CONTEXT);
}

function appendSpeculativeDecodingArgs(args: string[], input: Pick<ServerInput, 'specType' | 'specDraftNMax'>) {
  if (input.specType !== 'draft-mtp') return;
  const draftTokens =
    Number.isFinite(input.specDraftNMax) && input.specDraftNMax && input.specDraftNMax > 0
      ? Math.min(16, Math.floor(input.specDraftNMax))
      : 6;
  args.push('--spec-type', 'draft-mtp', '--spec-draft-n-max', String(draftTokens));
}

async function readModelMetadata(ctx: ExtensionBackendContext, modelPath: string) {
  const cached = metadataCache.get(modelPath);
  if (cached) return cached;
  const fallback = { detectedContextLength: null, recommendedContextSize: FALLBACK_CONTEXT };
  if (!modelPath || !(await exists(modelPath)) || !(await exists(bundledCli()))) return fallback;

  await chmod(bundledCli(), 0o755).catch(() => undefined);
  const result = await runProcess(ctx, bundledCli(), ['-m', modelPath, '-p', 'metadata', '-n', '1', '-c', '128', '--verbose'], {
    timeoutMs: 10_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const output = `${result.stdout}\n${result.stderr}`;
  const match = output.match(/\b[\w.-]+\.context_length\s+\w+\s+=\s+(\d+)/);
  const detectedContextLength = match ? Number(match[1]) : null;
  const metadata = { detectedContextLength, recommendedContextSize: recommendedContextSize(detectedContextLength) };
  metadataCache.set(modelPath, metadata);
  return metadata;
}

function currentDownloadJob() {
  return (
    [...downloadJobs.values()].find((job) => job.status === 'running') ??
    [...downloadJobs.values()].sort((a, b) => b.updatedAt - a.updatedAt)[0] ??
    null
  );
}

function listGgufFiles(root: string): Array<{ path: string; name: string; bytes: number; updatedAt: number }> {
  if (!existsSync(root)) return [];
  const out: Array<{ path: string; name: string; bytes: number; updatedAt: number }> = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const current = statSync(path);
    if (current.isDirectory()) out.push(...listGgufFiles(path));
    else if (entry.toLowerCase().endsWith('.gguf')) out.push({ path, name: entry, bytes: current.size, updatedAt: current.mtimeMs });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
}

async function readLlamaLatestRelease() {
  if (Date.now() - runtimeUpdateCache.checkedAt < 6 * 60 * 60 * 1000) return runtimeUpdateCache;
  runtimeUpdateCache.checkedAt = Date.now();
  try {
    const response = await fetch('https://api.github.com/repos/ggml-org/llama.cpp/releases/latest', {
      headers: { 'user-agent': 'neon-pilot-local-models' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const release = (await response.json()) as { tag_name?: string };
    runtimeUpdateCache.latestTag = release.tag_name ?? null;
    runtimeUpdateCache.error = null;
  } catch (error) {
    runtimeUpdateCache.error = error instanceof Error ? error.message : String(error);
  }
  return runtimeUpdateCache;
}

function parseLlamaBuild(version: string | undefined) {
  const match = version?.match(/(?:version:\s*)?(\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseLlamaReleaseBuild(tag: string | null | undefined) {
  const match = tag?.match(/b?(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function readServerHealth() {
  try {
    const response = await fetch(`${BASE_URL}/models`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return { reachable: false, status: response.status, models: [] as string[] };
    const body = (await response.json()) as { data?: Array<{ id?: string }> };
    return { reachable: true, status: response.status, models: (body.data ?? []).map((model) => model.id ?? '').filter(Boolean) };
  } catch (error) {
    return { reachable: false, error: error instanceof Error ? error.message : String(error), models: [] as string[] };
  }
}

export async function saveSettings(input: unknown, ctx: ExtensionBackendContext) {
  const settings = input as ServingSettings;
  await saveServingSettings(ctx, settings);
  return { ok: true };
}

export async function runtimeStatus(input: unknown, ctx: ExtensionBackendContext) {
  const checkRuntimeDetails = Boolean(
    typeof input === 'object' && input !== null && (input as { checkRuntimeDetails?: unknown }).checkRuntimeDetails,
  );
  const [cliAvailable, serverAvailable, modelPath, pid] = await Promise.all([
    exists(bundledCli()),
    exists(bundledServer()),
    selectedModelPath(ctx),
    readPid(ctx),
  ]);
  const [serverRunning, health] = await Promise.all([isPidRunning(ctx, pid), readServerHealth()]);
  const runtimeAvailable = cliAvailable || serverAvailable;
  const version = checkRuntimeDetails && cliAvailable ? await runProcess(ctx, bundledCli(), ['--version']) : null;

  if (cliAvailable) await chmod(bundledCli(), 0o755).catch(() => undefined);
  if (serverAvailable) await chmod(bundledServer(), 0o755).catch(() => undefined);

  const latestRelease = checkRuntimeDetails && runtimeAvailable ? await readLlamaLatestRelease() : { latestTag: null, error: null };
  const installedBuild = parseLlamaBuild(version?.stdout.trim() || version?.stderr.trim());
  const latestBuild = parseLlamaReleaseBuild(latestRelease.latestTag);
  const download = currentDownloadJob();
  const metadata = modelPath
    ? await readModelMetadata(ctx, modelPath).catch(() => ({
        detectedContextLength: null,
        recommendedContextSize: FALLBACK_CONTEXT,
      }))
    : { detectedContextLength: null, recommendedContextSize: FALLBACK_CONTEXT };

  return {
    available: runtimeAvailable,
    serverAvailable,
    cliAvailable,
    cliPath: bundledCli(),
    serverPath: bundledServer(),
    modelCacheRoot,
    selectedModelPath: modelPath,
    detectedContextLength: metadata.detectedContextLength,
    recommendedContextSize: metadata.recommendedContextSize,
    baseUrl: BASE_URL,
    version: version?.stdout.trim() || version?.stderr.trim(),
    runtime: {
      name: 'llama.cpp',
      installed: runtimeAvailable,
      installedVersion: version?.stdout.trim() || version?.stderr.trim() || null,
      latestVersion: latestRelease.latestTag,
      updateCheckError: latestRelease.error,
      needsUpdate: Boolean(installedBuild && latestBuild && installedBuild < latestBuild),
    },
    message: runtimeAvailable
      ? serverAvailable
        ? undefined
        : 'llama-server is missing. Persistent runtime is unavailable until bin/darwin-arm64/llama-server is bundled.'
      : 'Bundled llama.cpp binaries are missing. Add Metal-enabled darwin-arm64 llama-cli and llama-server under bin/darwin-arm64/.',
    server: health,
    process: { managedPid: pid, managedRunning: serverRunning },
    models: listGgufFiles(modelCacheRoot),
    download: download ? serializeDownloadJob(download) : null,
    log: readLog(),
    savedServingSettings: await loadServingSettings(ctx),
    enabled: (await ctx.storage.get(SERVER_ENABLED_KEY).catch(() => null)) !== false,
  };
}

export async function setServerEnabled(input: unknown, ctx: ExtensionBackendContext) {
  const { enabled } = input as { enabled: boolean };
  await ctx.storage.put(SERVER_ENABLED_KEY, enabled);
  if (!enabled) {
    // Stop the server if it's running
    const pid = await readPid(ctx);
    if (pid) {
      await ctx.shell.exec({ command: 'sh', args: ['-c', `kill ${pid} 2>/dev/null || true`] });
      await ctx.storage.put(SERVER_PID_KEY, 0);
    }
  }
  return { ok: true, enabled };
}

export async function downloadModel(input: DownloadModelInput, ctx: ExtensionBackendContext) {
  const repo = input.repo?.trim();
  const filename = input.filename?.trim();

  if (!repo) throw new Error('Repository is required, for example unsloth/Qwen3.6-35B-A3B-MTP-GGUF.');
  if (!filename) throw new Error('GGUF filename is required, for example model-q4_k_m.gguf.');
  if (filename.startsWith('/') || filename.split('/').some((part) => part === '..' || part === '')) {
    throw new Error('GGUF filename must be a relative file path from the Hugging Face repo.');
  }

  const repoDir = join(modelCacheRoot, repo.replaceAll('/', '__'));
  const destination = join(repoDir, basename(filename));
  const partial = `${destination}.partial`;

  await mkdir(repoDir, { recursive: true });

  if (await exists(destination)) {
    const current = await stat(destination);
    await setSelectedModelPath(ctx, destination);
    return { modelPath: destination, bytes: current.size, cached: true, status: await runtimeStatus({}, ctx) };
  }

  const existing = currentDownloadJob();
  if (existing?.status === 'running')
    return { ok: true, started: false, job: serializeDownloadJob(existing), status: await runtimeStatus({}, ctx) };

  await unlink(partial).catch(() => undefined);
  const job: DownloadJob = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    repo,
    filename,
    destination,
    partial,
    downloadedBytes: 0,
    totalBytes: null,
    status: 'running',
    message: `Downloading ${filename}`,
    error: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    abort: new AbortController(),
  };
  downloadJobs.set(job.id, job);
  const encodedFilename = filename.split('/').map(encodeURIComponent).join('/');
  const url = `https://huggingface.co/${repo}/resolve/main/${encodedFilename}?download=true`;
  void download(url, partial, job)
    .then(async () => {
      if (job.status === 'cancelled') return;
      await rename(partial, destination);
      const current = await stat(destination);
      job.downloadedBytes = current.size;
      job.totalBytes = current.size;
      job.status = 'succeeded';
      job.message = `Downloaded ${filename}`;
      job.updatedAt = Date.now();
      await setSelectedModelPath(ctx, destination);
    })
    .catch(async (error) => {
      if (job.abort.signal.aborted || job.status === 'cancelled') {
        job.status = 'cancelled';
        job.message = `Cancelled ${filename}`;
        job.error = null;
      } else {
        job.status = 'failed';
        job.message = `Failed ${filename}`;
        job.error = error instanceof Error ? error.message : String(error);
      }
      job.updatedAt = Date.now();
      await unlink(partial).catch(() => undefined);
    });

  return { ok: true, started: true, job: serializeDownloadJob(job), status: await runtimeStatus({}, ctx) };
}

export async function cancelDownload(_input: unknown, ctx: ExtensionBackendContext) {
  const job = currentDownloadJob();
  if (!job || job.status !== 'running') return { ok: true, cancelled: false, status: await runtimeStatus({}, ctx) };
  job.status = 'cancelled';
  job.message = `Cancelling ${job.filename}`;
  job.updatedAt = Date.now();
  job.abort.abort();
  await unlink(job.partial).catch(() => undefined);
  return { ok: true, cancelled: true, job: serializeDownloadJob(job), status: await runtimeStatus({}, ctx) };
}

export async function setModel(input: RevealInput, ctx: ExtensionBackendContext) {
  const modelPath = input.modelPath?.trim();
  if (!modelPath) throw new Error('modelPath is required.');
  await setSelectedModelPath(ctx, modelPath);
  return { ok: true, status: await runtimeStatus({}, ctx) };
}

export async function deleteModel(input: RevealInput, ctx: ExtensionBackendContext) {
  const modelPath = input.modelPath?.trim();
  if (!modelPath) throw new Error('modelPath is required.');
  const normalizedRoot = `${modelCacheRoot}/`;
  if (!modelPath.startsWith(normalizedRoot)) throw new Error('Can only delete GGUF models from the local model cache.');
  if (!(await exists(modelPath))) return { ok: true, deleted: false, status: await runtimeStatus({}, ctx) };
  if ((await selectedModelPath(ctx)) === modelPath && (await readServerHealth()).reachable) {
    throw new Error('Stop the current model before deleting it.');
  }
  rmSync(modelPath, { force: true });
  let parent = dirname(modelPath);
  while (parent.startsWith(normalizedRoot) && parent !== modelCacheRoot) {
    try {
      rmSync(parent, { recursive: false });
      parent = dirname(parent);
    } catch {
      break;
    }
  }
  if ((await selectedModelPath(ctx)) === modelPath) await ctx.storage.put(MODEL_PATH_KEY, '');
  return { ok: true, deleted: true, status: await runtimeStatus({}, ctx) };
}

export async function revealModel(input: RevealInput, ctx: ExtensionBackendContext) {
  const modelPath = input.modelPath?.trim();
  if (!modelPath) throw new Error('modelPath is required.');
  if (!(await exists(modelPath))) throw new Error(`Model file does not exist: ${modelPath}`);
  await ctx.shell.exec({ command: 'open', args: ['-R', modelPath] });
  return { ok: true };
}

export async function installRuntime(input: unknown, ctx: ExtensionBackendContext) {
  const force = typeof input === 'object' && input !== null && 'force' in input ? Boolean((input as { force?: unknown }).force) : false;
  if (!force && (await exists(bundledCli())) && (await exists(bundledServer())))
    return { ok: true, installed: false, status: await runtimeStatus({}, ctx) };

  const releaseResponse = await fetch('https://api.github.com/repos/ggml-org/llama.cpp/releases/latest', {
    headers: { 'user-agent': 'neon-pilot-local-models' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!releaseResponse.ok) throw new Error(`Failed to read llama.cpp releases: ${releaseResponse.status} ${releaseResponse.statusText}`);
  const release = (await releaseResponse.json()) as {
    html_url?: string;
    assets?: Array<{ name?: string; browser_download_url?: string }>;
  };
  const asset = release.assets?.find((candidate) => {
    const name = candidate.name?.toLowerCase() ?? '';
    return name.endsWith('.tar.gz') && name.includes('macos') && name.includes('arm64') && !name.includes('kleidiai');
  });
  if (!asset?.browser_download_url)
    throw new Error(`Could not find a macOS arm64 llama.cpp release asset in ${release.html_url ?? 'latest release'}`);

  await mkdir(runtimeBinDir, { recursive: true });
  const script = `set -euo pipefail
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
curl -L ${shellQuote(asset.browser_download_url)} -o "$workdir/llama.tar.gz"
tar -xzf "$workdir/llama.tar.gz" -C "$workdir"
cli=$(find "$workdir" -name llama-cli -type f | head -1)
server=$(find "$workdir" -name llama-server -type f | head -1)
test -n "$cli"
test -n "$server"
install -m 755 "$cli" ${shellQuote(join(runtimeBinDir, 'llama-cli'))}
install -m 755 "$server" ${shellQuote(join(runtimeBinDir, 'llama-server'))}
dylibs=$(find "$workdir" -name '*.dylib')
test -n "$dylibs"
while IFS= read -r dylib; do
  install -m 755 "$dylib" ${shellQuote(runtimeBinDir)}/$(basename "$dylib")
done <<EOF
$dylibs
EOF
`;
  await ctx.shell.exec({ command: 'sh', args: ['-c', script], timeoutMs: 120_000, maxBuffer: 1024 * 1024 });
  runtimeUpdateCache.checkedAt = 0;
  return { ok: true, installed: true, status: await runtimeStatus({}, ctx) };
}

export async function startServer(input: ServerInput, ctx: ExtensionBackendContext) {
  const modelPath = input.modelPath?.trim() || (await selectedModelPath(ctx));
  if (!modelPath) throw new Error('Select or download a GGUF model before starting the runtime.');
  if (!(await exists(bundledServer()))) throw new Error(`Bundled llama-server is missing at ${bundledServer()}`);
  if (!(await exists(modelPath))) throw new Error(`Model file does not exist: ${modelPath}`);

  const health = await readServerHealth();
  if (health.reachable) return { ok: true, alreadyRunning: true, status: await runtimeStatus({}, ctx) };
  const pid = await readPid(ctx);
  if (await isPidRunning(ctx, pid)) return { ok: true, starting: true, status: await runtimeStatus({}, ctx) };

  await mkdir(dirname(LOG_FILE), { recursive: true });
  await chmod(bundledServer(), 0o755).catch(() => undefined);
  await setSelectedModelPath(ctx, modelPath);
  await saveServingSettings(ctx, {
    contextSize: input.contextSize,
    gpuLayers: input.gpuLayers,
    temperature: input.temperature,
    topP: input.topP,
    topK: input.topK,
    minP: input.minP,
    repeatPenalty: input.repeatPenalty,
    seed: input.seed,
    threads: input.threads,
    batchSize: input.batchSize,
    ubatchSize: input.ubatchSize,
    parallel: input.parallel,
    flashAttention: input.flashAttention,
    extraArgs: input.extraArgs,
    specType: input.specType,
    specDraftNMax: input.specDraftNMax,
  });
  const metadata = await readModelMetadata(ctx, modelPath).catch(() => ({
    detectedContextLength: null,
    recommendedContextSize: FALLBACK_CONTEXT,
  }));
  const contextSize = input.contextSize && input.contextSize > 0 ? input.contextSize : metadata.recommendedContextSize;
  const parallel = finitePositiveInt(input.parallel) ?? 1;
  const args = [
    '-m',
    shellQuote(modelPath),
    '--host',
    '127.0.0.1',
    '--port',
    String(MODEL_PORT),
    '--parallel',
    String(parallel),
    '-ngl',
    String(input.gpuLayers ?? 999),
    '-c',
    String(contextSize),
  ];
  appendOptionalPositiveIntArg(args, '--threads', input.threads);
  appendOptionalPositiveIntArg(args, '--batch-size', input.batchSize);
  appendOptionalPositiveIntArg(args, '--ubatch-size', input.ubatchSize);
  appendOptionalPositiveIntArg(args, '--top-k', input.topK);
  appendOptionalArg(args, '--top-p', input.topP);
  appendOptionalArg(args, '--min-p', input.minP);
  appendOptionalArg(args, '--temp', input.temperature);
  appendOptionalArg(args, '--repeat-penalty', input.repeatPenalty);
  appendOptionalArg(args, '--seed', input.seed);
  if (input.flashAttention) args.push('--flash-attn');
  appendSpeculativeDecodingArgs(args, input);
  const extraArgs = input.extraArgs?.trim();
  const command = `exec ${shellQuote(bundledServer())} ${args.join(' ')}${extraArgs ? ` ${extraArgs}` : ''} >> ${shellQuote(LOG_FILE)} 2>&1`;
  const result = await ctx.shell.exec({ command: 'sh', args: ['-c', `nohup sh -c ${shellQuote(command)} >/dev/null 2>&1 & echo $!`] });
  await ctx.storage.put(SERVER_PID_KEY, Number(result.stdout.trim()));
  return { ok: true, started: true, pid: Number(result.stdout.trim()), status: await runtimeStatus({}, ctx) };
}

export async function stopServer(_input: unknown, ctx: ExtensionBackendContext) {
  const pid = await readPid(ctx);
  if (!(await isPidRunning(ctx, pid))) return { ok: true, stopped: false, status: await runtimeStatus({}, ctx) };
  await ctx.shell.exec({ command: 'sh', args: ['-c', `kill ${pid} >/dev/null 2>&1 || true`] });
  return { ok: true, stopped: true, pid, status: await runtimeStatus({}, ctx) };
}

export async function runPrompt(input: RunPromptInput, ctx: ExtensionBackendContext) {
  const modelPath = input.modelPath?.trim() || (await selectedModelPath(ctx));
  const prompt = input.prompt?.trim();

  if (!modelPath) throw new Error('Select or download a GGUF model first.');
  if (!prompt) throw new Error('Prompt is required.');
  if (!(await exists(modelPath))) throw new Error(`Model file does not exist: ${modelPath}`);

  const health = await readServerHealth();
  if (health.reachable) {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local' },
      body: JSON.stringify({
        model: basename(modelPath),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: input.maxTokens ?? 64,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(await response.text());
    const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { output: result.choices?.[0]?.message?.content || JSON.stringify(result, null, 2), source: 'server' };
  }

  if (!(await exists(bundledCli()))) throw new Error(`Bundled llama-cli is missing at ${bundledCli()}`);
  await chmod(bundledCli(), 0o755).catch(() => undefined);
  const metadata = await readModelMetadata(ctx, modelPath).catch(() => ({
    detectedContextLength: null,
    recommendedContextSize: FALLBACK_CONTEXT,
  }));
  const contextSize = input.contextSize && input.contextSize > 0 ? input.contextSize : metadata.recommendedContextSize;
  const args = ['-m', modelPath, '-p', prompt, '-ngl', String(input.gpuLayers ?? 999), '-c', String(contextSize)];
  appendSpeculativeDecodingArgs(args, input);
  const result = await runProcess(ctx, bundledCli, args, { timeoutMs: 120_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.exitCode !== 0) throw new Error(result.stderr || `llama-cli exited with code ${result.exitCode}`);
  return { output: result.stdout, stderr: result.stderr, source: 'cli' };
}
