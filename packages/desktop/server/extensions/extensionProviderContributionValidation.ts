import {
  assertRecordArray,
  requireString,
  requireStringArray,
  validateEnum,
  validateOptionalString,
} from './extensionManifestValidation.js';

export function validateTurnContextProviderContributions(value: unknown): void {
  for (const [index, provider] of assertRecordArray(value, 'contributes.turnContextProviders').entries()) {
    requireString(provider.id, `contributes.turnContextProviders[${index}].id`);
    requireString(provider.handler, `contributes.turnContextProviders[${index}].handler`);
    validateOptionalString(provider.title, `contributes.turnContextProviders[${index}].title`);
    if (provider.priority !== undefined && (typeof provider.priority !== 'number' || !Number.isInteger(provider.priority))) {
      throw new Error(`Extension manifest contributes.turnContextProviders[${index}].priority must be an integer.`);
    }
    if (provider.scope !== undefined) {
      for (const [scopeIndex, scope] of requireStringArray(provider.scope, `contributes.turnContextProviders[${index}].scope`).entries()) {
        validateEnum(scope, ['global', 'workspace', 'conversation'], `contributes.turnContextProviders[${index}].scope[${scopeIndex}]`);
      }
    }
  }
}

export function validateRuntimeProviderContributions(value: unknown): void {
  for (const [index, provider] of assertRecordArray(value, 'contributes.runtimeProviders').entries()) {
    requireString(provider.id, `contributes.runtimeProviders[${index}].id`);
    requireString(provider.handler, `contributes.runtimeProviders[${index}].handler`);
    requireString(provider.title, `contributes.runtimeProviders[${index}].title`);
    validateOptionalString(provider.description, `contributes.runtimeProviders[${index}].description`);
  }
}

export function validateConversationConnectionProviderContributions(value: unknown): void {
  for (const [index, provider] of assertRecordArray(value, 'contributes.conversationConnectionProviders').entries()) {
    requireString(provider.id, `contributes.conversationConnectionProviders[${index}].id`);
    requireString(provider.action, `contributes.conversationConnectionProviders[${index}].action`);
    validateOptionalString(provider.title, `contributes.conversationConnectionProviders[${index}].title`);
    if (provider.kind !== undefined) {
      validateEnum(
        provider.kind,
        ['activity', 'state', 'asset', 'context', 'integration', 'surface'],
        `contributes.conversationConnectionProviders[${index}].kind`,
      );
    }
    if (provider.surfaces !== undefined) {
      for (const [surfaceIndex, surface] of requireStringArray(
        provider.surfaces,
        `contributes.conversationConnectionProviders[${index}].surfaces`,
      ).entries()) {
        validateEnum(
          surface,
          ['activityShelf', 'composerShelf', 'rightRail', 'workbench', 'sidebar', 'cli'],
          `contributes.conversationConnectionProviders[${index}].surfaces[${surfaceIndex}]`,
        );
      }
    }
    if (provider.priority !== undefined && !Number.isInteger(provider.priority)) {
      throw new Error(`Extension manifest contributes.conversationConnectionProviders[${index}].priority must be an integer.`);
    }
  }
}

export function validateDynamicProviderContributions(contributes: Record<string, unknown>, providerFields: readonly string[]): void {
  for (const providerField of providerFields) {
    if (contributes[providerField] === undefined) {
      continue;
    }
    for (const [index, provider] of assertRecordArray(contributes[providerField], `contributes.${providerField}`).entries()) {
      requireString(provider.id, `contributes.${providerField}[${index}].id`);
      requireString(provider.handler, `contributes.${providerField}[${index}].handler`);
      validateOptionalString(provider.title, `contributes.${providerField}[${index}].title`);
      if (provider.priority !== undefined && !Number.isInteger(provider.priority)) {
        throw new Error(`Extension manifest contributes.${providerField}[${index}].priority must be an integer.`);
      }
    }
  }
}
