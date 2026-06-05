#!/usr/bin/env node
/* eslint-env node */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const defaultDataset = 'patrickleenyc/personal-agent-evals';
const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2).filter((value, index) => !(index === 0 && value === '--'));

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = args.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function numberArg(name, fallback) {
  const value = Number(arg(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readHfToken() {
  const tokenEnv = arg('token-env', 'HF_TOKEN');
  const envToken = process.env[tokenEnv];
  if (envToken?.trim()) return envToken.trim();
  const tokenFile = resolve(process.env.HOME ?? '', '.cache', 'huggingface', 'token');
  return existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : '';
}

async function fetchHfRows({ dataset, config, split = 'train' }) {
  const token = readHfToken();
  const rows = [];
  const pageSize = 100;
  for (let offset = 0; offset < 10_000; offset += pageSize) {
    const url = new URL('https://datasets-server.huggingface.co/rows');
    url.searchParams.set('dataset', dataset);
    url.searchParams.set('config', config);
    url.searchParams.set('split', split);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('length', String(pageSize));
    const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`${config} rows failed ${response.status}: ${text.slice(0, 500)}`);
    }
    const page = await response.json();
    rows.push(...(page.rows ?? []).map((entry) => entry.row).filter(Boolean));
    if ((page.rows ?? []).length < pageSize) break;
  }
  return rows;
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, 'utf8');
}

function commitExists(commit) {
  if (!commit) return false;
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: repoRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function commitSubject(commit) {
  try {
    return execFileSync('git', ['show', '-s', '--format=%s', commit], { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function treeHasPath(commit, path) {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}:${path}`], { cwd: repoRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readRepoShape(commit) {
  return ['package.json', 'docs', 'packages', 'extensions'].filter((path) => treeHasPath(commit, path));
}

function readCommitSelection(row, resolution) {
  const primary =
    normalizeCommit(resolution?.selected_commit) ||
    normalizeCommit(resolution?.recommended_base_commit) ||
    normalizeCommit(row.base_commit);
  if (commitExists(primary)) {
    return { commit: primary, strategy: 'primary_resolution_commit' };
  }

  const candidate = Array.isArray(resolution?.commit_candidates)
    ? resolution.commit_candidates.map((item) => normalizeCommit(item?.hash)).find((commit) => commitExists(commit))
    : '';
  if (candidate) {
    return { commit: candidate, strategy: 'existing_resolution_candidate', missingPrimaryCommit: primary };
  }

  return { commit: primary, strategy: 'unresolved' };
}

function normalizeCommit(value) {
  return typeof value === 'string' && value.trim() && value !== 'None' ? value.trim() : '';
}

function normalizedRepoPath(value) {
  const text = typeof value === 'string' ? value : '';
  return text.includes('/personal-agent') ? text.replace('/personal-agent', '/neon-pilot') : text || repoRoot;
}

function inferLane(row, resolution) {
  const type = String(row.type ?? resolution?.eval_type ?? '').toLowerCase();
  const failureMode = String(resolution?.failure_mode ?? row.id ?? '').toLowerCase();
  const prompt = String(row.prompt ?? '').toLowerCase();
  if (type.includes('frontend') || failureMode.includes('frontend') || prompt.includes('browser') || prompt.includes('sidebar')) {
    return 'ux_workflow';
  }
  if (prompt.includes('do not make code changes') || type.includes('baseline')) return 'diagnosis';
  return 'scoped_fix';
}

function validationForLane(lane) {
  if (lane === 'diagnosis') return ['no code changes; reviewer/judge evaluates final answer'];
  if (lane === 'ux_workflow') {
    return ['targeted tests for touched UI/runtime files', 'user-visible route or app-path validation when feasible'];
  }
  return ['targeted tests for touched files', 'relevant smoke or static boundary check when extension/core boundary is touched'];
}

function buildGoldCases({ cases, resolutions, limit }) {
  const resolutionById = new Map();
  for (const resolution of resolutions) {
    if (resolution.case_id) resolutionById.set(resolution.case_id, resolution);
    if (resolution.source_candidate_id) resolutionById.set(resolution.source_candidate_id, resolution);
  }

  const seenIds = new Set();
  const selected = [];
  const excluded = [];

  for (const row of cases) {
    if (seenIds.has(row.id)) {
      excluded.push({ id: row.id, reason: 'duplicate_case_id' });
      continue;
    }

    const resolution = resolutionById.get(row.id) ?? resolutionById.get(row.source_candidate_id) ?? null;
    const commitSelection = readCommitSelection(row, resolution);
    const baseCommit = commitSelection.commit;
    if (!baseCommit) {
      excluded.push({ id: row.id, reason: 'missing_base_commit' });
      continue;
    }

    if (!commitExists(baseCommit)) {
      excluded.push({ id: row.id, reason: 'commit_not_in_repo', baseCommit });
      continue;
    }

    const lane = inferLane(row, resolution);
    const scoring = row.scoring && typeof row.scoring === 'object' ? row.scoring : {};
    const repoShape = readRepoShape(baseCommit);
    selected.push({
      id: row.id,
      project: 'neon-pilot',
      source_dataset: defaultDataset,
      source_config: 'cases',
      source_candidate_id: row.source_candidate_id ?? '',
      case_path: row.case_path ?? '',
      lane,
      task_type: row.type ?? resolution?.eval_type ?? lane,
      failure_mode: resolution?.failure_mode ?? '',
      time_budget_minutes: 20,
      repo: normalizedRepoPath(row.repo),
      base_commit: baseCommit,
      base_commit_subject: commitSubject(baseCommit),
      prompt: row.prompt,
      allowed_change_scope: scoring.diff?.require_no_changes === true ? 'none' : 'repo',
      validation: validationForLane(lane),
      scoring: {
        diff_policy: scoring.diff?.require_no_changes === true ? 'no_changes' : 'focused_changes',
        require_no_changes: scoring.diff?.require_no_changes === true,
        forbidden_tools: scoring.trace?.forbidden_tools ?? [],
        forbidden_shell_patterns: scoring.trace?.forbidden_shell_patterns ?? ['git\\s+commit', 'git\\s+push'],
        final_must_include: scoring.trace?.final_must_include ?? [],
        judge_rubric: scoring.judge?.rubric ?? 'eval_rubrics/neon-pilot-gold-quality.md',
        min_judge_score: scoring.judge?.min_score ?? 4,
      },
      review: {
        commit_exists: true,
        commit_strategy: commitSelection.strategy,
        ...(commitSelection.missingPrimaryCommit ? { missing_primary_commit: commitSelection.missingPrimaryCommit } : {}),
        repo_shape: repoShape,
        feasibility: 'runnable_from_base_commit',
        notes:
          commitSelection.strategy === 'existing_resolution_candidate'
            ? 'Selected because an associated commit candidate exists locally; the primary selected/recommended commit is missing.'
            : repoShape.includes('package.json') && repoShape.includes('packages')
              ? 'Selected because the associated base/selected commit exists and has the expected Neon Pilot repo shape.'
              : 'Selected because the commit exists, but repo shape should be manually reviewed before running.',
      },
    });
    seenIds.add(row.id);
    if (selected.length >= limit) break;
  }

  return { selected, excluded };
}

function writeJsonl(file, rows) {
  write(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function writeExcludedJsonl(file, rows) {
  if (!file) return;
  writeJsonl(file, rows);
}

function writeReport(file, result, dataset) {
  const laneCounts = result.selected.reduce((acc, row) => ({ ...acc, [row.lane]: (acc[row.lane] ?? 0) + 1 }), {});
  const exclusionCounts = result.excluded.reduce((acc, row) => ({ ...acc, [row.reason]: (acc[row.reason] ?? 0) + 1 }), {});
  const commitStrategyCounts = result.selected.reduce(
    (acc, row) => ({ ...acc, [row.review.commit_strategy]: (acc[row.review.commit_strategy] ?? 0) + 1 }),
    {},
  );
  const lines = [
    '# Neon Pilot Gold Agent Benchmark',
    '',
    `Source dataset: \`${dataset}\``,
    '',
    `Selected runnable cases: ${result.selected.length}`,
    `Excluded source cases: ${result.excluded.length}`,
    '',
    '## Lane Counts',
    '',
    ...Object.entries(laneCounts).map(([lane, count]) => `- ${lane}: ${count}`),
    '',
    '## Exclusion Counts',
    '',
    ...Object.entries(exclusionCounts).map(([reason, count]) => `- ${reason}: ${count}`),
    '',
    '## Commit Selection',
    '',
    ...Object.entries(commitStrategyCounts).map(([strategy, count]) => `- ${strategy}: ${count}`),
    '',
    '## Runnable Cases',
    '',
    '| ID | Lane | Base commit | Subject |',
    '| --- | --- | --- | --- |',
    ...result.selected.map(
      (row) => `| \`${row.id}\` | ${row.lane} | \`${row.base_commit.slice(0, 8)}\` | ${row.base_commit_subject.replaceAll('|', '\\|')} |`,
    ),
    '',
    '## Notes',
    '',
    '- Every selected case has an associated commit that resolves in this repository via `git cat-file -e <commit>^{commit}`.',
    '- Every selected case was also checked for a recognizable Neon Pilot repo shape at that commit (`package.json`, `docs`, and `packages`).',
    '- Cases using `existing_resolution_candidate` have a missing primary selected/recommended commit, but another associated commit candidate exists locally.',
    '- The suite is intentionally small for v0 because missing commits still make many mined cases non-runnable without backfill.',
    '- Backfill candidates should start with excluded `commit_not_in_repo` and `missing_base_commit` cases.',
    '',
  ];
  write(file, `${lines.join('\n')}\n`);
}

async function main() {
  const dataset = arg('dataset', defaultDataset);
  const output = resolve(arg('output', 'benchmarks/neon-pilot-gold.jsonl'));
  const report = resolve(arg('report', 'benchmarks/neon-pilot-gold.md'));
  const excludedOutput = arg('excluded-output') ? resolve(arg('excluded-output')) : '';
  const limit = numberArg('limit', 50);
  const [cases, resolutions] = await Promise.all([
    fetchHfRows({ dataset, config: 'cases' }),
    fetchHfRows({ dataset, config: 'commit_resolution' }),
  ]);
  const result = buildGoldCases({ cases, resolutions, limit });
  writeJsonl(output, result.selected);
  writeExcludedJsonl(excludedOutput, result.excluded);
  writeReport(report, result, dataset);

  process.stdout.write(
    `${JSON.stringify(
      {
        dataset,
        output,
        report,
        ...(excludedOutput ? { excludedOutput } : {}),
        selected: result.selected.length,
        excluded: result.excluded.length,
        lanes: result.selected.reduce((acc, row) => ({ ...acc, [row.lane]: (acc[row.lane] ?? 0) + 1 }), {}),
        exclusions: result.excluded.reduce((acc, row) => ({ ...acc, [row.reason]: (acc[row.reason] ?? 0) + 1 }), {}),
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
