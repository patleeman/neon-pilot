import { describe, expect, it } from 'vitest';

import { renderSystemPromptTemplate } from './system-prompt-template.js';

describe('system-prompt-template', () => {
  it('renders durable path variables into the default system prompt', () => {
    const rendered = renderSystemPromptTemplate({
      knowledge_root: '/knowledge',
      agents_edit_target: '/knowledge/AGENTS.md',
      skills_dir: '/knowledge/skills',
      tasks_dir: '/state/tasks',
    });

    expect(rendered).toContain("You are Patrick Lee's personal AI agent");
    expect(rendered).toContain('Primary knowledge path: /knowledge');
    expect(rendered).toContain('Durable AGENTS.md target: /knowledge/AGENTS.md');
    expect(rendered).toContain('Skills directory: /knowledge/skills');
    expect(rendered).toContain('Scheduled tasks directory: /state/tasks');
  });

  it('normalizes absent and false values to empty strings without leaving template whitespace noise', () => {
    const rendered = renderSystemPromptTemplate({
      knowledge_root: undefined,
      agents_edit_target: null,
      skills_dir: false,
      tasks_dir: '',
    });

    expect(rendered).toContain('Primary knowledge path:');
    expect(rendered).toContain('Durable AGENTS.md target:');
    expect(rendered).not.toMatch(/[ \t]+\n/);
    expect(rendered).not.toMatch(/\n{3,}/);
    expect(rendered).toBe(rendered.trim());
  });

  it('does not autoescape rendered values because the prompt is plain text', () => {
    const rendered = renderSystemPromptTemplate({ knowledge_root: '<knowledge>&path' });

    expect(rendered).toContain('Primary knowledge path: <knowledge>&path');
  });
});
