export function buildDesktopConversationSource(input: { sessionFile: string; cwd: string; live: boolean }): {
  sessionFile: string;
  cwd: string;
  live: boolean;
} {
  return { sessionFile: input.sessionFile, cwd: input.cwd, live: input.live };
}

export function normalizeResolvedSessionFile(sessionFile: string | undefined | null): string | null {
  const normalized = sessionFile?.trim();
  return normalized || null;
}
