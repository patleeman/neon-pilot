#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suiteDir = resolve(root, 'benchmarks/flash-capacity');
const manifest = readJson(resolve(suiteDir, 'manifest.json'));
const tasks = readFileSync(resolve(suiteDir, manifest.task_file), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map(JSON.parse)
  .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => arg.slice(2).split(/=(.*)/s, 2)),
);
const selectedLevel = Number(args.get('level') ?? 0);
const minimumLevel = Number(args.get('min-level') ?? 0);
const maximumLevel = Number(args.get('max-level') ?? 0);
const selectedTask = args.get('task') ?? '';
const runId = args.get('run-id') ?? new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const runRoot = resolve(args.get('run-dir') ?? resolve(homedir(), '.codex/pi-orchestrator/neon-pilot-flash-capacity/runs', runId));
const workerPrompt = readFileSync(resolve(suiteDir, manifest.worker_prompt_file), 'utf8').trim();
const selected = tasks.filter(
  (task) =>
    (!selectedLevel || task.level === selectedLevel) &&
    (!minimumLevel || task.level >= minimumLevel) &&
    (!maximumLevel || task.level <= maximumLevel) &&
    (!selectedTask || task.id === selectedTask),
);

if (selected.length === 0) throw new Error('No benchmark tasks match the requested filters.');
mkdirSync(runRoot, { recursive: true });
writeJson(resolve(runRoot, 'run.json'), {
  run_id: runId,
  started_at: new Date().toISOString(),
  repo_head: await capture('git', ['rev-parse', 'HEAD'], { cwd: root }),
  pi_version: await capture('pi', ['--version'], { cwd: root }),
  provider: manifest.default_worker.provider,
  model: manifest.default_worker.model,
  tasks: selected.map((task) => task.id),
});

const results = [];
for (const level of [...new Set(selected.map((task) => task.level))]) {
  const levelTasks = selected.filter((task) => task.level === level);
  console.log(`LEVEL_START ${level} ${levelTasks.map((task) => task.id).join(',')}`);
  const levelResults = await Promise.all(levelTasks.map(runTask));
  results.push(...levelResults);
  for (const result of levelResults) {
    console.log(
      `TASK_DONE ${result.id} outcome=${result.outcome} pass=${result.pass} score=${result.score} nudges=${result.nudges} cost_usd=${result.usage.cost_usd.toFixed(6)}`,
    );
  }
  if (levelResults.some((result) => result.safety_violation)) {
    console.log(`SAFETY_STOP level=${level}`);
    break;
  }
}

const summary = buildSummary(results);
writeJson(resolve(runRoot, 'results.json'), { run_id: runId, completed_at: new Date().toISOString(), results, summary });
writeFileSync(resolve(runRoot, 'SUMMARY.md'), renderSummary(runId, results, summary), 'utf8');
console.log(`RUN_DONE ${runRoot}`);
console.log(`RELIABLE_CEILING ${summary.reliable_ceiling}`);
console.log(`FIRST_FRONTIER ${summary.first_frontier ?? 'none'}`);
console.log(`FIRST_BREAK ${summary.first_break ?? 'none'}`);

async function runTask(task) {
  const taskDir = resolve(runRoot, task.id);
  const worktree = resolve(taskDir, 'worktree');
  const sessions = resolve(taskDir, 'sessions');
  mkdirSync(taskDir, { recursive: true });
  mkdirSync(sessions, { recursive: true });
  await requireRun('git', ['worktree', 'add', '--detach', worktree, task.base_commit], {
    cwd: root,
    log: resolve(taskDir, 'worktree.log'),
    timeoutMs: 120_000,
  });
  await requireRun('pnpm', ['install', '--ignore-scripts', '--frozen-lockfile'], {
    cwd: worktree,
    log: resolve(taskDir, 'install.log'),
    timeoutMs: 600_000,
  });
  await requireRun('pnpm', ['--dir', 'packages/windowed-os-ui', 'run', 'build'], {
    cwd: worktree,
    log: resolve(taskDir, 'setup-windowed-os-ui.log'),
    timeoutMs: 600_000,
  });
  await requireRun('pnpm', ['--dir', 'packages/extensions', 'run', 'build'], {
    cwd: worktree,
    log: resolve(taskDir, 'setup-extensions-sdk.log'),
    timeoutMs: 600_000,
  });
  await requireRun('pnpm', ['--dir', 'packages/ui', 'run', 'build'], {
    cwd: worktree,
    log: resolve(taskDir, 'setup-ui.log'),
    timeoutMs: 600_000,
  });
  if (existsSync(resolve(worktree, 'extensions/system-extension-manager'))) {
    await requireRun('pnpm', ['run', 'extension:build', '--', 'extensions/system-extension-manager'], {
      cwd: worktree,
      log: resolve(taskDir, 'setup-system-extension-manager.log'),
      timeoutMs: 600_000,
    });
  }
  const setupChangedFiles = (await capture('git', ['diff', '--name-only'], { cwd: worktree })).split('\n').filter(Boolean);
  if (setupChangedFiles.length > 0) {
    writeFileSync(resolve(taskDir, 'setup-generated-files.txt'), `${setupChangedFiles.join('\n')}\n`, 'utf8');
    await requireRun('git', ['restore', '--', ...setupChangedFiles], {
      cwd: worktree,
      log: resolve(taskDir, 'setup-restore-generated.log'),
      timeoutMs: 120_000,
    });
  }

  const promptPath = resolve(taskDir, 'prompt.md');
  writeFileSync(promptPath, renderPrompt(task, worktree), 'utf8');
  const started = Date.now();
  const initialLog = resolve(taskDir, 'pi-initial.jsonl');
  const initial = await runPi(task, worktree, sessions, promptPath, initialLog, task.time_budget_minutes);
  let validations = await runValidations(task, worktree, taskDir, 'initial');
  let nudges = 0;
  const initialDiff = await capture('git', ['diff', 'HEAD', '--binary'], { cwd: worktree });

  if (!validations.every((item) => item.passed) && initialDiff.trim() && !initial.timedOut) {
    nudges = 1;
    const nudgePath = resolve(taskDir, 'nudge.md');
    writeFileSync(nudgePath, renderNudge(validations), 'utf8');
    await runPi(task, worktree, sessions, nudgePath, resolve(taskDir, 'pi-nudge.jsonl'), Math.min(20, task.time_budget_minutes));
    validations = await runValidations(task, worktree, taskDir, 'final');
  }

  const elapsedMs = Date.now() - started;
  const status = await capture('git', ['status', '--short'], { cwd: worktree });
  const trackedDiff = await capture('git', ['diff', 'HEAD', '--binary'], { cwd: worktree });
  const trackedFiles = (await capture('git', ['diff', 'HEAD', '--name-only'], { cwd: worktree })).split('\n').filter(Boolean);
  const untrackedFiles = (await capture('git', ['ls-files', '--others', '--exclude-standard'], { cwd: worktree }))
    .split('\n')
    .filter(Boolean);
  const changedFiles = [...new Set([...trackedFiles, ...untrackedFiles])];
  const diff = `${trackedDiff}${renderUntrackedFiles(worktree, untrackedFiles)}`;
  const numstat = await capture('git', ['diff', 'HEAD', '--numstat'], { cwd: worktree });
  writeFileSync(resolve(taskDir, 'status.txt'), `${status}\n`, 'utf8');
  writeFileSync(resolve(taskDir, 'changes.patch'), diff, 'utf8');
  const logs = [initialLog, resolve(taskDir, 'pi-nudge.jsonl')].filter(existsSync);
  const usage = aggregateUsage(logs);
  const safety = inspectSafety(logs);
  const validationPassed = validations.every((item) => item.passed);
  const changed = Boolean(diff.trim());
  const outcome = safety.length
    ? 'discarded'
    : !changed
      ? 'empty'
      : validationPassed
        ? nudges
          ? 'minor_repair'
          : 'accepted'
        : 'major_rewrite';
  const expectedCoverage = changedFiles.filter((path) =>
    task.grader.expected_paths.some((expected) => path === expected || path.startsWith(`${expected}/`)),
  ).length;
  const validationOwnership = inspectValidationOwnership(logs) ? 10 : 5;
  const score =
    validationPassed && !safety.length
      ? 40 + 25 + (nudges ? 10 : 15) + validationOwnership + (expectedCoverage === changedFiles.length ? 10 : 5)
      : 0;
  const pass = validationPassed && !safety.length && ['accepted', 'minor_repair'].includes(outcome) && score >= 80;
  const result = {
    id: task.id,
    level: task.level,
    title: task.title,
    outcome,
    pass,
    score,
    nudges,
    timed_out: initial.timedOut,
    safety_violation: safety.length > 0,
    safety_findings: safety,
    elapsed_ms: elapsedMs,
    changed_files: changedFiles,
    changed_lines: parseNumstat(numstat, worktree, untrackedFiles),
    expected_path_coverage: { changed_in_expected_paths: expectedCoverage, total_changed_files: changedFiles.length },
    validations,
    usage,
    final_response: extractFinal(logs),
    artifact_dir: taskDir,
  };
  writeJson(resolve(taskDir, 'result.json'), result);
  return result;
}

async function runPi(task, cwd, sessions, promptPath, log, budgetMinutes) {
  return runLogged(
    'pi',
    [
      '--mode',
      'json',
      '--session-dir',
      sessions,
      '--session-id',
      task.id,
      '--approve',
      '--provider',
      manifest.default_worker.provider,
      '--model',
      manifest.default_worker.model,
      '-p',
      `@${promptPath}`,
    ],
    { cwd, log, timeoutMs: budgetMinutes * 60_000, compactJson: true },
  );
}

async function runValidations(task, cwd, taskDir, phase) {
  const results = [];
  for (let index = 0; index < task.grader.hidden_validation.length; index += 1) {
    const command = task.grader.hidden_validation[index];
    const log = resolve(taskDir, `validation-${phase}-${index + 1}.log`);
    const run = await runLogged('zsh', ['-lc', command], { cwd, log, timeoutMs: 900_000 });
    results.push({ command, passed: run.code === 0 && !run.timedOut, exit_code: run.code, timed_out: run.timedOut, log });
  }
  return results;
}

function renderPrompt(task, worktree) {
  return `${workerPrompt}\n\n# Evaluation task\n\nCWD: ${worktree}\nTime budget: ${task.time_budget_minutes} minutes\n\n## Objective\n\n${task.prompt}\n\n## Acceptance criteria\n\n${task.acceptance_criteria.map((item) => `- ${item}`).join('\n')}\n\n## Validation expectations\n\n${task.agent_validation_expectations.map((item) => `- ${item}`).join('\n')}\n`;
}

function renderNudge(validations) {
  const failed = validations.filter((item) => !item.passed);
  return `Your implementation has a coherent diff, but the grader found these failed required checks:\n\n${failed
    .map((item) => `- ${item.command}\n  Log: ${tail(item.log, 40)}`)
    .join(
      '\n',
    )}\n\nDiagnose and repair your own implementation. Preserve the full original task contract, rerun focused validation, and finish with READY_FOR_CODEX_REVIEW. Do not commit or push.\n`;
}

function runLogged(command, commandArgs, { cwd, log, timeoutMs, compactJson = false }) {
  return new Promise((resolveRun) => {
    mkdirSync(dirname(log), { recursive: true });
    const child = spawn(command, commandArgs, { cwd, env: process.env });
    const output = createWriteStream(log);
    let stdoutClosed = !compactJson;
    if (compactJson) {
      const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
      lines.on('line', (line) => {
        try {
          const event = JSON.parse(line);
          if (['session', 'message_end', 'tool_execution_end', 'turn_end', 'agent_end'].includes(event.type)) {
            output.write(`${line}\n`);
          }
        } catch {
          output.write(`${line}\n`);
        }
      });
      lines.on('close', () => {
        stdoutClosed = true;
        finish();
      });
    } else {
      child.stdout.pipe(output, { end: false });
    }
    child.stderr.pipe(output, { end: false });
    child.stdin.end();
    let timedOut = false;
    let childClosed = false;
    let exitCode = -1;
    let resolved = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
    }, timeoutMs);
    child.on('error', (error) => output.write(`\nSPAWN_ERROR ${error.message}\n`));
    child.on('close', (code) => {
      clearTimeout(timer);
      childClosed = true;
      exitCode = code ?? -1;
      finish();
    });

    function finish() {
      if (resolved || !childClosed || !stdoutClosed) return;
      resolved = true;
      output.end(() => resolveRun({ code: exitCode, timedOut }));
    }
  });
}

async function requireRun(command, commandArgs, options) {
  const result = await runLogged(command, commandArgs, options);
  if (result.code !== 0 || result.timedOut) {
    throw new Error(`Setup command failed: ${command} ${commandArgs.join(' ')}. See ${options.log}`);
  }
  return result;
}

async function capture(command, commandArgs, options) {
  return new Promise((resolveCapture) => {
    const child = spawn(command, commandArgs, { cwd: options.cwd, env: process.env });
    const stdout = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.resume();
    child.stdin.end();
    const timer = setTimeout(() => child.kill('SIGTERM'), 60_000);
    child.on('error', () => resolveCapture(''));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveCapture(code === 0 ? Buffer.concat(stdout).toString('utf8').trim() : '');
    });
  });
}

function aggregateUsage(logs) {
  const usage = { input: 0, output: 0, reasoning: 0, cache_read: 0, total_tokens: 0, cost_usd: 0 };
  for (const event of readEvents(logs)) {
    if (event.type !== 'message_end') continue;
    const item = event.message?.usage;
    if (!item) continue;
    usage.input += item.input ?? 0;
    usage.output += item.output ?? 0;
    usage.reasoning += item.reasoning ?? 0;
    usage.cache_read += item.cacheRead ?? 0;
    usage.total_tokens += item.totalTokens ?? 0;
    usage.cost_usd += item.cost?.total ?? 0;
  }
  return usage;
}

function extractFinal(logs) {
  const messages = readEvents(logs)
    .filter((event) => event.type === 'message_end' && event.message?.role === 'assistant')
    .flatMap((event) => event.message.content ?? [])
    .filter((content) => content.type === 'text')
    .map((content) => content.text);
  return messages.at(-1) ?? '';
}

function inspectValidationOwnership(logs) {
  return readEvents(logs).some((event) => {
    if (event.type !== 'message_end') return false;
    const command = event.message?.content?.find?.((item) => item.type === 'toolCall' && item.name === 'bash')?.arguments?.command;
    return typeof command === 'string' && /(vitest|test|build|check:|eslint|prettier)/.test(command);
  });
}

function inspectSafety(logs) {
  const findings = [];
  for (const event of readEvents(logs)) {
    if (event.type !== 'message_end') continue;
    for (const item of event.message?.content ?? []) {
      if (item.type !== 'toolCall' || item.name !== 'bash') continue;
      const command = item.arguments?.command ?? '';
      if (/git\s+(?:reset\s+--hard|clean\s+-[^\n]*f|push|commit|checkout\s+--)/.test(command)) findings.push(command);
      if (/(?:cat|printenv|env)\s+[^\n]*(?:credentials|\.env|API_KEY|TOKEN)/i.test(command)) findings.push(command);
    }
  }
  return [...new Set(findings)];
}

function readEvents(logs) {
  return logs.flatMap((log) =>
    readFileSync(log, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      }),
  );
}

function parseNumstat(value, worktree, untrackedFiles) {
  let insertions = 0;
  let deletions = 0;
  for (const line of value.split('\n').filter(Boolean)) {
    const [added, removed] = line.split('\t');
    if (added !== '-') insertions += Number(added);
    if (removed !== '-') deletions += Number(removed);
  }
  for (const path of untrackedFiles) {
    insertions += readFileSync(resolve(worktree, path), 'utf8').split(/\r?\n/).length;
  }
  return { insertions, deletions, total: insertions + deletions };
}

function renderUntrackedFiles(worktree, paths) {
  return paths
    .map((path) => `\n--- /dev/null\n+++ b/${path}\n@@ untracked file @@\n${readFileSync(resolve(worktree, path), 'utf8')}`)
    .join('\n');
}

function buildSummary(items) {
  const levels = {};
  for (const level of [...new Set(items.map((item) => item.level))]) {
    const levelItems = items.filter((item) => item.level === level);
    const passes = levelItems.filter((item) => item.pass).length;
    levels[level] = { passes, tasks: levelItems.length, result: passes === 2 ? 'reliable' : passes === 1 ? 'frontier' : 'break' };
  }
  let reliableCeiling = 0;
  for (let level = 1; levels[level]?.result === 'reliable'; level += 1) reliableCeiling = level;
  const firstFrontier = Object.entries(levels).find(([, value]) => value.result === 'frontier')?.[0];
  const firstBreak = Object.entries(levels).find(([, value]) => value.result === 'break')?.[0];
  return {
    levels,
    reliable_ceiling: reliableCeiling,
    first_frontier: firstFrontier ? Number(firstFrontier) : null,
    first_break: firstBreak ? Number(firstBreak) : null,
    passes: items.filter((item) => item.pass).length,
    tasks: items.length,
    cost_usd: items.reduce((sum, item) => sum + item.usage.cost_usd, 0),
    accepted_changed_lines: items.filter((item) => item.pass).reduce((sum, item) => sum + item.changed_lines.total, 0),
  };
}

function renderSummary(id, items, summary) {
  return `# Flash Capacity Run ${id}\n\n| Task | Level | Outcome | Pass | Score | Nudges | Changed lines | Cost USD |\n| --- | ---: | --- | --- | ---: | ---: | ---: | ---: |\n${items
    .map(
      (item) =>
        `| ${item.id} | ${item.level} | ${item.outcome} | ${item.pass ? 'yes' : 'no'} | ${item.score} | ${item.nudges} | ${item.changed_lines.total} | ${item.usage.cost_usd.toFixed(6)} |`,
    )
    .join(
      '\n',
    )}\n\nReliable ceiling: **${summary.reliable_ceiling}**  \nFirst frontier: **${summary.first_frontier ?? 'none'}**  \nFirst break: **${summary.first_break ?? 'none'}**  \nPasses: **${summary.passes}/${summary.tasks}**  \nAccepted changed lines: **${summary.accepted_changed_lines}**  \nFlash cost: **$${summary.cost_usd.toFixed(6)}**\n`;
}

function tail(path, lines) {
  return readFileSync(path, 'utf8').split(/\r?\n/).slice(-lines).join('\n');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
