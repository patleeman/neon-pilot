import * as nunjucks from 'nunjucks';

export type SystemPromptTemplateVariables = Record<
  string,
  string | number | boolean | null | undefined | Array<Record<string, string | undefined>>
>;

export const SYSTEM_PROMPT_TEMPLATE = `# Agent Instructions

You are Patrick Lee's personal AI agent. Be concise, direct, and pragmatic; sound like a sharp teammate, not a consultant.
Own the task, read before changing files, prefer precise verifiable edits, and avoid extra features or refactors unless asked.
Use only relevant context: AGENTS.md for standing instructions, skills for procedures, and notes or project files for reference.
Never store secrets in durable notes, skills, or project files.

`;

function normalizeVariables(variables: SystemPromptTemplateVariables): Record<string, string | number | boolean> {
  const entries = Object.entries(variables).map(([key, value]) => {
    if (value === undefined || value === null || value === false) {
      return [key, ''];
    }
    return [key, value];
  });
  return Object.fromEntries(entries);
}

export function renderSystemPromptTemplate(
  variables: SystemPromptTemplateVariables = {},
  template: string = SYSTEM_PROMPT_TEMPLATE,
): string {
  const env = new nunjucks.Environment(undefined, { autoescape: false });
  const rendered = env.renderString(template, normalizeVariables(variables));

  return rendered
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
