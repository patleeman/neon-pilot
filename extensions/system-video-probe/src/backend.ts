import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, join } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_ID = 'mlx-community/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-nvfp4';
const MODEL_PORT = 8012;
const BASE_URL = `http://127.0.0.1:${MODEL_PORT}`;
const CACHE_DIR = join(homedir(), '.cache', 'neon-pilot', 'video-probe');
const VENV_DIR = join(CACHE_DIR, 'venv');
const VENV_PYTHON = join(VENV_DIR, 'bin', 'python');
const VENV_MLX_VLM_SERVER = join(VENV_DIR, 'bin', 'mlx_vlm.server');
const LOG_FILE = join(CACHE_DIR, 'latest.log');

const SERVER_PID_KEY = 'videoProbe/process/serverPid';
const SETUP_PID_KEY = 'videoProbe/process/setupPid';

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpg', '.mpeg', '.m4v', '.3gp', '.wmv', '.flv']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function pickPythonCommand() {
  return existsSync('/opt/homebrew/bin/python3') ? '/opt/homebrew/bin/python3' : 'python3';
}

function readLog() {
  if (!existsSync(LOG_FILE)) return '';
  return readFileSync(LOG_FILE, 'utf8').slice(-30_000);
}

async function runProcess(ctx: ExtensionBackendContext, command: string, args: string[], timeoutMs = 10_000) {
  try {
    const result = await ctx.shell.exec({ command, args, timeoutMs, maxBuffer: 1024 * 1024 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { exitCode: 1, stdout: '', stderr: error instanceof Error ? error.message : String(error) };
  }
}

async function readPid(ctx: ExtensionBackendContext, key: string) {
  const stored = await ctx.storage.get(key).catch(() => null);
  const pid = typeof stored === 'number' ? stored : Number(stored);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

async function isPidRunning(ctx: ExtensionBackendContext, pid: number | null) {
  if (!pid) return false;
  const result = await runProcess(ctx, 'sh', ['-c', `kill -0 ${pid} >/dev/null 2>&1 && echo yes || true`]);
  return result.stdout.trim() === 'yes';
}

async function readServerHealth() {
  try {
    const response = await fetch(`${BASE_URL}/v1/models`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return { reachable: false };
    const body = (await response.json()) as { data?: Array<{ id?: string }> };
    return { reachable: true, models: (body.data ?? []).map((m) => m.id ?? '').filter(Boolean) };
  } catch {
    return { reachable: false };
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export async function status(_input: unknown, ctx: ExtensionBackendContext) {
  const serverPid = await readPid(ctx, SERVER_PID_KEY);
  const setupPid = await readPid(ctx, SETUP_PID_KEY);
  const [serverRunning, setupRunning, health] = await Promise.all([
    isPidRunning(ctx, serverPid),
    isPidRunning(ctx, setupPid),
    readServerHealth(),
  ]);

  return {
    ok: true,
    modelId: MODEL_ID,
    baseUrl: BASE_URL,
    runtimeInstalled: existsSync(VENV_MLX_VLM_SERVER),
    venvReady: existsSync(VENV_PYTHON),
    server: health,
    process: { serverPid, serverRunning, setupPid, setupRunning },
    log: readLog(),
  };
}

// ---------------------------------------------------------------------------
// Setup — install mlx-vlm and download model
// ---------------------------------------------------------------------------

export async function setup(_input: unknown, ctx: ExtensionBackendContext) {
  const setupRunning = await isPidRunning(ctx, await readPid(ctx, SETUP_PID_KEY));
  if (setupRunning) return { ok: true, alreadyRunning: true, status: await status({}, ctx) };

  mkdirSync(CACHE_DIR, { recursive: true });

  const script = [
    `: > ${shellQuote(LOG_FILE)}`,
    `echo "--- setup ${new Date().toISOString()} ---" >> ${shellQuote(LOG_FILE)}`,
    `[ -x ${shellQuote(VENV_PYTHON)} ] || ${shellQuote(pickPythonCommand())} -m venv ${shellQuote(VENV_DIR)} >> ${shellQuote(LOG_FILE)} 2>&1`,
    `${shellQuote(VENV_PYTHON)} -m pip install -U pip mlx-vlm huggingface_hub >> ${shellQuote(LOG_FILE)} 2>&1`,
    `HF_HOME=${shellQuote(CACHE_DIR)} ${shellQuote(join(VENV_DIR, 'bin', 'hf'))} download ${shellQuote(MODEL_ID)} >> ${shellQuote(LOG_FILE)} 2>&1`,
    `echo "--- setup complete ---" >> ${shellQuote(LOG_FILE)}`,
  ].join(' && ');

  const result = await ctx.shell.exec({
    command: 'sh',
    args: ['-c', `nohup sh -c ${shellQuote(script)} >/dev/null 2>&1 & echo $!`],
  });
  await ctx.storage.put(SETUP_PID_KEY, Number(result.stdout.trim()));

  return { ok: true, started: true, status: await status({}, ctx) };
}

// ---------------------------------------------------------------------------
// Server start / stop
// ---------------------------------------------------------------------------

export async function startServer(_input: unknown, ctx: ExtensionBackendContext) {
  const health = await readServerHealth();
  if (health.reachable) return { ok: true, alreadyRunning: true, status: await status({}, ctx) };

  const serverRunning = await isPidRunning(ctx, await readPid(ctx, SERVER_PID_KEY));
  if (serverRunning) return { ok: true, starting: true, status: await status({}, ctx) };

  if (!existsSync(VENV_MLX_VLM_SERVER)) {
    return { ok: false, error: 'mlx-vlm is not installed. Run setup first.', status: await status({}, ctx) };
  }

  const command = `exec env HF_HOME=${shellQuote(CACHE_DIR)} ${shellQuote(VENV_MLX_VLM_SERVER)} --model ${shellQuote(MODEL_ID)} --host 127.0.0.1 --port ${MODEL_PORT} >> ${shellQuote(LOG_FILE)} 2>&1`;
  const result = await ctx.shell.exec({
    command: 'sh',
    args: ['-c', `nohup sh -c ${shellQuote(command)} >/dev/null 2>&1 & echo $!`],
  });
  const pid = Number(result.stdout.trim());
  await ctx.storage.put(SERVER_PID_KEY, pid);

  return { ok: true, started: true, pid, status: await status({}, ctx) };
}

export async function stopServer(_input: unknown, ctx: ExtensionBackendContext) {
  const serverPid = await readPid(ctx, SERVER_PID_KEY);
  if (!(await isPidRunning(ctx, serverPid))) {
    return { ok: true, stopped: false, status: await status({}, ctx) };
  }
  await ctx.shell.exec({ command: 'sh', args: ['-c', `kill ${serverPid} >/dev/null 2>&1 || true`] });
  return { ok: true, stopped: true, pid: serverPid, status: await status({}, ctx) };
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.m4v': 'video/mp4',
  '.3gp': 'video/3gpp',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
};

function readPath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('probe_video: path is required.');
  const p = value.trim();
  if (!existsSync(p)) throw new Error(`Video file not found: ${p}`);
  const ext = extname(p).toLowerCase();
  if (ext && !SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported video format: ${ext}. Supported: ${[...SUPPORTED_EXTENSIONS].join(', ')}`);
  }
  return p;
}

function readQuestion(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('probe_video: question is required.');
  if (value.length > 8000) throw new Error('Question too long (max 8000 chars).');
  return value.trim();
}

function readSettings(profileSettingsFilePath: string) {
  try {
    if (!existsSync(profileSettingsFilePath)) return { backend: 'openrouter' as const, openrouterModel: 'google/gemini-2.5-flash' };
    const root = JSON.parse(readFileSync(profileSettingsFilePath, 'utf8')) as Record<string, unknown>;
    const raw = root.videoProbe as Record<string, unknown> | undefined;
    return {
      backend: raw?.backend === 'local' ? ('local' as const) : ('openrouter' as const),
      openrouterModel:
        typeof raw?.openrouterModel === 'string' && raw.openrouterModel.trim() ? raw.openrouterModel.trim() : 'google/gemini-2.5-flash',
    };
  } catch {
    return { backend: 'openrouter' as const, openrouterModel: 'google/gemini-2.5-flash' };
  }
}

async function callVideoEndpoint(
  endpoint: string,
  model: string,
  filePath: string,
  question: string,
  extraHeaders: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<string> {
  const videoData = readFileSync(filePath);
  const base64 = videoData.toString('base64');
  const mimeType = MIME_MAP[extname(filePath).toLowerCase()] ?? 'video/mp4';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'video_url', video_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: question },
          ],
        },
      ],
    }),
    signal,
  });

  const text = await response.text();
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } | string };
      if (typeof parsed.error === 'string') msg = parsed.error;
      else if (typeof parsed.error?.message === 'string') msg = parsed.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const parsed = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
  const content = parsed.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Model returned an empty response.');
  return content;
}

async function ensureServerRunning(ctx: ExtensionBackendContext): Promise<void> {
  const health = await readServerHealth();
  if (health.reachable) return;

  // Auto-start if runtime is installed
  if (!existsSync(VENV_MLX_VLM_SERVER)) {
    throw new Error(
      'mlx-vlm is not installed. Open the Video Probe page and click "Set Up" to install the runtime and download the model.',
    );
  }

  await startServer({}, ctx);

  // Wait up to 60s for the server to come up (model load takes time)
  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const h = await readServerHealth();
    if (h.reachable) return;
  }

  throw new Error('mlx-vlm server did not become ready in time. Check the Video Probe page for logs.');
}

export async function probeVideo(input: { path?: unknown; question?: unknown }, ctx: ExtensionBackendContext) {
  const filePath = readPath(input.path);
  const question = readQuestion(input.question);
  const settings = readSettings(ctx.profileSettingsFilePath);

  let text: string;
  let modelRef: string;

  try {
    if (settings.backend === 'local') {
      await ensureServerRunning(ctx);
      modelRef = MODEL_ID;
      text = await callVideoEndpoint(`${BASE_URL}/v1/chat/completions`, MODEL_ID, filePath, question, {}, ctx.signal);
    } else {
      const apiKey = (await ctx.secrets.get('openrouterApiKey'))?.trim();
      if (!apiKey) throw new Error('No OpenRouter API key configured. Add one in Settings → Video Probe.');
      modelRef = settings.openrouterModel;
      text = await callVideoEndpoint(
        'https://openrouter.ai/api/v1/chat/completions',
        settings.openrouterModel,
        filePath,
        question,
        {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/neon-pilot/personal-agent',
          'X-Title': 'Personal Agent Video Probe',
        },
        ctx.signal,
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const normalized = msg.toLowerCase();
    let friendly = msg;

    if (/(402|insufficient.*balance|payment required|billing|credits)/.test(normalized)) {
      friendly = `Video probe billing error (${settings.backend}, ${modelRef!}): ${msg}`;
    } else if (/(connection refused|econnrefused|fetch failed|enotfound)/.test(normalized) && settings.backend === 'local') {
      friendly = `Could not reach mlx-vlm server. Open the Video Probe page to check status. Error: ${msg}`;
    } else if (/(too large|413|size limit|content_too_large)/.test(normalized)) {
      friendly = `Video file too large for this backend. Try a shorter clip. Error: ${msg}`;
    }

    return { text: friendly, content: [{ type: 'text' as const, text: friendly }], isError: true };
  }

  return {
    text,
    content: [{ type: 'text' as const, text }],
    details: { backend: settings.backend, model: modelRef!, filePath },
  };
}
