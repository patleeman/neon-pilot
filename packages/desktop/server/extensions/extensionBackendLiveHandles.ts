const toolUpdateHandles = new Map<string, (update: never) => void>();
let nextToolUpdateHandleId = 0;

export function registerExtensionToolUpdateHandle(
  onUpdate: ((update: never) => void) | undefined,
): string | undefined {
  if (!onUpdate) return undefined;
  const handleId = `tool-update-${++nextToolUpdateHandleId}`;
  toolUpdateHandles.set(handleId, onUpdate);
  return handleId;
}

export function unregisterExtensionToolUpdateHandle(handleId: string | undefined): void {
  if (!handleId) return;
  toolUpdateHandles.delete(handleId);
}

export function emitExtensionToolUpdate(handleId: string, update: never): void {
  const onUpdate = toolUpdateHandles.get(handleId);
  if (!onUpdate) throw new Error(`Extension tool update handle not found: ${handleId}`);
  onUpdate(update);
}
