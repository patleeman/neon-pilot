export function mergeResolvedParentSessionMetadata<TMeta extends { parentSessionFile?: string; parentSessionId?: string }>(
  meta: TMeta,
  input: { parentSessionFile?: string; parentSessionId?: string },
): TMeta {
  if (meta.parentSessionFile === input.parentSessionFile && meta.parentSessionId === input.parentSessionId) {
    return meta;
  }

  return {
    ...meta,
    ...(input.parentSessionFile ? { parentSessionFile: input.parentSessionFile } : {}),
    ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
  };
}
