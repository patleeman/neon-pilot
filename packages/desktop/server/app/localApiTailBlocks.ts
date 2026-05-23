const MAX_DESKTOP_LOCAL_API_TAIL_BLOCKS = 10000;

export function normalizeDesktopLocalApiTailBlocks(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? Math.min(MAX_DESKTOP_LOCAL_API_TAIL_BLOCKS, value)
    : undefined;
}
