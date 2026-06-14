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
    expect(runner).toContain('require-visual');
    expect(runner).toContain('visual_review');
    expect(runner).toContain('visual-review.md');
    expect(runner).toContain('quality.json');
  });

  it('keeps the rubric grounded in frontend and backend quality gates', () => {
    const rubric = readFileSync(new URL('../benchmarks/extension-quality/rubric.md', import.meta.url), 'utf8');
    const visualRubric = readFileSync(new URL('../benchmarks/extension-quality/visual-rubric.md', import.meta.url), 'utf8');
    const visualRunner = readFileSync(new URL('./extension-visual-eval.mjs', import.meta.url), 'utf8');
    const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

    expect(rubric).toContain('Frontend UX');
    expect(rubric).toContain('Backend Quality');
    expect(rubric).toContain('Hard Gates');
    expect(rubric).toContain('boundary_violation');
    expect(rubric).toContain('no_visual_qa');
    expect(rubric).toContain('screenshot-backed visual review');

    expect(visualRubric).toContain('Host Fit');
    expect(visualRubric).toContain('Density & Layout');
    expect(visualRubric).toContain('no_image_access');
    expect(visualRunner).toContain('Page.captureScreenshot');
    expect(visualRunner).toContain('baseline-screenshots');
    expect(visualRunner).toContain('generated-screenshots');
    expect(packageJson).toContain('eval:extension-visual');
  });
});
