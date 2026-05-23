export function resolveAttentionReadValue(read: boolean | undefined): boolean {
  return read !== false;
}

export function assertAttentionTargetUpdated(updated: boolean, message: string): void {
  if (!updated) {
    throw new Error(message);
  }
}

export function buildDesktopOkResponse(): { ok: true } {
  return { ok: true };
}
