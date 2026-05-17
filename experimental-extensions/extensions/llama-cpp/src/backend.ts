import { createWriteStream, existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { access, chmod, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { get } from 'node:https';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExtensionBackendContext } from '@personal-agent/extensions';

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
type RunPromptInput = { modelPath?: string; prompt?: string; contextSize?: number; gpuLayers?: number };
type ServerInput = { modelPath?: string; contextSize?: number; gpuLayers?: number };
type RevealInput = { modelPath?: string };

const here = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(here, '..');
const repoRoot = process.env.PERSONAL_AGENT_REPO_ROOT?.trim();
const llamaCppExtensionRoot = repoRoot ? join(repoRoot, 'experimental-extensions', 'extensions', 'llama-cpp') : extensionRoot;
function bundledBinary(name: string) {
  const localPath = join(extensionRoot, 'bin', 'darwin-arm64', name);
  if (existsSync(localPath)) return localPath;
  return join(llamaCppExtensionRoot, 'bin', 'darwin-arm64', name);
}
const bundledCli = bundledBinary('llama-cli');
const bundledServer = bundledBinary('llama-server');
const modelCacheRoot = join(homedir(), '.cache', 'personal-agent', 'llama-cpp', 'models');
const LOG_FILE = join(modelCacheRoot, '..', 'latest.log');
const SERVER_PID_KEY = 'process/serverPid';
const MODEL_PATH_KEY = 'settings/modelPath';
const MODEL_PORT = 8012;
const BASE_URL = `http://127.0.0.1:${MODEL_PORT}/v1`;
const downloadJobs = new Map<string, DownloadJob>();

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

export async function runtimeStatus(_input: unknown, ctx: ExtensionBackendContext) {
  const [cliAvailable, serverAvailable, modelPath, pid] = await Promise.all([
    exists(bundledCli),
    exists(bundledServer),
    selectedModelPath(ctx),
    readPid(ctx),
  ]);
  const [serverRunning, health] = await Promise.all([isPidRunning(ctx, pid), readServerHealth()]);
  const runtimeAvailable = cliAvailable || serverAvailable;
  const version = cliAvailable ? await runProcess(ctx, bundledCli, ['--version']) : null;

  if (cliAvailable) await chmod(bundledCli, 0o755).catch(() => undefined);
  if (serverAvailable) await chmod(bundledServer, 0o755).catch(() => undefined);

  const download = currentDownloadJob();

  return {
    available: runtimeAvailable,
    serverAvailable,
    cliAvailable,
    cliPath: bundledCli,
    serverPath: bundledServer,
    modelCacheRoot,
    selectedModelPath: modelPath,
    baseUrl: BASE_URL,
    version: version?.stdout.trim() || version?.stderr.trim(),
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
  };
}

export async function downloadModel(input: DownloadModelInput, ctx: ExtensionBackendContext) {
  const repo = input.repo?.trim();
  const filename = input.filename?.trim();

  if (!repo) throw new Error('Repository is required, for example unsloth/Qwen3.6-35B-A3B-MTP-GGUF.');
  if (!filename) throw new Error('GGUF filename is required, for example model-q4_k_m.gguf.');
  if (filename.includes('/') || filename.includes('..')) throw new Error('Filename must be a single GGUF filename, not a path.');

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
  const url = `https://huggingface.co/${repo}/resolve/main/${encodeURIComponent(filename)}?download=true`;
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

export async function startServer(input: ServerInput, ctx: ExtensionBackendContext) {
  const modelPath = input.modelPath?.trim() || (await selectedModelPath(ctx));
  if (!modelPath) throw new Error('Select or download a GGUF model before starting the runtime.');
  if (!(await exists(bundledServer))) throw new Error(`Bundled llama-server is missing at ${bundledServer}`);
  if (!(await exists(modelPath))) throw new Error(`Model file does not exist: ${modelPath}`);

  const health = await readServerHealth();
  if (health.reachable) return { ok: true, alreadyRunning: true, status: await runtimeStatus({}, ctx) };
  const pid = await readPid(ctx);
  if (await isPidRunning(ctx, pid)) return { ok: true, starting: true, status: await runtimeStatus({}, ctx) };

  await mkdir(dirname(LOG_FILE), { recursive: true });
  await chmod(bundledServer, 0o755).catch(() => undefined);
  await setSelectedModelPath(ctx, modelPath);
  const args = [
    '-m',
    shellQuote(modelPath),
    '--host',
    '127.0.0.1',
    '--port',
    String(MODEL_PORT),
    '-ngl',
    String(input.gpuLayers ?? 999),
    '-c',
    String(input.contextSize ?? 8192),
  ];
  const command = `${shellQuote(bundledServer)} ${args.join(' ')} >> ${shellQuote(LOG_FILE)} 2>&1`;
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
      body: JSON.stringify({ model: basename(modelPath), messages: [{ role: 'user', content: prompt }], stream: false }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(await response.text());
    const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { output: result.choices?.[0]?.message?.content || JSON.stringify(result, null, 2), source: 'server' };
  }

  if (!(await exists(bundledCli))) throw new Error(`Bundled llama-cli is missing at ${bundledCli}`);
  await chmod(bundledCli, 0o755).catch(() => undefined);
  const args = ['-m', modelPath, '-p', prompt, '-ngl', String(input.gpuLayers ?? 999), '-c', String(input.contextSize ?? 8192)];
  const result = await runProcess(ctx, bundledCli, args, { timeoutMs: 120_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.exitCode !== 0) throw new Error(result.stderr || `llama-cli exited with code ${result.exitCode}`);
  return { output: result.stdout, stderr: result.stderr, source: 'cli' };
}
