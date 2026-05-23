import { resolve } from 'node:path';

import { normalizeExtensionSkillContribution, readSkillFrontmatterFields, validateExtensionSkillContribution } from './extensionSkills.js';

export interface ExtensionSkillRegistryEntryLike {
  packageRoot?: string;
  manifest: {
    id: string;
    packageType?: string;
    contributes?: { skills?: unknown[] };
  };
}

export interface ExtensionSkillRegistrationLike {
  extensionId: string;
  packageType: string;
  id: string;
  name: string;
  title?: string;
  description?: string;
  path: string;
  packageRoot: string;
}

export function buildExtensionSkillRegistrations(entry: ExtensionSkillRegistryEntryLike): ExtensionSkillRegistrationLike[] {
  if (!entry.packageRoot) {
    return [];
  }

  return (entry.manifest.contributes?.skills ?? []).flatMap((skill): ExtensionSkillRegistrationLike[] => {
    const normalized = normalizeExtensionSkillContribution(skill);
    if (validateExtensionSkillContribution({ packageRoot: entry.packageRoot, skill: normalized })) {
      return [];
    }

    const skillPath = resolve(entry.packageRoot, normalized.path);
    const frontmatter = readSkillFrontmatterFields(skillPath);
    const id = normalized.id.trim();
    const name = `${entry.manifest.id}/${id}`;
    return [
      {
        extensionId: entry.manifest.id,
        packageType: entry.manifest.packageType ?? 'user',
        id,
        name,
        title: normalized.title ?? frontmatter?.name,
        description: normalized.description ?? frontmatter?.description,
        path: skillPath,
        packageRoot: entry.packageRoot,
      },
    ];
  });
}
