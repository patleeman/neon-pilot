import { existsSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function directoryHasEntries(path: string): boolean {
  try {
    return existsSync(path) && readdirSync(path).length > 0;
  } catch {
    return false;
  }
}

export function removeEmptyParentDirectories(root: string, filePath: string): void {
  let current = dirname(filePath);
  const resolvedRoot = resolve(root);
  while (current.startsWith(resolvedRoot) && current !== resolvedRoot) {
    try {
      rmdirSync(current);
    } catch {
      break;
    }
    current = dirname(current);
  }
}

export function deleteFileIfExists(filePath: string, root: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  unlinkSync(filePath);
  removeEmptyParentDirectories(root, filePath);
}
