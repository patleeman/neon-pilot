import { EXTENSION_ICON_NAMES } from './extensionManifest.js';
import {
  assertRecordArray,
  requireString,
  requireStringArray,
  validateEnum,
  validateOptionalString,
} from './extensionManifestValidation.js';

const EXTENSION_PAGE_TYPES = ['conversation', 'table', 'editor', 'settings', 'dashboard', 'setup'] as const;

export function validateNavigationContributions(value: unknown): void {
  for (const [index, nav] of assertRecordArray(value, 'contributes.nav').entries()) {
    requireString(nav.id, `contributes.nav[${index}].id`);
    requireString(nav.label, `contributes.nav[${index}].label`);
    requireString(nav.route, `contributes.nav[${index}].route`);
    if (nav.icon !== undefined) validateEnum(nav.icon, EXTENSION_ICON_NAMES, `contributes.nav[${index}].icon`);
    validateOptionalString(nav.badgeAction, `contributes.nav[${index}].badgeAction`);
    validateOptionalString(nav.sidebarView, `contributes.nav[${index}].sidebarView`);
    validateOptionalString(nav.rightSidebarView, `contributes.nav[${index}].rightSidebarView`);
    if (nav.pageType !== undefined) validateEnum(nav.pageType, EXTENSION_PAGE_TYPES, `contributes.nav[${index}].pageType`);
    if (nav.section !== undefined) validateEnum(nav.section, ['primary', 'settings'], `contributes.nav[${index}].section`);
  }
}

export function validateCommandContributions(value: unknown): void {
  for (const [index, command] of assertRecordArray(value, 'contributes.commands').entries()) {
    requireString(command.id, `contributes.commands[${index}].id`);
    requireString(command.title, `contributes.commands[${index}].title`);
    requireString(command.action, `contributes.commands[${index}].action`);
    if (command.icon !== undefined) validateEnum(command.icon, EXTENSION_ICON_NAMES, `contributes.commands[${index}].icon`);
    validateOptionalString(command.category, `contributes.commands[${index}].category`);
    validateOptionalString(command.description, `contributes.commands[${index}].description`);
    validateOptionalString(command.enablement, `contributes.commands[${index}].enablement`);
  }
}

export function validateCliCommandContributions(value: unknown): void {
  for (const [index, command] of assertRecordArray(value, 'contributes.cliCommands').entries()) {
    requireString(command.id, `contributes.cliCommands[${index}].id`);
    requireString(command.command, `contributes.cliCommands[${index}].command`);
    requireString(command.action, `contributes.cliCommands[${index}].action`);
    validateOptionalString(command.inputAction, `contributes.cliCommands[${index}].inputAction`);
    validateOptionalString(command.title, `contributes.cliCommands[${index}].title`);
    validateOptionalString(command.description, `contributes.cliCommands[${index}].description`);
    validateOptionalString(command.usage, `contributes.cliCommands[${index}].usage`);
    if (command.examples !== undefined) requireStringArray(command.examples, `contributes.cliCommands[${index}].examples`);
    validateOptionalRecord(command.argsSchema, `contributes.cliCommands[${index}].argsSchema`);
    validateOptionalRecord(command.flagsSchema, `contributes.cliCommands[${index}].flagsSchema`);
    if (command.mode !== undefined) {
      validateEnum(command.mode, ['read', 'write', 'destructive', 'background', 'streaming'], `contributes.cliCommands[${index}].mode`);
    }
    validateOptionalBoolean(command.requiresApp, `contributes.cliCommands[${index}].requiresApp`);
    validateOptionalBoolean(command.destructive, `contributes.cliCommands[${index}].destructive`);
    validateOptionalBoolean(command.idempotent, `contributes.cliCommands[${index}].idempotent`);
    validateOptionalBoolean(command.startsBackgroundWork, `contributes.cliCommands[${index}].startsBackgroundWork`);
    validateOptionalBoolean(command.supportsDryRun, `contributes.cliCommands[${index}].supportsDryRun`);
    if (command.outputModes !== undefined) {
      const outputModes = requireStringArray(command.outputModes, `contributes.cliCommands[${index}].outputModes`);
      for (const mode of outputModes) {
        validateEnum(mode, ['text', 'json', 'jsonl'], `contributes.cliCommands[${index}].outputModes[]`);
      }
    }
    if (command.streaming !== undefined) {
      validateOptionalRecord(command.streaming, `contributes.cliCommands[${index}].streaming`);
      const streaming = command.streaming as Record<string, unknown>;
      validateOptionalBoolean(streaming.supportsFollow, `contributes.cliCommands[${index}].streaming.supportsFollow`);
      validateOptionalBoolean(streaming.supportsJsonl, `contributes.cliCommands[${index}].streaming.supportsJsonl`);
      validateOptionalBoolean(streaming.cancelOnInterruptDefault, `contributes.cliCommands[${index}].streaming.cancelOnInterruptDefault`);
    }
    if (command.smoke !== undefined) {
      validateOptionalRecord(command.smoke, `contributes.cliCommands[${index}].smoke`);
      const smoke = command.smoke as Record<string, unknown>;
      if (smoke.argv !== undefined) requireStringArray(smoke.argv, `contributes.cliCommands[${index}].smoke.argv`);
      if (smoke.expectHumanIncludes !== undefined) {
        requireStringArray(smoke.expectHumanIncludes, `contributes.cliCommands[${index}].smoke.expectHumanIncludes`);
      }
      if (smoke.expectJsonFields !== undefined) {
        requireStringArray(smoke.expectJsonFields, `contributes.cliCommands[${index}].smoke.expectJsonFields`);
      }
    }
    if (command.aliases !== undefined) requireStringArray(command.aliases, `contributes.cliCommands[${index}].aliases`);
    if (command.jsonDefault !== undefined && typeof command.jsonDefault !== 'boolean') {
      throw new Error(`Extension manifest contributes.cliCommands[${index}].jsonDefault must be a boolean.`);
    }
  }
}

function validateOptionalBoolean(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`Extension manifest ${path} must be a boolean.`);
  }
}

function validateOptionalRecord(value: unknown, path: string): void {
  if (value !== undefined && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    throw new Error(`Extension manifest ${path} must be an object.`);
  }
}

export function validateKeybindingContributions(value: unknown): void {
  for (const [index, keybinding] of assertRecordArray(value, 'contributes.keybindings').entries()) {
    requireString(keybinding.id, `contributes.keybindings[${index}].id`);
    requireString(keybinding.title, `contributes.keybindings[${index}].title`);
    requireStringArray(keybinding.keys, `contributes.keybindings[${index}].keys`);
    requireString(keybinding.command, `contributes.keybindings[${index}].command`);
    validateOptionalString(keybinding.when, `contributes.keybindings[${index}].when`);
    if (keybinding.scope !== undefined) validateEnum(keybinding.scope, ['global', 'surface'], `contributes.keybindings[${index}].scope`);
  }
}

export function validateSlashCommandContributions(value: unknown): void {
  for (const [index, command] of assertRecordArray(value, 'contributes.slashCommands').entries()) {
    requireString(command.name, `contributes.slashCommands[${index}].name`);
    requireString(command.description, `contributes.slashCommands[${index}].description`);
    requireString(command.action, `contributes.slashCommands[${index}].action`);
  }
}

export function validateMentionContributions(value: unknown): void {
  for (const [index, mention] of assertRecordArray(value, 'contributes.mentions').entries()) {
    requireString(mention.id, `contributes.mentions[${index}].id`);
    requireString(mention.title, `contributes.mentions[${index}].title`);
    validateOptionalString(mention.description, `contributes.mentions[${index}].description`);
    requireStringArray(mention.kinds, `contributes.mentions[${index}].kinds`);
    requireString(mention.provider, `contributes.mentions[${index}].provider`);
  }
}
