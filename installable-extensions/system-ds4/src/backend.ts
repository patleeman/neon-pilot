import { access, chmod, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { extractReadableHtml, parseDuckDuckGoHtml } from '@neon-pilot/extensions/backend/webContent';

const PROVIDER = 'ds4';
const MODEL_ID = 'deepseek-v4-flash';
const MODEL_REF = `${PROVIDER}/${MODEL_ID}`;
const BASE_URL = 'http://127.0.0.1:8000/v1';
const API_KEY = 'dsv4-local';
const DS4_REPO_URL = 'https://github.com/antirez/ds4.git';
const MODEL_VARIANT = 'q2-imatrix';
const MODEL_NAME = 'DeepSeek V4 Flash';
const MODEL_FILENAME = 'DeepSeek-V4-Flash-IQ2XXS-w2Q2K-AProjQ8-SExpQ8-OutQ8-chat-v2-imatrix.gguf';
const DS4_CORE_TOOLS = ['bash', 'read', 'edit'];
const BOOTSTRAP_PID_KEY = 'runtime/bootstrapPid';
const SERVER_PID_KEY = 'runtime/serverPid';
const SETTINGS_KEY = 'settings';
const DEFAULT_READ_LINES = 500;
const DEFAULT_SEARCH_RESULTS = 80;
const MAX_INLINE_TEXT_BYTES = 256 * 1024;
const RTK_AUTO_PREFIX_COMMANDS = new Set([
  'aws',
  'cargo',
  'cat',
  'curl',
  'docker',
  'find',
  'gh',
  'git',
  'go',
  'grep',
  'jest',
  'json',
  'kubectl',
  'ls',
  'npm',
  'pnpm',
  'pytest',
  'rg',
  'rspec',
  'ruff',
  'tail',
  'tree',
  'tsc',
  'vitest',
  'wget',
]);
const BOOTSTRAP_STEPS = [
  { id: 'tools', title: 'Check tools', progress: 8 },
  { id: 'source', title: 'Download source', progress: 22 },
  { id: 'build', title: 'Build ds4-server', progress: 42 },
  { id: 'model', title: 'Download model', progress: 82 },
  { id: 'verify', title: 'Verify install', progress: 95 },
  { id: 'done', title: 'Ready', progress: 100 },
] as const;

type ToolResult = { content?: Array<{ type?: string; text?: string }>; details?: unknown; isError?: boolean };
type Ds4Settings = {
  shellCompression: 'off' | 'rtk';
};
type ShellJob = {
  id: number;
  command: string;
  cwd: string;
  pid: number | null;
  startedAt: string;
  done: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
  output: string;
  readOffset: number;
  kill: () => void;
};

let nextJobId = 1;
const shellJobs = new Map<number, ShellJob>();

const DEFAULT_SETTINGS: Ds4Settings = {
  shellCompression: 'off',
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function normalizeSettings(value: unknown): Ds4Settings {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    shellCompression: record.shellCompression === 'rtk' ? 'rtk' : 'off',
  };
}

function syncRtkShellCompressionEnv(settings: Ds4Settings): void {
  process.env.NEON_PILOT_DS4_RTK_SHELL_COMPRESSION = settings.shellCompression;
}

async function readSettings(ctx: ExtensionBackendContext): Promise<Ds4Settings> {
  const settings = normalizeSettings(await ctx.storage.get(SETTINGS_KEY).catch(() => null));
  syncRtkShellCompressionEnv(settings);
  return settings;
}

async function writeSettings(ctx: ExtensionBackendContext, patch: unknown): Promise<Ds4Settings> {
  const current = await readSettings(ctx);
  const next = normalizeSettings({ ...current, ...(patch && typeof patch === 'object' ? (patch as Record<string, unknown>) : {}) });
  await ctx.storage.put(SETTINGS_KEY, next);
  syncRtkShellCompressionEnv(next);
  return next;
}

async function runtimePaths(ctx: ExtensionBackendContext) {
  const appRoot = await ctx.filesystem.app({
    access: ['read', 'write', 'delete', 'list', 'metadata'],
    reason: 'manage DS4 local runtime files',
  });
  const root = path.join(appRoot.root.path, 'runtime');
  const repoDir = path.join(root, 'ds4');
  return {
    root,
    repoDir,
    serverBin: path.join(repoDir, 'ds4-server'),
    modelPath: path.join(repoDir, 'gguf', MODEL_FILENAME),
    modelLink: path.join(repoDir, 'ds4flash.gguf'),
    kvDir: path.join(root, 'kv-cache'),
    bootstrapLog: path.join(root, 'bootstrap.log'),
    bootstrapStatus: path.join(root, 'bootstrap.status'),
    serverLog: path.join(root, 'server.log'),
  };
}

async function readTail(filePath: string, maxBytes = 30_000) {
  try {
    const text = await readFile(filePath, 'utf8');
    return text.length > maxBytes ? text.slice(-maxBytes) : text;
  } catch {
    return '';
  }
}

async function fileSize(filePath: string): Promise<number | null> {
  try {
    return (await stat(filePath)).size;
  } catch {
    return null;
  }
}

function parseBootstrapStatus(raw: string): {
  status: string;
  phase?: string;
  progress?: number;
  message?: string;
  updatedAt?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { status: 'idle' };
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const status = typeof parsed.status === 'string' ? parsed.status : 'running';
    const phase = typeof parsed.phase === 'string' ? parsed.phase : undefined;
    const progress = typeof parsed.progress === 'number' && Number.isFinite(parsed.progress) ? parsed.progress : undefined;
    const message = typeof parsed.message === 'string' ? parsed.message : undefined;
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined;
    return { status, ...(phase ? { phase } : {}), ...(progress !== undefined ? { progress } : {}), ...(message ? { message } : {}), ...(updatedAt ? { updatedAt } : {}) };
  } catch {
    return { status: trimmed };
  }
}

async function readStoredPid(ctx: ExtensionBackendContext, key: string) {
  const stored = await ctx.storage.get(key).catch(() => null);
  const pid = typeof stored === 'number' ? stored : Number(stored);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

async function isPidRunning(ctx: ExtensionBackendContext, pid: number | null) {
  if (!pid) return false;
  const result = await ctx.shell.exec({ command: 'sh', args: ['-c', `kill -0 ${pid} >/dev/null 2>&1 && echo yes || true`] });
  return result.stdout.trim() === 'yes';
}

async function readBootstrapState(ctx: ExtensionBackendContext, paths?: Awaited<ReturnType<typeof runtimePaths>>) {
  paths ??= await runtimePaths(ctx);
  const pid = await readStoredPid(ctx, BOOTSTRAP_PID_KEY);
  const running = await isPidRunning(ctx, pid);
  const parsed = parseBootstrapStatus(await readTail(paths.bootstrapStatus, 4096));
  const status = parsed.status === 'idle' && running ? 'running' : parsed.status;
  return {
    ...parsed,
    status,
    running,
    pid,
    steps: BOOTSTRAP_STEPS,
    log: await readTail(paths.bootstrapLog),
  };
}

async function readToolAvailability(ctx: ExtensionBackendContext) {
  const result = await ctx.shell.exec({
    command: 'sh',
    args: ['-c', 'for tool in git make curl cc; do if command -v "$tool" >/dev/null 2>&1; then printf "%s=ok\\n" "$tool"; else printf "%s=missing\\n" "$tool"; fi; done'],
  });
  return Object.fromEntries(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim().split('='))
      .filter((entry): entry is [string, string] => entry.length === 2 && Boolean(entry[0]))
      .map(([tool, state]) => [tool, state === 'ok']),
  ) as Record<string, boolean>;
}

async function readRtkAvailability(ctx: ExtensionBackendContext) {
  const result = await ctx.shell.exec({
    command: 'sh',
    args: [
      '-c',
      [
        'set +e',
        'path="$(command -v rtk 2>/dev/null)"',
        'if [ -z "$path" ]; then echo "installed=no"; exit 0; fi',
        'echo "installed=yes"',
        'echo "path=$path"',
        'version="$(rtk --version 2>&1 | head -n 1)"',
        'echo "version=$version"',
        'gain="$(rtk gain 2>&1 | head -n 3)"',
        'code=$?',
        'echo "gain_exit=$code"',
        'printf "gain=%s\\n" "$gain"',
      ].join('\n'),
    ],
  });
  const fields = Object.fromEntries(
    result.stdout
      .split(/\r?\n/)
      .map((line) => {
        const index = line.indexOf('=');
        return index < 0 ? null : [line.slice(0, index), line.slice(index + 1)];
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );
  const installed = fields.installed === 'yes';
  const gainExit = Number(fields.gain_exit);
  return {
    installed,
    valid: installed && gainExit === 0,
    path: fields.path || undefined,
    version: fields.version || undefined,
    gainPreview: fields.gain || undefined,
    error: installed && gainExit !== 0 ? fields.gain || 'rtk gain failed; this may be the wrong rtk package.' : undefined,
  };
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

async function waitForHealth(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let last = await readServerHealth();
  while (!last.reachable && Date.now() < deadline) {
    await delay(1000);
    last = await readServerHealth();
  }
  return last;
}

async function waitForPidExit(ctx: ExtensionBackendContext, pid: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while ((await isPidRunning(ctx, pid)) && Date.now() < deadline) {
    await delay(250);
  }
  return !(await isPidRunning(ctx, pid));
}

function toolRuntime(ctx: ExtensionBackendContext) {
  return {
    runtimeScope: ctx.runtimeScope,
    repoRoot: ctx.runtime.getRepoRoot(),
    modelRef: MODEL_REF,
  };
}

function textFrom(result: ToolResult): string {
  const text = result.content
    ?.map((entry) => (entry.type === 'text' || !entry.type ? (entry.text ?? '') : ''))
    .filter(Boolean)
    .join('\n');
  return text || JSON.stringify(result.details ?? result, null, 2);
}

async function callHostTool(name: string, input: unknown, ctx: ExtensionBackendContext) {
  const { invokeToolByName } = await import('@neon-pilot/extensions/backend/tools');
  const result = (await invokeToolByName({
    name,
    input,
    runtime: toolRuntime(ctx),
    toolContext: ctx.toolContext,
  })) as ToolResult;
  return {
    text: textFrom(result),
    content: result.content ?? [{ type: 'text' as const, text: textFrom(result) }],
    ...(result.details !== undefined ? { details: result.details } : {}),
    ...(result.isError ? { isError: true } : {}),
  };
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function cwdFor(ctx: ExtensionBackendContext): string {
  return ctx.toolContext?.cwd ?? ctx.runtime.getRepoRoot();
}

function trimLargeText(text: string): { text: string; truncated: boolean } {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= MAX_INLINE_TEXT_BYTES) return { text, truncated: false };
  let end = Math.min(text.length, MAX_INLINE_TEXT_BYTES);
  while (end > 0 && Buffer.byteLength(text.slice(0, end), 'utf8') > MAX_INLINE_TEXT_BYTES) end -= 1;
  return { text: `${text.slice(0, end)}\n\n[Truncated at ${MAX_INLINE_TEXT_BYTES} bytes]`, truncated: true };
}

function firstShellWord(command: string): string {
  return command.trim().match(/^[A-Za-z0-9._/-]+/)?.[0] ?? '';
}

function isSimpleShellCommand(command: string): boolean {
  return !/[|&;()<>`$\\\n]/.test(command);
}

function rtkWrappedShellSnippet(command: string): string {
  const trimmed = command.trim();
  return [
    'if command -v rtk >/dev/null 2>&1 && rtk gain >/dev/null 2>&1; then',
    `  exec rtk ${trimmed}`,
    'else',
    `  exec sh -lc ${shellQuote(trimmed)}`,
    'fi',
  ].join('\n');
}

function maybeWrapShellLaunchWithRtk(input: { command: string; args: string[]; env: NodeJS.ProcessEnv }) {
  if (input.env.NEON_PILOT_DS4_RTK_SHELL_COMPRESSION !== 'rtk') return { command: input.command, args: input.args };
  const command = input.command.trim();
  const args = input.args;
  const shellCommand =
    (path.basename(command) === 'sh' || path.basename(command) === 'bash') && args[0] === '-lc' && typeof args[1] === 'string'
      ? args[1]
      : [command, ...args].join(' ');
  const trimmed = shellCommand.trim();
  const firstWord = firstShellWord(trimmed);
  if (!firstWord || path.basename(firstWord) === 'rtk') return { command: input.command, args: input.args };
  if (!isSimpleShellCommand(trimmed)) return { command: input.command, args: input.args };
  if (!RTK_AUTO_PREFIX_COMMANDS.has(path.basename(firstWord))) return { command: input.command, args: input.args };
  return { command: 'sh', args: ['-lc', rtkWrappedShellSnippet(trimmed)] };
}

async function maybeWrapWithRtk(command: string, ctx: ExtensionBackendContext): Promise<{ command: string; wrapped: boolean; reason?: string }> {
  const settings = await readSettings(ctx);
  if (settings.shellCompression !== 'rtk') return { command, wrapped: false, reason: 'disabled' };
  const availability = await readRtkAvailability(ctx);
  if (!availability.valid) return { command, wrapped: false, reason: availability.error ?? 'rtk unavailable' };
  const trimmed = command.trim();
  const firstWord = firstShellWord(trimmed);
  if (!firstWord || path.basename(firstWord) === 'rtk') return { command, wrapped: false, reason: 'already rtk' };
  if (!isSimpleShellCommand(trimmed)) return { command, wrapped: false, reason: 'complex shell command' };
  if (!RTK_AUTO_PREFIX_COMMANDS.has(path.basename(firstWord))) return { command, wrapped: false, reason: 'unsupported command' };
  return { command: `rtk ${trimmed}`, wrapped: true };
}

function readKey(ctx: ExtensionBackendContext): string {
  const id = ctx.toolContext?.conversationId ?? ctx.toolContext?.sessionId ?? 'global';
  return `read-state:${id}`;
}

async function rememberRead(ctx: ExtensionBackendContext, input: { path: string; startLine: number; count: number; whole?: boolean }) {
  if (input.whole) {
    await ctx.storage.delete(readKey(ctx));
    return;
  }
  await ctx.storage.put(readKey(ctx), {
    path: input.path,
    nextLine: input.startLine + input.count,
    count: input.count,
  });
}

export async function installProvider(_input: unknown, ctx: ExtensionBackendContext) {
  await ctx.models.saveProvider({
    provider: PROVIDER,
    baseUrl: BASE_URL,
    api: 'openai-completions',
    apiKey: API_KEY,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: true,
      supportsUsageInStreaming: true,
      maxTokensField: 'max_tokens',
      supportsStrictMode: false,
      thinkingFormat: 'deepseek',
      requiresReasoningContentOnAssistantMessages: true,
    },
  });
  const state = await ctx.models.saveProviderModel({
    provider: PROVIDER,
    modelId: MODEL_ID,
    name: MODEL_NAME,
    reasoning: true,
    input: ['text'],
    contextWindow: 100000,
    maxTokens: 384000,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
  });
  return { ok: true, provider: PROVIDER, model: MODEL_REF, state };
}

export async function status(_input: unknown, ctx: ExtensionBackendContext) {
  const paths = await runtimePaths(ctx);
  const [repoInstalled, serverInstalled, modelInstalled, modelBytes, bootstrap, serverPid, server, tools, settings, rtk] = await Promise.all([
    exists(path.join(paths.repoDir, '.git')),
    exists(paths.serverBin),
    exists(paths.modelPath),
    fileSize(paths.modelPath),
    readBootstrapState(ctx, paths),
    readStoredPid(ctx, SERVER_PID_KEY),
    readServerHealth(),
    readToolAvailability(ctx),
    readSettings(ctx),
    readRtkAvailability(ctx),
  ]);
  const managedRunning = await isPidRunning(ctx, serverPid);
  return {
    ok: true,
    reachable: server.reachable,
    baseUrl: BASE_URL,
    models: server.models,
    runtime: {
      managedRoot: paths.root,
      repoUrl: DS4_REPO_URL,
      repoDir: paths.repoDir,
      repoInstalled,
      serverInstalled,
      serverPath: paths.serverBin,
      modelVariant: MODEL_VARIANT,
      modelInstalled,
      modelPath: paths.modelPath,
      modelBytes,
      installed: serverInstalled && modelInstalled,
      tools,
      rtk,
    },
    settings,
    bootstrap,
    server: {
      ...server,
      managedPid: serverPid,
      managedRunning,
      log: await readTail(paths.serverLog),
    },
  };
}

export async function discover(_input: unknown, ctx: ExtensionBackendContext) {
  return {
    provider: PROVIDER,
    baseUrl: BASE_URL,
    api: 'openai-completions',
    apiKey: API_KEY,
    models: [
      {
        id: MODEL_ID,
        name: MODEL_NAME,
        reasoning: true,
        input: ['text'],
        contextWindow: 100000,
      },
    ],
  };
}

export async function getSettings(_input: unknown, ctx: ExtensionBackendContext) {
  return { ok: true, settings: await readSettings(ctx), status: await status({}, ctx) };
}

export async function saveSettings(input: unknown, ctx: ExtensionBackendContext) {
  const settings = await writeSettings(ctx, input);
  return { ok: true, settings, status: await status({}, ctx) };
}

export async function runtimeService() {
  return { ok: true };
}

export async function runtimeServiceHealth() {
  return { running: true };
}

export async function bootstrapRuntime(input: { force?: unknown; start?: unknown }, ctx: ExtensionBackendContext) {
  const paths = await runtimePaths(ctx);
  await mkdir(paths.root, { recursive: true });
  const running = await readBootstrapState(ctx, paths);
  if (running.running) return { ok: true, started: false, bootstrap: running, status: await status({}, ctx) };

  const force = input.force === true;
  if (!force && (await exists(paths.serverBin)) && (await exists(paths.modelPath))) {
    if (input.start !== false) await startServer({}, ctx);
    return { ok: true, started: false, cached: true, status: await status({}, ctx) };
  }

  const script = `set -euo pipefail
mkdir -p ${shellQuote(paths.root)} ${shellQuote(path.dirname(paths.modelPath))} ${shellQuote(paths.kvDir)}
write_status() {
  status="$1"
  phase="$2"
  progress="$3"
  message="$4"
  now="$(date -u +%FT%TZ)"
  printf '{"status":"%s","phase":"%s","progress":%s,"message":"%s","updatedAt":"%s"}' "$status" "$phase" "$progress" "$message" "$now" > ${shellQuote(paths.bootstrapStatus)}
}
write_status running tools 2 "Checking required local tools"
{
  echo "[$(date -u +%FT%TZ)] Preparing DS4 runtime in ${paths.root}"
  missing=""
  for tool in git make curl cc; do
    if command -v "$tool" >/dev/null 2>&1; then
      echo "[$(date -u +%FT%TZ)] Tool available: $tool"
    else
      echo "[$(date -u +%FT%TZ)] Missing required tool: $tool"
      missing="$missing $tool"
    fi
  done
  if [ -n "$missing" ]; then
    write_status failed tools 2 "Missing required tools:$missing"
    echo "Install the missing tools, then run setup again. On macOS, xcode-select --install provides make and cc; curl and git are normally provided by Command Line Tools or Homebrew."
    exit 1
  fi
  write_status running source 8 "Preparing ds4 source checkout"
  if [ ! -d ${shellQuote(path.join(paths.repoDir, '.git'))} ]; then
    rm -rf ${shellQuote(paths.repoDir)}
    echo "[$(date -u +%FT%TZ)] Cloning ${DS4_REPO_URL}"
    git clone --depth 1 ${shellQuote(DS4_REPO_URL)} ${shellQuote(paths.repoDir)}
  else
    echo "[$(date -u +%FT%TZ)] Updating existing ds4 checkout"
    git -C ${shellQuote(paths.repoDir)} fetch --depth 1 origin main
    git -C ${shellQuote(paths.repoDir)} reset --hard origin/main
  fi
  write_status running build 22 "Building ds4-server"
  make -C ${shellQuote(paths.repoDir)} -j"$(sysctl -n hw.ncpu 2>/dev/null || echo 4)"
  if [ ${force ? '1' : '0'} -eq 1 ] || [ ! -f ${shellQuote(paths.modelPath)} ]; then
    write_status running model 42 "Downloading DeepSeek V4 Flash model (~81 GB)"
    echo "[$(date -u +%FT%TZ)] Downloading model variant ${MODEL_VARIANT}. This is roughly 81 GB and may take a long time."
    cd ${shellQuote(paths.repoDir)}
    ./download_model.sh ${shellQuote(MODEL_VARIANT)}
  else
    write_status running model 82 "Model file already present; offline setup can reuse it"
    echo "[$(date -u +%FT%TZ)] Model file already exists; skipping download"
  fi
  write_status running verify 95 "Verifying DS4 runtime files"
  test -x ${shellQuote(paths.serverBin)}
  test -f ${shellQuote(paths.modelPath)}
  write_status succeeded done 100 "DS4 runtime ready"
  echo "[$(date -u +%FT%TZ)] DS4 runtime ready"
} >> ${shellQuote(paths.bootstrapLog)} 2>&1 || {
  if ! grep -q '"status":"failed"' ${shellQuote(paths.bootstrapStatus)} 2>/dev/null; then
    write_status failed failed 0 "DS4 setup failed; open the bootstrap log for details"
  fi
  exit 1
}
`;
  const result = await ctx.shell.exec({
    command: 'sh',
    args: ['-c', `nohup sh -c ${shellQuote(script)} >/dev/null 2>&1 & echo $!`],
  });
  const pid = Number(result.stdout.trim());
  await ctx.storage.put(BOOTSTRAP_PID_KEY, pid);
  return { ok: true, started: true, pid, status: await status({}, ctx) };
}

export async function startServer(input: { timeoutMs?: unknown }, ctx: ExtensionBackendContext) {
  const paths = await runtimePaths(ctx);
  const health = await readServerHealth();
  if (health.reachable) return { ok: true, alreadyRunning: true, status: await status({}, ctx) };

  if (!(await exists(paths.serverBin)) || !(await exists(paths.modelPath))) {
    throw new Error('DS4 is not installed yet. Run ds4BootstrapRuntime first; it clones ds4, builds ds4-server, and downloads the GGUF model.');
  }

  const pid = await readStoredPid(ctx, SERVER_PID_KEY);
  if (await isPidRunning(ctx, pid)) return { ok: true, starting: true, status: await status({}, ctx) };

  await mkdir(paths.kvDir, { recursive: true });
  await chmod(paths.serverBin, 0o755).catch(() => undefined);
  const command = `cd ${shellQuote(paths.repoDir)} && exec ${shellQuote(paths.serverBin)} --ctx 100000 --kv-disk-dir ${shellQuote(paths.kvDir)} --kv-disk-space-mb 8192 >> ${shellQuote(paths.serverLog)} 2>&1`;
  const result = await ctx.shell.exec({
    command: 'sh',
    args: ['-c', `nohup sh -c ${shellQuote(command)} >/dev/null 2>&1 & echo $!`],
  });
  const serverPid = Number(result.stdout.trim());
  await ctx.storage.put(SERVER_PID_KEY, serverPid);
  const timeoutMs = typeof input.timeoutMs === 'number' && Number.isFinite(input.timeoutMs) ? Math.max(0, Math.floor(input.timeoutMs)) : 60_000;
  const nextHealth = timeoutMs > 0 ? await waitForHealth(timeoutMs) : await readServerHealth();
  if (!nextHealth.reachable) {
    const log = (await readTail(paths.serverLog, 4000)).trim();
    throw new Error(
      [
        `DS4 server did not become reachable at ${BASE_URL}.`,
        nextHealth.error ? `Health check: ${nextHealth.error}` : undefined,
        log ? `Server log:\n${log}` : `Server log is empty at ${paths.serverLog}.`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
  }
  return { ok: true, started: true, pid: serverPid, status: await status({}, ctx) };
}

export async function stopServer(_input: unknown, ctx: ExtensionBackendContext) {
  const pid = await readStoredPid(ctx, SERVER_PID_KEY);
  if (!(await isPidRunning(ctx, pid))) return { ok: true, stopped: false, status: await status({}, ctx) };
  await ctx.shell.exec({ command: 'sh', args: ['-c', `kill -TERM ${pid} >/dev/null 2>&1 || true`] });
  const exited = pid ? await waitForPidExit(ctx, pid, 10_000) : true;
  if (!exited) {
    ctx.log.warn('ds4-server did not exit after SIGTERM; sending SIGKILL', { pid });
    await ctx.shell.exec({ command: 'sh', args: ['-c', `kill -KILL ${pid} >/dev/null 2>&1 || true`] });
    await waitForPidExit(ctx, pid, 2_000);
  }
  await ctx.storage.put(SERVER_PID_KEY, 0);
  return { ok: true, stopped: true, pid, graceful: exited, status: await status({}, ctx) };
}

export async function revealRuntimeFolder(_input: unknown, ctx: ExtensionBackendContext) {
  const paths = await runtimePaths(ctx);
  await mkdir(paths.root, { recursive: true });
  await ctx.shell.exec({ command: 'open', args: [paths.root] });
  return { ok: true, path: paths.root };
}

export async function revealModelFile(_input: unknown, ctx: ExtensionBackendContext) {
  const paths = await runtimePaths(ctx);
  const target = (await exists(paths.modelPath)) ? paths.modelPath : path.dirname(paths.modelPath);
  await mkdir(path.dirname(paths.modelPath), { recursive: true });
  await ctx.shell.exec({ command: 'open', args: ['-R', target] });
  return { ok: true, path: target };
}

export async function clearKvCache(_input: unknown, ctx: ExtensionBackendContext) {
  const paths = await runtimePaths(ctx);
  await rm(paths.kvDir, { recursive: true, force: true });
  await mkdir(paths.kvDir, { recursive: true });
  return { ok: true, path: paths.kvDir, status: await status({}, ctx) };
}

function formatJobUpdate(job: ShellJob, options: { stopped?: boolean } = {}) {
  const newOutput = job.output.slice(job.readOffset);
  job.readOffset = job.output.length;
  const lines = [
    `bash job=${job.id} pid=${job.pid ?? 'unknown'} ${job.done ? 'finished' : options.stopped ? 'stopped' : 'running'}`,
    `command: ${job.command}`,
  ];
  if (job.done) lines.push(`exit: ${job.signal ? `signal ${job.signal}` : job.code ?? 'unknown'}`);
  lines.push('', newOutput.trimEnd() || '(no new output)');
  if (!job.done) lines.push('', `Use bash_status job=${job.id} to get new output; use bash_stop job=${job.id} to stop execution.`);
  return {
    text: lines.join('\n'),
    content: [{ type: 'text' as const, text: lines.join('\n') }],
    details: { job: job.id, pid: job.pid, running: !job.done, command: job.command, cwd: job.cwd },
  };
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function bash(input: { command?: unknown; timeout_sec?: unknown; refresh_sec?: unknown }, ctx: ExtensionBackendContext) {
  const command = stringValue(input.command);
  if (!command) throw new Error('command is required.');
  const rtk = await maybeWrapWithRtk(command, ctx);
  const refreshSeconds = numeric(input.refresh_sec);
  if (refreshSeconds !== undefined) {
    const cwd = cwdFor(ctx);
    const id = nextJobId++;
    let output = '';
    const handle = await ctx.shell.spawn({
      command: 'sh',
      args: ['-lc', rtk.command],
      cwd,
      onStdout: (chunk) => {
        output += chunk;
        const job = shellJobs.get(id);
        if (job) job.output = output;
      },
      onStderr: (chunk) => {
        output += chunk;
        const job = shellJobs.get(id);
        if (job) job.output = output;
      },
      onExit: ({ code, signal }) => {
        const job = shellJobs.get(id);
        if (!job) return;
        job.done = true;
        job.code = code;
        job.signal = signal;
        job.output = output;
      },
    });
    const job: ShellJob = {
      id,
      command: rtk.command,
      cwd,
      pid: handle.pid,
      startedAt: new Date().toISOString(),
      done: false,
      code: null,
      signal: null,
      output,
      readOffset: 0,
      kill: handle.kill,
    };
    shellJobs.set(id, job);
    await delay(Math.min(Math.floor(refreshSeconds * 1000), 30_000));
    job.output = output;
    return formatJobUpdate(job);
  }
  return callHostTool(
    'bash',
    {
      command: rtk.command,
      ...(numeric(input.timeout_sec) ? { timeout: numeric(input.timeout_sec) } : {}),
    },
    ctx,
  );
}

function readJob(input: { job?: unknown }): ShellJob {
  const id = Math.floor(numeric(input.job) ?? 0);
  const job = shellJobs.get(id);
  if (!job) throw new Error(`bash job not found: job=${id}`);
  return job;
}

export async function bash_status(input: { job?: unknown; refresh_sec?: unknown }, _ctx: ExtensionBackendContext) {
  const job = readJob(input);
  const refreshSeconds = numeric(input.refresh_sec);
  if (!job.done && refreshSeconds !== undefined) {
    await delay(Math.min(Math.floor(refreshSeconds * 1000), 30_000));
  }
  return formatJobUpdate(job);
}

export async function bash_stop(input: { job?: unknown }, _ctx: ExtensionBackendContext) {
  const job = readJob(input);
  if (!job.done) {
    job.kill();
    await delay(100);
  }
  return formatJobUpdate(job, { stopped: true });
}

export async function read(
  input: { path?: unknown; start_line?: unknown; max_lines?: unknown; whole?: unknown; raw?: unknown },
  ctx: ExtensionBackendContext,
) {
  const path = stringValue(input.path);
  if (!path) throw new Error('path is required.');
  const startLine = Math.floor(numeric(input.start_line) ?? 1);
  const count = Math.floor(numeric(input.max_lines) ?? DEFAULT_READ_LINES);
  const whole = input.whole === true;
  if (booleanValue(input.raw)) {
    const root = await ctx.filesystem.workspace({ cwd: cwdFor(ctx), access: ['read'], reason: 'DS4 raw file read' });
    const raw = await root.readText(path, { maxBytes: MAX_INLINE_TEXT_BYTES + 1 });
    const lines = raw.split(/\r?\n/);
    const selected = whole ? raw : lines.slice(Math.max(0, startLine - 1), Math.max(0, startLine - 1) + count).join('\n');
    const formatted = trimLargeText(selected);
    await rememberRead(ctx, { path, startLine, count, whole });
    return { text: formatted.text, content: [{ type: 'text' as const, text: formatted.text }], details: { path, raw: true, truncated: formatted.truncated } };
  }
  const result = await callHostTool(
    'read',
    {
      path,
      ...(whole ? {} : { offset: startLine, limit: count }),
    },
    ctx,
  );
  await rememberRead(ctx, { path, startLine, count, whole });
  return result;
}

export async function more(input: { count?: unknown }, ctx: ExtensionBackendContext) {
  const state = await ctx.storage.get<{ path?: string; nextLine?: number; count?: number }>(readKey(ctx));
  const path = stringValue(state?.path);
  if (!path) throw new Error('No previous read is available for this conversation.');
  const count = Math.floor(numeric(input.count) ?? numeric(state?.count) ?? DEFAULT_READ_LINES);
  const startLine = Math.floor(numeric(state?.nextLine) ?? 1);
  const result = await callHostTool('read', { path, offset: startLine, limit: count }, ctx);
  await rememberRead(ctx, { path, startLine, count });
  return result;
}

export async function write(input: { path?: unknown; content?: unknown }, ctx: ExtensionBackendContext) {
  const path = stringValue(input.path);
  if (!path) throw new Error('path is required.');
  if (typeof input.content !== 'string') throw new Error('content is required.');
  return callHostTool('write', { path, content: input.content }, ctx);
}

export async function edit(input: { path?: unknown; old?: unknown; new?: unknown }, ctx: ExtensionBackendContext) {
  const path = stringValue(input.path);
  if (!path) throw new Error('path is required.');
  if (typeof input.old !== 'string') throw new Error('old is required.');
  if (typeof input.new !== 'string') throw new Error('new is required.');
  if (input.old.includes('[upto]')) {
    const root = await ctx.filesystem.workspace({ cwd: cwdFor(ctx), access: ['read', 'write'], reason: 'DS4 anchor edit' });
    const original = await root.readText(path, { maxBytes: MAX_INLINE_TEXT_BYTES + 1 });
    const parts = input.old.split('[upto]');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('old with [upto] must include non-empty unique head and tail anchors.');
    }
    const [head, tail] = parts as [string, string];
    const headIndex = original.indexOf(head);
    if (headIndex < 0 || original.indexOf(head, headIndex + head.length) >= 0) {
      throw new Error('old [upto] head anchor must match exactly once.');
    }
    const tailIndex = original.indexOf(tail, headIndex + head.length);
    if (tailIndex < 0 || original.indexOf(tail, tailIndex + tail.length) >= 0) {
      throw new Error('old [upto] tail anchor must match exactly once after the head anchor.');
    }
    const endIndex = tailIndex + tail.length;
    const updated = `${original.slice(0, headIndex)}${input.new}${original.slice(endIndex)}`;
    await root.writeText(path, updated);
    const text = `Edited ${path} with [upto] anchor replacement.`;
    return { text, content: [{ type: 'text' as const, text }], details: { path, replaced: true, upto: true } };
  }
  return callHostTool('edit', { path, edits: [{ oldText: input.old, newText: input.new }] }, ctx);
}

export async function search(
  input: {
    query?: unknown;
    path?: unknown;
    mode?: unknown;
    glob?: unknown;
    context?: unknown;
    max_results?: unknown;
    case_sensitive?: unknown;
  },
  ctx: ExtensionBackendContext,
) {
  const query = stringValue(input.query);
  if (!query) throw new Error('query is required.');
  const args = ['--line-number', '--with-filename', '--no-heading', '--color', 'never'];
  const contextLines = numeric(input.context);
  if (contextLines !== undefined) args.push('--context', String(Math.floor(contextLines)));
  if (input.case_sensitive !== true) args.push('--ignore-case');
  if (input.mode === 'literal') args.push('--fixed-strings');
  const glob = stringValue(input.glob);
  if (glob) args.push('--glob', glob);
  args.push(query, stringValue(input.path) ?? '.');

  try {
    const result = await ctx.shell.exec({
      command: 'rg',
      args,
      cwd: ctx.toolContext?.cwd ?? ctx.runtime.getRepoRoot(),
      timeoutMs: 30_000,
      maxBuffer: 512_000,
    });
    const maxResults = Math.floor(numeric(input.max_results) ?? DEFAULT_SEARCH_RESULTS);
    const lines = result.stdout.split('\n').filter(Boolean);
    const shown = lines.slice(0, maxResults);
    const suffix = lines.length > shown.length ? `\n... ${lines.length - shown.length} more matches truncated.` : '';
    const text = shown.length ? `${shown.join('\n')}${suffix}` : 'No matches.';
    return { text, content: [{ type: 'text' as const, text }], details: { command: 'rg', args, matches: lines.length } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/exit code 1|No such file|No matches/i.test(message)) {
      return { text: 'No matches.', content: [{ type: 'text' as const, text: 'No matches.' }], details: { command: 'rg', args } };
    }
    throw error;
  }
}

export async function list(input: { path?: unknown }, ctx: ExtensionBackendContext) {
  const target = stringValue(input.path);
  if (!target) throw new Error('path is required.');
  const root = await ctx.filesystem.workspace({ cwd: cwdFor(ctx), access: ['list', 'metadata'], reason: 'DS4 directory list' });
  const entries = await root.list(target, { depth: 0 });
  const rows = entries
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const kind = entry.type === 'directory' ? 'dir ' : entry.type === 'symlink' ? 'link' : 'file';
      const size = entry.type === 'file' ? (entry.size ?? null) : null;
      return `${kind} ${size === null ? ''.padStart(9) : String(size).padStart(9)} ${entry.name}${entry.type === 'directory' ? '/' : ''}`;
    });
  const text = rows.length ? rows.join('\n') : '(empty directory)';
  return { text, content: [{ type: 'text' as const, text }], details: { path: target, count: rows.length } };
}

export async function google_search(input: { query?: unknown; count?: unknown; page?: unknown }, ctx: ExtensionBackendContext) {
  const query = stringValue(input.query);
  if (!query) throw new Error('query is required.');
  const page = Math.max(1, Math.floor(numeric(input.page) ?? 1));
  const maxResults = Math.min(Math.max(Math.floor(numeric(input.count) ?? 5), 1), 20);
  const offset = (page - 1) * 20;
  const params = new URLSearchParams({ q: query });
  if (offset > 0) {
    params.set('s', String(offset));
    params.set('dc', String(offset + 1));
  }
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml',
  };
  const response = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Search failed: HTTP ${response.status}`);
  let results = await parseDuckDuckGoHtml({ html: await response.text(), maxResults }, ctx);
  if (results.length === 0) {
    const lite = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ q: query }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!lite.ok) throw new Error(`Search failed: HTTP ${lite.status}`);
    results = await parseDuckDuckGoHtml({ html: await lite.text(), maxResults }, ctx);
  }
  const start = offset + 1;
  const text = results.length
    ? `Search | Page ${page} | Results ${start}-${start + results.length - 1}\n\n${results
        .map((result, index) => `--- Result ${start + index} ---\nTitle: ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet}`)
        .join('\n\n')}`
    : `No results found for: ${query}`;
  return { text, content: [{ type: 'text' as const, text }], details: { query, page, count: results.length, source: 'duckduckgo' } };
}

export async function visit_page(input: { url?: unknown; raw?: unknown }, ctx: ExtensionBackendContext) {
  const url = stringValue(input.url);
  if (!url) throw new Error('url is required.');
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Page fetch failed: HTTP ${response.status}`);
  const body = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const text =
    booleanValue(input.raw) || !contentType.includes('html') ? body : (await extractReadableHtml({ html: body, url }, ctx)).markdown;
  const formatted = trimLargeText(text);
  return { text: formatted.text, content: [{ type: 'text' as const, text: formatted.text }], details: { url, contentType, truncated: formatted.truncated } };
}

export async function optimizePromptAssembly(input: { plan?: unknown; context?: { modelRef?: string; provider?: string } }) {
  const plan = input.plan as
    | {
        skills?: { skillPaths?: string[]; inlineSkills?: unknown[]; diagnostics?: unknown[] };
        tools?: { activeToolNames?: string[]; diagnostics?: unknown[] };
        instructions?: { layers?: Array<Record<string, unknown>>; diagnostics?: unknown[] };
        diagnostics?: Array<Record<string, unknown>>;
      }
    | undefined;
  const modelRef = input.context?.modelRef ?? '';
  const isDs4 = input.context?.provider === PROVIDER || modelRef === MODEL_REF || modelRef.startsWith(`${PROVIDER}/`);
  if (!plan || !isDs4) return { plan };

  if (plan.skills) {
    const ds4SkillPaths = (plan.skills.skillPaths ?? []).filter((skillPath) => skillPath.includes('system-ds4'));
    plan.skills = { ...plan.skills, skillPaths: ds4SkillPaths, inlineSkills: [] };
  }
  if (plan.tools?.activeToolNames) {
    plan.tools = { ...plan.tools, activeToolNames: plan.tools.activeToolNames.filter((tool) => DS4_CORE_TOOLS.includes(tool)) };
  }
  if (plan.instructions?.layers) {
    const compacted = plan.instructions.layers.map((layer) => {
      const id = typeof layer.id === 'string' ? layer.id : '';
      const title = typeof layer.title === 'string' ? layer.title : 'Instruction layer';
      const source = layer.source && typeof layer.source === 'object' ? (layer.source as Record<string, unknown>) : {};
      const label = typeof source.label === 'string' ? source.label : title;
      const isGlobalAgents = id.startsWith('agents:') || title === 'AGENTS.md';
      if (!isGlobalAgents) return layer;
      return {
        ...layer,
        content: [
          `## ${title}`,
          '',
          `Full instructions are available at ${label}.`,
          'For DS4, keep only the local repo instructions in working memory. Read this file only when the task depends on broader global workflow policy.',
        ].join('\n'),
      };
    });
    plan.instructions = { ...plan.instructions, layers: compacted };
  }
  plan.diagnostics = [
    ...(plan.diagnostics ?? []),
    {
      severity: 'info',
      code: 'ds4-progressive-disclosure',
      message: 'DS4 prompt assembly reduced to core tools, the DS4 skill, and pointer-style global instructions.',
      sourceId: 'system-ds4',
    },
  ];
  return { plan };
}

export function createDs4AgentExtension(): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    const cliBinDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bin');
    const maybeWrapperApi = pi as ExtensionAPI & {
      registerBashProcessWrapper?: (
        id: string,
        wrap: (context: {
          command: string;
          args: string[];
          cwd?: string;
          env: NodeJS.ProcessEnv;
          shell?: boolean;
          wrappers: Array<{ id: string; label?: string }>;
        }) => {
          command: string;
          args: string[];
          cwd?: string;
          env: NodeJS.ProcessEnv;
          shell?: boolean;
          wrappers: Array<{ id: string; label?: string }>;
        },
        options?: { label?: string },
      ) => void;
    };
    maybeWrapperApi.registerBashProcessWrapper?.(
      'system-ds4-cli',
      (context) => {
        const env = {
          ...context.env,
          PATH: `${cliBinDir}${path.delimiter}${context.env.PATH ?? ''}`,
          DS4_CLI_BIN: path.join(cliBinDir, 'ds4'),
        };
        const launch = maybeWrapShellLaunchWithRtk({ command: context.command, args: context.args, env });
        return {
          ...context,
          ...launch,
          env,
        };
      },
      { label: 'DS4 CLI' },
    );

    const activate = (ctx: {
      modelProfile?: { kind?: string; profile?: { id?: string; extensionId?: string } };
      getActiveTools?: () => string[];
      setActiveTools?: (toolNames: string[]) => void;
    }) => {
      if (ctx.modelProfile?.kind !== 'resolved' || ctx.modelProfile.profile?.id !== 'ds4-compatible') {
        return;
      }
      ctx.setActiveTools?.(DS4_CORE_TOOLS);
    };

    pi.on('session_start', (_event, ctx) => activate(ctx));
    pi.on('model_select', (_event, ctx) => activate(ctx));
  };
}
