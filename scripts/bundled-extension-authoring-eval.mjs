#!/usr/bin/env node
/* eslint-env node */
import { createHash, randomBytes } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { analyzeBundledAuthoringManifest } from './bundled-authoring-contract.mjs';
import { createArtifactRedactor } from './benchmark-artifact-redaction.mjs';
import { resolveBenchmarkProxyAuthStrategy } from './benchmark-provider-proxy-contract.mjs';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2).filter((value) => value !== '--');
const valueArg = (name, fallback = '') => args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const boolArg = (name) => args.includes(`--${name}`) || valueArg(name) === 'true';
const casesPath = resolve(repoRoot, valueArg('cases', 'benchmarks/extension-quality/bundled-authoring-tasks.jsonl'));
const outRoot = resolve(repoRoot, valueArg('out', `artifacts/bundled-authoring/${new Date().toISOString().replaceAll(':', '-')}`));
const model = valueArg('model', 'opencode-go/glm-5.1');
const benchmarkProvider = model.includes('/') ? model.slice(0, model.indexOf('/')) : '';
const benchmarkModelId = model.includes('/') ? model.slice(model.indexOf('/') + 1) : model;
const artifactRedactor = createArtifactRedactor();
const selectedCase = valueArg('case');
const dryRun = boolArg('dry-run');
const keepExtensions = boolArg('keep-extensions');
const timeoutMs = Number(valueArg('timeout-ms', '1800000'));
const cliPath = valueArg('cli', 'neon-pilot');
const appBundleArg = valueArg('app');
const appBundle = appBundleArg ? resolve(appBundleArg) : '';
for (const name of ['state-root', 'user-data', 'daemon-socket']) {
  if (valueArg(name)) throw new Error(`--${name} is not supported: benchmark runtime state must remain inside its owned temporary root.`);
}
// macOS Unix sockets have a 103-byte path limit; /var/folders/... from
// os.tmpdir() can consume nearly all of it before the benchmark adds a name.
const ownedRuntimeParent = process.platform === 'darwin' ? '/tmp' : tmpdir();
const ownedRuntimeRoot = mkdtempSync(resolve(ownedRuntimeParent, 'np-authoring-'));
const benchmarkStateRoot = resolve(ownedRuntimeRoot, 'state');
const benchmarkUserData = resolve(ownedRuntimeRoot, 'user-data');
const benchmarkSocket = resolve(ownedRuntimeRoot, 'daemon.sock');
const benchmarkHome = resolve(ownedRuntimeRoot, 'home');
const benchmarkConfigRoot = resolve(ownedRuntimeRoot, 'config');
const benchmarkKnowledgeRoot = resolve(ownedRuntimeRoot, 'knowledge');
const seedStateRootArg = valueArg('seed-state-root');
const seedStateRoot = seedStateRootArg ? resolve(seedStateRootArg) : '';
const clearedEnvironmentOverrides = [
  'MCP_CONFIG_PATH',
  'NEON_PILOT_ACTIVE_PROFILE',
  'NEON_PILOT_APP_ROOT',
  'NEON_PILOT_AUTH_PATH',
  'NEON_PILOT_CACHE_PATH',
  'NEON_PILOT_CONFIG_FILE',
  'NEON_PILOT_DAEMON_CONFIG',
  'NEON_PILOT_DESKTOP_APP_PATH',
  'NEON_PILOT_DESKTOP_DEV_BUNDLE',
  'NEON_PILOT_DS4_PROGRESSIVE_SKILLS',
  'NEON_PILOT_EXTENSION_PATHS',
  'NEON_PILOT_MCP_AUTH_DIR',
  'NEON_PILOT_PROFILE',
  'NEON_PILOT_REPO_ROOT',
  'NEON_PILOT_RESOURCES_ROOT',
  'NEON_PILOT_SESSION_PATH',
  'NEON_PILOT_VAULT_ROOT',
  'PERSONAL_AGENT_ACTIVE_PROFILE',
  'PERSONAL_AGENT_PROFILE',
  'PERSONAL_AGENT_REPO_ROOT',
  'PI_CODING_AGENT_DIR',
  'PI_PACKAGE_DIR',
];
let activeAppProcess;
let activeProviderProxy;
let benchmarkProxyBaseUrl = '';
let benchmarkProxyToken = '';
let runtimeCleaned = false;
function cleanupOwnedRuntime() {
  if (runtimeCleaned) return;
  runtimeCleaned = true;
  if (activeAppProcess?.exitCode === null) activeAppProcess.kill('SIGKILL');
  if (activeProviderProxy?.exitCode === null) activeProviderProxy.kill('SIGKILL');
  rmSync(ownedRuntimeRoot, { recursive: true, force: true });
}
process.once('exit', cleanupOwnedRuntime);
for (const [signal, exitCode] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.once(signal, () => {
    cleanupOwnedRuntime();
    process.exit(exitCode);
  });
}
const benchmarkEnv = {
  HOME: benchmarkHome,
  XDG_CACHE_HOME: resolve(ownedRuntimeRoot, 'xdg-cache'),
  XDG_CONFIG_HOME: resolve(ownedRuntimeRoot, 'xdg-config'),
  XDG_DATA_HOME: resolve(ownedRuntimeRoot, 'xdg-data'),
  XDG_STATE_HOME: resolve(ownedRuntimeRoot, 'xdg-state'),
  NEON_PILOT_RUNTIME_CHANNEL: 'test',
  NEON_PILOT_STATE_ROOT: benchmarkStateRoot,
  NEON_PILOT_CONFIG_ROOT: benchmarkConfigRoot,
  NEON_PILOT_KNOWLEDGE_ROOT: benchmarkKnowledgeRoot,
  NEON_PILOT_DESKTOP_USER_DATA_DIR: benchmarkUserData,
  NEON_PILOT_DAEMON_SOCKET_PATH: benchmarkSocket,
  NEON_PILOT_DAEMON_NAMESPACE: `bundled-authoring-${process.pid}`,
  MCP_CONFIG_PATH: undefined,
  NEON_PILOT_CONFIG_FILE: undefined,
  NEON_PILOT_AUTH_PATH: undefined,
  NEON_PILOT_CACHE_PATH: undefined,
  NEON_PILOT_DAEMON_CONFIG: undefined,
  NEON_PILOT_DESKTOP_APP_PATH: undefined,
  NEON_PILOT_DESKTOP_DEV_BUNDLE: undefined,
  NEON_PILOT_DS4_PROGRESSIVE_SKILLS: undefined,
  NEON_PILOT_MCP_AUTH_DIR: undefined,
  NEON_PILOT_EXTENSION_PATHS: undefined,
  NEON_PILOT_RESOURCES_ROOT: undefined,
  NEON_PILOT_APP_ROOT: undefined,
  NEON_PILOT_VAULT_ROOT: undefined,
  NEON_PILOT_ACTIVE_PROFILE: undefined,
  NEON_PILOT_PROFILE: undefined,
  NEON_PILOT_SESSION_PATH: undefined,
  PERSONAL_AGENT_ACTIVE_PROFILE: undefined,
  PERSONAL_AGENT_PROFILE: undefined,
  PERSONAL_AGENT_REPO_ROOT: undefined,
  PI_CODING_AGENT_DIR: undefined,
  PI_PACKAGE_DIR: undefined,
};

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: options.cwd,
    env: { ...process.env, NEON_PILOT_REPO_ROOT: undefined, ...benchmarkEnv, ...(options.env ?? {}) },
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 120000,
    maxBuffer: 50 * 1024 * 1024,
  });
}

function hashTree(path) {
  const hash = createHash('sha256');
  const visit = (current, relative = '') => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const next = resolve(current, entry.name);
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(next, childRelative);
      else if (entry.isFile()) {
        hash.update(childRelative);
        hash.update(readFileSync(next));
      }
    }
  };
  visit(path);
  return hash.digest('hex');
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function startBenchmarkProviderProxy(sourceRoot) {
  const modelsPath = resolve(sourceRoot, 'neon-pilot-runtime/models.json');
  const authPath = resolve(sourceRoot, 'neon-pilot-runtime/auth.json');
  const models = JSON.parse(readFileSync(modelsPath, 'utf8'));
  const provider = models?.providers?.[benchmarkProvider];
  const selectedModel = Array.isArray(provider?.models) ? provider.models.find((candidate) => candidate?.id === benchmarkModelId) : null;
  const targetBaseUrl =
    typeof selectedModel?.baseUrl === 'string' ? selectedModel.baseUrl : typeof provider?.baseUrl === 'string' ? provider.baseUrl : '';
  const api = typeof selectedModel?.api === 'string' ? selectedModel.api : typeof provider?.api === 'string' ? provider.api : '';
  const authStrategy = resolveBenchmarkProxyAuthStrategy(api);
  let apiKey = '';
  if (process.platform === 'darwin') {
    const keychain = spawnSync(
      'security',
      ['find-generic-password', '-s', 'neon-pilot', '-a', `provider:${benchmarkProvider}:apiKey`, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    apiKey = keychain.status === 0 ? String(keychain.stdout ?? '').trim() : '';
  }
  if (!apiKey && existsSync(authPath)) {
    const credential = JSON.parse(readFileSync(authPath, 'utf8'))?.[benchmarkProvider];
    apiKey = typeof credential?.key === 'string' ? credential.key : '';
  }
  if (!targetBaseUrl || !apiKey) throw new Error(`Could not configure isolated provider proxy for ${benchmarkProvider}.`);
  artifactRedactor.add(apiKey);
  benchmarkProxyToken = randomBytes(32).toString('base64url');
  const child = spawn(process.execPath, [resolve(repoRoot, 'scripts/benchmark-provider-proxy.mjs')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH },
  });
  activeProviderProxy = child;
  child.stdin.end(JSON.stringify({ targetBaseUrl, apiKey, proxyToken: benchmarkProxyToken, authStrategy }));
  const ready = await new Promise((resolveReady, rejectReady) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => rejectReady(new Error('Benchmark provider proxy startup timed out.')), 10_000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      const line = stdout.split(/\r?\n/u).find(Boolean);
      if (!line) return;
      try {
        const payload = JSON.parse(line);
        if (payload?.ok === true && typeof payload.baseUrl === 'string') {
          clearTimeout(timer);
          resolveReady(payload.baseUrl);
        }
      } catch {
        // Wait for a complete JSON line.
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += artifactRedactor.redactText(chunk.toString('utf8'));
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      rejectReady(new Error(`Benchmark provider proxy exited during startup (${code}): ${stderr}`));
    });
  });
  benchmarkProxyBaseUrl = ready;
}

function copyMinimalSeedState(sourceRoot, targetRoot, runtimeConfigRoot) {
  // Authentication and model selection are the only machine inputs allowed
  // into this eval. In particular, never copy AGENTS.md, APPEND_SYSTEM.md,
  // skills, MCP configuration, extensions, conversations, or workspaces.
  const allowlist = [
    'secrets.index.json',
    'neon-pilot-runtime/auth.json',
    'neon-pilot-runtime/models.json',
    'neon-pilot-runtime/settings.json',
  ];
  const copied = [];
  for (const relative of allowlist) {
    const source = resolve(sourceRoot, relative);
    if (!existsSync(source) || !statSync(source).isFile()) continue;
    const configFileName =
      relative === 'neon-pilot-runtime/models.json'
        ? 'models.json'
        : relative === 'neon-pilot-runtime/settings.json'
          ? 'settings.json'
          : '';
    const target = configFileName ? resolve(runtimeConfigRoot, 'runtime/shared', configFileName) : resolve(targetRoot, relative);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    if (relative === 'secrets.index.json') {
      if (!benchmarkProvider) continue;
      const providerKey = `provider:${benchmarkProvider}:apiKey`;
      const sourceIndex = JSON.parse(readFileSync(source, 'utf8'));
      const entries = Array.isArray(sourceIndex) && sourceIndex.includes(providerKey) ? [providerKey] : [];
      if (entries.length === 0) continue;
      writeFileSync(target, `${JSON.stringify(entries, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      copied.push({
        relative,
        destinationClass: 'runtime-state',
        sanitizedEntries: entries,
        sha256: hashFile(target),
        bytes: statSync(target).size,
      });
      continue;
    }
    if (relative === 'neon-pilot-runtime/settings.json') {
      const sourceSettings = JSON.parse(readFileSync(source, 'utf8'));
      const settings = {
        defaultProvider: benchmarkProvider,
        defaultModel: benchmarkModelId,
        ...(typeof sourceSettings.defaultThinkingLevel === 'string' ? { defaultThinkingLevel: sourceSettings.defaultThinkingLevel } : {}),
      };
      writeFileSync(target, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      copied.push({
        relative,
        destinationClass: 'runtime-config',
        sanitizedKeys: Object.keys(settings),
        sha256: hashFile(target),
        bytes: statSync(target).size,
      });
      continue;
    }
    if (relative === 'neon-pilot-runtime/models.json') {
      const sourceModels = JSON.parse(readFileSync(source, 'utf8'));
      const provider = sourceModels?.providers?.[benchmarkProvider];
      const selectedModel = Array.isArray(provider?.models)
        ? provider.models.find((candidate) => candidate?.id === benchmarkModelId)
        : null;
      if (!provider || !selectedModel) throw new Error(`Seed models do not contain ${benchmarkProvider}/${benchmarkModelId}.`);
      const pick = (value, keys) => Object.fromEntries(keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
      const sanitizedProvider = {
        ...pick(provider, ['api', 'authHeader', 'compat']),
        ...(benchmarkProxyBaseUrl ? { baseUrl: benchmarkProxyBaseUrl } : {}),
      };
      const sanitizedModel = {
        ...pick(selectedModel, ['id', 'name', 'api', 'reasoning', 'input', 'contextWindow', 'maxTokens', 'cost', 'compat']),
        ...(benchmarkProxyBaseUrl ? { baseUrl: benchmarkProxyBaseUrl } : {}),
      };
      const models = { providers: { [benchmarkProvider]: { ...sanitizedProvider, models: [sanitizedModel] } } };
      writeFileSync(target, `${JSON.stringify(models, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      copied.push({
        relative,
        destinationClass: 'runtime-config',
        sanitizedProvider: benchmarkProvider,
        sanitizedModel: benchmarkModelId,
        sha256: hashFile(target),
        bytes: statSync(target).size,
      });
      continue;
    }
    if (relative === 'neon-pilot-runtime/auth.json') {
      const credential = { type: 'api_key', key: benchmarkProxyToken || 'dry-run-proxy-token' };
      const credentialSource = benchmarkProxyBaseUrl ? 'isolated-provider-proxy' : 'dry-run-placeholder';
      const auth = { [benchmarkProvider]: credential };
      writeFileSync(target, `${JSON.stringify(auth, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      copied.push({
        relative,
        destinationClass: 'runtime-state',
        sanitizedProvider: benchmarkProvider,
        credentialSource: credentialSource || 'none',
        bytes: statSync(target).size,
      });
      continue;
    }
  }
  return copied;
}

function hasSuccessfulComputerUseEvidence(transcriptResult) {
  const payload = parseJsonOutput(transcriptResult?.stdout);
  const strings = [];
  const visit = (value) => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(payload);
  const blocks = strings.join('\n').split(/\n\n(?=\[\d+\])/u);
  return blocks.some(
    (block) =>
      /tool_use:computer_use/u.test(block) &&
      /"action"\s*:\s*"(?:capture|window_state)"/u.test(block) &&
      !/"(?:isError|error)"\s*:\s*(?:true|\{)/u.test(block) &&
      /(?:"type"\s*:\s*"image"|Neon Pilot[^\n]*window_id)/u.test(block),
  );
}

function treeBytes(path) {
  let total = 0;
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const next = resolve(current, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (entry.isFile()) total += statSync(next).size;
    }
  };
  visit(path);
  return total;
}

function write(path, value) {
  artifactRedactor.write(path, value);
}

function readCases() {
  return readFileSync(casesPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((testCase) => !selectedCase || testCase.id === selectedCase);
}

function parseJsonOutput(output) {
  const trimmed = String(output ?? '').trim();
  if (trimmed) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Some CLI commands include log lines before their final JSON payload.
    }
  }
  const lines = String(output ?? '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // Continue through log lines until structured CLI output is found.
    }
  }
  return null;
}

function launchPackagedApp(logRoot) {
  const plist = resolve(appBundle, 'Contents/Info.plist');
  const executableName = String(run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleExecutable', plist]).stdout ?? '').trim();
  if (!executableName) throw new Error(`Could not resolve CFBundleExecutable from ${plist}`);
  activeAppProcess = spawn(resolve(appBundle, 'Contents/MacOS', executableName), ['--no-quit-confirmation'], {
    cwd: tmpdir(),
    env: { ...process.env, NEON_PILOT_REPO_ROOT: undefined, ...benchmarkEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  mkdirSync(logRoot, { recursive: true });
  const stdout = [];
  const stderr = [];
  activeAppProcess.stdout?.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
  activeAppProcess.stderr?.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
  activeAppProcess.benchmarkLogs = { logRoot, stdout, stderr };
  return activeAppProcess;
}

async function waitForApp(child, timeout = 30_000) {
  const startedAt = Date.now();
  const controlPlanePath = resolve(benchmarkStateRoot, 'desktop/cli-control-plane.json');
  while (Date.now() - startedAt < timeout) {
    if (child.exitCode !== null) throw new Error(`Packaged app exited during startup with status ${child.exitCode}.`);
    if (existsSync(controlPlanePath)) {
      try {
        const record = JSON.parse(readFileSync(controlPlanePath, 'utf8'));
        if (
          record?.pid === child.pid &&
          typeof record?.extensionHost?.baseUrl === 'string' &&
          typeof record?.extensionHost?.token === 'string' &&
          typeof record?.localBackend?.baseUrl === 'string' &&
          typeof record?.localBackend?.token === 'string'
        ) {
          const response = await fetch(`${record.extensionHost.baseUrl}/rpc`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${record.extensionHost.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ request: { type: 'health' } }),
          });
          const payload = await response.json();
          if (response.ok && payload?.ok === true) {
            // The local backend is spawned after the extension host and receives
            // its RPC credentials during startup. Give that handoff time to
            // settle; the subsequent agent command is the authoritative
            // end-to-end readiness check.
            await new Promise((resolveWait) => setTimeout(resolveWait, 5_000));
            return;
          }
        }
      } catch {
        // The app rewrites this record atomically during startup; retry until it
        // identifies this exact process and its extension host answers health.
      }
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error('Packaged app did not become ready for extension authoring.');
}

async function stopPackagedApp(child) {
  if (!child) return;
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolveWait) => child.once('exit', resolveWait)),
      new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  const logs = child.benchmarkLogs;
  if (logs) {
    write(resolve(logs.logRoot, 'app.stdout.txt'), Buffer.concat(logs.stdout).toString('utf8'));
    write(resolve(logs.logRoot, 'app.stderr.txt'), Buffer.concat(logs.stderr).toString('utf8'));
    child.benchmarkLogs = undefined;
  }
  if (activeAppProcess === child) activeAppProcess = undefined;
}

function containsMinimumNumber(value, minimum) {
  if (typeof value === 'number') return value >= minimum;
  if (Array.isArray(value)) return value.some((entry) => containsMinimumNumber(entry, minimum));
  if (value && typeof value === 'object') return Object.values(value).some((entry) => containsMinimumNumber(entry, minimum));
  return false;
}

function findFirstId(value) {
  if (!value || typeof value !== 'object') return null;
  if (!Array.isArray(value) && typeof value.id === 'string' && value.id.trim()) return value.id;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const id = findFirstId(child);
    if (id) return id;
  }
  return null;
}

function resolveCapturedValues(value, captures) {
  if (typeof value === 'string' && value.startsWith('$capture:')) {
    const captureId = value.slice('$capture:'.length);
    if (!captures.has(captureId)) throw new Error(`Behavior check references missing capture ${captureId}.`);
    return captures.get(captureId);
  }
  if (Array.isArray(value)) return value.map((entry) => resolveCapturedValues(entry, captures));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveCapturedValues(entry, captures)]));
  }
  return value;
}

function locateInstalledExtension(extensionId) {
  const result = run(cliPath, ['extensions', 'list', '--json']);
  const payload = parseJsonOutput(result.stdout);
  const extensions = payload?.extensions ?? payload?.result?.extensions ?? [];
  return Array.isArray(extensions) ? extensions.find((entry) => entry?.id === extensionId) : null;
}

function locateConversationForWorkspace(workspace) {
  const result = run(cliPath, ['conversations', 'list', '--json']);
  const payload = parseJsonOutput(result.stdout);
  const sessions = payload?.details?.sessions ?? payload?.sessions ?? [];
  if (!Array.isArray(sessions)) return null;
  const canonicalWorkspace = existsSync(workspace) ? realpathSync(workspace) : workspace;
  return (
    sessions.find((session) => {
      if (typeof session?.cwd !== 'string') return false;
      const cwd = existsSync(session.cwd) ? realpathSync(session.cwd) : session.cwd;
      return cwd === canonicalWorkspace;
    })?.id ?? null
  );
}

async function waitForConversationCompletion(conversationId, timeout) {
  const deadline = Date.now() + timeout;
  const quiescenceMs = 30_000;
  let sawRunning = false;
  let lastSession = null;
  let quietSince = null;
  let quietActivityAt = null;
  const readNewestBlock = () => {
    const transcriptResult = run(cliPath, [
      'conversations',
      'transcript',
      'read',
      conversationId,
      '--limit',
      '20',
      '--order',
      'desc',
      '--json',
    ]);
    const transcriptPayload = parseJsonOutput(transcriptResult.stdout);
    const blocks = transcriptPayload?.details?.blocks;
    return Array.isArray(blocks)
      ? blocks.reduce((latest, block) => (latest === null || Number(block?.index) > Number(latest?.index) ? block : latest), null)
      : null;
  };
  while (Date.now() < deadline) {
    if (activeAppProcess && activeAppProcess.exitCode !== null) {
      const newestBlock = readNewestBlock();
      if (newestBlock?.type === 'text') return { ok: true, sawRunning, session: lastSession, appExited: true };
      throw new Error(`Packaged app exited during an unfinished agent tool turn (status ${activeAppProcess.exitCode}).`);
    }
    const result = run(cliPath, ['conversations', 'list', '--json']);
    const payload = parseJsonOutput(result.stdout);
    const sessions = payload?.details?.sessions ?? payload?.sessions ?? payload?.details ?? payload ?? [];
    const session = Array.isArray(sessions) ? sessions.find((entry) => entry?.id === conversationId) : null;
    if (session) {
      lastSession = session;
      const running = session.isRunning === true || session.running === true || session.isStreaming === true;
      if (running) {
        sawRunning = true;
        quietSince = null;
        quietActivityAt = null;
      } else if (sawRunning) {
        const activityAt = typeof session.lastActivityAt === 'string' ? session.lastActivityAt : null;
        if (quietSince === null || activityAt !== quietActivityAt) {
          quietSince = Date.now();
          quietActivityAt = activityAt;
        } else if (Date.now() - quietSince >= quiescenceMs) {
          const newestBlock = readNewestBlock();
          if (newestBlock?.type === 'text') return { ok: true, sawRunning, session };
        }
      }
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  }
  return { ok: false, sawRunning, session: lastSession };
}

mkdirSync(outRoot, { recursive: true });
let seedInputs = [];
if (seedStateRoot) {
  if (!existsSync(seedStateRoot)) throw new Error(`Seed state root not found: ${seedStateRoot}`);
  if (existsSync(benchmarkStateRoot)) throw new Error(`Isolated state root already exists: ${benchmarkStateRoot}`);
  if (!dryRun) await startBenchmarkProviderProxy(seedStateRoot);
  mkdirSync(benchmarkStateRoot, { recursive: true, mode: 0o700 });
  seedInputs = copyMinimalSeedState(seedStateRoot, benchmarkStateRoot, benchmarkConfigRoot);
}
mkdirSync(benchmarkStateRoot, { recursive: true, mode: 0o700 });
mkdirSync(benchmarkUserData, { recursive: true, mode: 0o700 });
for (const path of [
  benchmarkHome,
  benchmarkConfigRoot,
  benchmarkKnowledgeRoot,
  ...Object.values(benchmarkEnv).filter((value) => typeof value === 'string' && /\/xdg-/u.test(value)),
]) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
}
if (!dryRun && !appBundle) throw new Error('A packaged app is required for a full bundled-authoring benchmark. Pass --app=<path>.');
if (!dryRun && !valueArg('cli')) throw new Error('The packaged app CLI launcher is required. Pass --cli=<path>.');
if (!dryRun && appBundle && !existsSync(appBundle)) throw new Error(`Packaged app not found: ${appBundle}`);
const resourceRoot = appBundle ? resolve(appBundle, 'Contents/Resources') : '';
const packagedSkillPath = resourceRoot
  ? resolve(resourceRoot, 'extensions/system-extension-manager/skills/local-extension-development')
  : '';
const packagedAuthoringPath = resourceRoot ? resolve(resourceRoot, 'extension-authoring') : '';
if (!dryRun && appBundle && (!existsSync(packagedSkillPath) || !existsSync(packagedAuthoringPath))) {
  throw new Error('Packaged app does not contain the bundled authoring skill and extension authoring runtime.');
}
if (!dryRun && appBundle) {
  const packagedBuilder = resolve(packagedAuthoringPath, 'scripts/extension-build.mjs');
  const packagedEsbuildModule = resolve(packagedAuthoringPath, 'vendor/esbuild/lib/main.js');
  const packagedEsbuildBinary = resolve(packagedAuthoringPath, 'vendor', `esbuild-bin-darwin-${process.arch}`);
  if (![packagedBuilder, packagedEsbuildModule, packagedEsbuildBinary].every((path) => existsSync(path))) {
    throw new Error('Packaged app authoring runtime is incomplete: builder, esbuild module, or native binary is missing.');
  }
}
const whichCli = cliPath.includes('/') ? resolve(cliPath) : String(run('which', [cliPath]).stdout ?? '').trim();
const canonicalAppBundle = appBundle && existsSync(appBundle) ? realpathSync(appBundle) : '';
const packagedSkillSha256 = packagedSkillPath && existsSync(packagedSkillPath) ? hashTree(packagedSkillPath) : null;
const packagedAuthoringSha256 = packagedAuthoringPath && existsSync(packagedAuthoringPath) ? hashTree(packagedAuthoringPath) : null;
if (!dryRun && whichCli && existsSync(whichCli)) {
  const launcherText = readFileSync(whichCli, 'utf8');
  if (!launcherText.includes(canonicalAppBundle)) {
    throw new Error(`CLI launcher is not bound to the packaged app under test: ${whichCli}`);
  }
}
const summary = {
  startedAt: new Date().toISOString(),
  model,
  provenance: {
    cliPath: whichCli && existsSync(whichCli) ? realpathSync(whichCli) : cliPath,
    appBundle: canonicalAppBundle || null,
    appVersion:
      appBundle && existsSync(resolve(appBundle, 'Contents/Info.plist'))
        ? String(
            run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', resolve(appBundle, 'Contents/Info.plist')]).stdout ??
              '',
          ).trim()
        : null,
    packagedSkillPath: packagedSkillPath || null,
    packagedSkillSha256,
    packagedAuthoringPath: packagedAuthoringPath || null,
    packagedAuthoringBytes: packagedAuthoringPath && existsSync(packagedAuthoringPath) ? treeBytes(packagedAuthoringPath) : null,
    packagedAuthoringSha256,
    runtimeChannel: benchmarkEnv.NEON_PILOT_RUNTIME_CHANNEL,
    isolatedStateRoot: benchmarkStateRoot,
    isolatedUserData: benchmarkUserData,
    isolatedDaemonSocket: benchmarkSocket,
    isolatedHome: benchmarkHome,
    isolatedConfigRoot: benchmarkConfigRoot,
    isolatedKnowledgeRoot: benchmarkKnowledgeRoot,
    seedStateRoot: seedStateRoot || null,
    seedInputs,
    clearedEnvironmentOverrides,
  },
  cases: [],
};

for (const testCase of readCases()) {
  const caseOut = resolve(outRoot, testCase.id);
  const workspace = mkdtempSync(resolve(tmpdir(), `neon-pilot-bundled-authoring-${testCase.id}-`));
  const prompt = [
    testCase.prompt,
    '',
    ...(testCase.explicitSkillHint === false
      ? [`Create the extension with the exact id ${testCase.extensionId}.`]
      : [`Use the bundled local-extension-development skill. Create the extension with the exact id ${testCase.extensionId}.`]),
    'Assume there is no Neon Pilot source checkout and do not search for one. Use only the installed app, its injected skill resources, and its packaged extension commands.',
    'Complete the full create, source edit, build, validate, reload, enable, smoke, and real-app verification loop. Do not merely explain how.',
    'For real-app verification, one successful computer_use capture or window_state call is sufficient when the accessibility tree is sparse; do not wander into unrelated screenshot tools or private application files.',
  ].join('\n');
  write(resolve(caseOut, 'prompt.txt'), prompt);

  if (dryRun) {
    summary.cases.push({ id: testCase.id, extensionId: testCase.extensionId, workspace, dryRun: true, prompt });
    rmSync(workspace, { recursive: true, force: true });
    continue;
  }

  if (locateInstalledExtension(testCase.extensionId)) {
    summary.cases.push({ id: testCase.id, extensionId: testCase.extensionId, status: 'preexisting_extension' });
    rmSync(workspace, { recursive: true, force: true });
    continue;
  }

  let appProcess;
  try {
    appProcess = launchPackagedApp(caseOut);
    await waitForApp(appProcess);
    const agentStart = run(
      cliPath,
      ['ask', '--model', model, '--cwd', workspace, '--timeout-ms', String(timeoutMs), '--format', 'json', '--prompt', prompt],
      {
        cwd: workspace,
        timeoutMs: 120_000,
      },
    );
    write(resolve(caseOut, 'agent.stdout.txt'), agentStart.stdout ?? '');
    write(resolve(caseOut, 'agent.stderr.txt'), agentStart.stderr ?? '');
    const agentPayload = parseJsonOutput(agentStart.stdout);
    const conversationId = agentPayload?.details?.conversationId ?? agentPayload?.details?.id ?? locateConversationForWorkspace(workspace);
    const completion =
      agentStart.status === 0 && conversationId
        ? await waitForConversationCompletion(conversationId, timeoutMs)
        : { ok: false, sawRunning: false, session: null };
    write(resolve(caseOut, 'agent-completion.json'), `${JSON.stringify(completion, null, 2)}\n`);
    if (completion.appExited === true) {
      await stopPackagedApp(appProcess);
      appProcess = launchPackagedApp(resolve(caseOut, 'relaunch'));
      await waitForApp(appProcess);
    }
    const agent = { ...agentStart, status: agentStart.status === 0 && completion.ok ? 0 : agentStart.status || 5 };
    const transcript = conversationId
      ? run(cliPath, ['conversations', 'transcript', 'read', conversationId, '--limit', '10000', '--order', 'asc', '--json'])
      : null;
    if (transcript) write(resolve(caseOut, 'agent.transcript.json'), transcript.stdout ?? '');

    const installed = locateInstalledExtension(testCase.extensionId);
    const packageRoot = typeof installed?.packageRoot === 'string' ? installed.packageRoot : '';
    let contract = { ok: false, problems: ['generated extension was not found in the installed extension registry'] };
    const commands = [];
    const behavior = [];
    const captures = new Map();
    let generatedPackageContainsCredential = false;
    if (packageRoot && existsSync(resolve(packageRoot, 'extension.json'))) {
      try {
        artifactRedactor.assertCleanTree(packageRoot);
      } catch {
        generatedPackageContainsCredential = true;
      }
      const preserved = resolve(caseOut, 'generated-extension');
      cpSync(packageRoot, preserved, { recursive: true });
      artifactRedactor.sanitizeTree(preserved);
      const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'extension.json'), 'utf8'));
      const sources = {
        backend: existsSync(resolve(packageRoot, 'src/backend.ts')) ? readFileSync(resolve(packageRoot, 'src/backend.ts'), 'utf8') : '',
        frontend: existsSync(resolve(packageRoot, 'src/frontend.tsx'))
          ? readFileSync(resolve(packageRoot, 'src/frontend.tsx'), 'utf8')
          : '',
      };
      contract = analyzeBundledAuthoringManifest(testCase, manifest, sources);
      if (generatedPackageContainsCredential) {
        contract = { ok: false, problems: [...contract.problems, 'generated extension contained benchmark provider credential material'] };
      }
      for (const argv of [
        ['extensions', 'build', testCase.extensionId, '--json'],
        ['extensions', 'validate', testCase.extensionId, '--json'],
        ['extensions', 'reload', testCase.extensionId, '--json'],
        ['extensions', 'enable', testCase.extensionId, '--json'],
        ['extensions', 'smoke', testCase.extensionId, '--json'],
      ]) {
        const result = run(cliPath, argv);
        const payload = parseJsonOutput(result.stdout);
        const action = argv[1];
        const logicalOk =
          result.status === 0 &&
          payload?.ok !== false &&
          (action !== 'validate' || Number(payload?.summary?.errors ?? 0) === 0) &&
          (action !== 'smoke' || (payload?.ok === true && (payload?.checks ?? []).every((check) => check?.ok === true)));
        commands.push({ argv, status: result.status, logicalOk, payload, stdout: result.stdout, stderr: result.stderr });
      }
      for (const check of testCase.behaviorChecks ?? []) {
        const resolvedInput = resolveCapturedValues(check.input ?? {}, captures);
        const argv = [
          'extensions',
          'invoke',
          testCase.extensionId,
          check.actionId,
          '--input-json',
          JSON.stringify(resolvedInput),
          '--json',
        ];
        const result = run(cliPath, argv);
        const payload = parseJsonOutput(result.stdout);
        const resultValue = payload?.result ?? payload?.details?.result ?? payload;
        const textValue = JSON.stringify(resultValue).toLowerCase();
        const logicalOk =
          result.status === 0 &&
          payload?.ok !== false &&
          (!check.expectText || textValue.includes(String(check.expectText).toLowerCase())) &&
          (!check.expectAbsentText || !textValue.includes(String(check.expectAbsentText).toLowerCase())) &&
          (check.expectMinimum === undefined || containsMinimumNumber(resultValue, Number(check.expectMinimum)));
        if (logicalOk && check.captureId) {
          const captured = findFirstId(resultValue);
          if (captured) captures.set(check.captureId, captured);
        }
        behavior.push({ argv, status: result.status, logicalOk, payload, stdout: result.stdout, stderr: result.stderr });
      }
      const sourceText =
        run('rg', ['-n', 'workingdir/neon-pilot|pnpm run|packages/desktop|packages/core|packages/extensions/src', packageRoot]).stdout ??
        '';
      const agentTrace = `${agent.stdout ?? ''}\n${transcript?.stdout ?? ''}`;
      const traceLeak = agentTrace.includes(repoRoot) || /"path":"[^"]*packages\/(?:desktop|core|extensions)\/src/u.test(agentTrace);
      if (sourceText.trim() || traceLeak)
        contract = { ok: false, problems: [...contract.problems, 'agent used source-checkout knowledge'] };
      if (hashTree(packagedSkillPath) !== packagedSkillSha256 || hashTree(packagedAuthoringPath) !== packagedAuthoringSha256) {
        contract = { ok: false, problems: [...contract.problems, 'agent modified immutable packaged authoring resources'] };
      }
    }

    await stopPackagedApp(appProcess);

    let visualOk = !appBundle;
    if (packageRoot && appBundle && !generatedPackageContainsCredential) {
      const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'extension.json'), 'utf8'));
      const routes = (manifest?.contributes?.views ?? [])
        .filter((view) => view?.location === 'main' && typeof view?.route === 'string')
        .map((view) => view.route);
      const visualSetupPath = resolve(caseOut, 'visual-setup-actions.json');
      write(visualSetupPath, `${JSON.stringify(testCase.visualSetupActions ?? [], null, 2)}\n`);
      const visualInteractionsPath = resolve(caseOut, 'visual-interactions.json');
      write(visualInteractionsPath, `${JSON.stringify(testCase.visualInteractions ?? [], null, 2)}\n`);
      const visual = run(
        process.execPath,
        [
          resolve(repoRoot, 'scripts/extension-visual-eval.mjs'),
          `--app=${appBundle}`,
          `--extension-dir=${packageRoot}`,
          `--generated-routes=${routes.join(',')}`,
          `--baseline-routes=/home`,
          `--out=${resolve(caseOut, 'visual-qa')}`,
          `--setup-actions=${visualSetupPath}`,
          `--interactions=${visualInteractionsPath}`,
          '--skip-onboarding=true',
        ],
        { timeoutMs: 300000 },
      );
      write(resolve(caseOut, 'visual-qa.stdout.txt'), visual.stdout ?? '');
      write(resolve(caseOut, 'visual-qa.stderr.txt'), visual.stderr ?? '');
      const visualSummaryPath = resolve(caseOut, 'visual-qa/visual-capture-summary.json');
      const visualSummary = existsSync(visualSummaryPath) ? JSON.parse(readFileSync(visualSummaryPath, 'utf8')) : null;
      visualOk =
        visual.status === 0 &&
        visualSummary !== null &&
        (routes.length === 0 || (Array.isArray(visualSummary.generated) && visualSummary.generated.length >= routes.length));
    }

    write(resolve(caseOut, 'contract.json'), `${JSON.stringify(contract, null, 2)}\n`);
    write(resolve(caseOut, 'commands.json'), `${JSON.stringify(commands, null, 2)}\n`);
    write(resolve(caseOut, 'behavior.json'), `${JSON.stringify(behavior, null, 2)}\n`);
    const commandOk = commands.length === 5 && commands.every((entry) => entry.logicalOk === true);
    const behaviorOk = behavior.length === (testCase.behaviorChecks ?? []).length && behavior.every((entry) => entry.logicalOk === true);
    const realAppOk = testCase.requireRealAppInteraction !== true || (hasSuccessfulComputerUseEvidence(transcript) && visualOk);
    const agentOk = agent.status === 0;
    summary.cases.push({
      id: testCase.id,
      extensionId: testCase.extensionId,
      status: agentOk && contract.ok && commandOk && behaviorOk && realAppOk && visualOk ? 'passed' : 'failed',
      agentOk,
      agentStatus: agent.status,
      packageRoot,
      contract,
      commandOk,
      behaviorOk,
      realAppOk,
      visualOk,
      conversationId,
    });

    if (packageRoot && !keepExtensions) run(cliPath, ['extensions', 'delete', testCase.extensionId, '--json']);
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    write(resolve(caseOut, 'runner-error.txt'), `${message}\n`);
    if (!summary.cases.some((entry) => entry.id === testCase.id)) {
      summary.cases.push({
        id: testCase.id,
        extensionId: testCase.extensionId,
        status: 'failed',
        error: message,
      });
    }
  } finally {
    await stopPackagedApp(appProcess);
    rmSync(workspace, { recursive: true, force: true });
  }
}

summary.finishedAt = new Date().toISOString();
summary.ok = summary.cases.length > 0 && summary.cases.every((entry) => entry.status === 'passed' || entry.dryRun);
write(resolve(outRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
artifactRedactor.sanitizeTree(outRoot);
artifactRedactor.assertCleanTree(outRoot);
console.log(
  JSON.stringify({ ok: summary.ok, outRoot, cases: summary.cases.map(({ id, status, dryRun }) => ({ id, status, dryRun })) }, null, 2),
);
process.exit(summary.ok ? 0 : 1);
