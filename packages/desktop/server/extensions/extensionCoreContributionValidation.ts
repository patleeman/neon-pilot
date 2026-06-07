import {
  assertArray,
  assertRecordArray,
  requireString,
  requireStringArray,
  validateOptionalString,
} from './extensionManifestValidation.js';
import { isRecord } from './extensionRegistryConfig.js';

export function validateSkillContributions(value: unknown): void {
  for (const [index, skill] of assertArray(value, 'contributes.skills').entries()) {
    if (typeof skill === 'string') {
      requireString(skill, `contributes.skills[${index}]`);
      continue;
    }
    if (!isRecord(skill)) throw new Error(`Extension manifest contributes.skills[${index}] must be a string or object.`);
    requireString(skill.id, `contributes.skills[${index}].id`);
    requireString(skill.path, `contributes.skills[${index}].path`);
    validateOptionalString(skill.title, `contributes.skills[${index}].title`);
    validateOptionalString(skill.description, `contributes.skills[${index}].description`);
  }
}

export function validateToolContributions(value: unknown): void {
  for (const [index, tool] of assertRecordArray(value, 'contributes.tools').entries()) {
    requireString(tool.id, `contributes.tools[${index}].id`);
    requireString(tool.description, `contributes.tools[${index}].description`);
    validateOptionalString(tool.title, `contributes.tools[${index}].title`);
    validateOptionalString(tool.label, `contributes.tools[${index}].label`);
    validateOptionalString(tool.action, `contributes.tools[${index}].action`);
    validateOptionalString(tool.handler, `contributes.tools[${index}].handler`);
    validateOptionalString(tool.name, `contributes.tools[${index}].name`);
    validateOptionalString(tool.activation, `contributes.tools[${index}].activation`);
    if (tool.activation !== undefined && tool.activation !== 'auto' && tool.activation !== 'explicit') {
      throw new Error(`Extension manifest contributes.tools[${index}].activation must be one of: auto, explicit.`);
    }
    if (tool.when !== undefined) {
      if (!isRecord(tool.when)) throw new Error(`Extension manifest contributes.tools[${index}].when must be an object.`);
      if (tool.when.providers !== undefined) requireStringArray(tool.when.providers, `contributes.tools[${index}].when.providers`);
      if (tool.when.models !== undefined) requireStringArray(tool.when.models, `contributes.tools[${index}].when.models`);
    }
    validateOptionalString(tool.replaces, `contributes.tools[${index}].replaces`);
    if (tool.promptGuidelines !== undefined) requireStringArray(tool.promptGuidelines, `contributes.tools[${index}].promptGuidelines`);
  }
}

export function validateModelProfileContributions(value: unknown): void {
  for (const [index, profile] of assertRecordArray(value, 'contributes.modelProfiles').entries()) {
    requireString(profile.id, `contributes.modelProfiles[${index}].id`);
    requireStringArray(profile.match, `contributes.modelProfiles[${index}].match`);
    validateOptionalString(profile.title, `contributes.modelProfiles[${index}].title`);
    validateOptionalString(profile.description, `contributes.modelProfiles[${index}].description`);
    validateOptionalString(profile.startupAction, `contributes.modelProfiles[${index}].startupAction`);
    if (profile.activeTools !== undefined) {
      requireStringArray(profile.activeTools, `contributes.modelProfiles[${index}].activeTools`);
    }
    if (profile.priority !== undefined && typeof profile.priority !== 'number') {
      throw new Error(`Extension manifest contributes.modelProfiles[${index}].priority must be a number.`);
    }
  }
}
