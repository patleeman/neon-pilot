import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, join } from 'node:path';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
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
const SETTINGS_FILE = join(CACHE_DIR, 'settings.json');

const SERVER_PID_KEY = 'videoProbe/process/serverPid';
const SETUP_PID_KEY = 'videoProbe/process/setupPid';

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpg', '.mpeg', '.m4v', '.3gp', '.wmv', '.flv']);

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

// ---------------------------------------------------------------------------
// Settings (shared file — readable from both agent extension and backend actions)
// ---------------------------------------------------------------------------

interface VideoProbeSettings {
  backend: 'openrouter' | 'local';
  cloudModel: string;
  localModel: string;
  hfToken: string;
}

interface OpenRouterAuthStatus {
  configured: boolean;
  source: 'stored' | 'environment' | 'none';
}

const DEFAULT_SETTINGS: VideoProbeSettings = {
  backend: 'openrouter',
  cloudModel: 'google/gemini-2.5-flash',
  localModel: MODEL_ID,
  hfToken: '',
};

const HF_TOKEN_SECRET_ID = 'hfToken';

function loadSettings(): VideoProbeSettings {
  try {
    if (!existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
    const raw = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as Partial<VideoProbeSettings>;
    return {
      backend: raw.backend === 'local' ? 'local' : 'openrouter',
      cloudModel: typeof raw.cloudModel === 'string' && raw.cloudModel.trim() ? raw.cloudModel.trim() : DEFAULT_SETTINGS.cloudModel,
      localModel: typeof raw.localModel === 'string' && raw.localModel.trim() ? raw.localModel.trim() : DEFAULT_SETTINGS.localModel,
      hfToken: typeof raw.hfToken === 'string' ? raw.hfToken : '',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: VideoProbeSettings): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const safeSettings = {
    backend: settings.backend,
    cloudModel: settings.cloudModel,
    localModel: settings.localModel,
  };
  writeFileSync(SETTINGS_FILE, JSON.stringify(safeSettings, null, 2), 'utf8');
}

function readLegacyHfToken(): string {
  return loadSettings().hfToken.trim();
}

async function readHfToken(ctx: ExtensionBackendContext): Promise<string> {
  const secret = await Promise.resolve(ctx.secrets.get(HF_TOKEN_SECRET_ID));
  return secret?.trim() || readLegacyHfToken();
}

function readToolHfToken(ctx: unknown): string {
  const maybeCtx = ctx as { secrets?: { get?: (secretId: string) => string | undefined } } | undefined;
  return maybeCtx?.secrets?.get?.(HF_TOKEN_SECRET_ID)?.trim() || readLegacyHfToken();
}

async function publicSettings(ctx: ExtensionBackendContext): Promise<VideoProbeSettings> {
  const settings = loadSettings();
  return { ...settings, hfToken: (await readHfToken(ctx)) ? 'configured' : '' };
}

function readOpenRouterAuthStatus(runtimeDir: string): OpenRouterAuthStatus {
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    return { configured: true, source: 'environment' };
  }

  try {
    const authFile = join(runtimeDir, 'auth.json');
    if (!existsSync(authFile)) return { configured: false, source: 'none' };
    const raw = JSON.parse(readFileSync(authFile, 'utf8')) as Record<string, unknown>;
    const credential = raw.openrouter as { type?: unknown; key?: unknown; access?: unknown; accessToken?: unknown } | undefined;
    const hasApiKey = credential?.type === 'api_key' && typeof credential.key === 'string' && credential.key.trim().length > 0;
    const hasOAuthToken =
      credential?.type === 'oauth' &&
      ((typeof credential.access === 'string' && credential.access.trim().length > 0) ||
        (typeof credential.accessToken === 'string' && credential.accessToken.trim().length > 0));
    return hasApiKey || hasOAuthToken ? { configured: true, source: 'stored' } : { configured: false, source: 'none' };
  } catch {
    return { configured: false, source: 'none' };
  }
}

export async function readSettings(_input: unknown, ctx: ExtensionBackendContext) {
  return { ok: true, settings: await publicSettings(ctx) };
}

export async function writeSettings(input: unknown, ctx: ExtensionBackendContext) {
  const raw = input as Partial<VideoProbeSettings>;
  const current = loadSettings();
  const next: VideoProbeSettings = {
    backend: raw.backend === 'local' ? 'local' : raw.backend === 'openrouter' ? 'openrouter' : current.backend,
    cloudModel: typeof raw.cloudModel === 'string' && raw.cloudModel.trim() ? raw.cloudModel.trim() : current.cloudModel,
    localModel: typeof raw.localModel === 'string' && raw.localModel.trim() ? raw.localModel.trim() : current.localModel,
    hfToken: current.hfToken,
  };
  saveSettings(next);
  return { ok: true, settings: await publicSettings(ctx) };
}

// ---------------------------------------------------------------------------
// Shell helpers (for backend actions only)
// ---------------------------------------------------------------------------

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function hfEnv(token: string) {
  const base = `HF_HOME=${shellQuote(CACHE_DIR)}`;
  return token.trim() ? `${base} HF_TOKEN=${shellQuote(token.trim())}` : base;
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

// ---------------------------------------------------------------------------
// Server health (used by both backend actions and agent extension)
// ---------------------------------------------------------------------------

async function readServerHealth(): Promise<{ reachable: boolean; listening: boolean; models?: string[] }> {
  // First check if the port is accepting connections at all (server started but model may still be loading)
  let listening = false;
  try {
    const probe = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(1000) });
    listening = probe.status < 600; // any response means port is open
  } catch {
    // ECONNREFUSED = not listening; timeout = listening but slow
    // A timeout likely means it IS listening (model loading)
    listening = false;
  }

  // Then check if the API is fully ready
  try {
    const response = await fetch(`${BASE_URL}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return { reachable: false, listening };
    const body = (await response.json()) as { data?: Array<{ id?: string }> };
    return { reachable: true, listening: true, models: (body.data ?? []).map((m) => m.id ?? '').filter(Boolean) };
  } catch {
    return { reachable: false, listening };
  }
}

// ---------------------------------------------------------------------------
// Backend actions — server lifecycle
// ---------------------------------------------------------------------------

export async function status(_input: unknown, ctx: ExtensionBackendContext) {
  const serverPid = await readPid(ctx, SERVER_PID_KEY);
  const setupPid = await readPid(ctx, SETUP_PID_KEY);
  const [serverRunning, setupRunning, health] = await Promise.all([
    isPidRunning(ctx, serverPid),
    isPidRunning(ctx, setupPid),
    readServerHealth(),
  ]);
  const settings = await publicSettings(ctx);
  return {
    ok: true,
    modelId: settings.localModel,
    baseUrl: BASE_URL,
    runtimeInstalled: existsSync(VENV_MLX_VLM_SERVER),
    venvReady: existsSync(VENV_PYTHON),
    server: health,
    process: { serverPid, serverRunning: serverRunning || health.reachable, setupPid, setupRunning },
    settings,
    openrouterAuth: readOpenRouterAuthStatus(ctx.runtimeDir),
    log: readLog(),
  };
}

export async function setup(_input: unknown, ctx: ExtensionBackendContext) {
  const setupRunning = await isPidRunning(ctx, await readPid(ctx, SETUP_PID_KEY));
  if (setupRunning) return { ok: true, alreadyRunning: true, status: await status({}, ctx) };
  mkdirSync(CACHE_DIR, { recursive: true });
  const { localModel } = loadSettings();
  const hfToken = await readHfToken(ctx);
  const env = hfEnv(hfToken);
  const script = [
    `: > ${shellQuote(LOG_FILE)}`,
    `echo "--- setup ${new Date().toISOString()} ---" >> ${shellQuote(LOG_FILE)}`,
    `[ -x ${shellQuote(VENV_PYTHON)} ] || ${shellQuote(pickPythonCommand())} -m venv ${shellQuote(VENV_DIR)} >> ${shellQuote(LOG_FILE)} 2>&1`,
    `${shellQuote(VENV_PYTHON)} -m pip install -U pip mlx-vlm huggingface_hub >> ${shellQuote(LOG_FILE)} 2>&1`,
    `${env} ${shellQuote(join(VENV_DIR, 'bin', 'hf'))} download ${shellQuote(localModel)} >> ${shellQuote(LOG_FILE)} 2>&1`,
    `echo "--- setup complete ---" >> ${shellQuote(LOG_FILE)}`,
  ].join(' && ');
  const result = await ctx.shell.exec({
    command: 'sh',
    args: ['-c', `nohup sh -c ${shellQuote(script)} >/dev/null 2>&1 & echo $!`],
  });
  await ctx.storage.put(SETUP_PID_KEY, Number(result.stdout.trim()));
  return { ok: true, started: true, status: await status({}, ctx) };
}

export async function startServer(_input: unknown, ctx: ExtensionBackendContext) {
  const health = await readServerHealth();
  if (health.reachable) return { ok: true, alreadyRunning: true, status: await status({}, ctx) };
  const serverRunning = await isPidRunning(ctx, await readPid(ctx, SERVER_PID_KEY));
  if (serverRunning) return { ok: true, starting: true, status: await status({}, ctx) };
  if (!existsSync(VENV_MLX_VLM_SERVER)) {
    return { ok: false, error: 'mlx-vlm is not installed. Run setup first.', status: await status({}, ctx) };
  }
  const { localModel } = loadSettings();
  const hfToken = await readHfToken(ctx);
  const command = `exec env ${hfEnv(hfToken)} ${shellQuote(VENV_MLX_VLM_SERVER)} --model ${shellQuote(localModel)} --host 127.0.0.1 --port ${MODEL_PORT} >> ${shellQuote(LOG_FILE)} 2>&1`;
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

export async function cancelSetup(_input: unknown, ctx: ExtensionBackendContext) {
  const setupPid = await readPid(ctx, SETUP_PID_KEY);
  if (setupPid) {
    // Kill the whole process group to catch child processes (pip, hf, etc.)
    await ctx.shell.exec({
      command: 'sh',
      args: ['-c', `kill -- -${setupPid} >/dev/null 2>&1 || kill ${setupPid} >/dev/null 2>&1 || true`],
    });
    await ctx.storage.put(SETUP_PID_KEY, null);
  }
  return { ok: true, status: await status({}, ctx) };
}

export async function resetInstallation(_input: unknown, ctx: ExtensionBackendContext) {
  // Kill server and setup if running
  const [serverPid, setupPid] = await Promise.all([readPid(ctx, SERVER_PID_KEY), readPid(ctx, SETUP_PID_KEY)]);
  const killCmds = [
    serverPid ? `kill ${serverPid} >/dev/null 2>&1 || true` : '',
    setupPid ? `kill -- -${setupPid} >/dev/null 2>&1 || kill ${setupPid} >/dev/null 2>&1 || true` : '',
  ]
    .filter(Boolean)
    .join('; ');
  if (killCmds) await ctx.shell.exec({ command: 'sh', args: ['-c', killCmds] });
  // Delete the entire cache dir (venv + model weights + logs)
  await ctx.shell.exec({ command: 'sh', args: ['-c', `rm -rf ${shellQuote(CACHE_DIR)}`], timeoutMs: 30_000 });
  await ctx.storage.put(SERVER_PID_KEY, null);
  await ctx.storage.put(SETUP_PID_KEY, null);
  return { ok: true, status: await status({}, ctx) };
}

// ---------------------------------------------------------------------------
// Agent extension — probe_video tool
// ---------------------------------------------------------------------------

const ProbeVideoParams = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Absolute path to the video file on disk.' },
    question: { type: 'string', minLength: 1, maxLength: 8000, description: 'What to ask or analyze about the video.' },
  },
  required: ['path', 'question'],
} as const;

function validatePath(value: string): string {
  const p = value.trim();
  if (!p) throw new Error('probe_video: path is required.');
  if (!existsSync(p)) throw new Error(`Video file not found: ${p}`);
  const ext = extname(p).toLowerCase();
  if (ext && !SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported video format: ${ext}. Supported: ${[...SUPPORTED_EXTENSIONS].join(', ')}`);
  }
  return p;
}

async function callChatCompletions(
  endpoint: string,
  model: string,
  filePath: string,
  question: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<string> {
  const videoData = readFileSync(filePath);
  const base64 = videoData.toString('base64');
  const mimeType = MIME_MAP[extname(filePath).toLowerCase()] ?? 'video/mp4';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
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

export function createVideoProbeAgentExtension(): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    pi.registerTool({
      name: 'probe_video',
      label: 'Probe video',
      description:
        'Analyze a video file using a video-capable model. Provide the absolute path to a video file and a question about its contents.',
      promptGuidelines: [
        'Use this tool when the user references a video file by path and asks about its content.',
        'Do not guess at video content — always call this tool when visual inspection of a video is needed.',
      ],
      parameters: ProbeVideoParams,
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const filePath = validatePath(params.path);
        const question = params.question.trim();
        const settings = loadSettings();
        const hfToken = readToolHfToken(ctx);

        if (settings.backend === 'local') {
          // Check server health; auto-start if installed but not running
          let health = await readServerHealth();
          if (!health.reachable && existsSync(VENV_MLX_VLM_SERVER)) {
            const startCommand = `exec env ${hfEnv(hfToken)} ${shellQuote(VENV_MLX_VLM_SERVER)} --model ${shellQuote(settings.localModel)} --host 127.0.0.1 --port ${MODEL_PORT} >> ${shellQuote(LOG_FILE)} 2>&1`;
            await pi.exec('sh', ['-c', `nohup sh -c ${shellQuote(startCommand)} >/dev/null 2>&1 &`]);
            // Wait up to 60s for server to come up
            for (let i = 0; i < 60; i++) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              health = await readServerHealth();
              if (health.reachable) break;
            }
          }
          if (!health.reachable) {
            if (!existsSync(VENV_MLX_VLM_SERVER)) {
              const msg = 'mlx-vlm is not installed. Open the Video Probe page and click "Set Up" to install it.';
              return { text: msg, content: [{ type: 'text' as const, text: msg }], isError: true };
            }
            const msg = 'mlx-vlm server did not become ready in time. Check the Video Probe page for logs.';
            return { text: msg, content: [{ type: 'text' as const, text: msg }], isError: true };
          }

          const text = await callChatCompletions(`${BASE_URL}/v1/chat/completions`, settings.localModel, filePath, question, {}, signal);
          return { text, content: [{ type: 'text' as const, text }], details: { backend: 'local', model: settings.localModel, filePath } };
        }

        // OpenRouter — resolve API key from the existing provider config
        const cloudModel = settings.cloudModel;
        const orModel = ctx.modelRegistry.find('openrouter', cloudModel);
        if (!orModel) {
          const msg = `OpenRouter model "${cloudModel}" is not configured in Pi. Add it via the model picker or update the model in the Video Probe page settings.`;
          return { text: msg, content: [{ type: 'text' as const, text: msg }], isError: true };
        }
        const auth = await ctx.modelRegistry.getApiKeyAndHeaders(orModel);
        if (!auth.ok || !auth.apiKey) {
          const msg = 'OpenRouter is not authenticated. Configure it via Settings → Providers.';
          return { text: msg, content: [{ type: 'text' as const, text: msg }], isError: true };
        }

        const text = await callChatCompletions(
          'https://openrouter.ai/api/v1/chat/completions',
          cloudModel,
          filePath,
          question,
          { Authorization: `Bearer ${auth.apiKey}`, ...(auth.headers ?? {}) },
          signal,
        );
        return { text, content: [{ type: 'text' as const, text }], details: { backend: 'openrouter', model: cloudModel, filePath } };
      },
    });
  };
}
