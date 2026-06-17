import type { AssemblyRuntimeContext } from './types.js';

export const DEFAULT_RUNTIME_SCOPE = 'shared';

export function getAssemblyRuntimeScope(ctx: Pick<AssemblyRuntimeContext, 'runtimeScope'>): string {
  return ctx.runtimeScope || DEFAULT_RUNTIME_SCOPE;
}
