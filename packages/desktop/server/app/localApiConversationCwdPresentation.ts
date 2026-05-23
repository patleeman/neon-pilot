export function buildUnchangedConversationCwdResponse(input: { id: string; sessionFile: string; cwd: string }): {
  id: string;
  sessionFile: string;
  cwd: string;
  changed: false;
} {
  return { id: input.id, sessionFile: input.sessionFile, cwd: input.cwd, changed: false };
}

export function buildChangedConversationCwdResponse(input: { id: string; sessionFile: string; cwd: string }): {
  id: string;
  sessionFile: string;
  cwd: string;
  changed: true;
} {
  return { id: input.id, sessionFile: input.sessionFile, cwd: input.cwd, changed: true };
}

export function resolvePreviousWorkspaceCwd(input: {
  hasWorkspaceCwd: boolean;
  workspaceCwd?: string | null;
  currentCwd: string;
}): string | null {
  return input.hasWorkspaceCwd ? (input.workspaceCwd ?? null) : input.currentCwd;
}
