import type { MemorySkillItem } from '../shared/types';
import {
  parseStructuredSlashCommand,
  type SlashCommandSuggestionContext,
  STRUCTURED_SLASH_COMMANDS,
  valuesForSlashArgument,
} from './slashCommandSchema';

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
  section: 'Commands' | 'Skills' | 'Apps';
  source?: string;
  kind: 'command' | 'skill' | 'extensionSlashCommand';
  extensionId?: string;
  action?: string;
}

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
    return 'App';
  }

  const title = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return `${title} app`;
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
  suggestionContext: SlashCommandSuggestionContext = {},
): SlashMenuItem[] {
  const parsedInput = parseSlashInput(query);
  const commandQuery = parsedInput?.command ?? query;
  const normalized = normalizeSlashQuery(commandQuery);

  const structuredItems = buildStructuredSlashMenuItems(query, suggestionContext);
  if (structuredItems !== null) {
    return [...structuredItems, ...buildExtensionSlashItems(query, extensionCommands), ...buildSkillSlashItems(query, skills, normalized)];
  }

  const commandItems: SlashMenuItem[] = STRUCTURED_SLASH_COMMANDS.map((command) => ({
    command,
    score: normalized.length === 0 ? 0 : fuzzyScore(normalized, command.name),
  }))
    .filter((entry) => normalized.length === 0 || entry.score !== null)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.command.name.localeCompare(right.command.name))
    .map(({ command }) => ({
      key: command.name,
      insertText: `/${command.name}${command.subcommands?.length ? ' ' : ' '}`,
      displayCmd: `/${command.name}`,
      icon: commandIcon(command.owner),
      desc: command.description,
      section: 'Commands',
      kind: 'command',
    }));

  return [...commandItems, ...buildExtensionSlashItems(query, extensionCommands), ...buildSkillSlashItems(query, skills, normalized)];
}

function commandIcon(owner: string): string {
  if (owner === 'core') return '◇';
  if (owner === 'system-model-picker') return '◉';
  if (owner === 'system-auto-mode') return '∞';
  if (owner === 'system-artifacts') return '▣';
  if (owner === 'system-runs') return '$';
  return '•';
}

function buildSkillSlashItems(query: string, skills: MemorySkillItem[], normalized: string): SlashMenuItem[] {
  const explicitSkillQuery = getExplicitSkillFilterQuery(query);
  const skillQuery = explicitSkillQuery ?? (normalized.length > 0 ? normalized : null);
  return skillQuery === null
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
          insertText: `/skill use ${skill.name} `,
          displayCmd: `/skill use ${skill.name}`,
          icon: '✦',
          desc: skill.description,
          section: 'Skills',
          source: skill.source,
          kind: 'skill',
        }));
}

function buildExtensionSlashItems(query: string, extensionCommands: ExtensionSlashCommandItem[]): SlashMenuItem[] {
  const parsedInput = parseSlashInput(query);
  const commandQuery = parsedInput?.command ?? query;
  const normalized = normalizeSlashQuery(commandQuery);
  return [...extensionCommands]
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
      section: 'Apps',
      source: formatExtensionSourceLabel(command.extensionId),
      kind: 'extensionSlashCommand',
      extensionId: command.extensionId,
      action: command.action,
    }));
}

function buildStructuredSlashMenuItems(query: string, suggestionContext: SlashCommandSuggestionContext): SlashMenuItem[] | null {
  const parsed = parseStructuredSlashCommand(query);
  if (!parsed?.command) return null;
  const command = parsed.command;
  const afterCommand = query.slice(query.indexOf(command.name) + command.name.length);
  if (!command.subcommands?.length) {
    return null;
  }

  const isAtSubcommandPosition = afterCommand.length > 0 && !parsed.subcommand && !afterCommand.trimStart().includes(' ');
  const isAfterCommandSpace = afterCommand.length > 0 && afterCommand.trim().length === 0;
  if (isAtSubcommandPosition || isAfterCommandSpace) {
    const subquery = afterCommand.trimStart().toLowerCase();
    return command.subcommands
      .map((subcommand) => ({
        subcommand,
        score: subquery.length === 0 ? 0 : fuzzyScore(subquery, subcommand.name),
      }))
      .filter((entry) => subquery.length === 0 || entry.score !== null)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.subcommand.name.localeCompare(right.subcommand.name))
      .map(({ subcommand }) => ({
        key: `${command.name}:${subcommand.name}`,
        insertText: `/${command.name} ${subcommand.name} `,
        displayCmd: `/${command.name} ${subcommand.name}`,
        icon: commandIcon(command.owner),
        desc: subcommand.description,
        section: 'Commands',
        kind: 'command',
      }));
  }

  const argument = parsed.subcommand?.argument;
  const values = valuesForSlashArgument(argument, suggestionContext);
  if (!argument || values.length === 0 || !parsed.subcommand) {
    return null;
  }

  const argumentQuery = parsed.argument.trim().toLowerCase();
  return values
    .map((value) => ({
      value,
      score: argumentQuery.length === 0 ? 0 : fuzzyScore(argumentQuery, value),
    }))
    .filter((entry) => argumentQuery.length === 0 || entry.score !== null)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.value.localeCompare(right.value))
    .map(({ value }) => ({
      key: `${command.name}:${parsed.subcommand?.name}:${value}`,
      insertText: `/${command.name} ${parsed.subcommand?.name} ${value} `,
      displayCmd: value,
      icon: commandIcon(command.owner),
      desc: argument.name,
      section: 'Commands',
      kind: 'command',
    }));
}
