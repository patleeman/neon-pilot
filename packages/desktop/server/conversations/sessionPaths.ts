import { dirname, join } from 'node:path';

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
