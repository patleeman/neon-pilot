import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';

import { writeAppTelemetryEvent } from './app-telemetry-db.js';
import { getConfigRoot } from './runtime/paths.js';
import { SYSTEM_PROMPT_TEMPLATE } from './system-prompt-template.js';

export const DEFAULT_RESUME_FALLBACK_PROMPT = 'Continue from where you left off.';

export function getDefaultMachineInstructionFiles(): string[] {
  return [join(homedir(), '.config', 'agents', 'AGENTS.md')];
}

export function getDefaultMachineSkillDirs(): string[] {
  const home = homedir();
  return [
    join(home, '.config', 'agents', 'skill'),
    join(home, '.config', 'agents', 'skills'),
    join(home, '.claude', 'skills'),
    join(home, '.codex', 'skills'),
    join(home, '.config', 'codex', 'skills'),
    join(home, '.local', 'state', 'pi', 'knowledge-base', 'repo', 'skills'),
    join(home, '.local', 'state', 'neon-pilot', 'knowledge-base', 'repo', 'skills'),
    join(home, '.local', 'state', 'neon-pilot-rc', 'knowledge-base', 'repo', 'skills'),
    join(home, '.config', 'agent-skills'),
  ];
}

export type MachineConfigSectionKey = 'daemon' | 'ui';

export interface MachineConfigDocument {
  knowledgeRoot?: string;
  instructionFiles?: string[];
  skillDirs?: string[];
  systemPromptTemplate?: string;
  daemon?: Record<string, unknown>;
  ui?: Record<string, unknown>;
}

export interface MachineConfigOptions {
  configRoot?: string;
  filePath?: string;
}

export interface MachineUiConfigState {
  resumeFallbackPrompt: string;
}

export interface WriteMachineUiConfigInput {
  resumeFallbackPrompt?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const DANGEROUS_MERGE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function deepMerge(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    if (DANGEROUS_MERGE_KEYS.has(key)) {
      continue;
    }

    if (Array.isArray(value)) {
      output[key] = [...value];
      continue;
    }

    if (isRecord(value)) {
      const current = output[key];
      output[key] = isRecord(current) ? deepMerge(current, value) : deepMerge({}, value);
      continue;
    }

    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}

function normalizeSection(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.keys(value).length > 0 ? deepMerge({}, value) : undefined;
}

function readJsonObjectFile(path: string, label: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    if (!isRecord(parsed)) {
      throw new Error('root must be an object');
    }

    return parsed;
  } catch (error) {
    writeAppTelemetryEvent({
      source: 'system',
      category: 'config',
      name: 'read_failed',
      metadata: { label, path, message: (error as Error).message },
    });
    return undefined;
  }
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ];

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMachineConfig(value: unknown): MachineConfigDocument {
  const document = isRecord(value) ? value : {};
  const knowledgeRoot =
    typeof document.knowledgeRoot === 'string' && document.knowledgeRoot.trim().length > 0 ? document.knowledgeRoot.trim() : undefined;
  const instructionFiles = normalizeStringArray(document.instructionFiles);
  const skillDirs = normalizeStringArray(document.skillDirs);
  const systemPromptTemplate =
    typeof document.systemPromptTemplate === 'string' && document.systemPromptTemplate.trim().length > 0
      ? document.systemPromptTemplate
      : undefined;
  const daemon = normalizeSection(document.daemon);
  const ui = normalizeSection(document.ui);

  return {
    ...(knowledgeRoot ? { knowledgeRoot } : {}),
    ...(instructionFiles ? { instructionFiles } : {}),
    ...(skillDirs ? { skillDirs } : {}),
    ...(systemPromptTemplate ? { systemPromptTemplate } : {}),
    ...(daemon ? { daemon } : {}),
    ...(ui ? { ui } : {}),
  };
}

export function getMachineConfigFilePath(options: MachineConfigOptions = {}): string {
  if (options.filePath) {
    return resolve(options.filePath);
  }

  if (options.configRoot) {
    return join(resolve(options.configRoot), 'config.json');
  }

  const explicit = process.env.NEON_PILOT_CONFIG_FILE;
  if (explicit && explicit.trim().length > 0) {
    return resolve(explicit.trim());
  }

  return join(resolve(getConfigRoot()), 'config.json');
}

export function readMachineConfig(options: MachineConfigOptions = {}): MachineConfigDocument {
  const filePath = getMachineConfigFilePath(options);
  const document = readJsonObjectFile(filePath, 'machine config') ?? {};
  return normalizeMachineConfig(document);
}

export function writeMachineConfig(document: MachineConfigDocument, options: MachineConfigOptions = {}): MachineConfigDocument {
  const filePath = getMachineConfigFilePath(options);
  const normalized = normalizeMachineConfig(document);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`);

  return normalized;
}

export function updateMachineConfig(
  updater: (current: MachineConfigDocument) => MachineConfigDocument,
  options: MachineConfigOptions = {},
): MachineConfigDocument {
  return writeMachineConfig(updater(readMachineConfig(options)), options);
}

export function readMachineConfigSection(
  section: MachineConfigSectionKey,
  options: MachineConfigOptions = {},
): Record<string, unknown> | undefined {
  return readMachineConfig(options)[section];
}

export function updateMachineConfigSection(
  section: MachineConfigSectionKey,
  updater: (current: Record<string, unknown> | undefined, document: MachineConfigDocument) => Record<string, unknown> | undefined,
  options: MachineConfigOptions = {},
): MachineConfigDocument {
  return updateMachineConfig((current) => {
    const next = { ...current };
    const updated = normalizeSection(updater(current[section], current));

    if (updated) {
      next[section] = updated;
    } else {
      delete next[section];
    }

    return next;
  }, options);
}

export function readMachineInstructionFiles(options: MachineConfigOptions = {}): string[] {
  return [...new Set([...getDefaultMachineInstructionFiles(), ...(readMachineConfig(options).instructionFiles ?? [])])];
}

export function writeMachineInstructionFiles(instructionFiles: string[], options: MachineConfigOptions = {}): MachineConfigDocument {
  const normalizedInstructionFiles = [...new Set(instructionFiles.map((value) => value.trim()).filter((value) => value.length > 0))];
  return updateMachineConfig((current) => {
    const next: MachineConfigDocument = { ...current };
    if (normalizedInstructionFiles.length > 0) {
      next.instructionFiles = normalizedInstructionFiles;
    } else {
      delete next.instructionFiles;
    }
    return next;
  }, options);
}

export function readMachineSkillDirs(options: MachineConfigOptions = {}): string[] {
  return [...new Set([...getDefaultMachineSkillDirs(), ...(readMachineConfig(options).skillDirs ?? [])])];
}

export function writeMachineSkillDirs(skillDirs: string[], options: MachineConfigOptions = {}): MachineConfigDocument {
  const normalizedSkillDirs = [...new Set(skillDirs.map((value) => value.trim()).filter((value) => value.length > 0))];
  return updateMachineConfig((current) => {
    const next: MachineConfigDocument = { ...current };
    if (normalizedSkillDirs.length > 0) {
      next.skillDirs = normalizedSkillDirs;
    } else {
      delete next.skillDirs;
    }
    return next;
  }, options);
}

export function readMachineSystemPromptTemplate(options: MachineConfigOptions = {}): string {
  return readMachineConfig(options).systemPromptTemplate ?? SYSTEM_PROMPT_TEMPLATE;
}

export function writeMachineSystemPromptTemplate(
  template: string | null | undefined,
  options: MachineConfigOptions = {},
): MachineConfigDocument {
  const normalized = typeof template === 'string' ? template.trim() : '';
  return updateMachineConfig((current) => {
    const next: MachineConfigDocument = { ...current };
    if (normalized.length > 0 && normalized !== SYSTEM_PROMPT_TEMPLATE.trim()) {
      next.systemPromptTemplate = template ?? '';
    } else {
      delete next.systemPromptTemplate;
    }
    return next;
  }, options);
}

export function finalizeMachineUiConfigState(config: MachineUiConfigState): MachineUiConfigState {
  return config;
}

function normalizeResumeFallbackPrompt(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_RESUME_FALLBACK_PROMPT;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : DEFAULT_RESUME_FALLBACK_PROMPT;
}

export function readMachineUiConfig(options: MachineConfigOptions = {}): MachineUiConfigState {
  const section = readMachineConfigSection('ui', options) ?? {};

  return finalizeMachineUiConfigState({
    resumeFallbackPrompt: normalizeResumeFallbackPrompt(section.resumeFallbackPrompt),
  });
}

export function writeMachineUiConfig(input: WriteMachineUiConfigInput, options: MachineConfigOptions = {}): MachineUiConfigState {
  const currentState = readMachineUiConfig(options);
  const currentSection = readMachineConfigSection('ui', options) ?? {};

  const updated = finalizeMachineUiConfigState({
    resumeFallbackPrompt:
      input.resumeFallbackPrompt === undefined
        ? currentState.resumeFallbackPrompt
        : normalizeResumeFallbackPrompt(input.resumeFallbackPrompt),
  });

  updateMachineConfigSection(
    'ui',
    () => ({
      ...currentSection,
      resumeFallbackPrompt: updated.resumeFallbackPrompt,
    }),
    options,
  );

  return updated;
}
