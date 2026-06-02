#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2).filter((value, index) => !(index === 0 && value === '--'));
const command = args[0] ?? 'help';
const defaultHfDataset = 'patrickleenyc/personal-agent-evals';

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = args.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function write(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, 'utf8');
}

function append(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, { encoding: 'utf8', flag: 'a' });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

function readHfToken() {
  const tokenEnv = arg('token-env', 'HF_TOKEN');
  const envToken = process.env[tokenEnv];
  if (envToken) return envToken.trim();
  const tokenFile = path.join(process.env.HOME ?? '', '.cache', 'huggingface', 'token');
  if (existsSync(tokenFile)) return readFileSync(tokenFile, 'utf8').trim();
  return '';
}

async function fetchHfJson(endpoint, params) {
  const token = readHfToken();
  const url = new URL(`https://datasets-server.huggingface.co/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${endpoint} failed ${response.status}: ${text.slice(0, 500)}`);
  }
  return response.json();
}

function parseMaybeJson(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function fetchHfCases({ dataset, config = 'cases', split = 'train', offset = 0, length = 20 }) {
  const data = await fetchHfJson('rows', { dataset, config, split, offset, length });
  return (data.rows ?? []).map((entry) => entry.row).filter(Boolean);
}

async function fetchAllHfRows({ dataset, config, split = 'train' }) {
  const rows = [];
  const pageSize = 100;
  for (let offset = 0; offset < 10_000; offset += pageSize) {
    const page = await fetchHfCases({ dataset, config, split, offset, length: pageSize });
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchCoreHfCases({ dataset, split = 'train', perType = 3 }) {
  const [cases, basisRows, resolutions] = await Promise.all([
    fetchAllHfRows({ dataset, config: 'cases', split }),
    fetchAllHfRows({ dataset, config: 'basis_candidates', split }),
    fetchAllHfRows({ dataset, config: 'commit_resolution', split }),
  ]);
  const caseBySourceCandidateId = new Map(cases.map((row) => [row.source_candidate_id, row]));
  const resolutionByCaseId = new Map(resolutions.map((row) => [row.case_id, row]));
  const selected = [];
  const counts = new Map();
  const targetRepo = path.resolve(arg('target-repo', repoRoot));
  for (const basis of basisRows) {
    const triage = parseMaybeJson(basis.triage, {});
    const type = String(triage.eval_type ?? '').replace(/^triage\./, '') || 'case';
    if (!['frontend', 'coding', 'behavior'].includes(type)) continue;
    if ((counts.get(type) ?? 0) >= perType) continue;
    const row = caseBySourceCandidateId.get(basis.id);
    if (!row) continue;
    const resolution = resolutionByCaseId.get(basis.id);
    const selectedCommit =
      stringOrEmpty(resolution?.selected_commit) ||
      stringOrEmpty(resolution?.recommended_base_commit) ||
      stringOrEmpty(row.base_commit);
    if (hasFlag('require-commit') && (!selectedCommit || !commitExists(targetRepo, selectedCommit))) continue;
    selected.push({
      ...row,
      coreType: type,
      coreFailureMode: String(triage.failure_mode ?? '').replace(/^triage\./, ''),
      basisCandidateId: basis.id,
      resolvedCommit: selectedCommit,
      commitResolution: resolution ?? null,
    });
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return selected;
}

function stringOrEmpty(value) {
  return typeof value === 'string' && value.trim() && value !== 'None' ? value.trim() : '';
}

function childExitError(label, code, signal) {
  return new Error(`${label} exited before ready: ${code ?? signal ?? 'unknown'}`);
}

function waitForChildReady(child, label) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      child.off('message', onMessage);
      child.off('exit', onExit);
      child.off('error', onError);
    };
    const onMessage = (message) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') {
        cleanup();
        resolve(message);
        return;
      }
      if (message.type === 'fatal') {
        cleanup();
        reject(new Error(`${label} fatal: ${message.error ?? 'unknown error'}`));
      }
    };
    const onExit = (code, signal) => {
      cleanup();
      reject(childExitError(label, code, signal));
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    child.on('message', onMessage);
    child.once('exit', onExit);
    child.once('error', onError);
  });
}

async function startBenchBackend({ mode, stateRoot }) {
  const extensionHostFile = path.join(repoRoot, 'packages', 'desktop', 'dist', 'backend', 'extension-host-child.js');
  const backendFile = path.join(repoRoot, 'packages', 'desktop', 'dist', 'backend', 'local-backend-child.js');
  assert(existsSync(extensionHostFile), `Missing desktop backend build: ${extensionHostFile}\nRun: pnpm --dir packages/desktop run build:main`);
  assert(existsSync(backendFile), `Missing desktop backend build: ${backendFile}\nRun: pnpm --dir packages/desktop run build:main`);
  const existingTestingStateRoot = path.join(process.env.HOME ?? '', '.local', 'state', 'neon-pilot-testing');
  const root = stateRoot || process.env.NEON_PILOT_STATE_ROOT || (existsSync(existingTestingStateRoot) ? existingTestingStateRoot : mkdtempSync(path.join(tmpdir(), `neon-pilot-ds4-bench-${mode}-`)));
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NEON_PILOT_DESKTOP_DEV_BUNDLE: '1',
    NEON_PILOT_REPO_ROOT: repoRoot,
    NEON_PILOT_RUNTIME_CHANNEL: 'test',
    NEON_PILOT_STATE_ROOT: root,
    NEON_PILOT_CONFIG_ROOT: path.join(root, 'config'),
    NEON_PILOT_DESKTOP_USER_DATA_DIR: path.join(root, 'user-data'),
    NEON_PILOT_DAEMON_SOCKET_PATH: path.join(root, 'daemon.sock'),
    NEON_PILOT_COMPANION_PORT: '0',
    NEON_PILOT_DS4_OPTIMIZATION_MODE: mode === 'baseline' ? 'baseline' : 'optimized',
  };
  const extensionHost = spawn(process.execPath, [extensionHostFile], { cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  extensionHost.stderr?.on('data', (chunk) => process.stderr.write(`[bench-extension-host] ${String(chunk)}`));
  const extensionReady = await waitForChildReady(extensionHost, 'extension host');
  const backend = spawn(process.execPath, [backendFile], {
    cwd: repoRoot,
    env: {
      ...env,
      NEON_PILOT_EXTENSION_HOST_BASE_URL: `http://127.0.0.1:${extensionReady.port}`,
      NEON_PILOT_EXTENSION_HOST_TOKEN: extensionReady.token,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  backend.stderr?.on('data', (chunk) => process.stderr.write(`[bench-backend] ${String(chunk)}`));
  const backendReady = await waitForChildReady(backend, 'backend');
  const children = [backend, extensionHost];
  return {
    baseUrl: `http://127.0.0.1:${backendReady.port}`,
    token: backendReady.token,
    stateRoot: root,
    async stop() {
      for (const child of children) {
        if (!child.killed && child.connected) child.send({ type: 'shutdown' });
      }
      await sleep(500);
      for (const child of children) {
        if (!child.killed) child.kill('SIGTERM');
      }
    },
  };
}

async function dispatchLocalApi(client, request) {
  const response = await fetch(`${client.baseUrl}/dispatch`, {
    method: 'POST',
    headers: { authorization: `Bearer ${client.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ request }),
  });
  const text = await response.text();
  let payload = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Keep plain text bodies as-is.
  }
  if (!response.ok) throw new Error(`Backend dispatch failed ${response.status}: ${JSON.stringify(payload).slice(0, 1000)}`);
  return payload;
}

async function streamLocalApiEvents(client, streamPath, onEvent, { timeoutMs }) {
  const url = new URL('/stream', client.baseUrl);
  url.searchParams.set('path', streamPath);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    const response = await fetch(url, { headers: { authorization: `Bearer ${client.token}` }, signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`Stream failed ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseSseEvent(raw);
        if (event && (await onEvent(event)) === false) {
          controller.abort();
          return;
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

function parseSseEvent(raw) {
  let type = 'message';
  const data = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) type = line.slice('event:'.length).trim();
    if (line.startsWith('data:')) data.push(line.slice('data:'.length).trimStart());
  }
  if (!data.length) return { type };
  const text = data.join('\n');
  try {
    return { type, data: JSON.parse(text) };
  } catch {
    return { type, data: text };
  }
}

function runNodeTest(workspace) {
  execFileSync(process.execPath, ['test.mjs'], { cwd: workspace, stdio: 'pipe' });
}

function createPackageJson(name) {
  return JSON.stringify({ name, private: true, type: 'module', scripts: { test: 'node test.mjs' } }, null, 2);
}

function makeLargeHandlerFixture() {
  const filler = Array.from({ length: 90 }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    return `  output.steps.push("legacy-${n}:" + value);`;
  }).join('\n');
  return `export function normalizeInvoiceId(value) {
  const output = { steps: [] };
${filler}
  return output.steps.join("|");
}
`;
}

const tasks = [
  {
    id: 'small-test-fix',
    title: 'Fix a small failing utility',
    category: 'coding',
    setup(workspace) {
      write(path.join(workspace, 'package.json'), createPackageJson('ds4-small-test-fix'));
      write(
        path.join(workspace, 'src', 'slug.js'),
        `export function slugifyTitle(input) {
  return input.trim().toLowerCase().replaceAll(" ", "-");
}
`,
      );
      write(
        path.join(workspace, 'test.mjs'),
        `import assert from 'node:assert/strict';
import { slugifyTitle } from './src/slug.js';

assert.equal(slugifyTitle('  Hello, DS4 World!  '), 'hello-ds4-world');
assert.equal(slugifyTitle('Multiple   Spaces'), 'multiple-spaces');
assert.equal(slugifyTitle('Already-ok'), 'already-ok');
`,
      );
    },
    prompt: [
      'Fix this workspace so `node test.mjs` passes.',
      'Keep the change focused. Run the test before you finish.',
    ].join('\n'),
    grade(workspace) {
      runNodeTest(workspace);
      const text = readFileSync(path.join(workspace, 'src', 'slug.js'), 'utf8');
      assert(text.includes('slugifyTitle'), 'slugifyTitle export is missing.');
    },
  },
  {
    id: 'multi-file-search-edit',
    title: 'Find and update a cross-file behavior',
    category: 'search',
    setup(workspace) {
      write(path.join(workspace, 'package.json'), createPackageJson('ds4-multi-file-search-edit'));
      write(
        path.join(workspace, 'src', 'pricing.js'),
        `export function formatPrice(cents) {
  return "$" + (cents / 100).toFixed(2);
}
`,
      );
      write(
        path.join(workspace, 'src', 'receipt.js'),
        `import { formatPrice } from './pricing.js';

export function renderReceipt(items) {
  return items.map((item) => item.name + ': ' + formatPrice(item.cents)).join('\\n');
}
`,
      );
      write(
        path.join(workspace, 'test.mjs'),
        `import assert from 'node:assert/strict';
import { renderReceipt } from './src/receipt.js';

const receipt = renderReceipt([{ name: 'Tea', cents: 350 }, { name: 'Cake', cents: 700 }]);
assert.equal(receipt, 'Tea: USD 3.50\\nCake: USD 7.00');
`,
      );
    },
    prompt: [
      'The receipt output format changed. Make the tests pass with the smallest correct code change.',
      'Use search or file reads as needed, then run `node test.mjs`.',
    ].join('\n'),
    grade(workspace) {
      runNodeTest(workspace);
      const pricing = readFileSync(path.join(workspace, 'src', 'pricing.js'), 'utf8');
      assert(pricing.includes('USD'), 'pricing formatter did not include USD.');
    },
  },
  {
    id: 'large-anchor-edit',
    title: 'Replace a large function body',
    category: 'large-edit',
    setup(workspace) {
      write(path.join(workspace, 'package.json'), createPackageJson('ds4-large-anchor-edit'));
      write(path.join(workspace, 'src', 'invoice.js'), makeLargeHandlerFixture());
      write(
        path.join(workspace, 'test.mjs'),
        `import assert from 'node:assert/strict';
import { normalizeInvoiceId } from './src/invoice.js';

assert.equal(normalizeInvoiceId(' inv-000123 '), 'INV-123');
assert.equal(normalizeInvoiceId('0007'), 'INV-7');
assert.equal(normalizeInvoiceId('INV-42'), 'INV-42');
`,
      );
    },
    prompt: [
      'Replace the legacy invoice normalizer with the intended behavior and make `node test.mjs` pass.',
      'The implementation should trim input, remove an optional `inv-`/`INV-` prefix, strip leading zeroes, and return `INV-<number>`.',
      'Keep the file small after the change.',
    ].join('\n'),
    grade(workspace) {
      runNodeTest(workspace);
      const invoice = readFileSync(path.join(workspace, 'src', 'invoice.js'), 'utf8');
      assert(invoice.split('\n').length <= 20, 'legacy body was not compactly replaced.');
    },
  },
  {
    id: 'cli-progressive-disclosure',
    title: 'Use DS4 CLI for withheld capabilities',
    category: 'cli',
    setup(workspace) {
      write(path.join(workspace, 'package.json'), createPackageJson('ds4-cli-progressive-disclosure'));
      write(
        path.join(workspace, 'src', 'report.js'),
        `export function summarizeTools(toolText) {
  const lines = toolText.split('\\n').map((line) => line.trim()).filter(Boolean);
  return {
    hasSubagent: lines.some((line) => line.includes('subagent')),
    hasWeb: lines.some((line) => line.includes('web_search') || line.includes('web_fetch')),
    count: lines.length,
  };
}
`,
      );
      write(
        path.join(workspace, 'test.mjs'),
        `import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { summarizeTools } from './src/report.js';

assert.equal(existsSync('ds4-tools.txt'), true, 'expected ds4-tools.txt');
const report = summarizeTools(readFileSync('ds4-tools.txt', 'utf8'));
assert.equal(report.hasSubagent, true, 'expected subagent to be discoverable through ds4 CLI');
assert.equal(report.hasWeb, true, 'expected web capability to be discoverable through ds4 CLI');
assert.ok(report.count >= 2, 'expected at least two CLI capabilities');
`,
      );
    },
    prompt: [
      'Use the DS4 CLI to discover withheld tools and save the visible tool list to `ds4-tools.txt` in this workspace.',
      'Then run `node test.mjs`. Do not search the repo to infer the DS4 tool list.',
    ].join('\n'),
    grade(workspace) {
      runNodeTest(workspace);
    },
  },
];

function taskById(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error(`Unknown task "${id}". Run: pnpm run bench:ds4 -- list`);
  return task;
}

function usage() {
  return [
    'DS4 task benchmark',
    '',
    'Commands:',
    '  list',
    '  hf-list [--dataset=patrickleenyc/personal-agent-evals] [--limit=20] [--core] [--per-type=3] [--require-commit]',
    '  hf-prepare --case=<id> [--dataset=patrickleenyc/personal-agent-evals] [--mode=optimized|baseline] [--out=<dir>] [--core]',
    '  api-smoke [--mode=optimized|baseline]',
    '  run-core --mode=optimized|baseline|both [--target-repo=<path>] [--base-url=<url> --token=<token>] [--out=<dir>] [--timeout-ms=900000] [--limit=9]',
    '  prepare --task=<id> [--mode=optimized|baseline] [--out=<dir>]',
    '  grade --workspace=<dir> [--metrics=<file>] [--json]',
    '  report --results=<file[,file...]> [--json]',
    '',
    'The harness creates fixed workspaces and deterministic graders. Run the emitted prompt',
    'through Neon Pilot, then grade the workspace and aggregate metrics across modes.',
  ].join('\n');
}

function listTasks() {
  for (const task of tasks) {
    console.log(`${task.id}\t${task.category}\t${task.title}`);
  }
}

async function listHfCases() {
  const dataset = arg('dataset', defaultHfDataset);
  const limit = Number(arg('limit', '20')) || 20;
  const offset = Number(arg('offset', '0')) || 0;
  const perType = Number(arg('per-type', '3')) || 3;
  const cases = hasFlag('core')
    ? await fetchCoreHfCases({ dataset, perType })
    : await fetchHfCases({ dataset, offset, length: Math.min(Math.max(limit, 1), 100) });
  for (const row of cases) {
    const scoring = parseMaybeJson(row.scoring, {});
    const prompt = normalizeNewlines(String(row.prompt ?? '')).replace(/\s+/g, ' ').trim();
    const kind = row.coreType ?? row.type ?? scoring?.type ?? 'case';
    const failure = row.coreFailureMode ? `\t${row.coreFailureMode}` : '';
    const commit = row.resolvedCommit ? `\t${row.resolvedCommit.slice(0, 12)}` : '';
    console.log(`${row.id}\t${kind}${failure}${commit}\t${row.repo ?? ''}\t${prompt.slice(0, 120)}`);
  }
}

async function prepareHfCase() {
  const dataset = arg('dataset', defaultHfDataset);
  const caseId = arg('case');
  assert(caseId, '--case is required');
  const mode = arg('mode', 'optimized');
  assert(['optimized', 'baseline'].includes(mode), '--mode must be optimized or baseline');

  let found = null;
  if (hasFlag('core')) {
    const rows = await fetchCoreHfCases({ dataset, perType: Number(arg('per-type', '3')) || 3 });
    found = rows.find((row) => row.id === caseId || row.basisCandidateId === caseId) ?? null;
  } else {
    const pageSize = 100;
    for (let offset = 0; offset < 1000 && !found; offset += pageSize) {
      const rows = await fetchHfCases({ dataset, offset, length: pageSize });
      found = rows.find((row) => row.id === caseId) ?? null;
      if (rows.length < pageSize) break;
    }
  }
  assert(found, `Case not found: ${caseId}`);

  const out = arg('out') || mkdtempSync(path.join(tmpdir(), `neon-pilot-ds4-hf-${caseId.replace(/[^a-zA-Z0-9_.-]/g, '-')}-`));
  if (existsSync(out) && hasFlag('clean')) rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const scoring = parseMaybeJson(found.scoring, {});
  const prompt = [
    normalizeNewlines(String(found.prompt ?? '')).trim(),
    '',
    `Benchmark case: ${found.id}`,
    `Benchmark mode: ${mode}`,
    found.repo ? `Target repo: ${found.repo}` : '',
    found.base_commit ? `Base commit: ${found.base_commit}` : '',
    '',
    'When finished, leave the target repo/workspace in the completed state. The grader/reviewer will run separately.',
  ]
    .filter(Boolean)
    .join('\n');

  write(path.join(out, 'BENCHMARK_PROMPT.md'), `${prompt}\n`);
  writeJson(path.join(out, '.ds4-benchmark.json'), {
    source: 'huggingface',
    dataset,
    config: 'cases',
    split: 'train',
    taskId: found.id,
    title: found.id,
    category: found.type ?? 'case',
    coreType: found.coreType ?? '',
    coreFailureMode: found.coreFailureMode ?? '',
    basisCandidateId: found.basisCandidateId ?? '',
    resolvedCommit: found.resolvedCommit ?? '',
    commitResolution: found.commitResolution ?? null,
    mode,
    workspace: out,
    targetRepo: found.repo ?? '',
    baseCommit: found.base_commit ?? '',
    casePath: found.case_path ?? '',
    sourceCandidateId: found.source_candidate_id ?? '',
    scoring,
    agent: parseMaybeJson(found.agent, {}),
    preparedAt: new Date().toISOString(),
    prompt,
  });

  console.log(`workspace=${out}`);
  console.log(`prompt=${path.join(out, 'BENCHMARK_PROMPT.md')}`);
  console.log(`targetRepo=${found.repo ?? ''}`);
  console.log(`baseCommit=${found.base_commit ?? ''}`);
  console.log('');
  console.log(prompt);
}

function currentGitSnapshot(cwd) {
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const status = execFileSync('git', ['status', '--short'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return { head, dirty: status.trim().length > 0, statusShort: status };
  } catch (error) {
    return { head: '', dirty: null, statusShort: '', error: error instanceof Error ? error.message : String(error) };
  }
}

function createCaseWorkspace({ sourceRepo, outputDir, mode, caseId, commit }) {
  const snapshot = currentGitSnapshot(sourceRepo);
  const targetCommit = commit && commitExists(sourceRepo, commit) ? commit : snapshot.head;
  if (hasFlag('require-commit') && commit && targetCommit !== commit) {
    throw new Error(`Resolved commit is missing for ${caseId}: ${commit}`);
  }
  if (!targetCommit) return { workspace: sourceRepo, snapshot, isolated: false, targetCommit: '' };
  if (hasFlag('no-isolate')) return { workspace: sourceRepo, snapshot, isolated: false, targetCommit };
  const worktreeRoot = path.join(outputDir, 'worktrees');
  mkdirSync(worktreeRoot, { recursive: true });
  const workspace = path.join(worktreeRoot, `${mode}-${caseId}`);
  rmSync(workspace, { recursive: true, force: true });
  execFileSync('git', ['worktree', 'add', '--detach', workspace, targetCommit], { cwd: sourceRepo, stdio: 'pipe' });
  const sourceNodeModules = path.join(sourceRepo, 'node_modules');
  const workspaceNodeModules = path.join(workspace, 'node_modules');
  if (existsSync(sourceNodeModules) && !existsSync(workspaceNodeModules)) {
    symlinkSync(sourceNodeModules, workspaceNodeModules, 'dir');
  }
  return { workspace, snapshot, isolated: true, targetCommit };
}

function commitExists(cwd, commit) {
  if (!commit) return false;
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function buildHfPrompt(row, mode, targetRepo) {
  const hasBaseCommit = commitExists(targetRepo, row.base_commit);
  return [
    normalizeNewlines(String(row.prompt ?? '')).trim(),
    '',
    `Benchmark case: ${row.id}`,
    `Benchmark mode: ${mode}`,
    `Target repo: ${targetRepo}`,
    row.repo && row.repo !== targetRepo ? `Original dataset repo: ${row.repo}` : '',
    hasBaseCommit ? `Base commit: ${row.base_commit}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function runOneCase({ client, row, mode, outputDir, timeoutMs }) {
  const sourceRepo = path.resolve(arg('target-repo', repoRoot));
  const workspaceInfo = createCaseWorkspace({ sourceRepo, outputDir, mode, caseId: row.id, commit: row.resolvedCommit || row.base_commit });
  const targetRepo = workspaceInfo.workspace;
  const prompt = buildHfPrompt(row, mode, targetRepo);
  const startedAtMs = Date.now();
  const metrics = {
    turns: 0,
    toolCalls: 0,
    toolErrors: 0,
    errors: [],
    tools: {},
    stats: null,
    agentStarted: false,
    agentEnded: false,
    firstToolMs: null,
    firstTokenStatsMs: null,
  };
  const snapshot = workspaceInfo.snapshot;
  const created = await dispatchLocalApi(client, {
    method: 'POST',
    path: '/api/live-sessions',
    body: {
      cwd: targetRepo,
      model: 'ds4/deepseek-v4-flash',
      thinkingLevel: 'high',
    },
  });
  const conversationId = created.id;
  assert(conversationId, `Live session creation returned no id: ${JSON.stringify(created).slice(0, 1000)}`);
  const streamPath = `/api/live-sessions/${encodeURIComponent(conversationId)}/events?tailBlocks=80&surfaceId=bench&surfaceType=chat`;
  const streamPromise = streamLocalApiEvents(
    client,
    streamPath,
    async (event) => {
      const data = event.data && typeof event.data === 'object' ? event.data : {};
      const type = data.type ?? event.type;
      if (type === 'agent_start') metrics.agentStarted = true;
      if (type === 'agent_end') {
        metrics.agentEnded = true;
        return false;
      }
      if (type === 'turn_end') metrics.turns += 1;
      if (type === 'tool_start') {
        metrics.toolCalls += 1;
        if (metrics.firstToolMs === null) metrics.firstToolMs = Date.now() - startedAtMs;
        const toolName = String(data.toolName ?? 'unknown');
        metrics.tools[toolName] = (metrics.tools[toolName] ?? 0) + 1;
      }
      if (type === 'tool_end' && data.isError) metrics.toolErrors += 1;
      if (type === 'stats_update') {
        metrics.stats = data.tokens ?? null;
        if (metrics.firstTokenStatsMs === null) metrics.firstTokenStatsMs = Date.now() - startedAtMs;
      }
      if (type === 'error') metrics.errors.push(String(data.message ?? 'unknown error'));
      return true;
    },
    { timeoutMs },
  );
  try {
    await sleep(250);
    await dispatchLocalApi(client, {
      method: 'POST',
      path: `/api/live-sessions/${encodeURIComponent(conversationId)}/prompt`,
      body: {
        text: prompt,
        behavior: 'followUp',
      },
    });
    await streamPromise;
  } catch (error) {
    metrics.errors.push(error instanceof Error ? error.message : String(error));
  }
  const wallMs = Date.now() - startedAtMs;
  const result = {
    caseId: row.id,
    sourceCandidateId: row.source_candidate_id ?? '',
    mode,
    coreType: row.coreType ?? row.type ?? '',
    coreFailureMode: row.coreFailureMode ?? '',
    conversationId,
    prompt,
    targetRepo,
    sourceRepo,
    isolatedWorkspace: workspaceInfo.isolated,
    originalDatasetRepo: row.repo ?? '',
    baseCommit: row.base_commit ?? '',
    snapshot,
    targetCommit: workspaceInfo.targetCommit,
    resolvedCommit: row.resolvedCommit ?? '',
    passed: metrics.agentEnded && metrics.errors.length === 0,
    wallMs,
    metrics: {
      turns: metrics.turns,
      toolCalls: metrics.toolCalls,
      toolErrors: metrics.toolErrors,
      wallMs,
      inputTokens: metrics.stats?.input ?? null,
      outputTokens: metrics.stats?.output ?? null,
      totalTokens: metrics.stats?.total ?? null,
      cacheReadTokens: metrics.stats?.cacheRead ?? null,
      cacheWriteTokens: metrics.stats?.cacheWrite ?? null,
      firstToolMs: metrics.firstToolMs,
      firstTokenStatsMs: metrics.firstTokenStatsMs,
      tools: metrics.tools,
      errors: metrics.errors,
      agentStarted: metrics.agentStarted,
      agentEnded: metrics.agentEnded,
    },
    scoring: parseMaybeJson(row.scoring, {}),
    createdAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date().toISOString(),
  };
  writeJson(path.join(outputDir, `${mode}-${row.id}.json`), result);
  return result;
}

async function runCore() {
  const dataset = arg('dataset', defaultHfDataset);
  const requestedMode = arg('mode', 'optimized');
  assert(['optimized', 'baseline', 'both'].includes(requestedMode), '--mode must be optimized, baseline, or both');
  const modes = requestedMode === 'both' ? ['optimized', 'baseline'] : [requestedMode];
  const timeoutMs = Number(arg('timeout-ms', '900000')) || 900_000;
  const outputDir = path.resolve(arg('out') || path.join(repoRoot, 'artifacts', 'ds4-evals', new Date().toISOString().replace(/[:.]/g, '-')));
  mkdirSync(outputDir, { recursive: true });
  const limit = Number(arg('limit', '0')) || 0;
  const cases = (await fetchCoreHfCases({ dataset, perType: Number(arg('per-type', '3')) || 3 })).slice(0, limit > 0 ? limit : undefined);
  const results = [];
  for (const mode of modes) {
    const providedBaseUrl = arg('base-url');
    const providedToken = arg('token');
    const backend =
      providedBaseUrl && providedToken
        ? { baseUrl: providedBaseUrl, token: providedToken, stateRoot: '', stop: async () => {} }
        : await startBenchBackend({ mode, stateRoot: arg('state-root') });
    const client = { baseUrl: backend.baseUrl, token: backend.token };
    try {
      for (const row of cases) {
        console.log(`[${mode}] ${row.id}`);
        const result = await runOneCase({ client, row, mode, outputDir, timeoutMs });
        results.push(result);
        append(path.join(outputDir, 'results.jsonl'), `${JSON.stringify(result)}\n`);
      }
    } finally {
      await backend.stop();
    }
  }
  writeJson(path.join(outputDir, 'summary.json'), summarizeBenchmarkRun(results));
  console.log(`results=${outputDir}`);
}

async function apiSmoke() {
  const mode = arg('mode', 'optimized');
  assert(['optimized', 'baseline'].includes(mode), '--mode must be optimized or baseline');
  const backend = await startBenchBackend({ mode, stateRoot: arg('state-root') });
  try {
    const response = await fetch(`${backend.baseUrl}/health`, { headers: { authorization: `Bearer ${backend.token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(`Health failed ${response.status}: ${JSON.stringify(body)}`);
    console.log(JSON.stringify({ mode, baseUrl: backend.baseUrl, stateRoot: backend.stateRoot, health: body }, null, 2));
  } finally {
    await backend.stop();
  }
}

function summarizeBenchmarkRun(results) {
  const byMode = summarizeResults(
    results.map((result) => ({
      mode: result.mode,
      passed: result.passed,
      metrics: result.metrics,
    })),
  );
  return {
    generatedAt: new Date().toISOString(),
    caseCount: results.length,
    modes: byMode,
    cases: results.map((result) => ({
      caseId: result.caseId,
      mode: result.mode,
      coreType: result.coreType,
      passed: result.passed,
      wallMs: result.wallMs,
      turns: result.metrics.turns,
      toolCalls: result.metrics.toolCalls,
      inputTokens: result.metrics.inputTokens,
      outputTokens: result.metrics.outputTokens,
      errors: result.metrics.errors,
    })),
  };
}

function prepareTask() {
  const task = taskById(arg('task'));
  const mode = arg('mode', 'optimized');
  assert(['optimized', 'baseline'].includes(mode), '--mode must be optimized or baseline');
  const out = arg('out') || mkdtempSync(path.join(tmpdir(), `neon-pilot-ds4-bench-${task.id}-`));
  if (existsSync(out) && hasFlag('clean')) rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  task.setup(out);

  const prompt = [
    task.prompt,
    '',
    `Workspace: ${out}`,
    `Benchmark mode: ${mode}`,
    '',
    'When finished, leave the workspace in the completed state. The grader will run separately.',
  ].join('\n');
  write(path.join(out, 'BENCHMARK_PROMPT.md'), `${prompt}\n`);
  writeJson(path.join(out, '.ds4-benchmark.json'), {
    taskId: task.id,
    title: task.title,
    category: task.category,
    mode,
    workspace: out,
    preparedAt: new Date().toISOString(),
    prompt,
  });

  console.log(`workspace=${out}`);
  console.log(`prompt=${path.join(out, 'BENCHMARK_PROMPT.md')}`);
  console.log('');
  console.log(prompt);
}

function loadMetrics(file) {
  if (!file) return {};
  if (!existsSync(file)) throw new Error(`Metrics file not found: ${file}`);
  return readJson(file);
}

function gradeTask() {
  const workspace = path.resolve(arg('workspace'));
  assert(workspace, '--workspace is required');
  const metadataFile = path.join(workspace, '.ds4-benchmark.json');
  assert(existsSync(metadataFile), `Missing benchmark metadata: ${metadataFile}`);
  const metadata = readJson(metadataFile);
  const task = taskById(metadata.taskId);
  const started = Date.now();
  let passed = false;
  let error = '';
  try {
    task.grade(workspace);
    passed = true;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const result = {
    taskId: task.id,
    title: task.title,
    category: task.category,
    mode: metadata.mode,
    workspace,
    passed,
    error,
    gradeMs: Date.now() - started,
    metrics: loadMetrics(arg('metrics')),
    gradedAt: new Date().toISOString(),
  };
  const resultFile = path.join(workspace, `.ds4-benchmark-result-${metadata.mode}.json`);
  writeJson(resultFile, result);
  if (hasFlag('json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`${passed ? 'PASS' : 'FAIL'} ${task.id} (${metadata.mode})`);
    if (error) console.log(error);
    console.log(`result=${resultFile}`);
  }
  process.exitCode = passed ? 0 : 1;
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function summarizeResults(results) {
  const groups = new Map();
  for (const result of results) {
    const key = result.mode ?? 'unknown';
    const group = groups.get(key) ?? {
      mode: key,
      tasks: 0,
      passed: 0,
      failed: 0,
      turns: [],
      toolCalls: [],
      wallMs: [],
      inputTokens: [],
      outputTokens: [],
    };
    group.tasks += 1;
    result.passed ? (group.passed += 1) : (group.failed += 1);
    for (const [field, bucket] of [
      ['turns', group.turns],
      ['toolCalls', group.toolCalls],
      ['wallMs', group.wallMs],
      ['inputTokens', group.inputTokens],
      ['outputTokens', group.outputTokens],
    ]) {
      const value = numberOrNull(result.metrics?.[field]);
      if (value !== null) bucket.push(value);
    }
    groups.set(key, group);
  }
  return Array.from(groups.values()).map((group) => ({
    mode: group.mode,
    tasks: group.tasks,
    passed: group.passed,
    failed: group.failed,
    passRate: group.tasks ? Math.round((group.passed / group.tasks) * 1000) / 10 : 0,
    avgTurns: avg(group.turns),
    avgToolCalls: avg(group.toolCalls),
    avgWallMs: avg(group.wallMs),
    avgInputTokens: avg(group.inputTokens),
    avgOutputTokens: avg(group.outputTokens),
  }));
}

function avg(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function report() {
  const resultFiles = arg('results')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  assert(resultFiles.length > 0, '--results is required');
  const results = resultFiles.map((file) => readJson(path.resolve(file)));
  const summary = summarizeResults(results);
  if (hasFlag('json')) {
    console.log(JSON.stringify({ summary, results }, null, 2));
    return;
  }
  console.log('mode\ttasks\tpass%\tavg turns\tavg tools\tavg wall ms\tavg input tok\tavg output tok');
  for (const row of summary) {
    console.log(
      [
        row.mode,
        row.tasks,
        row.passRate,
        row.avgTurns ?? '',
        row.avgToolCalls ?? '',
        row.avgWallMs ?? '',
        row.avgInputTokens ?? '',
        row.avgOutputTokens ?? '',
      ].join('\t'),
    );
  }
}

try {
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(usage());
  } else if (command === 'list') {
    listTasks();
  } else if (command === 'hf-list') {
    await listHfCases();
  } else if (command === 'hf-prepare') {
    await prepareHfCase();
  } else if (command === 'run-core') {
    await runCore();
  } else if (command === 'api-smoke') {
    await apiSmoke();
  } else if (command === 'prepare') {
    prepareTask();
  } else if (command === 'grade') {
    gradeTask();
  } else if (command === 'report') {
    report();
  } else {
    throw new Error(`Unknown command: ${command}\n\n${usage()}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
