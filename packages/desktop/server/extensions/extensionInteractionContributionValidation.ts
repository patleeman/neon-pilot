import {
  assertRecordArray,
  requireString,
  requireStringArray,
  validateEnum,
  validateOptionalString,
} from './extensionManifestValidation.js';

function validateOptionalInteger(value: unknown, path: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value))) {
    throw new Error(`Extension manifest ${path} must be an integer.`);
  }
}

export function validateContextMenuContributions(value: unknown): void {
  for (const [index, menu] of assertRecordArray(value, 'contributes.contextMenus').entries()) {
    requireString(menu.id, `contributes.contextMenus[${index}].id`);
    requireString(menu.title, `contributes.contextMenus[${index}].title`);
    requireString(menu.action, `contributes.contextMenus[${index}].action`);
    validateEnum(
      menu.surface,
      ['message', 'conversationList', 'selection', 'fileSelection', 'transcriptSelection'],
      `contributes.contextMenus[${index}].surface`,
    );
    if (menu.separator !== undefined && typeof menu.separator !== 'boolean') {
      throw new Error(`Extension manifest contributes.contextMenus[${index}].separator must be a boolean.`);
    }
    validateOptionalString(menu.when, `contributes.contextMenus[${index}].when`);
  }
}

export function validateSelectionActionContributions(value: unknown): void {
  for (const [index, action] of assertRecordArray(value, 'contributes.selectionActions').entries()) {
    requireString(action.id, `contributes.selectionActions[${index}].id`);
    requireString(action.title, `contributes.selectionActions[${index}].title`);
    requireString(action.action, `contributes.selectionActions[${index}].action`);
    const kinds = requireStringArray(action.kinds, `contributes.selectionActions[${index}].kinds`);
    for (const [kindIndex, kind] of kinds.entries()) {
      validateEnum(
        kind,
        ['text', 'messages', 'files', 'transcriptRange', 'resource'],
        `contributes.selectionActions[${index}].kinds[${kindIndex}]`,
      );
    }
    validateOptionalString(action.icon, `contributes.selectionActions[${index}].icon`);
    validateOptionalString(action.when, `contributes.selectionActions[${index}].when`);
    validateOptionalInteger(action.priority, `contributes.selectionActions[${index}].priority`);
  }
}

export function validateTranscriptBlockContributions(value: unknown): void {
  for (const [index, block] of assertRecordArray(value, 'contributes.transcriptBlocks').entries()) {
    requireString(block.id, `contributes.transcriptBlocks[${index}].id`);
    requireString(block.component, `contributes.transcriptBlocks[${index}].component`);
    validateOptionalString(block.title, `contributes.transcriptBlocks[${index}].title`);
    validateOptionalInteger(block.schemaVersion, `contributes.transcriptBlocks[${index}].schemaVersion`);
  }
}

export function validateSubscriptionContributions(value: unknown): void {
  for (const [index, subscription] of assertRecordArray(value, 'contributes.subscriptions').entries()) {
    requireString(subscription.id, `contributes.subscriptions[${index}].id`);
    requireString(subscription.handler, `contributes.subscriptions[${index}].handler`);
    requireString(subscription.source, `contributes.subscriptions[${index}].source`);
    validateOptionalString(subscription.pattern, `contributes.subscriptions[${index}].pattern`);
    validateOptionalInteger(subscription.debounceMs, `contributes.subscriptions[${index}].debounceMs`);
  }
}
