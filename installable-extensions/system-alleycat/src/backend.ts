import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

import { createCodexAuth } from './codexAuth.js';

let codexServer: Awaited<ReturnType<typeof import('./codexJsonRpcServer.js').createCodexServer>> | null = null;
let codexAuth: ReturnType<typeof createCodexAuth> | null = null;
let pairPayloadCache: AlleycatPairPayload | null = null;
let sidecarProcess: { pid: number | null; kill: () => Promise<void> | void } | null = null;
let sidecarPid: number | null = null;
let sidecarLogPath: string | null = null;
let sidecarLogs: string[] = [];
let startPromise: Promise<AlleycatStatus> | null = null;
let sidecarStopReason: string | null = null;

const DEFAULT_COMPAT_PORT = 3850;
const SECRET_KEY = 'alleycat-secret-key';
const STABLE_IDENTITY_FILE = 'kitty-litter-alleycat/identity.json';
const SIDECAR_READY_TIMEOUT_MS = 30_000;
const SIDECAR_PROCESS_NAME = 'neon-pilot-alleycat-host';

export interface AlleycatPairPayload {
  v: 1;
  node_id: string;
  token: string;
  relay: string | null;
  host_name?: string | null;
}

export interface AlleycatAgentInfo {
  name: 'neon-pilot';
  display_name: 'Neon Pilot';
  wire: 'jsonl';
  available: boolean;
  presentation: {
    title: 'Neon Pilot';
    is_beta: boolean;
    sort_order: number;
    description: string;
    aliases: string[];
  };
  capabilities: {
    locks_reasoning_effort_after_activity: boolean;
    supports_ssh_bridge: boolean;
    uses_direct_codex_port: boolean;
  };
}

export interface AlleycatStatus {
  running: boolean;
  port: number | null;
  pairPayload: AlleycatPairPayload | null;
  agents: AlleycatAgentInfo[];
  implementation: 'iroh-sidecar' | 'codex-jsonrpc-compat';
  sidecarRunning: boolean;
  logs: string[];
  note: string;
}

function neonPilotInfo(available: boolean): AlleycatAgentInfo {
  return {
    name: 'neon-pilot',
    display_name: 'Neon Pilot',
    wire: 'jsonl',
    available,
    presentation: {
      title: 'Neon Pilot',
      is_beta: true,
      sort_order: 0,
      description: 'Neon Pilot conversations exposed to Kitty Litter.',
      aliases: ['pa', 'personalagent'],
    },
    capabilities: {
      locks_reasoning_effort_after_activity: false,
      supports_ssh_bridge: false,
      uses_direct_codex_port: false,
    },
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function stripAnsiEscapes(value: string): string {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code !== 27) {
      output += value[index];
      continue;
    }

    const next = value[index + 1];
    if (next === '[') {
      index += 2;
      while (index < value.length) {
        const terminator = value.charCodeAt(index);
        if (terminator >= 0x40 && terminator <= 0x7e) break;
        index += 1;
      }
      continue;
    }

    if (next === ']') {
      index += 2;
      while (index < value.length) {
        const current = value.charCodeAt(index);
        if (current === 7) break;
        if (current === 27 && value[index + 1] === '\\') {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    index += 1;
  }
  return output;
}

function redactSensitiveLogLine(line: string): string {
  try {
    const event = JSON.parse(line) as { type?: string; pairPayload?: AlleycatPairPayload };
    if (event.type === 'ready' && event.pairPayload) {
      return JSON.stringify({ ...event, pairPayload: { ...event.pairPayload, token: '<redacted>' } });
    }
  } catch {
    // Plain text log line; handle with regex below.
  }
  return line.replace(/("token"\s*:\s*")([^"]+)(")/g, '$1<redacted>$3');
}

function appendSidecarOutput(chunk: Buffer): void {
  for (const line of chunk.toString('utf8').split('\n')) {
    try {
      const event = JSON.parse(line) as { type?: string; pairPayload?: AlleycatPairPayload };
      if (event.type === 'ready' && event.pairPayload) pairPayloadCache = event.pairPayload;
    } catch {
      // Non-JSON sidecar log line.
    }
    rememberLog(line);
  }
}

function rememberLog(line: string): void {
  const trimmed = stripAnsiEscapes(redactSensitiveLogLine(line)).trim();
  if (!trimmed) return;
  sidecarLogs.push(trimmed);
  if (sidecarLogs.length > 200) sidecarLogs = sidecarLogs.slice(-200);
  if (sidecarLogPath) {
    try {
      appendFileSync(sidecarLogPath, `${trimmed}\n`);
    } catch {
      // Best-effort diagnostics only.
    }
  }
}

function sidecarBinaryPath(): { binary: string | null; searched: string[] } {
  if (process.env.NEON_PILOT_ALLEYCAT_SIDECAR) return { binary: process.env.NEON_PILOT_ALLEYCAT_SIDECAR, searched: [] };
  const here = dirname(fileURLToPath(import.meta.url));
  const platform = process.platform === 'darwin' ? 'macos' : process.platform;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const binaryName = `neon-pilot-alleycat-host-${platform}-${arch}`;
  const roots = [process.env.NEON_PILOT_REPO_ROOT, process.cwd()].filter((root): root is string => Boolean(root));
  const candidates = [
    // Built/imported extension packages copy static binaries into dist/bin.
    join(here, 'bin', binaryName),
    // Source-tree development keeps binaries at extension-root/bin while backend.mjs is in dist/.
    join(here, '..', 'bin', binaryName),
    // Dev backend builds may run from a cache directory, so import.meta.url is
    // not always under the extension package. Search the repo checkout too.
    ...roots.flatMap((root) => [
      join(root, 'extensions', 'system-alleycat', 'dist', 'bin', binaryName),
      join(root, 'extensions', 'system-alleycat', 'bin', binaryName),
    ]),
  ];
  return { binary: candidates.find((candidate) => existsSync(candidate)) ?? null, searched: [...new Set(candidates)] };
}

async function ensureSecretKey(ctx: ExtensionBackendContext): Promise<string> {
  const stablePath = join(ctx.runtimeDir, STABLE_IDENTITY_FILE);
  try {
    if (existsSync(stablePath)) {
      const parsed = JSON.parse(readFileSync(stablePath, 'utf8')) as { secretKey?: unknown };
      if (typeof parsed.secretKey === 'string' && parsed.secretKey.trim()) return parsed.secretKey;
    }
  } catch {
    // Regenerate below if the file is corrupt.
  }

  const existing = await ctx.storage.get<string>(SECRET_KEY).catch(() => null);
  const secret = typeof existing === 'string' && existing.trim() ? existing : randomBytes(32).toString('base64');
  mkdirSync(dirname(stablePath), { recursive: true });
  writeFileSync(stablePath, `${JSON.stringify({ secretKey: secret }, null, 2)}\n`, { mode: 0o600 });
  await ctx.storage.put(SECRET_KEY, secret).catch(() => ({ ok: true }));
  return secret;
}

async function buildPairPayload(ctx: ExtensionBackendContext): Promise<AlleycatPairPayload | null> {
  const auth = codexAuth ?? createCodexAuth(ctx);
  await auth.ensurePairing();
  codexAuth = auth;
  return pairPayloadCache;
}

async function refreshSidecarLogs(): Promise<void> {
  if (!sidecarLogPath) return;
  try {
    const lines = readFileSync(sidecarLogPath, 'utf8').split('\n').filter(Boolean);
    sidecarLogs = lines.slice(-200);
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as { type?: string; pairPayload?: AlleycatPairPayload };
        if (event.type === 'ready' && event.pairPayload && event.pairPayload.token !== '<redacted>') pairPayloadCache = event.pairPayload;
      } catch {
        // Keep non-JSON log lines only.
      }
    }
  } catch {
    // Log file may not exist yet.
  }
}

async function isPidRunning(ctx: ExtensionBackendContext, pid: number): Promise<boolean> {
  const result = await ctx.shell.exec({
    command: 'sh',
    args: ['-lc', `kill -0 ${pid} >/dev/null 2>&1 && echo yes || echo no`],
    timeoutMs: 5_000,
  });
  return result.stdout.trim() === 'yes';
}

async function stopStaleSidecars(ctx: ExtensionBackendContext): Promise<void> {
  const result = await ctx.shell.exec({
    command: 'sh',
    args: ['-lc', `pgrep -f ${shellQuote(SIDECAR_PROCESS_NAME)} 2>/dev/null || true`],
    timeoutMs: 5_000,
  });
  const pids = result.stdout
    .split(/\s+/)
    .map((value) => Number(value.trim()))
    .filter((pid) => Number.isFinite(pid) && pid > 0 && pid !== process.pid);
  const stalePids = sidecarPid ? pids.filter((pid) => pid !== sidecarPid) : pids;
  if (stalePids.length === 0) return;
  rememberLog(`stopping stale Alleycat sidecar processes: ${stalePids.join(', ')}`);
  await ctx.shell.exec({ command: 'sh', args: ['-lc', `kill ${stalePids.join(' ')} >/dev/null 2>&1 || true`], timeoutMs: 5_000 });
}

async function startSidecar(ctx: ExtensionBackendContext): Promise<void> {
  if (!codexServer) throw new Error('Codex JSONL server must be running before Alleycat sidecar starts');
  if (sidecarPid && (await isPidRunning(ctx, sidecarPid))) return;

  const { binary, searched } = sidecarBinaryPath();
  if (!binary) {
    rememberLog(`sidecar binary missing; searched: ${searched.join(', ')}`);
    rememberLog('set NEON_PILOT_ALLEYCAT_SIDECAR or rebuild/reimport the extension so dist/bin/neon-pilot-alleycat-host-* is packaged');
    return;
  }

  await stopStaleSidecars(ctx);

  const auth = codexAuth ?? createCodexAuth(ctx);
  const token = await auth.ensurePairing();
  codexAuth = auth;
  pairPayloadCache = null;
  const secret = await ensureSecretKey(ctx);
  const logPath = join(ctx.runtimeDir, 'alleycat-sidecar.log');
  sidecarLogPath = logPath;
  sidecarLogs = [];
  try {
    writeFileSync(logPath, '');
  } catch {
    // Best-effort diagnostics only.
  }

  const env = {
    ...process.env,
    NEON_PILOT_ALLEYCAT_TOKEN: token,
    NEON_PILOT_ALLEYCAT_SECRET_KEY: secret,
    NEON_PILOT_ALLEYCAT_JSONL_HOST: '127.0.0.1',
    NEON_PILOT_ALLEYCAT_JSONL_PORT: String(codexServer.jsonlPort),
    RUST_LOG: process.env.RUST_LOG ?? 'info',
  };
  const child = await ctx.shell.spawn({
    command: binary,
    env,
    onStdout: (chunk) => appendSidecarOutput(Buffer.from(chunk)),
    onStderr: (chunk) => appendSidecarOutput(Buffer.from(chunk)),
    onExit: (event) => {
      const reason = sidecarStopReason ? ` reason=${sidecarStopReason}` : '';
      rememberLog(`Alleycat sidecar exited code=${event.code ?? 'null'} signal=${event.signal ?? 'null'}${reason}`);
      sidecarStopReason = null;
      if (sidecarProcess === child) {
        sidecarProcess = null;
        sidecarPid = null;
      }
    },
  });
  sidecarProcess = child;
  sidecarPid = child.pid;
  if (!sidecarPid) throw new Error('Failed to start Alleycat sidecar: missing child pid');

  const deadline = Date.now() + SIDECAR_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await refreshSidecarLogs();
    if (pairPayloadCache?.node_id && pairPayloadCache.node_id !== 'sidecar-not-running') return;
    if (!(await isPidRunning(ctx, sidecarPid)))
      throw new Error(`Alleycat sidecar exited before ready: ${sidecarLogs.slice(-5).join('\n')}`);
  }
  throw new Error(`Timed out waiting for Alleycat sidecar ready event: ${sidecarLogs.slice(-5).join('\n')}`);
}

async function startOnce(_input: unknown, ctx: ExtensionBackendContext): Promise<AlleycatStatus> {
  if (!codexServer) {
    const { createCodexServer, setCodexProtocolLogger } = await import('./codexJsonRpcServer.js');
    const auth = codexAuth ?? createCodexAuth(ctx);
    codexAuth = auth;
    await auth.ensurePairing();
    const port = Number(process.env.NEON_PILOT_ALLEYCAT_COMPAT_PORT) || DEFAULT_COMPAT_PORT;
    setCodexProtocolLogger(rememberLog);
    codexServer = await createCodexServer({ port, auth, ctx, bindAddress: '127.0.0.1', fallbackToEphemeralPortOnConflict: true });
    ctx.log.info('Neon Pilot Alleycat compatibility server started', { port: codexServer.port, jsonlPort: codexServer.jsonlPort });
  }
  await startSidecar(ctx);
  pairPayloadCache = await buildPairPayload(ctx);
  return status(_input, ctx);
}

export async function start(input: unknown, ctx: ExtensionBackendContext): Promise<AlleycatStatus> {
  if (startPromise) return startPromise;
  startPromise = startOnce(input, ctx).finally(() => {
    startPromise = null;
  });
  return startPromise;
}

export async function startService(input: unknown, ctx: ExtensionBackendContext): Promise<AlleycatStatus> {
  try {
    return await start(input, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    rememberLog(`Alleycat service start degraded: ${message}`);
    ctx.log.warn('Alleycat service start degraded', { error: message });
    return status(input, ctx);
  }
}

async function stopSidecar(ctx?: ExtensionBackendContext, reason = 'requested'): Promise<void> {
  if (sidecarProcess) {
    sidecarStopReason = reason;
    rememberLog(`stopping Alleycat sidecar: ${reason}`);
    sidecarProcess.kill();
    sidecarProcess = null;
  }
  if (sidecarPid) {
    if (ctx) {
      sidecarStopReason = reason;
      rememberLog(`stopping Alleycat sidecar pid ${sidecarPid}: ${reason}`);
      await ctx.shell.exec({ command: 'sh', args: ['-lc', `kill ${sidecarPid} >/dev/null 2>&1 || true`], timeoutMs: 5_000 });
    }
    sidecarPid = null;
  }
  pairPayloadCache = null;
}

export async function stop(_input?: unknown, ctx?: ExtensionBackendContext): Promise<{ ok: true }> {
  await startPromise?.catch(() => null);
  startPromise = null;
  await stopSidecar(ctx, 'extension stop/disable/reload');
  if (ctx) await stopStaleSidecars(ctx);
  if (codexServer) {
    codexServer.stop();
    codexServer = null;
  }
  return { ok: true };
}

export async function status(_input?: unknown, ctx?: ExtensionBackendContext): Promise<AlleycatStatus> {
  if (ctx) await refreshSidecarLogs();
  if (ctx && sidecarPid && !(await isPidRunning(ctx, sidecarPid))) sidecarPid = null;
  if (ctx && !pairPayloadCache) pairPayloadCache = await buildPairPayload(ctx);
  return {
    running: Boolean(codexServer && sidecarPid),
    port: codexServer?.port ?? null,
    pairPayload: pairPayloadCache,
    agents: [neonPilotInfo(Boolean(codexServer && sidecarPid))],
    implementation: sidecarPid ? 'iroh-sidecar' : 'codex-jsonrpc-compat',
    sidecarRunning: Boolean(sidecarPid),
    logs: sidecarLogs.slice(-50),
    note: sidecarPid
      ? 'The PA-owned iroh Alleycat host is running and forwards Neon Pilot JSON-RPC over a JSONL bridge.'
      : 'The Codex-shaped JSON-RPC compatibility server is available, but the iroh sidecar binary is not running yet.',
  };
}

export async function rotateToken(_input: unknown, ctx: ExtensionBackendContext): Promise<AlleycatStatus> {
  const auth = codexAuth ?? createCodexAuth(ctx);
  codexAuth = auth;
  auth.rotateToken();
  await stopSidecar(ctx, 'pairing token rotation');
  if (codexServer) await startSidecar(ctx);
  pairPayloadCache = await buildPairPayload(ctx);
  return status(_input, ctx);
}
