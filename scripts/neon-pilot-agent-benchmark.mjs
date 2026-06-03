#!/usr/bin/env node
/* eslint-env node */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const defaultDataset = 'patrickleenyc/personal-agent-evals';
const args = process.argv.slice(2).filter((value, index) => !(index === 0 && value === '--'));

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = args.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
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

function stringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function compactText(value, maxChars = 1800) {
  return stringifyValue(value).replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function caseIsNoCode(row) {
  const prompt = String(row.prompt ?? '').toLowerCase();
  const scoring = row.scoring && typeof row.scoring === 'object' ? row.scoring : {};
  return scoring.diff?.require_no_changes === true || prompt.includes('do not make code changes');
}

function caseKind(row) {
  const text = `${row.type ?? ''} ${row.id ?? ''} ${row.prompt ?? ''}`.toLowerCase();
  if (text.includes('frontend') || text.includes('ui ') || text.includes('browser')) return 'frontend-diagnosis';
  if (text.includes('security') || text.includes('permission')) return 'security-reasoning';
  if (text.includes('plan') || text.includes('assess') || text.includes('explain')) return 'architecture-diagnosis';
  return 'runtime-diagnosis';
}

function microPromptFromBasis(row) {
  const triage = row.triage && typeof row.triage === 'object' ? row.triage : {};
  const target = row.window?.target_user_turn;
  const before = Array.isArray(row.window?.before) ? row.window.before.slice(-3) : [];
  const after = Array.isArray(row.window?.after) ? row.window.after.slice(0, 3) : [];
  return [
    'You are benchmarking Neon Pilot on a real historical agent failure window.',
    '',
    `Failure mode: ${triage.failure_mode ?? 'unknown'}`,
    `User turn: ${target?.text ?? row.signal?.matched_text ?? ''}`,
    '',
    'Recent context before the user turn:',
    before.map((item) => `- ${item.role}${item.tool_name ? `/${item.tool_name}` : ''}: ${compactText(item.text, 900)}`).join('\n') ||
      '- none',
    '',
    'Immediate context after the user turn:',
    after.map((item) => `- ${item.role}${item.tool_name ? `/${item.tool_name}` : ''}: ${compactText(item.text, 900)}`).join('\n') ||
      '- none',
    '',
    'Task: diagnose what went wrong, identify the first repo areas or runtime state to inspect, and propose the smallest corrective next step. Do not make code changes. Keep the response concrete enough that another agent could continue from it.',
  ].join('\n');
}

function buildMicroCases({ cases, basisRows, limit, basisLimit }) {
  const noCodeCases = cases.filter(caseIsNoCode).map((row) => ({
    id: row.id,
    source: { dataset_config: 'cases', source_candidate_id: row.source_candidate_id, case_path: row.case_path },
    kind: caseKind(row),
    repo: row.repo,
    base_commit: row.base_commit,
    prompt: row.prompt,
    max_minutes: 20,
    scoring: {
      require_no_changes: true,
      final_must_include: row.scoring?.trace?.final_must_include ?? [],
      forbidden_shell_patterns: row.scoring?.trace?.forbidden_shell_patterns ?? ['git\\s+commit', 'git\\s+push', 'apply_patch'],
      judge_rubric: row.scoring?.judge?.rubric ?? 'eval_rubrics/baseline-answer-quality.md',
    },
  }));

  const basisCases = basisRows.slice(0, basisLimit).map((row) => {
    const triage = row.triage && typeof row.triage === 'object' ? row.triage : {};
    return {
      id: `micro-${row.id}`,
      source: { dataset_config: 'basis_candidates', basis_id: row.id, conversation_id: row.source?.conversation_id },
      kind: String(triage.eval_type ?? 'diagnosis').replace(/^triage\./, '') || 'diagnosis',
      repo: row.source?.cwd ?? '',
      base_commit: '',
      prompt: microPromptFromBasis(row),
      max_minutes: 20,
      scoring: {
        require_no_changes: true,
        final_must_include: [String(triage.failure_mode ?? '').replace(/^triage\./, '')].filter(Boolean),
        forbidden_shell_patterns: ['git\\s+commit', 'git\\s+push', 'apply_patch'],
        judge_rubric: 'eval_rubrics/micro-diagnosis-quality.md',
      },
    };
  });

  return [...noCodeCases, ...basisCases].slice(0, limit);
}

function writeJsonl(file, rows) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

function writeMarkdown(file, rows, dataset) {
  mkdirSync(dirname(file), { recursive: true });
  const lines = [
    '# Neon Pilot Agent Micro Benchmark',
    '',
    `Source dataset: ${dataset}`,
    '',
    'Each task is capped at 20 minutes and defaults to no code changes. The goal is to measure diagnosis, repo navigation, instruction following, and handoff quality without waiting for full implementations.',
    '',
    '| ID | Kind | Max minutes | Source |',
    '| --- | --- | ---: | --- |',
    ...rows.map((row) => `| \`${row.id}\` | ${row.kind} | ${row.max_minutes} | ${row.source.dataset_config} |`),
    '',
    'Run with:',
    '',
    '```bash',
    'pnpm run bench:agent -- --output=benchmarks/neon-pilot-agent-micro.jsonl --markdown=benchmarks/neon-pilot-agent-micro.md',
    '```',
    '',
  ];
  writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const dataset = arg('dataset', defaultDataset);
  const output = resolve(arg('output', 'benchmarks/neon-pilot-agent-micro.jsonl'));
  const markdown = arg('markdown', '');
  const limit = numberArg('limit', 12);
  const basisLimit = numberArg('basis-limit', 4);
  const [cases, basisRows] = await Promise.all([
    fetchHfRows({ dataset, config: 'cases' }),
    fetchHfRows({ dataset, config: 'basis_candidates' }),
  ]);
  const rows = buildMicroCases({ cases, basisRows, limit, basisLimit });
  writeJsonl(output, rows);
  if (markdown) writeMarkdown(resolve(markdown), rows, dataset);

  const summary = {
    dataset,
    output,
    markdown: markdown ? resolve(markdown) : '',
    selected: rows.length,
    sourceRows: { cases: cases.length, basis_candidates: basisRows.length },
    kinds: rows.reduce((acc, row) => ({ ...acc, [row.kind]: (acc[row.kind] ?? 0) + 1 }), {}),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  if (!hasFlag('json-errors')) {
    console.error(error instanceof Error ? error.message : String(error));
  } else {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
  process.exit(1);
});
