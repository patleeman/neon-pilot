import { describe, expect, it } from 'vitest';

import { renderSystemPromptTemplate } from './system-prompt-template.js';

describe('system-prompt-template', () => {
  it('renders concise default system guidance without durable paths', () => {
    const rendered = renderSystemPromptTemplate({
      knowledge_root: '/knowledge',
      agents_edit_target: '/knowledge/AGENTS.md',
      skills_dir: '/knowledge/skills',
      tasks_dir: '/state/tasks',
    });

    expect(rendered).toContain("You are Patrick Lee's personal AI agent");
    expect(rendered).toContain('Use only relevant context');
    expect(rendered).not.toContain('/knowledge');
    expect(rendered).not.toContain('/state/tasks');
  });

  it('normalizes absent and false values to empty strings without leaving template whitespace noise', () => {
    const rendered = renderSystemPromptTemplate({
      knowledge_root: undefined,
      agents_edit_target: null,
      skills_dir: false,
      tasks_dir: '',
    });

    expect(rendered).not.toMatch(/[ \t]+\n/);
    expect(rendered).not.toMatch(/\n{3,}/);
    expect(rendered).toBe(rendered.trim());
  });

  it('does not autoescape rendered values because the prompt is plain text', () => {
    const rendered = renderSystemPromptTemplate({ custom_value: '<knowledge>&path' }, 'Custom value: {{ custom_value }}');

    expect(rendered).toContain('Custom value: <knowledge>&path');
  });
});
