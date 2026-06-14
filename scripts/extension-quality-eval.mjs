#!/usr/bin/env node
/* eslint-env node */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2).filter((value, index) => !(index === 0 && value === '--'));

function arg(name, fallback = '') {
  const exact = `--${name}`;
  const prefix = `${exact}=`;
  const found = args.find((value) => value.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  return args.includes(exact) ? 'true' : fallback;
}

function boolArg(name) {
  return arg(name, 'false') === 'true';
}

function numberArg(name, fallback) {
  const value = Number(arg(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function readJsonl(file) {
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${file}:${index + 1}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, 'utf8');
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: 50 * 1024 * 1024,
    timeout: options.timeoutMs,
  });
}

function currentHead() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function casePrompt(testCase) {
  const extensionBase = `.eval-extensions/${testCase.id}`;
  return [
    `Build this Neon Pilot extension in this isolated repo worktree.`,
    '',
    `Case id: ${testCase.id}`,
    `Expected primary surface: ${testCase.surface}`,
    `Create the extension package under: ${extensionBase}/<extension-id>`,
    '',
    'User request:',
    testCase.prompt,
    '',
    'One-shot requirements:',
    '- Before editing, write a short UX brief in your answer or notes: primary user/job, primary surface, information architecture, state model, shared UI primitives, and visual acceptance criteria.',
    '- Implement the extension with editable source files and current dist artifacts.',
    `- Put all new extension package files under ${extensionBase}/ so the evaluator can find them.`,
    '- Use only public extension SDK imports from @neon-pilot/extensions, @neon-pilot/extensions/ui, or narrow backend SDK subpaths.',
    '- Use shared UI primitives and constrained controls where possible.',
    '- Add command contributions for meaningful user-reachable actions.',
    '- Destructive user actions such as delete/remove/replace must require confirmation through the app UI.',
    '- Create/new commands should deep-link or otherwise open the create flow; do not make them duplicate the generic open-page command unless you document a host limitation.',
    '- Include loading, empty, error, success, disabled, and long-running states where relevant.',
    '- Run the narrowest meaningful build/doctor/static validation you can from this worktree.',
    `- Before your final answer, run or report equivalent file evidence: find ${extensionBase} -maxdepth 3 -type f, and confirm an extension.json exists under ${extensionBase}/<extension-id>/.`,
    '- Do not create git commits or push. Leave changes in the worktree for evaluation.',
    '',
    'Acceptance criteria:',
    ...(testCase.expected ?? []).map((item) => `- ${item}`),
    '',
    'Final answer must include touched files, validation commands/results, and any user-visible path you could not validate.',
  ].join('\n');
}

function discoverExtensionDir(worktree, testCase) {
  const base = `.eval-extensions/${testCase.id}`;
  const result = run('find', [base, '-maxdepth', '2', '-name', 'extension.json', '-print'], { cwd: worktree });
  const first = (result.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  return first ? dirname(resolve(worktree, first)) : resolve(worktree, base);
}

function parseRunId(text) {
  const match = /\b(run-[^\s.]+)/.exec(text);
  return match?.[1] ?? '';
}

function runNeonPilotCase({ worktree, testCase, prompt, caseOut, timeoutMs, model, runner }) {
  if (runner === 'ask') {
    const neonArgs = [
      'ask',
      '--model',
      model,
      '--cwd',
      worktree,
      '--title',
      `Extension quality eval: ${testCase.id}`,
      '--timeout-ms',
      String(timeoutMs),
      '--format',
      'json',
      '--prompt',
      prompt,
    ];
    const result = run('neon-pilot', neonArgs, { cwd: repoRoot, timeoutMs });
    write(resolve(caseOut, 'neon-pilot.stdout.txt'), result.stdout ?? '');
    write(resolve(caseOut, 'neon-pilot.stderr.txt'), result.stderr ?? '');
    return { status: result.status === 0 ? 'completed' : 'failed', code: result.status, signal: result.signal, runner };
  }

  const startArgs = [
    'protocol',
    'neon-pilot-agent',
    'start',
    '--cwd',
    worktree,
    '--task-slug',
    testCase.id,
    '--prompt',
    prompt,
    '--model',
    model,
    '--json',
  ];
  const start = run('neon-pilot', startArgs, { cwd: repoRoot, timeoutMs: 120000 });
  write(resolve(caseOut, 'neon-pilot-start.stdout.txt'), start.stdout ?? '');
  write(resolve(caseOut, 'neon-pilot-start.stderr.txt'), start.stderr ?? '');
  const runId = parseRunId(`${start.stdout ?? ''}\n${start.stderr ?? ''}`);
  if (start.status !== 0 || !runId) {
    return { status: 'start_failed', code: start.status, signal: start.signal, runner, runId };
  }

  const wait = run(
    'neon-pilot',
    ['protocol', 'neon-pilot-agent', 'runs', 'wait-any', '--run-ids', runId, '--timeout-ms', String(timeoutMs), '--json'],
    { cwd: repoRoot, timeoutMs: timeoutMs + 30000 },
  );
  write(resolve(caseOut, 'neon-pilot-wait.stdout.txt'), wait.stdout ?? '');
  write(resolve(caseOut, 'neon-pilot-wait.stderr.txt'), wait.stderr ?? '');
  const logs = run('neon-pilot', ['protocol', 'neon-pilot-agent', 'runs', 'logs', runId, '--tail', '2000'], {
    cwd: repoRoot,
    timeoutMs: 120000,
  });
  write(resolve(caseOut, 'neon-pilot-logs.txt'), `${logs.stdout ?? ''}${logs.stderr ?? ''}`);
  return { status: wait.status === 0 ? 'completed' : 'failed', code: wait.status, signal: wait.signal, runner, runId };
}

function selectCases(cases) {
  const selectedId = arg('case');
  const selected = selectedId ? cases.filter((testCase) => testCase.id === selectedId) : cases;
  const limit = numberArg('limit', selected.length);
  return selected.slice(0, limit);
}

function runValidation(testCase, worktree, outDir, extensionDir) {
  if (!existsSync(resolve(extensionDir, 'extension.json'))) {
    const results = [
      {
        command: `test -f ${resolve(extensionDir, 'extension.json')}`,
        status: 1,
        signal: null,
        stdout: '',
        stderr: `No extension.json found at ${resolve(extensionDir, 'extension.json')}\n`,
      },
    ];
    write(resolve(outDir, 'validation.json'), `${JSON.stringify(results, null, 2)}\n`);
    return results;
  }

  const results = [];
  for (const rawCommand of testCase.validation ?? []) {
    const command = rawCommand.replaceAll('<extensionDir>', extensionDir);
    const result = run('bash', ['-lc', command], { cwd: repoRoot, timeoutMs: numberArg('validation-timeout-ms', 600000) });
    results.push({
      command,
      status: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
  write(resolve(outDir, 'validation.json'), `${JSON.stringify(results, null, 2)}\n`);
  return results;
}

function readIfExists(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

function analyzeQuality(testCase, extensionDir, outDir) {
  const manifestText = readIfExists(resolve(extensionDir, 'extension.json'));
  const frontendText = readIfExists(resolve(extensionDir, 'src', 'frontend.tsx'));
  const backendText = readIfExists(resolve(extensionDir, 'src', 'backend.ts'));
  const distDir = resolve(extensionDir, 'dist');
  const distFileList = existsSync(distDir)
    ? run('find', [distDir, '-type', 'f'], { cwd: repoRoot })
        .stdout.split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  const distSize = existsSync(distDir) ? run('du', ['-sk', distDir], { cwd: repoRoot }).stdout.trim().split(/\s+/)[0] : '0';

  let manifest = {};
  try {
    manifest = manifestText ? JSON.parse(manifestText) : {};
  } catch {
    manifest = {};
  }

  const commands = Array.isArray(manifest?.contributes?.commands) ? manifest.contributes.commands : [];
  const newCommand = commands.find((command) => /new|create/i.test(`${command.id ?? ''} ${command.title ?? ''}`));
  const openCommand = commands.find((command) => /open/i.test(`${command.id ?? ''} ${command.title ?? ''}`));
  const newCommandRoute = JSON.stringify(newCommand?.args ?? {});
  const openCommandRoute = JSON.stringify(openCommand?.args ?? {});
  const destructiveRequested = /delete|remove|destructive/i.test(`${testCase.prompt} ${(testCase.expected ?? []).join(' ')}`);
  const quality = {
    extensionDir,
    dist: {
      kilobytes: Number(distSize) || 0,
      fileCount: distFileList.length,
    },
    checks: [
      {
        id: 'extension_manifest',
        status: manifestText ? 'pass' : 'fail',
        detail: 'An extension.json file must exist in the discovered extension package root.',
      },
      {
        id: 'delete_confirmation',
        status:
          !destructiveRequested ||
          /\b(confirm|ConfirmDialog|pa\.ui\.confirm|window\.confirm|showDeleteConfirm|deleteConfirm)\b/.test(frontendText)
            ? 'pass'
            : 'fail',
        detail: destructiveRequested ? 'Destructive delete flows should require confirmation.' : 'No destructive delete flow requested.',
      },
      {
        id: 'new_command_deeplink',
        status: !newCommand || newCommandRoute !== openCommandRoute || /create|new/i.test(newCommandRoute) ? 'pass' : 'warn',
        detail: 'Create/new command should open the create flow, not duplicate the generic open command.',
      },
      {
        id: 'shared_ui_import',
        status: frontendText.includes('@neon-pilot/extensions/ui') ? 'pass' : 'fail',
        detail: 'Frontend should use public shared UI primitives.',
      },
      {
        id: 'backend_boundary',
        status: /@neon-pilot\/(core|desktop)|packages\/desktop|packages\/core/.test(backendText) ? 'fail' : 'pass',
        detail: 'Backend should not import core/desktop internals.',
      },
    ],
  };
  write(resolve(outDir, 'quality.json'), `${JSON.stringify(quality, null, 2)}\n`);
  return quality;
}

function gitText(worktree, argsForGit) {
  const result = run('git', argsForGit, { cwd: worktree });
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

const casesFile = resolve(repoRoot, arg('cases', 'benchmarks/extension-quality/tasks.jsonl'));
const outRoot = resolve(repoRoot, arg('out', `artifacts/extension-quality/${timestamp()}`));
const worktreeRoot = resolve(repoRoot, arg('worktree-root', `.tmp/extension-quality/${timestamp()}`));
const model = arg('model', 'opencode-go/deepseek-v4-flash');
const runner = arg('runner', 'protocol');
const timeoutMs = numberArg('timeout-ms', 1_800_000);
const dryRun = boolArg('dry-run');
const shouldValidate = boolArg('validate');
const keepWorktrees = boolArg('keep-worktrees');

const cases = selectCases(readJsonl(casesFile));
if (cases.length === 0) throw new Error('No cases selected.');

const head = currentHead();
const summary = {
  startedAt: new Date().toISOString(),
  repoRoot,
  casesFile,
  outRoot,
  worktreeRoot,
  model,
  runner,
  head,
  dryRun,
  validate: shouldValidate,
  results: [],
};

for (const testCase of cases) {
  const caseOut = resolve(outRoot, testCase.id);
  const worktree = resolve(worktreeRoot, testCase.id);
  const prompt = casePrompt(testCase);
  write(resolve(caseOut, 'prompt.txt'), prompt);

  if (dryRun) {
    const command =
      runner === 'ask'
        ? ['neon-pilot', 'ask', '--model', model, '--cwd', worktree, '--prompt', prompt]
        : [
            'neon-pilot',
            'protocol',
            'neon-pilot-agent',
            'start',
            '--cwd',
            worktree,
            '--task-slug',
            testCase.id,
            '--prompt',
            prompt,
            '--model',
            model,
          ];
    summary.results.push({ id: testCase.id, worktree, command: command.join(' '), dryRun: true, runner });
    continue;
  }

  mkdirSync(dirname(worktree), { recursive: true });
  const addResult = run('git', ['worktree', 'add', '--detach', worktree, head], { cwd: repoRoot });
  write(resolve(caseOut, 'worktree-add.stdout.txt'), addResult.stdout ?? '');
  write(resolve(caseOut, 'worktree-add.stderr.txt'), addResult.stderr ?? '');
  if (addResult.status !== 0) {
    summary.results.push({ id: testCase.id, status: 'worktree_failed', code: addResult.status });
    continue;
  }

  const result = runNeonPilotCase({ worktree, testCase, prompt, caseOut, timeoutMs, model, runner });
  const extensionDir = discoverExtensionDir(worktree, testCase);
  write(resolve(caseOut, 'extension-dir.txt'), `${extensionDir}\n`);
  write(resolve(caseOut, 'git-status.txt'), gitText(worktree, ['status', '--short']));
  write(resolve(caseOut, 'diff.patch'), gitText(worktree, ['diff', '--binary']));

  const validation = shouldValidate ? runValidation(testCase, worktree, caseOut, extensionDir) : [];
  const quality = analyzeQuality(testCase, extensionDir, caseOut);
  summary.results.push({
    id: testCase.id,
    worktree,
    outputDir: caseOut,
    status: result.status,
    code: result.code,
    signal: result.signal,
    runner: result.runner,
    runId: result.runId,
    validation: validation.map((entry) => ({ command: entry.command, status: entry.status, signal: entry.signal })),
    quality: quality.checks.map((entry) => ({ id: entry.id, status: entry.status })),
  });

  if (!keepWorktrees) {
    run('git', ['worktree', 'remove', '--force', worktree], { cwd: repoRoot });
    const parent = dirname(worktree);
    if (existsSync(parent) && basename(parent) !== '.tmp') {
      try {
        rmSync(parent, { recursive: false });
      } catch {
        // Non-empty parent means other cases still exist.
      }
    }
  }
}

summary.finishedAt = new Date().toISOString();
write(resolve(outRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
