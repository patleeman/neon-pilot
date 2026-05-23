import { listMissingRequiredExtensionDependencies } from './extensionDependencies.js';
import { validateExtensionSkillContribution } from './extensionSkills.js';

export function listExtensionContributionDiagnostics(input: {
  packageRoot?: string;
  skills?: unknown[];
  dependsOn?: string[];
  availableExtensionIds: string[];
}): string[] {
  const skillDiagnostics = (input.skills ?? [])
    .map((skill) => validateExtensionSkillContribution({ packageRoot: input.packageRoot, skill }))
    .filter((diagnostic): diagnostic is string => diagnostic !== null);
  const dependencyDiagnostics = listMissingRequiredExtensionDependencies(input.dependsOn ?? [], input.availableExtensionIds);
  return [...skillDiagnostics, ...dependencyDiagnostics];
}
