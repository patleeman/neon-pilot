export function serializeSessionJsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function buildCustomSessionEntry(input: {
  id: string;
  parentId: string | null;
  timestamp: string;
  customType: string;
  data: unknown;
}): Record<string, unknown> {
  return {
    type: 'custom',
    id: input.id,
    parentId: input.parentId,
    timestamp: input.timestamp,
    customType: input.customType,
    data: input.data,
  };
}

export function buildCustomMessageSessionEntry(input: {
  id: string;
  parentId: string | null;
  timestamp: string;
  customType: string;
  content: string;
  details?: unknown;
  display?: boolean;
}): Record<string, unknown> {
  return {
    type: 'custom_message',
    id: input.id,
    parentId: input.parentId,
    timestamp: input.timestamp,
    customType: input.customType,
    content: input.content,
    ...(input.details !== undefined ? { details: input.details } : {}),
    ...(input.display !== undefined ? { display: input.display } : {}),
  };
}
