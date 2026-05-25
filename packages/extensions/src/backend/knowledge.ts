function unresolved(): never {
  throw new Error('@neon-pilot/extensions/backend/knowledge must be resolved by the Neon Pilot host runtime.');
}

export function buildRecentReadUsage<TResult = unknown>(..._args: unknown[]): TResult {
  return unresolved();
}

export function listMemoryDocs<TResult = unknown>(..._args: unknown[]): TResult {
  return unresolved();
}

export function listSkillsForProfile<TResult = unknown>(..._args: unknown[]): TResult {
  return unresolved();
}

export function normalizeMemoryPath<TResult = unknown>(..._args: unknown[]): TResult {
  return unresolved();
}
