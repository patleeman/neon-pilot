import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suiteDir = resolve(root, 'benchmarks/flash-capacity');
const manifest = readJson('manifest.json');
const schema = readJson('schema.json');
const tasks = readFileSync(resolve(suiteDir, manifest.task_file), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on tasks.jsonl line ${index + 1}: ${error.message}`);
    }
  });

const levelByNumber = new Map(manifest.levels.map((level) => [level.level, level]));
const ids = new Set();
const errors = [];

check(manifest.name === 'flash-capacity', 'Manifest name must be flash-capacity.');
check(tasks.length === 10, `Expected 10 tasks, found ${tasks.length}.`);
check(schema.additionalProperties === false, 'Task schema must reject undeclared top-level fields.');

for (const task of tasks) {
  const label = task.id ?? '<missing-id>';
  check(!ids.has(label), `${label}: duplicate id.`);
  ids.add(label);

  const level = levelByNumber.get(task.level);
  check(Boolean(level), `${label}: unknown level ${task.level}.`);
  if (level) {
    check(task.level_name === level.name, `${label}: level_name does not match manifest.`);
    check(task.time_budget_minutes === level.time_budget_minutes, `${label}: time budget does not match manifest.`);
  }

  check(/^flash-l[1-5]-[ab]-[a-z0-9-]+$/.test(label), `${label}: invalid id format.`);
  check(task.repo === 'neon-pilot', `${label}: repo must be neon-pilot.`);
  check(
    Array.isArray(task.acceptance_criteria) && task.acceptance_criteria.length >= 2,
    `${label}: needs at least two acceptance criteria.`,
  );
  check(
    Array.isArray(task.agent_validation_expectations) && task.agent_validation_expectations.length > 0,
    `${label}: needs validation expectations.`,
  );
  check(task.scoring?.max_nudges === 1, `${label}: max_nudges must be 1.`);
  check(task.scoring?.pass_score === 80, `${label}: pass_score must be 80.`);
  check(sumWeights(task.scoring?.weights) === 100, `${label}: scoring weights must total 100.`);

  git(['cat-file', '-e', `${task.base_commit}^{commit}`], `${label}: base commit does not exist.`);
  git(['cat-file', '-e', `${task.reference_commit}^{commit}`], `${label}: reference commit does not exist.`);
  const parent = gitText(['rev-parse', `${task.reference_commit}^`], `${label}: cannot resolve reference parent.`);
  check(parent === task.base_commit, `${label}: base commit is not the reference commit's parent.`);

  const shortstat = gitText(['diff', '--shortstat', task.base_commit, task.reference_commit], `${label}: cannot compute reference diff.`);
  const actual = parseShortstat(shortstat);
  const expected = task.grader?.reference_diff;
  check(actual.files === expected?.files, `${label}: expected ${expected?.files} changed files, found ${actual.files}.`);
  check(actual.insertions === expected?.insertions, `${label}: expected ${expected?.insertions} insertions, found ${actual.insertions}.`);
  check(actual.deletions === expected?.deletions, `${label}: expected ${expected?.deletions} deletions, found ${actual.deletions}.`);

  for (const path of task.grader?.expected_paths ?? []) {
    const existsAtBase = gitPathExists(task.base_commit, path);
    const existsAtReference = gitPathExists(task.reference_commit, path);
    check(existsAtBase || existsAtReference, `${label}: expected path is absent at both commits: ${path}`);
    check(!task.prompt.includes(path), `${label}: prompt leaks hidden path ${path}.`);
  }

  const basePaths = new Set(
    gitText(['ls-tree', '-r', '--name-only', task.base_commit], `${label}: cannot list base commit paths.`).split('\n'),
  );
  for (const command of task.grader?.hidden_validation ?? []) {
    const referencedTargets = command.match(/[A-Za-z0-9_./-]+\.(?:test\.(?:tsx|ts)|mjs)/g) ?? [];
    for (const path of referencedTargets) {
      check(basePaths.has(path), `${label}: hidden validation target is absent at base commit: ${path}`);
    }
  }

  check(!task.prompt.includes(task.base_commit), `${label}: prompt leaks base commit.`);
  check(!task.prompt.includes(task.reference_commit), `${label}: prompt leaks reference commit.`);
  check(
    !task.acceptance_criteria.some((criterion) => criterion.includes(task.reference_commit)),
    `${label}: acceptance criteria leak reference commit.`,
  );
}

for (const level of manifest.levels) {
  const levelTasks = tasks.filter((task) => task.level === level.level);
  check(levelTasks.length === level.tasks, `Level ${level.level}: expected ${level.tasks} tasks, found ${levelTasks.length}.`);
  check(
    levelTasks.some((task) => task.id.includes(`-a-`)),
    `Level ${level.level}: missing task a.`,
  );
  check(
    levelTasks.some((task) => task.id.includes(`-b-`)),
    `Level ${level.level}: missing task b.`,
  );
}

if (errors.length > 0) {
  console.error(`Flash capacity eval validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${tasks.length} Flash capacity tasks across ${manifest.levels.length} levels.`);
for (const level of manifest.levels) {
  console.log(`- Level ${level.level} ${level.name}: ${level.tasks} tasks, ${level.time_budget_minutes} minutes each`);
}

function readJson(name) {
  return JSON.parse(readFileSync(resolve(suiteDir, name), 'utf8'));
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function git(args, message) {
  try {
    execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  } catch {
    errors.push(message);
  }
}

function gitText(args, message) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    errors.push(message);
    return '';
  }
}

function gitPathExists(commit, path) {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}:${path}`], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function parseShortstat(value) {
  const files = Number(value.match(/(\d+) files? changed/)?.[1] ?? 0);
  const insertions = Number(value.match(/(\d+) insertions?\(\+\)/)?.[1] ?? 0);
  const deletions = Number(value.match(/(\d+) deletions?\(-\)/)?.[1] ?? 0);
  return { files, insertions, deletions };
}

function sumWeights(weights = {}) {
  return Object.values(weights).reduce((sum, value) => sum + Number(value), 0);
}
