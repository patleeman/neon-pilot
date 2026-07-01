import { EXTENSION_ICON_NAMES } from './extensionManifest.js';
import { assertRecordArray, requireString, validateEnum, validateOptionalString } from './extensionManifestValidation.js';

function validateOptionalInteger(value: unknown, path: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value))) {
    throw new Error(`Extension manifest ${path} must be an integer.`);
  }
}

export function validateTopBarElementContributions(value: unknown): void {
  for (const [index, element] of assertRecordArray(value, 'contributes.topBarElements').entries()) {
    requireString(element.id, `contributes.topBarElements[${index}].id`);
    requireString(element.component, `contributes.topBarElements[${index}].component`);
    validateOptionalString(element.label, `contributes.topBarElements[${index}].label`);
  }
}

export function validateSetupItemContributions(value: unknown): void {
  for (const [index, item] of assertRecordArray(value, 'contributes.setupItems').entries()) {
    requireString(item.id, `contributes.setupItems[${index}].id`);
    requireString(item.title, `contributes.setupItems[${index}].title`);
    validateOptionalString(item.description, `contributes.setupItems[${index}].description`);
    validateOptionalString(item.capability, `contributes.setupItems[${index}].capability`);
    requireString(item.statusAction, `contributes.setupItems[${index}].statusAction`);
    if (item.severity !== undefined)
      validateEnum(item.severity, ['required', 'recommended', 'optional'], `contributes.setupItems[${index}].severity`);
    if (item.dismissible !== undefined && typeof item.dismissible !== 'boolean') {
      throw new Error(`Extension manifest contributes.setupItems[${index}].dismissible must be a boolean.`);
    }
    validateOptionalInteger(item.order, `contributes.setupItems[${index}].order`);
    if (item.actions === undefined || (Array.isArray(item.actions) && item.actions.length === 0)) {
      throw new Error(`Extension manifest contributes.setupItems[${index}].actions must include at least one setup action.`);
    }
    const actions = assertRecordArray(item.actions, `contributes.setupItems[${index}].actions`);
    for (const [actionIndex, action] of actions.entries()) {
      requireString(action.id, `contributes.setupItems[${index}].actions[${actionIndex}].id`);
      requireString(action.label, `contributes.setupItems[${index}].actions[${actionIndex}].label`);
      validateOptionalString(action.action, `contributes.setupItems[${index}].actions[${actionIndex}].action`);
      validateOptionalString(action.route, `contributes.setupItems[${index}].actions[${actionIndex}].route`);
      if (typeof action.action !== 'string' && typeof action.route !== 'string') {
        throw new Error(`Extension manifest contributes.setupItems[${index}].actions[${actionIndex}] must define action or route.`);
      }
      if (action.tone !== undefined)
        validateEnum(action.tone, ['default', 'primary', 'danger'], `contributes.setupItems[${index}].actions[${actionIndex}].tone`);
    }
  }
}

export function validateMessageActionContributions(value: unknown): void {
  for (const [index, action] of assertRecordArray(value, 'contributes.messageActions').entries()) {
    requireString(action.id, `contributes.messageActions[${index}].id`);
    requireString(action.title, `contributes.messageActions[${index}].title`);
    requireString(action.action, `contributes.messageActions[${index}].action`);
    validateOptionalString(action.when, `contributes.messageActions[${index}].when`);
    validateOptionalInteger(action.priority, `contributes.messageActions[${index}].priority`);
  }
}

export function validateComposerShelfContributions(value: unknown): void {
  for (const [index, shelf] of assertRecordArray(value, 'contributes.composerShelves').entries()) {
    requireString(shelf.id, `contributes.composerShelves[${index}].id`);
    requireString(shelf.component, `contributes.composerShelves[${index}].component`);
    validateOptionalString(shelf.title, `contributes.composerShelves[${index}].title`);
    validateOptionalString(shelf.conversationMetadataNamespace, `contributes.composerShelves[${index}].conversationMetadataNamespace`);
    if (shelf.placement !== undefined) validateEnum(shelf.placement, ['top', 'bottom'], `contributes.composerShelves[${index}].placement`);
  }
}

export function validateDraftConversationCreateContributions(value: unknown): void {
  for (const [index, contribution] of assertRecordArray(value, 'contributes.draftConversationCreate').entries()) {
    requireString(contribution.id, `contributes.draftConversationCreate[${index}].id`);
    requireString(contribution.prepareAction, `contributes.draftConversationCreate[${index}].prepareAction`);
    validateOptionalString(contribution.applyAction, `contributes.draftConversationCreate[${index}].applyAction`);
    validateOptionalInteger(contribution.priority, `contributes.draftConversationCreate[${index}].priority`);
  }
}

export function validateNewConversationPanelContributions(value: unknown): void {
  for (const [index, panel] of assertRecordArray(value, 'contributes.newConversationPanels').entries()) {
    requireString(panel.id, `contributes.newConversationPanels[${index}].id`);
    requireString(panel.component, `contributes.newConversationPanels[${index}].component`);
    validateOptionalString(panel.title, `contributes.newConversationPanels[${index}].title`);
    validateOptionalInteger(panel.priority, `contributes.newConversationPanels[${index}].priority`);
  }
}

export function validateComposerControlContributions(value: unknown): void {
  for (const [index, control] of assertRecordArray(value, 'contributes.composerControls').entries()) {
    requireString(control.id, `contributes.composerControls[${index}].id`);
    requireString(control.component, `contributes.composerControls[${index}].component`);
    validateOptionalString(control.title, `contributes.composerControls[${index}].title`);
    validateOptionalString(control.when, `contributes.composerControls[${index}].when`);
    if (control.slot !== undefined)
      validateEnum(control.slot, ['leading', 'preferences', 'actions'], `contributes.composerControls[${index}].slot`);
    validateOptionalInteger(control.priority, `contributes.composerControls[${index}].priority`);
  }
}

export function validateComposerInputToolContributions(value: unknown): void {
  for (const [index, tool] of assertRecordArray(value, 'contributes.composerInputTools').entries()) {
    requireString(tool.id, `contributes.composerInputTools[${index}].id`);
    requireString(tool.component, `contributes.composerInputTools[${index}].component`);
    validateOptionalString(tool.title, `contributes.composerInputTools[${index}].title`);
    validateOptionalString(tool.when, `contributes.composerInputTools[${index}].when`);
    validateOptionalInteger(tool.priority, `contributes.composerInputTools[${index}].priority`);
  }
}

export function validateToolbarActionContributions(value: unknown): void {
  for (const [index, action] of assertRecordArray(value, 'contributes.toolbarActions').entries()) {
    requireString(action.id, `contributes.toolbarActions[${index}].id`);
    requireString(action.title, `contributes.toolbarActions[${index}].title`);
    validateEnum(action.icon, EXTENSION_ICON_NAMES, `contributes.toolbarActions[${index}].icon`);
    requireString(action.action, `contributes.toolbarActions[${index}].action`);
    validateOptionalString(action.when, `contributes.toolbarActions[${index}].when`);
    validateOptionalInteger(action.priority, `contributes.toolbarActions[${index}].priority`);
  }
}
