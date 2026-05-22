import { describe, expect, it } from 'vitest';

import { renderSystemPromptTemplate } from './system-prompt-template.js';

describe('system-prompt-template', () => {
  it('renders durable path variables into the default system prompt', () => {
    const rendered = renderSystemPromptTemplate({
      vault_root: '/vault',
      agents_edit_target: '/vault/AGENTS.md',
      skills_dir: '/vault/skills',
      tasks_dir: '/state/tasks',
    });

    expect(rendered).toContain("You are Patrick Lee's personal AI agent");
    expect(rendered).toContain('Vault root: /vault');
    expect(rendered).toContain('Durable AGENTS.md target: /vault/AGENTS.md');
    expect(rendered).toContain('Skills directory: /vault/skills');
    expect(rendered).toContain('Scheduled tasks directory: /state/tasks');
  });

  it('normalizes absent and false values to empty strings without leaving template whitespace noise', () => {
    const rendered = renderSystemPromptTemplate({
      vault_root: undefined,
      agents_edit_target: null,
      skills_dir: false,
      tasks_dir: '',
    });

    expect(rendered).toContain('Vault root:');
    expect(rendered).toContain('Durable AGENTS.md target:');
    expect(rendered).not.toMatch(/[ \t]+\n/);
    expect(rendered).not.toMatch(/\n{3,}/);
    expect(rendered).toBe(rendered.trim());
  });

  it('does not autoescape rendered values because the prompt is plain text', () => {
    const rendered = renderSystemPromptTemplate({ vault_root: '<vault>&path' });

    expect(rendered).toContain('Vault root: <vault>&path');
  });
});
