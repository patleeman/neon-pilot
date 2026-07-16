import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { aggregateResults, buildInferenceRequest, responseText } from './extension-visual-judge.mjs';

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function captureFixture() {
  const root = mkdtempSync(join(tmpdir(), 'visual-judge-request-'));
  roots.push(root);
  const screenshots = join(root, 'judge-screenshots');
  mkdirSync(screenshots, { recursive: true });
  const screenshot = join(screenshots, 'page.png');
  writeFileSync(
    screenshot,
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=', 'base64'),
  );
  writeFileSync(
    join(root, 'visual-capture-summary.json'),
    `${JSON.stringify({ extensionId: 'judge-test', generated: [{ route: '/page', judgeScreenshot: screenshot }] })}\n`,
  );
  return root;
}

describe('extension visual judge transport', () => {
  it('uses OpenAI chat-completions image content for compatible providers', () => {
    const request = buildInferenceRequest('vision-model', captureFixture(), 'openai-completions');

    expect(request.messages[0]).toMatchObject({ role: 'system' });
    expect(request.messages[1].content[0]).toMatchObject({ type: 'text' });
    expect(request.messages[1].content[1]).toMatchObject({
      type: 'image_url',
      image_url: { detail: 'high' },
    });
    expect(request.messages[1].content[1].image_url.url).toMatch(/^data:image\/png;base64,/u);
    expect(request.response_format).toEqual({ type: 'json_object' });
    expect(request).not.toHaveProperty('input');
  });

  it('reads both chat-completions and Responses API text', () => {
    expect(responseText({ choices: [{ message: { content: '{"decision":"pass"}' } }] })).toBe('{"decision":"pass"}');
    expect(responseText({ output: [{ content: [{ text: '{"decision":"pass"}' }] }] })).toBe('{"decision":"pass"}');
  });

  it('never passes a judge result that still contains must-fix findings', () => {
    const aggregate = aggregateResults([
      {
        model: 'vision-model',
        status: 'pass',
        judge: { imageAccess: true, decision: 'pass', overall: 5, mustFix: ['Covered primary action'] },
      },
    ]);
    expect(aggregate.decision).toBe('fail');
    expect(aggregate.results[0].mustFix).toEqual(['Covered primary action']);
  });

  it('requires image access from every requested judge', () => {
    const aggregate = aggregateResults([
      { model: 'vision-a', status: 'pass', judge: { imageAccess: true, decision: 'pass', overall: 5, mustFix: [] } },
      { model: 'blind-b', status: 'pass', judge: { imageAccess: false, decision: 'pass', overall: 5, mustFix: [] } },
    ]);
    expect(aggregate.decision).toBe('fail');
  });
});
