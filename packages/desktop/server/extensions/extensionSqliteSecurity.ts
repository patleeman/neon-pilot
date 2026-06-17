import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const PRIVATE_SQLITE_DIR_MODE = 0o700;
const PRIVATE_SQLITE_FILE_MODE = 0o600;

export function preparePrivateExtensionSqlitePath(dbPath: string): void {
  const dir = dirname(dbPath);
  mkdirSync(dir, { recursive: true, mode: PRIVATE_SQLITE_DIR_MODE });
  chmodSync(dir, PRIVATE_SQLITE_DIR_MODE);
}

export function repairPrivateExtensionSqliteFiles(dbPath: string): void {
  for (const filePath of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (existsSync(filePath)) {
      chmodSync(filePath, PRIVATE_SQLITE_FILE_MODE);
    }
  }
}
