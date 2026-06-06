import { EXTENSION_ICON_NAMES } from './extensionManifest.js';
import {
  assertRecordArray,
  requireString,
  requireStringArray,
  validateEnum,
  validateOptionalString,
} from './extensionManifestValidation.js';

export function validateNavigationContributions(value: unknown): void {
  for (const [index, nav] of assertRecordArray(value, 'contributes.nav').entries()) {
    requireString(nav.id, `contributes.nav[${index}].id`);
    requireString(nav.label, `contributes.nav[${index}].label`);
    requireString(nav.route, `contributes.nav[${index}].route`);
    if (nav.icon !== undefined) validateEnum(nav.icon, EXTENSION_ICON_NAMES, `contributes.nav[${index}].icon`);
    validateOptionalString(nav.badgeAction, `contributes.nav[${index}].badgeAction`);
    validateOptionalString(nav.sidebarView, `contributes.nav[${index}].sidebarView`);
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
    validateOptionalString(command.title, `contributes.cliCommands[${index}].title`);
    validateOptionalString(command.description, `contributes.cliCommands[${index}].description`);
    if (command.aliases !== undefined) requireStringArray(command.aliases, `contributes.cliCommands[${index}].aliases`);
    if (command.jsonDefault !== undefined && typeof command.jsonDefault !== 'boolean') {
      throw new Error(`Extension manifest contributes.cliCommands[${index}].jsonDefault must be a boolean.`);
    }
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
