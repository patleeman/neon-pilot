import { assertRecordArray, requireString, validateOptionalString } from './extensionManifestValidation.js';

function validateOptionalInteger(value: unknown, path: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value))) {
    throw new Error(`Extension manifest ${path} must be an integer.`);
  }
}

export function validateComposerAttachmentProviderContributions(value: unknown): void {
  for (const [index, provider] of assertRecordArray(value, 'contributes.composerAttachmentProviders').entries()) {
    requireString(provider.id, `contributes.composerAttachmentProviders[${index}].id`);
    requireString(provider.title, `contributes.composerAttachmentProviders[${index}].title`);
    requireString(provider.action, `contributes.composerAttachmentProviders[${index}].action`);
    validateOptionalString(provider.icon, `contributes.composerAttachmentProviders[${index}].icon`);
    validateOptionalInteger(provider.priority, `contributes.composerAttachmentProviders[${index}].priority`);
  }
}

export function validateComposerAttachmentRendererContributions(value: unknown): void {
  for (const [index, renderer] of assertRecordArray(value, 'contributes.composerAttachmentRenderers').entries()) {
    requireString(renderer.id, `contributes.composerAttachmentRenderers[${index}].id`);
    requireString(renderer.type, `contributes.composerAttachmentRenderers[${index}].type`);
    requireString(renderer.component, `contributes.composerAttachmentRenderers[${index}].component`);
    validateOptionalInteger(renderer.priority, `contributes.composerAttachmentRenderers[${index}].priority`);
  }
}

export function validateComposerAttachmentResolverContributions(value: unknown): void {
  for (const [index, resolver] of assertRecordArray(value, 'contributes.composerAttachmentResolvers').entries()) {
    requireString(resolver.id, `contributes.composerAttachmentResolvers[${index}].id`);
    requireString(resolver.type, `contributes.composerAttachmentResolvers[${index}].type`);
    requireString(resolver.action, `contributes.composerAttachmentResolvers[${index}].action`);
  }
}

export function validateActivityTreeItemActionContributions(value: unknown): void {
  for (const [index, action] of assertRecordArray(value, 'contributes.activityTreeItemActions').entries()) {
    requireString(action.id, `contributes.activityTreeItemActions[${index}].id`);
    requireString(action.title, `contributes.activityTreeItemActions[${index}].title`);
    requireString(action.action, `contributes.activityTreeItemActions[${index}].action`);
    validateOptionalString(action.icon, `contributes.activityTreeItemActions[${index}].icon`);
    validateOptionalString(action.when, `contributes.activityTreeItemActions[${index}].when`);
    validateOptionalInteger(action.priority, `contributes.activityTreeItemActions[${index}].priority`);
  }
}
