import { isRecord } from './extensionRegistryConfig.js';

export interface ExtensionFailureRecord {
  at: string;
  operation: string;
  error: string;
}

export function normalizeExtensionFailureRecords(value: unknown): Record<string, ExtensionFailureRecord[]> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([id, records]) => {
      if (!Array.isArray(records)) return [];
      return [
        [
          id,
          records.filter(
            (record): record is ExtensionFailureRecord =>
              isRecord(record) && typeof record.at === 'string' && typeof record.operation === 'string' && typeof record.error === 'string',
          ),
        ],
      ];
    }),
  );
}
