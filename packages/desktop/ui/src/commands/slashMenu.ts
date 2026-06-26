import type { MemorySkillItem } from '../shared/types';

export interface ExtensionSlashCommandItem {
  extensionId: string;
  surfaceId: string;
  packageType?: string;
  name: string;
  description: string;
  action: string;
}

export interface SlashMenuItem {
  key: string;
  insertText: string;
  displayCmd: string;
  icon: string;
  desc: string;
  section: 'Commands' | 'Skills' | 'Extensions';
  source?: string;
  kind: 'command' | 'skill' | 'extensionSlashCommand';
  extensionId?: string;
  action?: string;
}

const BASE_SLASH_COMMANDS = [
  {
    cmd: '/compact',
    icon: '◌',
    desc: 'Manually compact the current conversation. Add text to guide the summary.',
  },
  {
    cmd: '/copy',
    icon: '⎘',
    desc: 'Copy the last assistant response.',
  },
  {
    cmd: '/export',
    icon: '⇩',
    desc: 'Export the current conversation. Add a path to choose where it saves.',
  },
  {
    cmd: '/name',
    icon: '✎',
    desc: 'Rename this conversation. Add the new title after the command.',
  },
  {
    cmd: '/run',
    icon: '$',
    desc: 'Ask Neon Pilot to run a shell command.',
  },
  {
    cmd: '/search',
    icon: '⌕',
    desc: 'Ask Neon Pilot to search the web.',
  },
  {
    cmd: '/summarize',
    icon: '≡',
    desc: 'Ask Neon Pilot to summarize the conversation so far.',
  },
  {
    cmd: '/think',
    icon: '◇',
    desc: 'Ask Neon Pilot to think through a topic or next step.',
  },
] as const;

interface ParsedSlashInput {
  command: string;
  argument: string;
}

export function parseSlashInput(input: string): ParsedSlashInput | null {
  if (!input.startsWith('/')) {
    return null;
  }

  const firstWhitespaceIndex = input.search(/\s/);
  if (firstWhitespaceIndex === -1) {
    return { command: input, argument: '' };
  }

  return {
    command: input.slice(0, firstWhitespaceIndex),
    argument: input.slice(firstWhitespaceIndex).trimStart(),
  };
}

function normalizeSlashQuery(query: string): string {
  return query.startsWith('/') ? query.slice(1).toLowerCase() : query.toLowerCase();
}

function normalizeFuzzyText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function formatExtensionSourceLabel(extensionId: string): string {
  const withoutSystemPrefix = extensionId.startsWith('system-') ? extensionId.slice('system-'.length) : extensionId;
  const words = withoutSystemPrefix
    .split(/[-_.\s]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return 'Extension';
  }

  const title = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return `${title} extension`;
}

export function fuzzyScore(query: string, candidate: string): number | null {
  const normalizedQuery = normalizeFuzzyText(query);
  const normalizedCandidate = normalizeFuzzyText(candidate);

  if (normalizedQuery.length === 0) {
    return 0;
  }

  let queryIndex = 0;
  let score = 0;
  let consecutiveBonus = 0;
  let firstMatchIndex = -1;
  let lastMatchIndex = -2;

  for (let candidateIndex = 0; candidateIndex < normalizedCandidate.length; candidateIndex += 1) {
    if (normalizedCandidate[candidateIndex] !== normalizedQuery[queryIndex]) {
      continue;
    }

    if (firstMatchIndex === -1) {
      firstMatchIndex = candidateIndex;
    }

    if (candidateIndex === lastMatchIndex + 1) {
      consecutiveBonus += 3;
    } else {
      consecutiveBonus = 0;
    }

    score += 10 + consecutiveBonus;
    lastMatchIndex = candidateIndex;
    queryIndex += 1;

    if (queryIndex === normalizedQuery.length) {
      break;
    }
  }

  if (queryIndex !== normalizedQuery.length) {
    return null;
  }

  if (firstMatchIndex === 0) {
    score += 12;
  }

  score += Math.max(0, 18 - (normalizedCandidate.length - normalizedQuery.length));
  return score;
}

function getExplicitSkillFilterQuery(query: string): string | null {
  const normalized = normalizeSlashQuery(query).trim();

  if (normalized.startsWith('skill:')) {
    return normalized.slice('skill:'.length);
  }

  if (normalized.startsWith('skill ')) {
    return normalized.slice('skill '.length).trim();
  }

  if (normalized === 'skills') {
    return '';
  }

  if (normalized.length >= 3 && fuzzyScore(normalized, 'skill') !== null) {
    return '';
  }

  return null;
}

function scoreSkill(query: string, skill: MemorySkillItem, slashQuery: string, explicitSkillQuery: boolean): number | null {
  if (query.length === 0) {
    return 0;
  }

  const nameScore = fuzzyScore(query, skill.name);
  const descScore = fuzzyScore(query, skill.description);

  if (explicitSkillQuery) {
    return nameScore ?? (descScore !== null ? Math.max(1, Math.floor(descScore / 3)) : null);
  }

  const slashCommandScore = fuzzyScore(slashQuery, `skill:${skill.name}`);
  const bestNameOrCommandScore = Math.max(nameScore ?? 0, slashCommandScore ?? 0);

  if (bestNameOrCommandScore > 0) {
    return bestNameOrCommandScore;
  }

  if (descScore !== null) {
    return Math.max(1, Math.floor(descScore / 3));
  }

  return null;
}

export function buildSlashMenuItems(
  query: string,
  skills: MemorySkillItem[],
  extensionCommands: ExtensionSlashCommandItem[] = [],
): SlashMenuItem[] {
  const parsedInput = parseSlashInput(query);
  const commandQuery = parsedInput?.command ?? query;
  const normalized = normalizeSlashQuery(commandQuery);

  const commandItems: SlashMenuItem[] = BASE_SLASH_COMMANDS.map((command) => ({
    command,
    score: normalized.length === 0 ? 0 : fuzzyScore(normalized, command.cmd.slice(1)),
  }))
    .filter((entry) => normalized.length === 0 || entry.score !== null)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.command.cmd.localeCompare(right.command.cmd))
    .map(({ command }) => ({
      key: command.cmd,
      insertText: `${command.cmd} `,
      displayCmd: command.cmd,
      icon: command.icon,
      desc: command.desc,
      section: 'Commands',
      kind: 'command',
    }));

  const explicitSkillQuery = getExplicitSkillFilterQuery(query);
  const skillQuery = explicitSkillQuery ?? (normalized.length > 0 ? normalized : null);
  const skillItems: SlashMenuItem[] =
    skillQuery === null
      ? []
      : [...skills]
          .map((skill) => ({
            skill,
            score: scoreSkill(skillQuery, skill, normalized, explicitSkillQuery !== null),
          }))
          .filter((entry) => entry.score !== null)
          .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.skill.name.localeCompare(right.skill.name))
          .map(({ skill }) => ({
            key: `skill:${skill.name}`,
            insertText: `/skill:${skill.name} `,
            displayCmd: `/skill:${skill.name}`,
            icon: '✦',
            desc: skill.description,
            section: 'Skills',
            source: skill.source,
            kind: 'skill',
          }));

  const extensionItems: SlashMenuItem[] = [...extensionCommands]
    .map((command) => ({
      command,
      score: normalized.length === 0 ? 0 : fuzzyScore(normalized, command.name),
    }))
    .filter((entry) => normalized.length === 0 || entry.score !== null)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.command.name.localeCompare(right.command.name))
    .map(({ command }) => ({
      key: `extension:${command.extensionId}:${command.surfaceId}`,
      insertText: `/${command.name} `,
      displayCmd: `/${command.name}`,
      icon: '◇',
      desc: command.description,
      section: 'Extensions',
      source: formatExtensionSourceLabel(command.extensionId),
      kind: 'extensionSlashCommand',
      extensionId: command.extensionId,
      action: command.action,
    }));

  return [...commandItems, ...extensionItems, ...skillItems];
}
