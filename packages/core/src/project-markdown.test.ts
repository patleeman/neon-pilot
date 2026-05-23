import { describe, expect, it } from 'vitest';

import { formatFrontmatter, formatMarkdownDocument, parseMarkdownSections, splitFrontmatter } from './project-markdown.js';

describe('project markdown helpers', () => {
  it('splits YAML-like frontmatter and normalizes CRLF bodies', () => {
    expect(splitFrontmatter('---\r\nid: "task-1"\r\nkind: note\r\n---\r\n# Body\r\n', 'Activity')).toEqual({
      attributes: { id: 'task-1', kind: 'note' },
      body: '# Body',
    });
  });

  it('rejects malformed frontmatter before parsing body content', () => {
    expect(() => splitFrontmatter('---\ninvalid\n---\n# Body\n', 'Activity')).toThrow(
      'Invalid frontmatter line in Activity markdown: invalid',
    );
  });

  it('formats and parses heading sections without changing section text', () => {
    const markdown = formatMarkdownDocument('Task', [
      ['Summary', 'One line'],
      ['Details', 'First\n\nSecond'],
    ]);

    expect(parseMarkdownSections(markdown, 'Task', 'Task')).toEqual({
      Summary: 'One line',
      Details: 'First\n\nSecond',
    });
  });

  it('formats frontmatter in insertion order', () => {
    expect(formatFrontmatter({ id: 'activity-1', kind: 'note' })).toBe('---\nid: activity-1\nkind: note\n---');
  });
});
