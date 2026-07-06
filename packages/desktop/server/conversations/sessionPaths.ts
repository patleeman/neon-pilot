import { dirname, join } from 'node:path';

import { getDurableSessionsDir } from '@neon-pilot/core';

export function resolvePersistentSessionDir(cwd: string, options?: { sessionsDir?: string }): string {
  const safePath = `--${cwd.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`;
  const sessionsDir = options?.sessionsDir ?? getDurableSessionsDir();
  return join(sessionsDir, safePath);
}

export function resolveSessionsDir(input: { envSessionsDir?: string; defaultSessionsDir: string }): string {
  return input.envSessionsDir ?? input.defaultSessionsDir;
}

export function resolveSessionsIndexFile(input: {
  envSessionsIndexFile?: string;
  envSessionsDir?: string;
  defaultSessionsIndexFile: string;
}): string {
  if (input.envSessionsIndexFile) {
    return input.envSessionsIndexFile;
  }

  if (input.envSessionsDir) {
    return join(dirname(input.envSessionsDir), 'session-meta-index.json');
  }

  return input.defaultSessionsIndexFile;
}
