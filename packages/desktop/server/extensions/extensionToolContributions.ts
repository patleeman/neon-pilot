import type { ExtensionPackageType, ExtensionToolContribution } from './extensionManifest.js';
import { buildExtensionToolRegistrationName } from './extensionToolNames.js';

export interface ExtensionToolRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  id: string;
  name: string;
  action: string;
  title?: string;
  label?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  promptSnippet?: string;
  promptGuidelines?: string[];
  priority?: number;
  when?: {
    providers?: string[];
    models?: string[];
  };
  replaces?: string;
  nativeRegistration?: boolean;
}

export function buildExtensionToolRegistrations(input: {
  extensionId: string;
  packageType?: ExtensionPackageType;
  tools?: ExtensionToolContribution[];
}): ExtensionToolRegistration[] {
  return (input.tools ?? []).flatMap((tool): ExtensionToolRegistration[] => {
    const id = tool.id.trim();
    if (!id || !tool.description?.trim()) {
      return [];
    }
    const explicitName = typeof tool.name === 'string' ? tool.name.trim() : '';
    const replaces = typeof tool.replaces === 'string' ? tool.replaces.trim() : '';
    const name = buildExtensionToolRegistrationName({ extensionId: input.extensionId, toolId: id, explicitName, replaces });
    if (!name) {
      return [];
    }
    return [
      {
        extensionId: input.extensionId,
        packageType: input.packageType ?? 'user',
        id,
        name,
        action: tool.action ?? tool.handler ?? id,
        ...(tool.title ? { title: tool.title } : {}),
        ...(tool.label ? { label: tool.label } : {}),
        description: tool.description,
        inputSchema: tool.inputSchema ?? { type: 'object', properties: {}, additionalProperties: false },
        ...(tool.promptSnippet ? { promptSnippet: tool.promptSnippet } : {}),
        ...(tool.promptGuidelines ? { promptGuidelines: tool.promptGuidelines } : {}),
        ...(Number.isInteger(tool.priority) ? { priority: tool.priority } : {}),
        ...(tool.when ? { when: tool.when } : {}),
        ...(replaces ? { replaces } : {}),
        ...(tool.nativeRegistration ? { nativeRegistration: true } : {}),
      },
    ];
  });
}
