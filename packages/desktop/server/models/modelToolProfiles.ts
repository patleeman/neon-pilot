export type ModelToolProfileId = string;

export function readModelToolProfileId(value: unknown): ModelToolProfileId | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
