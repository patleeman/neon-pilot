#!/usr/bin/env node
import { estimateTokens } from '@earendil-works/pi-coding-agent';

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');

function tokenCount(text) {
  return estimateTokens({
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: Date.now(),
  });
}

function pct(delta, baseline) {
  if (!Number.isFinite(delta) || !Number.isFinite(baseline) || baseline === 0) return 0;
  return Math.round((delta / baseline) * 1000) / 10;
}

function measure(label, baseline, optimized, notes = '', group = 'harness') {
  const baselineTokens = tokenCount(baseline);
  const optimizedTokens = tokenCount(optimized);
  return {
    group,
    label,
    baselineTokens,
    optimizedTokens,
    tokensSaved: baselineTokens - optimizedTokens,
    percentSaved: pct(baselineTokens - optimizedTokens, baselineTokens),
    baselineBytes: Buffer.byteLength(baseline, 'utf8'),
    optimizedBytes: Buffer.byteLength(optimized, 'utf8'),
    bytesSaved: Buffer.byteLength(baseline, 'utf8') - Buffer.byteLength(optimized, 'utf8'),
    notes,
  };
}

function repeatBlock(title, lines, count) {
  return Array.from({ length: count }, (_, index) => [`## ${title} ${index + 1}`, ...lines].join('\n')).join('\n\n');
}

function makeSourceFixture(lineCount) {
  const lines = [];
  for (let line = 1; line <= lineCount; line += 1) {
    const name = `function_${String(line).padStart(4, '0')}`;
    lines.push(`export function ${name}(input: string): string { return input.trim() + "-${line}"; }`);
  }
  return lines;
}

function makeShortLineFixture(lineCount) {
  const lines = [];
  for (let line = 1; line <= lineCount; line += 1) {
    lines.push(`x${line}`);
  }
  return lines;
}

function paddedRead(lines, startLine = 1) {
  const width = String(startLine + lines.length - 1).length;
  return lines.map((line, index) => `${String(startLine + index).padStart(width, ' ')} | ${line}`).join('\n');
}

function compactRead(lines, startLine = 1) {
  return lines.map((line, index) => `${startLine + index}|${line}`).join('\n');
}

function makeFunctionBody(lineCount) {
  const lines = ['function normalizeAmount(value) {', '  let output = "";'];
  for (let index = 0; index < lineCount - 3; index += 1) {
    lines.push(`  output += transform_${String(index).padStart(3, '0')}(value);`);
  }
  lines.push('  return output;', '}');
  return `${lines.join('\n')}\n`;
}

function makeReplacementBody() {
  return [
    'function normalizeAmount(value) {',
    '  const trimmed = value.trim();',
    '  const withoutLeadingZeroes = trimmed.replace(/^0+(?=\\d)/, "");',
    '  return withoutLeadingZeroes || "0";',
    '}',
    '',
  ].join('\n');
}

function oldNewEditPayload(oldText, newText) {
  return JSON.stringify({ path: 'src/amounts.ts', old: oldText, new: newText }, null, 2);
}

function uptoEditPayload(oldText, newText) {
  const lines = oldText.split('\n');
  const head = `${lines[0]}\n`;
  const tail = `${lines.at(-3)}\n${lines.at(-2)}\n`;
  return JSON.stringify({ path: 'src/amounts.ts', old: `${head}[upto]${tail}`, new: newText }, null, 2);
}

const fileLines = makeSourceFixture(500);
const shortLines = makeShortLineFixture(200);
const read50 = fileLines.slice(120, 170);
const read200 = fileLines.slice(120, 320);
const read500 = fileLines;
const oldFunction = makeFunctionBody(90);
const newFunction = makeReplacementBody();

const mainGuidelinesBaseline = [
  'Neon Pilot defaults',
  "You are Patrick Lee's personal AI agent. Use the knowledge base, skills, notes, and project context to do the work the way Patrick would.",
  '',
  'Style',
  'Be concise, direct, and pragmatic; sound like a sharp teammate, not a consultant.',
  'Lead with the main point. Use short paragraphs by default and flat lists only when they help.',
  'Avoid cheerleading, filler, and generic taxonomy dumps. Name the strongest lever first.',
  'During routine work, stay quiet unless you need input, hit a material milestone, or start/inspect long-running work.',
  '',
  'Execution',
  'Own the task and drive to completion without confirmation loops.',
  'Do only the requested work. Avoid extra features, refactors, or configurability.',
  'Prefer dedicated tools over shell fallbacks. Use parallel calls for independent reads/searches.',
  'Read files before changing them. Prefer precise edits; use full rewrites only for new files or deliberate replacements.',
  'If blocked, diagnose the constraint, pick the smallest correct path, and say what remains.',
  '',
  'Knowledge and persistence',
  'Primary knowledge path: /Users/patrick/Documents/neon-pilot',
  'Durable AGENTS.md target: /Users/patrick/Documents/neon-pilot/AGENTS.md',
  'Skills directory: /Users/patrick/Documents/neon-pilot/skills',
  'Scheduled tasks directory: /Users/patrick/.local/state/neon-pilot-testing/sync/tasks',
  'Never store secrets in durable notes, skills, or project files.',
  'Load only relevant knowledge: AGENTS.md for standing context, skills for procedures, notes/projects for reference.',
  'When a task matches an available skill, read that SKILL.md before using the workflow.',
].join('\n');

const mainGuidelinesOptimized = [
  '# Agent Instructions',
  'Be concise, direct, and pragmatic.',
  'Own the task, read before editing, make precise changes, and verify real behavior before calling work done.',
  'Load context progressively: AGENTS.md for standing instructions, skills for procedures, notes/project files for reference.',
].join('\n');

const ds4ModeBaseline = [
  'DS4 local model mode:',
  '- Core tools are stable: bash, read, edit, and subagent.',
  '- Use the subagent tool directly when the user asks to create, start, inspect, follow up with, or cancel delegated agent work.',
  '- If DS4 RTK shell compression is enabled in settings, simple supported bash commands are automatically run through RTK for compact output.',
  '- In DS4 mode, typical non-core tools are intentionally offloaded to the DS4 CLI to keep the tool schema small and prompt-cache stable.',
  '- Use bash to run extended capabilities through the DS4 CLI instead of searching the repo to infer missing tools.',
  '- Start with `ds4 help` when you need CLI capabilities.',
  '- Useful CLI commands include `ds4 list`, `ds4 search`, `ds4 read`, `ds4 write`, `ds4 edit`, and `ds4 fetch`.',
  '- Skills are pointers only in DS4 mode. Search these skill files first when the task may match a workflow, then read the matching SKILL.md before using it.',
].join('\n');

const ds4ModeOptimized = [
  'You are an expert coding assistant inside Neon Pilot.',
  '',
  'Guidelines:',
  '- Be concise, direct, and verify real behavior before calling work done.',
  '- Use available tools deliberately; prefer small, precise file reads, edits, and tests.',
  '',
  'DS4 mode:',
  '- This prompt is intentionally terse; rely on progressive disclosure instead of memorizing everything up front.',
  '- Only the shown tools are directly available. Use bash to explore and invoke withheld system tools through the `ds4` CLI.',
  '- The read tool uses compact `line|text` output; line numbers are references, not file content.',
  '- DS4 bash compacts eligible shell output with RTK by default when RTK is installed. Use `ds4 compression off` to disable it, and `ds4 compression rtk` to re-enable it.',
  '- Skills are progressively loaded too. Use `ds4 skills list`, `ds4 skills search <query>`, and `ds4 skills get <id-or-query>` before applying a workflow.',
].join('\n');

const globalAgentsFull = [
  'Global user agent preferences: /Users/patrick/.local/state/neon-pilot-testing/neon-pilot-runtime/AGENTS.md',
  repeatBlock(
    'Preference',
    [
      'Prefer correct, complete implementations over narrow shims.',
      'Validate the actual work before calling it done.',
      'Use dedicated tools when available, and keep unrelated changes out of scope.',
      'Be terse during routine work, but explain material milestones.',
    ],
    12,
  ),
].join('\n\n');
const repoAgentsFull = [
  'Repo user agent preferences: /Users/patrick/workingdir/neon-pilot/AGENTS.md',
  repeatBlock(
    'Repo Rule',
    [
      'Keep core small and build user-facing features as extensions by default.',
      'If the extension API is missing a capability, add the smallest general-purpose API surface to core.',
      'Validate extension/core boundary work with focused tests.',
      'Docs are for agents. Update docs whenever behavior or workflow changes.',
    ],
    14,
  ),
].join('\n\n');
const agentsEmbedded = `${globalAgentsFull}\n\n${repoAgentsFull}`;
const agentsPointerOnly = [
  'Instruction files:',
  '- Global user agent preferences: /Users/patrick/.local/state/neon-pilot-testing/neon-pilot-runtime/AGENTS.md (pointer only; read if relevant)',
  '- Repo user agent preferences: /Users/patrick/workingdir/neon-pilot/AGENTS.md (pointer only; read if relevant)',
].join('\n');

function skillBody(name, detailCount) {
  return [
    `# ${name}`,
    `Use this skill when the task matches ${name}.`,
    repeatBlock(
      'Workflow Step',
      [
        'Inspect the relevant files before changing behavior.',
        'Prefer narrow edits and run the smallest meaningful verification.',
        'Report concrete results and remaining risk.',
      ],
      detailCount,
    ),
  ].join('\n\n');
}

const embeddedSkills = [
  skillBody('Browser Automation', 8),
  skillBody('Subagent Delegation', 7),
  skillBody('GitHub Workflow', 8),
  skillBody('Design Review', 7),
  skillBody('Personal Knowledge Base', 8),
].join('\n\n---\n\n');
const progressiveSkills = [
  'Skills are progressively loaded.',
  'Use `ds4 skills list`, `ds4 skills search <query>`, and `ds4 skills get <id-or-query>` before applying a workflow.',
].join('\n');

const directToolsBaseline = ['bash', 'read', 'edit', 'subagent', 'web_search', 'web_fetch', 'write', 'more', 'bash_status', 'bash_stop'];
const directToolsOptimized = ['bash', 'read', 'edit'];
const toolSchemaBaseline = directToolsBaseline.map((name) => `${name}: ${JSON.stringify({ type: 'object', properties: { input: { type: 'string' } } })}`).join('\n');
const toolSchemaOptimized = directToolsOptimized.map((name) => `${name}: ${JSON.stringify({ type: 'object', properties: { input: { type: 'string' } } })}`).join('\n');

const rawShellOutput = [
  '$ pnpm vitest run packages/desktop/server/conversations/liveSessionLoader.test.ts',
  'RUN  v4.0.18 /Users/patrick/workingdir/neon-pilot',
  ...Array.from({ length: 90 }, (_, index) => `stdout line ${index + 1}: transform module-${index}.ts in ${12 + (index % 17)}ms with sourcemap and dependency cache`),
  '✓ packages/desktop/server/conversations/liveSessionLoader.test.ts (6 tests) 62ms',
  'Test Files  1 passed (1)',
  'Tests  6 passed (6)',
  'Duration  495ms',
].join('\n');
const rtkShellOutput = [
  '$ rtk pnpm vitest run packages/desktop/server/conversations/liveSessionLoader.test.ts',
  'ok: 1 test file, 6 tests passed',
  'duration: 495ms',
  'important output: none',
].join('\n');

const cliDiscoveryBaseline = [
  'The agent searches the repository for missing tool capabilities, reads extension manifests, opens backend files, and infers how to call actions.',
  ...Array.from({ length: 40 }, (_, index) => `rg/read result ${index + 1}: packages/desktop/server/extensions/example-${index}.ts action schema and handler metadata`),
].join('\n');
const cliDiscoveryOptimized = [
  '$ ds4 tools',
  'web_search - Search the web',
  'web_fetch - Fetch a page',
  'subagent - Start delegated agent work',
  '$ ds4 help subagent',
  'Usage: ds4 subagent [flags]',
].join('\n');

const benchmarks = [
  measure('prompt.main_guidelines', mainGuidelinesBaseline, mainGuidelinesOptimized, 'APPEND/main instruction cleanup.', 'prompt'),
  measure('prompt.ds4_mode', ds4ModeBaseline, ds4ModeOptimized, 'DS4-specific harness instructions, now focused on progressive disclosure.', 'prompt'),
  measure('prompt.agents', agentsEmbedded, agentsPointerOnly, 'Global and repo AGENTS are pointer-only in DS4 mode.', 'prompt'),
  measure('prompt.skills', embeddedSkills, progressiveSkills, 'Skills move from prompt injection to ds4 skills list/search/get.', 'prompt'),
  measure('tool_schema.direct', toolSchemaBaseline, toolSchemaOptimized, 'Direct tool definition surface shrinks; withheld tools move behind the ds4 CLI. Synthetic schema fixture.', 'tool_schema'),
  measure('cli.discovery', cliDiscoveryBaseline, cliDiscoveryOptimized, 'Agent discovers withheld tools through ds4 CLI instead of repo spelunking.', 'cli'),
  measure('read_output.50_lines', paddedRead(read50, 121), compactRead(read50, 121), 'Padded gutter vs compact line|text gutter.', 'read_output'),
  measure('read_output.200_lines', paddedRead(read200, 121), compactRead(read200, 121), 'Padded gutter vs compact line|text gutter.', 'read_output'),
  measure('read_output.500_lines', paddedRead(read500, 1), compactRead(read500, 1), 'Padded gutter vs compact line|text gutter.', 'read_output'),
  measure('read_output.200_short_lines', paddedRead(shortLines, 1), compactRead(shortLines, 1), 'Short-line fixture where gutter overhead dominates.', 'read_output'),
  measure('edit_payload.large_function', oldNewEditPayload(oldFunction, newFunction), uptoEditPayload(oldFunction, newFunction), 'Exact old/new replacement payload vs [upto] anchored replacement.', 'edit_payload'),
  measure('shell.rtk_output', rawShellOutput, rtkShellOutput, 'Synthetic RTK-style compression fixture for noisy command output.', 'shell'),
];

const totals = benchmarks.reduce(
  (acc, row) => ({
    baselineTokens: acc.baselineTokens + row.baselineTokens,
    optimizedTokens: acc.optimizedTokens + row.optimizedTokens,
    tokensSaved: acc.tokensSaved + row.tokensSaved,
    baselineBytes: acc.baselineBytes + row.baselineBytes,
    optimizedBytes: acc.optimizedBytes + row.optimizedBytes,
    bytesSaved: acc.bytesSaved + row.bytesSaved,
  }),
  { baselineTokens: 0, optimizedTokens: 0, tokensSaved: 0, baselineBytes: 0, optimizedBytes: 0, bytesSaved: 0 },
);
totals.percentSaved = pct(totals.tokensSaved, totals.baselineTokens);

const groups = Object.values(
  benchmarks.reduce((acc, row) => {
    const current = acc[row.group] ?? {
      group: row.group,
      baselineTokens: 0,
      optimizedTokens: 0,
      tokensSaved: 0,
      baselineBytes: 0,
      optimizedBytes: 0,
      bytesSaved: 0,
    };
    current.baselineTokens += row.baselineTokens;
    current.optimizedTokens += row.optimizedTokens;
    current.tokensSaved += row.tokensSaved;
    current.baselineBytes += row.baselineBytes;
    current.optimizedBytes += row.optimizedBytes;
    current.bytesSaved += row.bytesSaved;
    acc[row.group] = current;
    return acc;
  }, {}),
).map((group) => ({ ...group, percentSaved: pct(group.tokensSaved, group.baselineTokens) }));

const result = {
  suite: 'ds4-agent-eval',
  version: 1,
  generatedAt: new Date().toISOString(),
  totals,
  groups,
  benchmarks,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('DS4 Agent Eval');
  console.log('');
  console.log(`Total: ${totals.baselineTokens} -> ${totals.optimizedTokens} tokens (${totals.tokensSaved} saved, ${totals.percentSaved}%)`);
  console.log('');
  for (const group of groups) {
    console.log(`${group.group}: ${group.baselineTokens} -> ${group.optimizedTokens} tokens (${group.tokensSaved} saved, ${group.percentSaved}%)`);
  }
  console.log('');
  for (const row of benchmarks) {
    console.log(`${row.label}`);
    console.log(`  tokens: ${row.baselineTokens} -> ${row.optimizedTokens} (${row.tokensSaved} saved, ${row.percentSaved}%)`);
    console.log(`  bytes:  ${row.baselineBytes} -> ${row.optimizedBytes} (${row.bytesSaved} saved)`);
    if (row.notes) console.log(`  note:   ${row.notes}`);
  }
}
