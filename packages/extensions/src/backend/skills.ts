function unresolved(): never {
  throw new Error('@neon-pilot/extensions/backend/skills must be resolved by the Neon Pilot host runtime.');
}

export async function buildSkillInjectionPlanAsync<TResult = unknown>(..._args: unknown[]): Promise<TResult> {
  return unresolved();
}

export async function buildSkillInventoryAsync<TResult = unknown>(..._args: unknown[]): Promise<TResult> {
  return unresolved();
}

export function setSkillEnabled<TResult = unknown>(..._args: unknown[]): TResult {
  return unresolved();
}

export function writeMergedMcpConfigFile<TResult = unknown>(..._args: unknown[]): TResult {
  return unresolved();
}
