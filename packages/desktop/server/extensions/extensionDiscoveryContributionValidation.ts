import {
  assertRecordArray,
  requireString,
  requireStringArray,
  validateEnum,
  validateOptionalString,
} from './extensionManifestValidation.js';

export function validatePromptAssemblyHookContributions(value: unknown): void {
  for (const [index, hook] of assertRecordArray(value, 'contributes.promptAssemblyHooks').entries()) {
    requireString(hook.id, `contributes.promptAssemblyHooks[${index}].id`);
    requireString(hook.handler, `contributes.promptAssemblyHooks[${index}].handler`);
    validateOptionalString(hook.title, `contributes.promptAssemblyHooks[${index}].title`);
    validateEnum(
      requireString(hook.phase, `contributes.promptAssemblyHooks[${index}].phase`),
      ['after-discovery', 'before-policy', 'after-policy', 'before-injection', 'after-assembly'],
      `contributes.promptAssemblyHooks[${index}].phase`,
    );
    if (hook.priority !== undefined && !Number.isInteger(hook.priority)) {
      throw new Error(`Extension manifest contributes.promptAssemblyHooks[${index}].priority must be an integer.`);
    }
  }
}

export function validateQuickOpenContributions(value: unknown): void {
  for (const [index, provider] of assertRecordArray(value, 'contributes.quickOpen').entries()) {
    requireString(provider.id, `contributes.quickOpen[${index}].id`);
    requireString(provider.provider, `contributes.quickOpen[${index}].provider`);
    validateOptionalString(provider.title, `contributes.quickOpen[${index}].title`);
    validateOptionalString(provider.section, `contributes.quickOpen[${index}].section`);
    if (provider.order !== undefined && !Number.isInteger(provider.order)) {
      throw new Error(`Extension manifest contributes.quickOpen[${index}].order must be an integer.`);
    }
  }
}

export function validateSearchProviderContributions(value: unknown): void {
  for (const [index, provider] of assertRecordArray(value, 'contributes.searchProviders').entries()) {
    requireString(provider.id, `contributes.searchProviders[${index}].id`);
    requireString(provider.title, `contributes.searchProviders[${index}].title`);
    requireString(provider.action, `contributes.searchProviders[${index}].action`);
    if (provider.kinds !== undefined) requireStringArray(provider.kinds, `contributes.searchProviders[${index}].kinds`);
    if (provider.priority !== undefined && !Number.isInteger(provider.priority)) {
      throw new Error(`Extension manifest contributes.searchProviders[${index}].priority must be an integer.`);
    }
  }
}
