import { readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export interface SessionFileEntry {
  filePath: string;
  cwdSlug: string;
}

export function slugToCwd(slug: string): string {
  return slug.replace(/^--/, '').replace(/--$/, '').replace(/-/g, '/');
}

export function resolveSessionFileCwdSlug(filePath: string, sessionsDir: string): string {
  return dirname(filePath) === sessionsDir ? '' : basename(dirname(filePath));
}

export function listSessionFiles(sessionsDir: string): SessionFileEntry[] {
  const files: SessionFileEntry[] = [];
  const pendingDirs = [sessionsDir];

  while (pendingDirs.length > 0) {
    const currentDir = pendingDirs.pop() as string;
    let entryNames: string[];

    try {
      entryNames = readdirSync(currentDir);
    } catch {
      continue;
    }

    for (const entryName of entryNames) {
      const entryPath = join(currentDir, entryName);

      try {
        const stats = statSync(entryPath);
        if (stats.isFile()) {
          if (entryName.endsWith('.jsonl')) {
            files.push({ filePath: entryPath, cwdSlug: resolveSessionFileCwdSlug(entryPath, sessionsDir) });
          }
          continue;
        }

        if (stats.isDirectory()) {
          pendingDirs.push(entryPath);
        }
      } catch {
        continue;
      }
    }
  }

  return files;
}
