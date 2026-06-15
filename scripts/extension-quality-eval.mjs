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

function casePrompt(testCase, worktree) {
  const extensionBase = resolve(worktree, '.eval-extensions', testCase.id);
  const wrongCheckoutBase = resolve(repoRoot, '.eval-extensions', testCase.id);
  const uiPatternGuide = readIfExists(resolve(repoRoot, 'benchmarks/extension-quality/ui-patterns.md')).trim();
  const designGuidance = readDesignGuidance();
  return [
    `Build this Neon Pilot extension in this isolated repo worktree.`,
    '',
    `Case id: ${testCase.id}`,
    `Expected primary surface: ${testCase.surface}`,
    `Expected current working directory: ${worktree}`,
    `Create the extension package under this absolute directory: ${extensionBase}/<extension-id>`,
    '',
    'User request:',
    testCase.prompt,
    '',
    'One-shot requirements:',
    '- Before editing, write a short UX brief in your answer or notes: primary user/job, primary surface, information architecture, state model, shared UI primitives, and visual acceptance criteria.',
    '- Implement the extension with editable source files and current dist artifacts.',
    `- Put all new extension package files under ${extensionBase}/ so the evaluator can find them.`,
    `- Do not create or modify ${wrongCheckoutBase} or any path outside ${worktree}.`,
    '- Run pwd before writing files; if it is not the expected current working directory above, stop and correct your shell cwd.',
    '- Hard gates outrank visual taste: build, doctor, declared command/action wiring, destructive confirmations, and extension/core boundaries must remain clean before you polish layout.',
    '- Use only public extension SDK imports from @neon-pilot/extensions, @neon-pilot/extensions/ui, or narrow backend SDK subpaths.',
    '- Use shared UI primitives and constrained controls where possible.',
    '- Follow the Neon Pilot taste profile, visual rubric, refinement workflow, and negative examples below. These are application-specific design requirements, not optional inspiration.',
    '- Follow the positive UI pattern guidance below. Treat it as the target shape for CRUD/list/detail extension pages.',
    '- Choose the most user-friendly input for each field. Prefer structured row editors, key/value editors, segmented controls, toggles, selects, pickers, steppers, and tag/resource choosers over raw text inputs or textareas when the data has known structure.',
    '- Do not use a textarea as a shortcut for structured data, lists, key/value pairs, modes, or settings. Use a textarea only for genuinely long free-form prose/code/prompt content.',
    '- Design the default and empty states as real product surfaces, not demos: align with existing Neon Pilot page rhythm, density, headings, section structure, and host control styling.',
    '- For CRUD/list workflows, keep the durable shell visible even when empty: header actions, filters/search when useful, a list/table/resource area, and a detail/editor/preview or guidance panel. Do not leave a mostly blank page with only a tiny centered empty message.',
    '- For small durable object CRUD, create/edit must remain in the list/detail or inspector layout. Do not replace the page with a full-width create/edit form.',
    '- Empty states should teach the next action inside the real workflow layout; avoid full-page placeholder canvases unless the extension surface is intentionally tiny.',
    '- Make the primary route visually judgeable on first launch: include starter templates, representative example rows, or a non-persisted preview/guidance panel inside the normal workflow shell when persisted data is empty. Do not ship a blank database as the only first impression.',
    '- Starter content must support the workflow without reading as fake demo data. Prefer purposeful templates, preview panels, or import/create affordances over filling the screen with synthetic sample records.',
    '- Do not use emoji as UI artwork. Use shared icons, simple text, or app-native primitives instead.',
    '- Tags, labels, categories, and other repeatable structured values must use token/tag editors, selectable suggestions, or row controls. Do not use a comma-separated text input for tags.',
    '- Do not expose raw metadata dumps as prominent UI. If created/updated/enabled details are useful, render them compactly in subdued inline text or a small properties row that matches the host app.',
    '- Add command contributions for meaningful user-reachable actions.',
    '- Manifest nav icons must use the host allowlist: app, automation, browser, database, diff, file, gear, graph, kanban, play, sparkle, terminal. Manifest nav sections must be primary or settings only.',
    '- Prefer direct navigation command actions for opening extension routes. If a manifest command points at a backend action, that backend action must be declared with worker.enabled and must pass doctor.',
    '- Destructive user actions such as delete/remove/replace must require confirmation through the app UI immediately before mutation, using the extension UI context confirmation API. Do not rely on disabled buttons, labels, or comments as confirmation.',
    '- Create/new commands should deep-link or otherwise open the create flow; the frontend must read and honor that route state on first render. Do not make create commands duplicate the generic open-page command unless you document a host limitation.',
    '- For create deep links, use manifest command action `app.navigate` with `args.to`, for example `/ext/<id>?new=true`, and read `window.location.search` or equivalent URL search params in the frontend. Do not use a made-up `navigation` command action or hash-only parsing.',
    '- When the evaluator opens a route such as `/ext/<id>?new=true`, that screenshot must visibly show the new/create editor rather than the default empty list.',
    '- Include loading, empty, error, success, disabled, and long-running states where relevant.',
    '- Run the narrowest meaningful build/doctor/static validation you can from this worktree.',
    `- Before your final answer, run or report equivalent file evidence: pwd, find ${extensionBase} -maxdepth 3 -type f, and confirm an extension.json exists under ${extensionBase}/<extension-id>/.`,
    '- Do not create git commits or push. Leave changes in the worktree for evaluation.',
    '',
    'Positive UI pattern guidance:',
    uiPatternGuide || 'No additional pattern guidance found.',
    '',
    'Neon Pilot visual taste, rubric, and examples:',
    designGuidance,
    '',
    'Acceptance criteria:',
    ...(testCase.expected ?? []).map((item) => `- ${item}`),
    '',
    'Final answer must include touched files, validation commands/results, and any user-visible path you could not validate.',
  ].join('\n');
}

function discoverExtensionDir(worktree, testCase) {
  const base = resolve(worktree, '.eval-extensions', testCase.id);
  const result = run('find', [base, '-maxdepth', '2', '-name', 'extension.json', '-print'], { cwd: worktree });
  const first = (result.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  return first ? dirname(resolve(worktree, first)) : base;
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

function readNamedDoc(label, path) {
  const text = readIfExists(resolve(repoRoot, path)).trim();
  return text ? [`## ${label}`, '', `Source: ${path}`, '', text].join('\n') : [`## ${label}`, '', `Source missing: ${path}`].join('\n');
}

function readDesignGuidance() {
  return [
    readNamedDoc('Neon Pilot Taste Profile', 'docs/design/neon-pilot-taste.md'),
    readNamedDoc('Extension Visual Rubric', 'benchmarks/extension-quality/visual-rubric.md'),
    readNamedDoc('Extension Visual Refinement Loop', 'docs/design/extension-visual-refinement.md'),
    readNamedDoc('Negative Example Gallery', 'docs/design/examples/README.md'),
    readNamedDoc('Negative Anchor: AI Generated SaaS', 'docs/design/examples/negative/ai-generated-saas.md'),
    readNamedDoc('Negative Anchor: Title Description Noise', 'docs/design/examples/negative/title-description-noise.md'),
    readNamedDoc('Negative Anchor: Text Button Sprawl', 'docs/design/examples/negative/text-button-sprawl.md'),
    readNamedDoc('Negative Anchor: Box In Box', 'docs/design/examples/negative/box-in-box.md'),
    readNamedDoc('Negative Anchor: Sparse Empty State', 'docs/design/examples/negative/sparse-empty-state.md'),
    readNamedDoc('Negative Anchor: Modal CRUD Flow', 'docs/design/examples/negative/modal-crud-flow.md'),
  ].join('\n\n---\n\n');
}

function readSourceFiles(extensionDir, pattern) {
  const srcDir = resolve(extensionDir, 'src');
  if (!existsSync(srcDir)) return '';
  const result = run('find', [srcDir, '-type', 'f'], { cwd: repoRoot });
  return (result.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && pattern.test(line))
    .map((file) => readIfExists(file))
    .join('\n');
}

function manifestRouteHints(manifest) {
  const contributes = manifest?.contributes && typeof manifest.contributes === 'object' ? manifest.contributes : {};
  const routes = [];
  const views = Array.isArray(contributes.views) ? contributes.views : [];
  for (const view of views) {
    if (typeof view?.route === 'string') routes.push(view.route);
    if (typeof view?.path === 'string') routes.push(view.path);
  }
  const nav = Array.isArray(contributes.nav) ? contributes.nav : [];
  for (const item of nav) {
    if (typeof item?.route === 'string') routes.push(item.route);
    if (typeof item?.path === 'string') routes.push(item.path);
  }
  return [...new Set(routes)].filter(Boolean);
}

const ALLOWED_NAV_SECTIONS = new Set(['primary', 'settings']);
const ALLOWED_NAV_ICONS = new Set([
  'app',
  'automation',
  'browser',
  'database',
  'diff',
  'file',
  'gear',
  'graph',
  'kanban',
  'play',
  'sparkle',
  'terminal',
]);

function manifestContributionProblems(manifest) {
  const contributes = manifest?.contributes && typeof manifest.contributes === 'object' ? manifest.contributes : {};
  const nav = Array.isArray(contributes.nav) ? contributes.nav : [];
  const problems = [];
  for (const [index, item] of nav.entries()) {
    if (item?.section !== undefined && !ALLOWED_NAV_SECTIONS.has(item.section)) {
      problems.push(`contributes.nav[${index}].section=${JSON.stringify(item.section)}`);
    }
    if (item?.icon !== undefined && !ALLOWED_NAV_ICONS.has(item.icon)) {
      problems.push(`contributes.nav[${index}].icon=${JSON.stringify(item.icon)}`);
    }
  }
  return problems;
}

function visualReviewFiles(outDir) {
  const screenshotDir = resolve(outDir, 'screenshots');
  const screenshots = existsSync(screenshotDir)
    ? run('find', [screenshotDir, '-type', 'f'], { cwd: repoRoot }).stdout.split(/\r?\n/).filter(Boolean)
    : [];
  return {
    report: resolve(outDir, 'visual-review.json'),
    screenshots,
  };
}

function writeVisualReviewTemplate(testCase, extensionDir, outDir, manifest) {
  const routes = manifestRouteHints(manifest);
  const template = [
    `# Visual Review: ${testCase.id}`,
    '',
    `Extension package: ${extensionDir}`,
    `Surface: ${testCase.surface}`,
    routes.length ? `Routes to open: ${routes.join(', ')}` : 'Routes to open: inspect extension.json contributions for this surface.',
    '',
    '## Required Evidence',
    '',
    '- Add screenshots under `screenshots/` for the primary surface and at least one empty/error/loading or secondary state.',
    '- Add `visual-review.json` when the screenshots have been reviewed.',
    '- Review with `docs/design/neon-pilot-taste.md` and `benchmarks/extension-quality/visual-rubric.md`, using named failure tags for taste issues.',
    '',
    'Expected `visual-review.json` shape:',
    '',
    '```json',
    JSON.stringify(
      {
        status: 'pass',
        reviewer: 'human-or-vision-model',
        screenshots: ['screenshots/primary.png'],
        scores: {
          visualHierarchy: 1,
          density: 1,
          states: 1,
          accessibilitySignals: 1,
          hostConsistency: 1,
        },
        findings: [],
      },
      null,
      2,
    ),
    '```',
    '',
    '## Visual Checks',
    '',
    '- Does it follow the IDE-like Neon Pilot taste profile: dense, flat, neutral, literal, and workbench-integrated?',
    '- Does it avoid title/description noise, text-button sprawl, box-in-box layout, modal CRUD, sparse empty states, and purple AI-gradient styling?',
    '- Is the first screen immediately understandable without explanatory helper text?',
    '- Does it use host shared primitives instead of bespoke card chrome?',
    '- Are spacing, density, typography, and alignment appropriate for the requested surface?',
    '- Do long titles, paths, prompts, logs, or row text truncate/wrap without overlap?',
    '- Are loading, empty, error, success, disabled, and long-running states visibly distinct?',
    '- Are destructive actions visually separated and confirmed?',
    '- Are icon-only controls labeled and focusable?',
    '- Does the UI avoid nested cards, decorative chips, and one-note color styling?',
  ].join('\n');
  write(resolve(outDir, 'visual-review.md'), `${template}\n`);
}

function analyzeQuality(testCase, extensionDir, outDir, worktree, requireVisual) {
  const manifestText = readIfExists(resolve(extensionDir, 'extension.json'));
  const frontendText = readSourceFiles(extensionDir, /\.(tsx|ts|jsx|js)$/);
  const backendText = readSourceFiles(extensionDir, /backend\.(ts|js)$/);
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
  writeVisualReviewTemplate(testCase, extensionDir, outDir, manifest);

  const commands = Array.isArray(manifest?.contributes?.commands) ? manifest.contributes.commands : [];
  const manifestProblems = manifestContributionProblems(manifest);
  const newCommand = commands.find((command) => /new|create/i.test(`${command.id ?? ''} ${command.title ?? ''}`));
  const openCommand = commands.find((command) => /open/i.test(`${command.id ?? ''} ${command.title ?? ''}`));
  const newCommandTo = typeof newCommand?.args?.to === 'string' ? newCommand.args.to : '';
  const openCommandTo = typeof openCommand?.args?.to === 'string' ? openCommand.args.to : '';
  const newCommandProblems = [];
  if (newCommand) {
    if (newCommand.action !== 'app.navigate')
      newCommandProblems.push(`expected action app.navigate, got ${JSON.stringify(newCommand.action)}`);
    if (!/\?new=true|[?&](mode|intent|view)=new|[?&](create|new)=true/i.test(newCommandTo)) {
      newCommandProblems.push(`expected args.to to deep-link to create mode, got ${JSON.stringify(newCommandTo)}`);
    }
    if (newCommandTo && openCommandTo && newCommandTo === openCommandTo)
      newCommandProblems.push('new command duplicates open command route');
  }
  const destructiveRequested = /delete|remove|destructive/i.test(`${testCase.prompt} ${(testCase.expected ?? []).join(' ')}`);
  const statusLines = gitText(worktree, ['status', '--short'])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const allowedPrefix = `.eval-extensions/${testCase.id}/`;
  const outOfScopeChanges = statusLines.filter((line) => {
    const path = line.replace(/^.. /, '').replace(/^"|"$/g, '');
    return path && !path.startsWith(allowedPrefix);
  });
  const wrongCheckoutBase = resolve(repoRoot, '.eval-extensions', testCase.id);
  const visualFiles = visualReviewFiles(outDir);
  const hasVisualReport = existsSync(visualFiles.report);
  const hasScreenshots = visualFiles.screenshots.length > 0;
  const quality = {
    extensionDir,
    dist: {
      kilobytes: Number(distSize) || 0,
      fileCount: distFileList.length,
    },
    checks: [
      {
        id: 'extension_manifest',
        status: manifestText && manifestProblems.length === 0 ? 'pass' : 'fail',
        detail:
          manifestProblems.length === 0
            ? 'An extension.json file exists and basic contribution values match host allowlists.'
            : `Invalid contribution values: ${manifestProblems.join(', ')}`,
      },
      {
        id: 'scoped_worktree_changes',
        status: outOfScopeChanges.length === 0 ? 'pass' : 'fail',
        detail:
          outOfScopeChanges.length === 0
            ? 'All worktree changes are inside the case extension package.'
            : `Found changes outside ${allowedPrefix}: ${outOfScopeChanges.join(', ')}`,
      },
      {
        id: 'wrong_checkout_write',
        status: existsSync(wrongCheckoutBase) ? 'fail' : 'pass',
        detail: existsSync(wrongCheckoutBase)
          ? `Generated files were written to the main checkout at ${wrongCheckoutBase}.`
          : 'No case files were written to the main checkout eval directory.',
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
        status: !newCommand || newCommandProblems.length === 0 ? 'pass' : 'fail',
        detail:
          newCommandProblems.length === 0
            ? 'Create/new command deep-links through app.navigate.'
            : `Create/new command is not a valid create deeplink: ${newCommandProblems.join('; ')}`,
      },
      {
        id: 'shared_ui_import',
        status: frontendText.includes('@neon-pilot/extensions/ui') ? 'pass' : 'fail',
        detail: 'Frontend should use public shared UI primitives.',
      },
      {
        id: 'visual_review',
        status: hasVisualReport && hasScreenshots ? 'pass' : requireVisual ? 'fail' : 'warn',
        detail:
          hasVisualReport && hasScreenshots
            ? `Visual review found with ${visualFiles.screenshots.length} screenshot(s).`
            : 'No screenshot-backed visual review found; build/doctor checks do not prove the UI looks good.',
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
const requireVisual = boolArg('require-visual');

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
  requireVisual,
  results: [],
};

for (const testCase of cases) {
  const caseOut = resolve(outRoot, testCase.id);
  const worktree = resolve(worktreeRoot, testCase.id);
  const prompt = casePrompt(testCase, worktree);
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
  const quality = analyzeQuality(testCase, extensionDir, caseOut, worktree, requireVisual);
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
