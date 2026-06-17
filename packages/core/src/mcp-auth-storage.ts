import fs from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { resolveStatePaths } from './runtime/paths.js';

const MCP_AUTH_SCHEMA_VERSION = 'v1';

export interface LockfileData {
  pid: number;
  port: number;
  timestamp: number;
}

function getNeonPilotMcpBaseDir(): string {
  const explicit = process.env.NEON_PILOT_MCP_AUTH_DIR?.trim();
  if (explicit) {
    return resolve(explicit);
  }

  return join(resolveStatePaths().auth, 'mcp');
}

export function getMcpAuthConfigDir(): string {
  return join(getNeonPilotMcpBaseDir(), MCP_AUTH_SCHEMA_VERSION);
}

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(getMcpAuthConfigDir(), { recursive: true });
}

function assertSafeFileSegment(value: string): string {
  if (!value || value.includes('/') || value.includes('\\') || value === '.' || value === '..') {
    throw new Error(`Invalid MCP auth file segment: ${value}`);
  }
  return value;
}

function getMcpAuthFilePath(serverUrlHash: string, filename: string): string {
  const safeHash = assertSafeFileSegment(serverUrlHash);
  const safeFilename = assertSafeFileSegment(filename);
  return join(getMcpAuthConfigDir(), `${safeHash}_${safeFilename}`);
}

async function readExistingFile(filePaths: string[]): Promise<string | undefined> {
  for (const filePath of filePaths) {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return undefined;
}

export async function readJsonFile<T>(
  serverUrlHash: string,
  filename: string,
  schema: { parseAsync: (value: unknown) => Promise<T> },
): Promise<T | undefined> {
  const content = await readExistingFile([getMcpAuthFilePath(serverUrlHash, filename)]);

  if (!content) {
    return undefined;
  }

  try {
    return await schema.parseAsync(JSON.parse(content));
  } catch {
    return undefined;
  }
}

export async function writeJsonFile(serverUrlHash: string, filename: string, data: unknown): Promise<void> {
  await ensureConfigDir();
  await writePrivateFile(getMcpAuthFilePath(serverUrlHash, filename), `${JSON.stringify(data, null, 2)}\n`);
}

async function writePrivateFile(path: string, data: string): Promise<void> {
  await fs.writeFile(path, data, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  await fs.chmod(path, 0o600);
}

export async function readTextFile(serverUrlHash: string, filename: string): Promise<string | undefined> {
  return readExistingFile([getMcpAuthFilePath(serverUrlHash, filename)]);
}

export async function writeTextFile(serverUrlHash: string, filename: string, text: string): Promise<void> {
  await ensureConfigDir();
  await writePrivateFile(getMcpAuthFilePath(serverUrlHash, filename), text);
}

export async function deleteConfigFile(serverUrlHash: string, filename: string): Promise<void> {
  try {
    await fs.unlink(getMcpAuthFilePath(serverUrlHash, filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function createLockfile(serverUrlHash: string, pid: number, port: number): Promise<void> {
  const lockfile: LockfileData = {
    pid,
    port,
    timestamp: Date.now(),
  };

  await writeJsonFile(serverUrlHash, 'lock.json', lockfile);
}

export async function checkLockfile(serverUrlHash: string): Promise<LockfileData | null> {
  const lockfile = await readJsonFile<LockfileData>(serverUrlHash, 'lock.json', {
    async parseAsync(value: unknown): Promise<LockfileData> {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Invalid lockfile');
      }

      const record = value as Record<string, unknown>;
      if (typeof record.pid !== 'number' || typeof record.port !== 'number' || typeof record.timestamp !== 'number') {
        throw new Error('Invalid lockfile');
      }

      return {
        pid: record.pid,
        port: record.port,
        timestamp: record.timestamp,
      };
    },
  });

  return lockfile ?? null;
}

export async function deleteLockfile(serverUrlHash: string): Promise<void> {
  await deleteConfigFile(serverUrlHash, 'lock.json');
}
