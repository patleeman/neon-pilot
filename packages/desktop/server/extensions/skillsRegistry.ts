/**
 * Skills enable/disable registry.
 *
 * The Skills Manager extension writes a registry JSON file that lists disabled
 * skill IDs. This module reads that file and uses it to filter the skill paths
 * passed to the agent session loader, so disabled skills are excluded from
 * <available_skills> context without touching skill files on disk.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import { getStateRoot } from '@personal-agent/core';

const REGISTRY_FILE = 'skills-registry.json';

function readDisabledSkillIds(): Set<string> {
  const registryPath = join(getStateRoot(), REGISTRY_FILE);
  if (!existsSync(registryPath)) return new Set();
  try {
    const parsed = JSON.parse(readFileSync(registryPath, 'utf-8')) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.disabledSkillIds)) {
        return new Set(record.disabledSkillIds.filter((id): id is string => typeof id === 'string'));
      }
    }
  } catch {
    // ignore parse errors — treat as empty
  }
  return new Set();
}

/**
 * Expand a list of skill parent directories into individual skill subdirectory
 * paths, then remove any whose directory name (skill ID) appears in the
 * disabled registry.
 *
 * Passing individual subdirs instead of the parent dir to pi-coding-agent is
 * safe — DefaultResourceLoader accepts both forms.
 */
function expandAndFilterSkillDirs(skillDirs: string[], disabledIds: Set<string>): string[] {
  const expanded: string[] = [];
  for (const dir of skillDirs) {
    if (!existsSync(dir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const fullPath = join(dir, entry);
      try {
        if (!statSync(fullPath).isDirectory()) continue;
      } catch {
        continue;
      }
      const skillId = basename(fullPath);
      if (!disabledIds.has(skillId)) {
        expanded.push(fullPath);
      }
    }
  }
  return expanded;
}

/**
 * Build the final `additionalSkillPaths` list from:
 * - `skillDirs`: vault/machine-configured parent directories
 * - `extensionSkillDirs`: individual dirs from extension skill registrations
 *
 * Disabled skills (by ID) are excluded from both sources.
 */
export function buildFilteredSkillPaths(skillDirs: string[], extensionSkillDirs: string[]): string[] {
  const disabledIds = readDisabledSkillIds();

  // Vault/machine skill dirs need expansion into individual subdirs first
  const expandedVault = disabledIds.size > 0 ? expandAndFilterSkillDirs(skillDirs, disabledIds) : skillDirs;

  // Extension skills are already individual dirs — filter by dirname (skill ID)
  const filteredExtension = disabledIds.size > 0 ? extensionSkillDirs.filter((dir) => !disabledIds.has(basename(dir))) : extensionSkillDirs;

  return [...new Set([...expandedVault, ...filteredExtension])];
}
