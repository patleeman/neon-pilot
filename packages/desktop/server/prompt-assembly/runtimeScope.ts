import type { AssemblyRuntimeContext } from './types.js';

export const DEFAULT_RUNTIME_SCOPE = 'shared';

export function getAssemblyRuntimeScope(ctx: Pick<AssemblyRuntimeContext, 'runtimeScope' | 'profile'>): string {
  return ctx.runtimeScope || ctx.profile || DEFAULT_RUNTIME_SCOPE;
}
