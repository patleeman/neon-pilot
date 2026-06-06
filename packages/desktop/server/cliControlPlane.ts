import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { getStateRoot } from '@neon-pilot/core';

export interface NeonPilotCliControlPlaneRecord {
  version: 1;
  pid: number;
  updatedAt: string;
  extensionHost: {
    baseUrl: string;
    token: string;
  };
  localBackend?: {
    baseUrl: string;
    token: string;
  };
}

export function getNeonPilotCliControlPlaneFile(stateRoot: string = getStateRoot()): string {
  return join(stateRoot, 'desktop', 'cli-control-plane.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readEndpoint(value: unknown): { baseUrl: string; token: string } | undefined {
  if (!isRecord(value)) return undefined;
  const baseUrl = typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '';
  const token = typeof value.token === 'string' ? value.token.trim() : '';
  return baseUrl && token ? { baseUrl, token } : undefined;
}

export function readNeonPilotCliControlPlaneRecord(stateRoot: string = getStateRoot()): NeonPilotCliControlPlaneRecord | null {
  const filePath = getNeonPilotCliControlPlaneFile(stateRoot);
  if (!existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.pid !== 'number') return null;
    const extensionHost = readEndpoint(parsed.extensionHost);
    if (!extensionHost) return null;
    const localBackend = readEndpoint(parsed.localBackend);
    return {
      version: 1,
      pid: parsed.pid,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      extensionHost,
      ...(localBackend ? { localBackend } : {}),
    };
  } catch {
    return null;
  }
}

export function writeNeonPilotCliControlPlaneRecord(
  record: Omit<NeonPilotCliControlPlaneRecord, 'version' | 'updatedAt'>,
  stateRoot: string = getStateRoot(),
): string {
  const filePath = getNeonPilotCliControlPlaneFile(stateRoot);
  mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  const payload: NeonPilotCliControlPlaneRecord = {
    version: 1,
    updatedAt: new Date().toISOString(),
    ...record,
  };
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  return filePath;
}

export function removeNeonPilotCliControlPlaneRecord(stateRoot: string = getStateRoot()): void {
  rmSync(getNeonPilotCliControlPlaneFile(stateRoot), { force: true });
}
