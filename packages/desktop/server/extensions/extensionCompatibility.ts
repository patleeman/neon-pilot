import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ExtensionManifest } from './extensionManifest.js';

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function resolveInstalledAppVersion(): string {
  const candidates = [
    process.env.NEON_PILOT_REPO_ROOT ? resolve(process.env.NEON_PILOT_REPO_ROOT, 'package.json') : null,
    resolve(process.cwd(), 'package.json'),
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'app.asar', 'package.json') : null,
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'package.json') : null,
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const version = readJson(candidate)?.version;
    if (typeof version === 'string' && version.trim()) return version.trim();
  }
  return '0.0.0';
}

function parseVersion(value: string): ParsedVersion | null {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split('.').filter(Boolean) ?? [],
  };
}

function compareIdentifier(left: string, right: string): number {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : null;
  const rightNumber = /^\d+$/.test(right) ? Number(right) : null;
  if (leftNumber !== null && rightNumber !== null) return Math.sign(leftNumber - rightNumber);
  if (leftNumber !== null) return -1;
  if (rightNumber !== null) return 1;
  return left.localeCompare(right);
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) return Math.sign(left.major - right.major);
  if (left.minor !== right.minor) return Math.sign(left.minor - right.minor);
  if (left.patch !== right.patch) return Math.sign(left.patch - right.patch);
  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const compared = compareIdentifier(leftPart, rightPart);
    if (compared !== 0) return compared;
  }
  return 0;
}

function satisfiesComparator(version: ParsedVersion, comparator: string): boolean | null {
  const match = comparator.match(/^(>=|<=|>|<|=)?\s*v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
  if (!match) return null;
  const target = parseVersion(match[2]);
  if (!target) return null;
  const compared = compareVersions(version, target);
  const operator = match[1] ?? '=';
  if (operator === '>=') return compared >= 0;
  if (operator === '<=') return compared <= 0;
  if (operator === '>') return compared > 0;
  if (operator === '<') return compared < 0;
  return compared === 0;
}

export function satisfiesVersionRange(versionValue: string, rangeValue: string): boolean | null {
  const version = parseVersion(versionValue);
  if (!version) return null;
  const tokens = rangeValue
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0 || tokens.some((token) => token === '*' || token.toLowerCase() === 'x')) return true;
  let sawComparableToken = false;
  for (const token of tokens) {
    const result = satisfiesComparator(version, token);
    if (result === null) return null;
    sawComparableToken = true;
    if (!result) return false;
  }
  return sawComparableToken ? true : null;
}

export function getExtensionCompatibilityError(
  manifest: Pick<ExtensionManifest, 'id' | 'name' | 'compatibility'>,
  appVersion: string = resolveInstalledAppVersion(),
): string | null {
  const neonPilotRange = manifest.compatibility?.neonPilot?.trim();
  if (!neonPilotRange) return null;
  const compatible = satisfiesVersionRange(appVersion, neonPilotRange);
  if (compatible === false) {
    return `Extension "${manifest.name || manifest.id}" requires Neon Pilot ${neonPilotRange}, but this app is ${appVersion}.`;
  }
  return null;
}
