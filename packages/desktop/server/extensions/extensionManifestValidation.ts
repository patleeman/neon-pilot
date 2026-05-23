import { isRecord } from './extensionRegistryConfig.js';

export function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Extension manifest ${path} must be a non-empty string.`);
  }
  return value;
}

export function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    throw new Error(`Extension manifest ${path} must be an array of non-empty strings.`);
  }
  return value;
}

export function assertArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Extension manifest ${path} must be an array.`);
  }
  return value;
}

export function assertRecordArray(value: unknown, path: string): Record<string, unknown>[] {
  return assertArray(value, path).map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Extension manifest ${path}[${index}] must be an object.`);
    }
    return item;
  });
}

export function validateOptionalString(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`Extension manifest ${path} must be a string.`);
  }
}

export function validateEnum(value: unknown, allowed: readonly string[], path: string): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`Extension manifest ${path} must be one of: ${allowed.join(', ')}.`);
  }
}
