export function normalizeToolNamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function buildExtensionToolRegistrationName(input: {
  extensionId: string;
  toolId: string;
  explicitName?: string;
  replaces?: string;
}): string | null {
  const explicitName = input.explicitName?.trim() ?? '';
  const replaces = input.replaces?.trim() ?? '';
  if (replaces) return replaces;
  if (explicitName) return explicitName;

  const extensionPart = normalizeToolNamePart(input.extensionId);
  const toolPart = normalizeToolNamePart(input.toolId);
  if (!extensionPart || !toolPart) return null;
  return `extension_${extensionPart}_${toolPart}`;
}
