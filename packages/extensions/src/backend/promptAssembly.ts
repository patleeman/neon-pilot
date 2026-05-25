function unresolved(): never {
  throw new Error('@neon-pilot/extensions/backend/promptAssembly must be resolved by the Neon Pilot host runtime.');
}

export function buildInstructionPlan<TResult = unknown>(..._args: unknown[]): TResult {
  return unresolved();
}

export async function buildPromptAssemblyPlanAsync<TResult = unknown>(..._args: unknown[]): Promise<TResult> {
  return unresolved();
}

export async function buildPromptTemplatePlanAsync<TResult = unknown>(..._args: unknown[]): Promise<TResult> {
  return unresolved();
}

export async function buildToolInjectionPlanAsync<TResult = unknown>(..._args: unknown[]): Promise<TResult> {
  return unresolved();
}
