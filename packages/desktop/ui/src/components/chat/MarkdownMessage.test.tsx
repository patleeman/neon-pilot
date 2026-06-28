// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { prepareStreamingMarkdownText, renderStreamingMarkdownText } from './MarkdownMessage.js';

describe('prepareStreamingMarkdownText', () => {
  it('leaves complete markdown unchanged', () => {
    const text = ['**bold**', '', '```ts', 'const value = 1;', '```'].join('\n');
    expect(prepareStreamingMarkdownText(text)).toBe(text);
  });

  it('temporarily closes an unfinished backtick code fence', () => {
    expect(prepareStreamingMarkdownText('```ts\nconst value = 1;')).toBe('```ts\nconst value = 1;\n```');
  });

  it('temporarily closes an unfinished tilde code fence with the same length', () => {
    expect(prepareStreamingMarkdownText('~~~~\nvalue')).toBe('~~~~\nvalue\n~~~~');
  });
});

describe('renderStreamingMarkdownText', () => {
  it('renders markdown while text is still streaming', () => {
    render(<>{renderStreamingMarkdownText('Codex does **not** wait.')}</>);

    const strong = screen.getByText('not');
    expect(strong.tagName).toBe('STRONG');
  });
});
