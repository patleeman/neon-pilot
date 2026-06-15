import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function readJsonl(url) {
  return readFileSync(url, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('extension quality eval assets', () => {
  it('defines runnable extension cases with expected rubric metadata', () => {
    const cases = readJsonl(new URL('../benchmarks/extension-quality/tasks.jsonl', import.meta.url));

    expect(cases.length).toBeGreaterThanOrEqual(8);
    expect(new Set(cases.map((testCase) => testCase.surface))).toEqual(
      new Set([
        'main-page',
        'runtime-page',
        'right-rail',
        'transcript-renderer',
        'settingsComponent',
        'composer-control',
        'workbench-detail',
      ]),
    );

    for (const testCase of cases) {
      expect(testCase.id).toMatch(/^eq-/);
      expect(testCase.prompt).toContain('Build');
      expect(testCase.expected.length).toBeGreaterThanOrEqual(4);
      expect(testCase.validation).toContain('pnpm run extension:build -- <extensionDir>');
      expect(testCase.scoring.rubric).toBe('benchmarks/extension-quality/rubric.md');
    }

    const crud = cases.find((testCase) => testCase.id === 'eq-crud-presets');
    expect(crud.expected).toContain('delete requires confirmation');
    expect(crud.expected).toContain('new command opens the create flow or documents a host limitation');
  });

  it('documents and implements Neon Pilot DeepSeek V4 Flash as the default target', () => {
    const readme = readFileSync(new URL('../benchmarks/extension-quality/README.md', import.meta.url), 'utf8');
    const runner = readFileSync(new URL('./extension-quality-eval.mjs', import.meta.url), 'utf8');

    expect(readme).toContain('opencode-go/deepseek-v4-flash');
    expect(runner).toContain("arg('model', 'opencode-go/deepseek-v4-flash')");
    expect(runner).toContain('neon-pilot');
    expect(runner).toContain('.eval-extensions/${testCase.id}');
    expect(runner).toContain('Create the extension package under this absolute directory');
    expect(runner).toContain('Do not create or modify ${wrongCheckoutBase}');
    expect(runner).toContain('scoped_worktree_changes');
    expect(runner).toContain('wrong_checkout_write');
    expect(runner).toContain('readSourceFiles');
    expect(runner).toContain('/\\.(tsx|ts|jsx|js)$/');
    expect(runner).toContain('Hard gates outrank visual taste');
    expect(runner).toContain('readDesignGuidance');
    expect(runner).toContain('Neon Pilot visual taste, rubric, and examples');
    expect(runner).toContain('docs/design/neon-pilot-taste.md');
    expect(runner).toContain('benchmarks/extension-quality/visual-rubric.md');
    expect(runner).toContain('docs/design/extension-visual-refinement.md');
    expect(runner).toContain('docs/design/examples/negative/text-button-sprawl.md');
    expect(runner).toContain('Positive UI pattern guidance');
    expect(runner).toContain("readIfExists(resolve(repoRoot, 'benchmarks/extension-quality/ui-patterns.md'))");
    expect(runner).toContain("ALLOWED_NAV_SECTIONS = new Set(['primary', 'settings'])");
    expect(runner).toContain('manifestContributionProblems');
    expect(runner).toContain('Choose the most user-friendly input');
    expect(runner).toContain('Do not use a textarea as a shortcut');
    expect(runner).toContain('durable shell visible even when empty');
    expect(runner).toContain('create/edit must remain in the list/detail or inspector layout');
    expect(runner).toContain('avoid full-page placeholder canvases');
    expect(runner).toContain('visually judgeable on first launch');
    expect(runner).toContain('without reading as fake demo data');
    expect(runner).toContain('Do not use emoji as UI artwork');
    expect(runner).toContain('Do not use a comma-separated text input for tags');
    expect(runner).toContain('Do not expose raw metadata dumps');
    expect(runner).toContain('Prefer direct navigation command actions');
    expect(runner).toContain('Manifest nav icons must use the host allowlist');
    expect(runner).toContain('Manifest nav sections must be primary or settings only');
    expect(runner).toContain('immediately before mutation');
    expect(runner).toContain('read and honor that route state on first render');
    expect(runner).toContain('use manifest command action `app.navigate` with `args.to`');
    expect(runner).toContain('Do not use a made-up `navigation` command action');
    expect(runner).toContain('newCommandProblems');
    expect(runner).toContain('must visibly show the new/create editor');
    expect(runner).toContain('require-visual');
    expect(runner).toContain('visual_review');
    expect(runner).toContain('visual-review.md');
    expect(runner).toContain('title/description noise');
    expect(runner).toContain('text-button sprawl');
    expect(runner).toContain('quality.json');
  });

  it('keeps the rubric grounded in frontend and backend quality gates', () => {
    const rubric = readFileSync(new URL('../benchmarks/extension-quality/rubric.md', import.meta.url), 'utf8');
    const visualRubric = readFileSync(new URL('../benchmarks/extension-quality/visual-rubric.md', import.meta.url), 'utf8');
    const patterns = readFileSync(new URL('../benchmarks/extension-quality/ui-patterns.md', import.meta.url), 'utf8');
    const visualRunner = readFileSync(new URL('./extension-visual-eval.mjs', import.meta.url), 'utf8');
    const visualJudgeRunner = readFileSync(new URL('./extension-visual-judge.mjs', import.meta.url), 'utf8');
    const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

    expect(rubric).toContain('Frontend UX');
    expect(rubric).toContain('Backend Quality');
    expect(rubric).toContain('Hard Gates');
    expect(rubric).toContain('boundary_violation');
    expect(rubric).toContain('no_visual_qa');
    expect(rubric).toContain('screenshot-backed visual review');
    expect(rubric).toContain('lazy_textarea');
    expect(rubric).toContain('empty_canvas');
    expect(rubric).toContain('unjudgeable_first_launch');
    expect(rubric).toContain('emoji_artwork');
    expect(rubric).toContain('comma_tag_input');
    expect(rubric).toContain('raw_metadata_dump');
    expect(rubric).toContain('demo_seed_content');

    expect(visualRubric).toContain('Host Fit');
    expect(visualRubric).toContain('Workbench Fit');
    expect(visualRubric).toContain('Text Economy');
    expect(visualRubric).toContain('Action Chrome');
    expect(visualRubric).toContain('Control Taste');
    expect(visualRubric).toContain('Density & Layout');
    expect(visualRubric).toContain('no_image_access');
    expect(visualRubric).toContain('title_description_noise');
    expect(visualRubric).toContain('text_button_sprawl');
    expect(visualRubric).toContain('modal_crud_flow');
    expect(visualRubric).toContain('wrong_input_control');
    expect(visualRubric).toContain('full_page_crud_form');
    expect(patterns).toContain('CRUD Management Page');
    expect(patterns).toContain('Prompt Presets Page');
    expect(patterns).toContain('Never use comma-separated text inputs');
    expect(patterns).toContain('resource rows, table rows, or subdued action rows');
    expect(patterns).toContain('Do not replace the whole surface with a full-page form');
    expect(patterns).toContain('Avoid `title + description` repetition');
    expect(visualRunner).toContain('Page.captureScreenshot');
    expect(visualRunner).toContain('judge-image-max-px');
    expect(visualRunner).toContain('judge-screenshots');
    expect(visualRunner).toContain('sips');
    expect(visualRunner).toContain('calibrationRoutes');
    expect(visualRunner).toContain("target === 'settings'");
    expect(visualRunner).toContain('/settings#settings-providers');
    expect(visualRunner).toContain('Neon Pilot Taste Profile');
    expect(visualRunner).toContain('Title Description Noise');
    expect(visualRunner).toContain('Text Button Sprawl');
    expect(visualRunner).toContain('workbenchFit');
    expect(visualRunner).toContain('textEconomy');
    expect(visualRunner).toContain('actionChrome');
    expect(visualRunner).toContain('controlTaste');
    expect(visualRunner).toContain('baseline-screenshots');
    expect(visualRunner).toContain('generated-screenshots');
    expect(visualJudgeRunner).toContain('input_image');
    expect(visualJudgeRunner).toContain('visual-capture-summary.json');
    expect(visualJudgeRunner).toContain('opencode-go/kimi-k2.5');
    expect(visualJudgeRunner).toContain('opencode-go/mimo-v2.5');
    expect(visualJudgeRunner).toContain('opencode-go/qwen3.6-plus');
    expect(visualJudgeRunner).toContain('/responses');
    expect(packageJson).toContain('eval:extension-visual');
    expect(packageJson).toContain('eval:extension-visual-judge');
  });
});
