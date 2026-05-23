import { assertRecordArray, requireString, validateEnum, validateOptionalString } from './extensionManifestValidation.js';

function validateOptionalInteger(value: unknown, path: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value))) {
    throw new Error(`Extension manifest ${path} must be an integer.`);
  }
}

export function validateThreadHeaderActionContributions(value: unknown): void {
  for (const [index, action] of assertRecordArray(value, 'contributes.threadHeaderActions').entries()) {
    requireString(action.id, `contributes.threadHeaderActions[${index}].id`);
    requireString(action.component, `contributes.threadHeaderActions[${index}].component`);
    validateOptionalString(action.title, `contributes.threadHeaderActions[${index}].title`);
    validateOptionalInteger(action.priority, `contributes.threadHeaderActions[${index}].priority`);
  }
}

export function validateStatusBarItemContributions(value: unknown): void {
  for (const [index, item] of assertRecordArray(value, 'contributes.statusBarItems').entries()) {
    requireString(item.id, `contributes.statusBarItems[${index}].id`);
    requireString(item.label, `contributes.statusBarItems[${index}].label`);
    validateOptionalString(item.action, `contributes.statusBarItems[${index}].action`);
    validateOptionalString(item.component, `contributes.statusBarItems[${index}].component`);
    if (item.alignment !== undefined) validateEnum(item.alignment, ['left', 'right'], `contributes.statusBarItems[${index}].alignment`);
    validateOptionalInteger(item.priority, `contributes.statusBarItems[${index}].priority`);
  }
}

export function validateActivityTreeItemElementContributions(value: unknown): void {
  for (const [index, element] of assertRecordArray(value, 'contributes.activityTreeItemElements').entries()) {
    requireString(element.id, `contributes.activityTreeItemElements[${index}].id`);
    requireString(element.component, `contributes.activityTreeItemElements[${index}].component`);
    validateEnum(
      element.slot,
      ['leading', 'before-title', 'after-title', 'subtitle', 'trailing'],
      `contributes.activityTreeItemElements[${index}].slot`,
    );
    validateOptionalInteger(element.priority, `contributes.activityTreeItemElements[${index}].priority`);
  }
}

export function validateActivityTreeItemStyleContributions(value: unknown): void {
  for (const [index, style] of assertRecordArray(value, 'contributes.activityTreeItemStyles').entries()) {
    requireString(style.id, `contributes.activityTreeItemStyles[${index}].id`);
    requireString(style.provider, `contributes.activityTreeItemStyles[${index}].provider`);
    validateOptionalInteger(style.priority, `contributes.activityTreeItemStyles[${index}].priority`);
  }
}
