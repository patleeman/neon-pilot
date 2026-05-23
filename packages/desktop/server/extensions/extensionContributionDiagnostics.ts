import { listMissingRequiredExtensionDependencies } from './extensionDependencies.js';
import { type ExtensionDependencyContribution } from './extensionDependencies.js';
import { type ExtensionSkillContribution } from './extensionManifest.js';
import { validateExtensionSkillContribution } from './extensionSkills.js';

export function listExtensionContributionDiagnostics(input: {
  packageRoot?: string;
  skills?: Array<string | ExtensionSkillContribution>;
  dependsOn?: Array<string | ExtensionDependencyContribution>;
  availableExtensionIds: string[];
}): string[] {
  const skillDiagnostics = (input.skills ?? [])
    .map((skill) => validateExtensionSkillContribution({ packageRoot: input.packageRoot, skill }))
    .filter((diagnostic): diagnostic is string => diagnostic !== null);
  const dependencyDiagnostics = listMissingRequiredExtensionDependencies(input.dependsOn ?? [], input.availableExtensionIds);
  return [...skillDiagnostics, ...dependencyDiagnostics];
}
