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

export function validateConversationHeaderElementContributions(value: unknown): void {
  for (const [index, element] of assertRecordArray(value, 'contributes.conversationHeaderElements').entries()) {
    requireString(element.id, `contributes.conversationHeaderElements[${index}].id`);
    requireString(element.component, `contributes.conversationHeaderElements[${index}].component`);
    validateOptionalString(element.label, `contributes.conversationHeaderElements[${index}].label`);
  }
}

export function validateConversationDecoratorContributions(value: unknown): void {
  for (const [index, decorator] of assertRecordArray(value, 'contributes.conversationDecorators').entries()) {
    requireString(decorator.id, `contributes.conversationDecorators[${index}].id`);
    requireString(decorator.component, `contributes.conversationDecorators[${index}].component`);
    validateEnum(decorator.position, ['before-title', 'after-title', 'subtitle'], `contributes.conversationDecorators[${index}].position`);
    validateOptionalInteger(decorator.priority, `contributes.conversationDecorators[${index}].priority`);
  }
}

export function validateConversationLifecycleContributions(value: unknown): void {
  for (const [index, item] of assertRecordArray(value, 'contributes.conversationLifecycle').entries()) {
    requireString(item.id, `contributes.conversationLifecycle[${index}].id`);
    requireString(item.component, `contributes.conversationLifecycle[${index}].component`);
    const events = requireStringArray(item.events, `contributes.conversationLifecycle[${index}].events`);
    for (const [eventIndex, event] of events.entries()) {
      validateEnum(
        event,
        [
          'before-run',
          'after-run-start',
          'blocked',
          'waiting-for-user',
          'model-error',
          'tool-error',
          'goal-active',
          'compaction-available',
        ],
        `contributes.conversationLifecycle[${index}].events[${eventIndex}]`,
      );
    }
    if (item.slot !== undefined) validateEnum(item.slot, ['banner', 'inline'], `contributes.conversationLifecycle[${index}].slot`);
    validateOptionalInteger(item.priority, `contributes.conversationLifecycle[${index}].priority`);
  }
}
