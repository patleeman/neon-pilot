export function resolveLocalApiRepoRoot(input: { envRepoRoot?: string; envResourcesRoot?: string; defaultRepoRoot: string }): string {
  return input.envRepoRoot ?? input.envResourcesRoot ?? input.defaultRepoRoot;
}
