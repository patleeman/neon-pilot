import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

import type { ExtensionSkillContribution } from './extensionManifest.js';

export interface ExtensionSkillValidationInput {
  packageRoot?: string;
  skill: string | ExtensionSkillContribution;
}

export interface NormalizedExtensionSkillContribution extends ExtensionSkillContribution {
  id: string;
  path: string;
}

function assertInside(root: string, candidate: string): void {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error('Path escapes extension root.');
  }
}

export function normalizeExtensionSkillContribution(skill: string | ExtensionSkillContribution): ExtensionSkillContribution {
  if (typeof skill === 'string') {
    const segments = skill.split(/[\\/]/).filter(Boolean);
    const parent = segments.length > 1 ? segments[segments.length - 2] : undefined;
    const basename = segments.at(-1)?.replace(/\.md$/i, '') ?? 'skill';
    return { id: parent && basename.toUpperCase() === 'SKILL' ? parent : basename, path: skill };
  }
  return skill;
}

export function readSkillFrontmatterFields(skillPath: string): { name?: string; description?: string } | null {
  const raw = readFileSync(skillPath, 'utf-8').replace(/\r\n/g, '\n');
  if (!raw.startsWith('---\n')) return null;
  const endIndex = raw.indexOf('\n---', 4);
  if (endIndex === -1) return null;
  const frontmatter = raw.slice(4, endIndex);
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { ...(name ? { name } : {}), ...(description ? { description } : {}) };
}

export function validateExtensionSkillContribution(input: ExtensionSkillValidationInput): string | null {
  if (!input.packageRoot) {
    return 'Extension skill contributions require a package root.';
  }
  const normalized = normalizeExtensionSkillContribution(input.skill);
  if (!normalized.id?.trim()) {
    return 'Extension skill contribution is missing an id.';
  }
  if (!normalized.path?.trim()) {
    return `Extension skill ${normalized.id} is missing a path.`;
  }
  const skillPath = resolve(input.packageRoot, normalized.path);
  try {
    assertInside(input.packageRoot, skillPath);
  } catch {
    return `Extension skill ${normalized.id} path must stay inside the extension package.`;
  }
  if (!existsSync(skillPath)) {
    return `Extension skill ${normalized.id} path does not exist: ${normalized.path}`;
  }
  if (!normalized.path.endsWith('/SKILL.md') && normalized.path !== 'SKILL.md') {
    return `Extension skill ${normalized.id} should use the Agent Skills file name SKILL.md.`;
  }
  const frontmatter = readSkillFrontmatterFields(skillPath);
  if (!frontmatter?.name || !frontmatter.description) {
    return `Extension skill ${normalized.id} must use Agent Skills frontmatter with name and description.`;
  }
  return null;
}
