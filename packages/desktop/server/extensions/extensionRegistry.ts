import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getStateRoot } from '@neon-pilot/core';

import {
  validateActivityTreeItemElementContributions,
  validateActivityTreeItemStyleContributions,
  validateStatusBarItemContributions,
  validateThreadHeaderActionContributions,
} from './extensionActivityContributionValidation.js';
import { validateExtensionBackendContribution } from './extensionBackendValidation.js';
import {
  validateCommandContributions,
  validateKeybindingContributions,
  validateMentionContributions,
  validateNavigationContributions,
  validateSlashCommandContributions,
} from './extensionBasicContributionValidation.js';
import {
  applyExtensionQuarantine,
  buildFailureRecord,
  type ExtensionFailureRecord,
  planStartupGuardQuarantines,
  pruneRecentFailureRecords,
} from './extensionCircuitBreaker.js';
import {
  validateActivityTreeItemActionContributions,
  validateComposerAttachmentProviderContributions,
  validateComposerAttachmentRendererContributions,
  validateComposerAttachmentResolverContributions,
} from './extensionComposerAttachmentValidation.js';
import { listExtensionContributionDiagnostics as listExtensionContributionDiagnosticsValue } from './extensionContributionDiagnostics.js';
import {
  validateConversationDecoratorContributions,
  validateConversationHeaderElementContributions,
  validateConversationLifecycleContributions,
} from './extensionConversationContributionValidation.js';
import {
  validateModelProfileContributions,
  validateSkillContributions,
  validateToolContributions,
} from './extensionCoreContributionValidation.js';
import {
  validatePromptAssemblyHookContributions,
  validateQuickOpenContributions,
  validateSearchProviderContributions,
} from './extensionDiscoveryContributionValidation.js';
import { assertCanSetExtensionEnabled, buildExtensionEnabledConfigPatch, LOCKED_EXTENSION_IDS } from './extensionEnabledConfig.js';
import { normalizeExtensionFailureRecords } from './extensionFailureRecords.js';
import { buildExtensionFailureResponse, shouldQuarantineExtensionFailure } from './extensionFailureResponse.js';
import {
  validateContextMenuContributions,
  validateSelectionActionContributions,
  validateSubscriptionContributions,
  validateTranscriptBlockContributions,
} from './extensionInteractionContributionValidation.js';
import { readInvalidExtensionManifestMetadata } from './extensionInvalidManifests.js';
import { applyExtensionKeybindingConfigPatch } from './extensionKeybindingConfig.js';
import type { ExtensionManifest, ExtensionPackageType, ExtensionSurface, ExtensionViewContribution } from './extensionManifest.js';
import {
  EXTENSION_ICON_NAMES,
  EXTENSION_PLACEMENTS,
  EXTENSION_RIGHT_SURFACE_SCOPES,
  EXTENSION_ROUTE_CAPABILITIES,
  EXTENSION_SURFACE_KINDS,
} from './extensionManifest.js';
import {
  assertExtensionManifestRecord,
  validateExtensionManifestBasics,
  validateExtensionManifestDependencies,
  validateExtensionManifestFrontend,
} from './extensionManifestCoreValidation.js';
import { requireStringArray } from './extensionManifestValidation.js';
import { type ExtensionModelProfileResolution, resolveExtensionModelProfileFromRegistrations } from './extensionModelProfileResolution.js';
import { listExtensionPackagePaths } from './extensionPackagePaths.js';
import {
  validateDynamicProviderContributions,
  validateRuntimeProviderContributions,
  validateTurnContextProviderContributions,
} from './extensionProviderContributionValidation.js';
import { buildExtensionRegistrationContext } from './extensionRegistrationContext.js';
import {
  type ExtensionRegistryConfig,
  isRecord,
  normalizeExtensionRegistryConfig,
  serializeExtensionRegistryConfig,
} from './extensionRegistryConfig.js';
import {
  buildExtensionSecretRegistrations as buildExtensionSecretContributionRegistrations,
  buildExtensionSettingsRegistrations as buildExtensionSettingsContributionRegistrations,
} from './extensionSettingsContributions.js';
import {
  validateSecretContributions,
  validateSettingsComponentContribution,
  validateSettingsContributions,
} from './extensionSettingsContributionValidation.js';
import {
  buildExtensionMentionRegistrations as buildExtensionMentionContributionRegistrations,
  buildExtensionModelProfileRegistrations as buildExtensionModelProfileContributionRegistrations,
} from './extensionSimpleContributions.js';
import { buildExtensionSkillRegistrations as buildExtensionSkillRegistrationsValue } from './extensionSkillRegistrations.js';
import { buildExtensionStartupGuardResult, buildExtensionStartupMarker } from './extensionStartupMarker.js';
import { validateExtensionSurfaceContributions } from './extensionSurfaceValidation.js';
import { buildExtensionToolRegistrations as buildExtensionToolContributionRegistrations } from './extensionToolContributions.js';
import {
  validateComposerButtonContributions,
  validateComposerControlContributions,
  validateComposerInputToolContributions,
  validateComposerShelfContributions,
  validateMessageActionContributions,
  validateNewConversationPanelContributions,
  validateToolbarActionContributions,
  validateTopBarElementContributions,
} from './extensionUiContributionValidation.js';
import {
  validatePromptReferenceContributions,
  validateThemeContributions,
  validateTranscriptRendererContributions,
  validateViewContributions,
} from './extensionViewContributionValidation.js';
import { SYSTEM_EXTENSION_ENTRIES } from './systemExtensions.js';

// Per-extension health errors stored in memory. Cleared on successful load/reload.
const buildErrors = new Map<string, string>();
const healthErrors = new Map<string, string>();

export function setBuildError(extensionId: string, error: string): void {
  buildErrors.set(extensionId, error);
}

export function clearBuildError(extensionId: string): void {
  buildErrors.delete(extensionId);
}

export function setExtensionHealthError(extensionId: string, error: string): void {
  healthErrors.set(extensionId, error);
}

export function clearExtensionHealthError(extensionId: string): void {
  healthErrors.delete(extensionId);
}

export type LoadedExtensionManifest = ExtensionManifest & { packageType: ExtensionPackageType };

export interface InvalidExtensionEntry {
  id: string;
  name: string;
  packageType: ExtensionPackageType;
  packageRoot: string;
  source: 'runtime';
  errors: string[];
}

export interface ExtensionRegistryEntry {
  manifest: LoadedExtensionManifest;
  packageRoot?: string;
  source: 'system' | 'runtime';
}

export interface ExtensionSkillRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  id: string;
  name: string;
  title?: string;
  description?: string;
  path: string;
  packageRoot: string;
}

export interface ExtensionMentionRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  id: string;
  title: string;
  description?: string;
  kinds: string[];
  provider: string;
}

export interface ExtensionToolRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  id: string;
  name: string;
  action: string;
  title?: string;
  label?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  promptSnippet?: string;
  promptGuidelines?: string[];
  priority?: number;
  when?: {
    providers?: string[];
    models?: string[];
  };
  /** Built-in tool name this tool overrides. */
  replaces?: string;
  /** Tool is registered by the extension's agentExtension; skip auto-registration in manifestToolAgentExtension. */
  nativeRegistration?: boolean;
}

export interface ExtensionModelProfileRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  id: string;
  title?: string;
  description?: string;
  match: string[];
  priority: number;
}

export interface ExtensionAgentRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  exportName: string;
}

export interface ExtensionInstallSummary {
  id: string;
  name: string;
  packageType: ExtensionPackageType;
  enabled: boolean;
  status: 'enabled' | 'disabled' | 'invalid';
  errors?: string[];
  diagnostics?: string[];
  buildError?: string;
  healthError?: string;
  description?: string;
  version?: string;
  packageRoot?: string;
  manifest: LoadedExtensionManifest;
  permissions: ExtensionManifest['permissions'];
  surfaces: ExtensionSurface[];
  backendActions: NonNullable<ExtensionManifest['backend']>['actions'];
  services: NonNullable<ExtensionManifest['backend']>['services'];
  subscriptions: NonNullable<NonNullable<ExtensionManifest['contributes']>['subscriptions']>;
  dependsOn: NonNullable<ExtensionManifest['dependsOn']>;
  skills: ExtensionSkillRegistration[];
  mentions: ExtensionMentionRegistration[];
  tools: ExtensionToolRegistration[];
  modelProfiles: ExtensionModelProfileRegistration[];
  routes: Array<{ route: string; surfaceId: string }>;
}

export interface ExtensionRegistrySnapshot {
  extensions: LoadedExtensionManifest[];
  routes: Array<{ route: string; extensionId: string; surfaceId: string; packageType: ExtensionPackageType }>;
  surfaces: Array<ExtensionSurface & { extensionId: string; packageType: ExtensionPackageType }>;
  views: Array<
    ExtensionViewContribution & {
      extensionId: string;
      packageType: ExtensionPackageType;
      frontend?: ExtensionManifest['frontend'];
    }
  >;
}

export interface ExtensionCommandRegistration {
  extensionId: string;
  surfaceId: string;
  packageType: ExtensionPackageType;
  title: string;
  action: string;
  args?: unknown;
  icon?: string;
  category?: string;
  description?: string;
  enablement?: string;
}

export interface ExtensionKeybindingRegistration {
  extensionId: string;
  surfaceId: string;
  packageType: ExtensionPackageType;
  title: string;
  keys: string[];
  command: string;
  args?: unknown;
  when?: string;
  scope: 'global' | 'surface';
  defaultKeys: string[];
  enabled: boolean;
}

export interface ExtensionSlashCommandRegistration {
  extensionId: string;
  surfaceId: string;
  packageType: ExtensionPackageType;
  name: string;
  description: string;
  action: string;
}

export interface ExtensionPromptContextProviderRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  handler: string;
  title?: string;
  priority?: number;
  scope?: Array<'global' | 'workspace' | 'conversation'>;
}

export interface ExtensionRuntimeProviderRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  handler: string;
  title: string;
  description?: string;
}

export interface ExtensionAssemblyProviderRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  handler: string;
  title?: string;
  priority?: number;
  kind: 'skills' | 'tools' | 'promptTemplates' | 'instructions';
}

export interface ExtensionPromptAssemblyHookRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  handler: string;
  title?: string;
  priority?: number;
  phase: 'after-discovery' | 'before-policy' | 'after-policy' | 'before-injection' | 'after-assembly';
}

export interface ExtensionPromptReferenceRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  handler: string;
  title?: string;
}

export interface ExtensionQuickOpenRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  provider: string;
  title?: string;
  section?: string;
  order?: number;
}

export interface ExtensionSearchProviderRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  title: string;
  action: string;
  kinds?: string[];
  priority?: number;
}

export interface ExtensionComposerShelfRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  component: string;
  title?: string;
  placement: 'top' | 'bottom';
  frontendEntry?: string;
}

export interface ExtensionNewConversationPanelRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  component: string;
  title?: string;
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionToolbarActionRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  title: string;
  icon: string;
  action: string;
  when?: string;
  priority?: number;
}

export interface ExtensionComposerButtonRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  component: string;
  title?: string;
  slot?: 'leading' | 'preferences' | 'actions';
  when?: string;
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionComposerInputToolRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  component: string;
  title?: string;
  when?: string;
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionConversationDecoratorRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  component: string;
  position: 'before-title' | 'after-title' | 'subtitle';
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionStatusBarItemRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  label: string;
  action?: string;
  component?: string;
  alignment: 'left' | 'right';
  priority?: number;
  frontendEntry?: string;
}

export interface ExtensionConversationHeaderRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  component: string;
  label?: string;
  frontendEntry?: string;
}

export interface ExtensionContextMenuRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  title: string;
  action: string;
  surface: 'message' | 'conversationList' | 'selection' | 'fileSelection' | 'transcriptSelection';
  separator?: boolean;
  when?: string;
}

export interface ExtensionMessageActionRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  title: string;
  action: string;
  when?: string;
  priority?: number;
}

export interface ExtensionSettingsRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  key: string;
  type: string;
  default?: unknown;
  description?: string;
  group: string;
  enum?: string[];
  placeholder?: string;
  order: number;
}

export interface ExtensionSecretRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  id: string;
  key: string;
  label: string;
  description?: string;
  env?: string;
  placeholder?: string;
  order: number;
}

export interface ExtensionSettingsComponentRegistration {
  extensionId: string;
  id: string;
  packageType: ExtensionPackageType;
  component: string;
  sectionId: string;
  label: string;
  description?: string;
  order?: number;
  frontendEntry?: string;
}

const EXTENSION_FAILURE_WINDOW_MS = 10 * 60 * 1000;
const EXTENSION_FAILURE_THRESHOLD = 3;

export function getRuntimeExtensionsRoot(stateRoot: string = getStateRoot()): string {
  return join(stateRoot, 'extensions');
}

function getExtensionRegistryConfigPath(stateRoot: string = getStateRoot()): string {
  return join(getRuntimeExtensionsRoot(stateRoot), 'registry.json');
}

function getExtensionFailurePath(stateRoot: string = getStateRoot()): string {
  return join(getRuntimeExtensionsRoot(stateRoot), 'failures.json');
}

function getExtensionStartupMarkerPath(stateRoot: string = getStateRoot()): string {
  return join(getRuntimeExtensionsRoot(stateRoot), 'startup-marker.json');
}

function readExtensionRegistryConfig(stateRoot: string = getStateRoot()): ExtensionRegistryConfig {
  const configPath = getExtensionRegistryConfigPath(stateRoot);
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    return normalizeExtensionRegistryConfig(JSON.parse(readFileSync(configPath, 'utf-8')) as unknown);
  } catch {
    return {};
  }
}

function readExtensionFailureRecords(stateRoot: string = getStateRoot()): Record<string, ExtensionFailureRecord[]> {
  const path = getExtensionFailurePath(stateRoot);
  if (!existsSync(path)) return {};
  try {
    return normalizeExtensionFailureRecords(JSON.parse(readFileSync(path, 'utf-8')) as unknown);
  } catch {
    return {};
  }
}

function writeExtensionFailureRecords(records: Record<string, ExtensionFailureRecord[]>, stateRoot: string = getStateRoot()): void {
  const extensionsRoot = getRuntimeExtensionsRoot(stateRoot);
  mkdirSync(extensionsRoot, { recursive: true });
  writeFileSync(getExtensionFailurePath(stateRoot), `${JSON.stringify(records, null, 2)}\n`);
}

function listExtensionContributionDiagnostics(entry: ExtensionRegistryEntry): string[] {
  return listExtensionContributionDiagnosticsValue({
    packageRoot: entry.packageRoot,
    skills: entry.manifest.contributes?.skills,
    dependsOn: entry.manifest.dependsOn,
    availableExtensionIds: listExtensionEntries().map((candidate) => candidate.manifest.id),
  });
}

function buildExtensionSkillRegistrations(entry: ExtensionRegistryEntry): ExtensionSkillRegistration[] {
  return buildExtensionSkillRegistrationsValue(entry) as ExtensionSkillRegistration[];
}

function buildExtensionMentionRegistrations(entry: ExtensionRegistryEntry): ExtensionMentionRegistration[] {
  return buildExtensionMentionContributionRegistrations({
    ...buildExtensionRegistrationContext(entry),
    mentions: entry.manifest.contributes?.mentions,
  });
}

function buildExtensionSettingsRegistrations(entry: ExtensionRegistryEntry): ExtensionSettingsRegistration[] {
  return buildExtensionSettingsContributionRegistrations({
    ...buildExtensionRegistrationContext(entry),
    settings: entry.manifest.contributes?.settings,
  });
}

function buildExtensionSecretRegistrations(entry: ExtensionRegistryEntry): ExtensionSecretRegistration[] {
  return buildExtensionSecretContributionRegistrations({
    ...buildExtensionRegistrationContext(entry),
    secrets: entry.manifest.contributes?.secrets,
  });
}

function buildExtensionToolRegistrations(entry: ExtensionRegistryEntry): ExtensionToolRegistration[] {
  return buildExtensionToolContributionRegistrations({
    ...buildExtensionRegistrationContext(entry),
    tools: entry.manifest.contributes?.tools,
  });
}

function buildExtensionModelProfileRegistrations(entry: ExtensionRegistryEntry): ExtensionModelProfileRegistration[] {
  return buildExtensionModelProfileContributionRegistrations({
    ...buildExtensionRegistrationContext(entry),
    profiles: entry.manifest.contributes?.modelProfiles,
  });
}

function writeExtensionRegistryConfig(config: ExtensionRegistryConfig, stateRoot: string = getStateRoot()): void {
  const extensionsRoot = getRuntimeExtensionsRoot(stateRoot);
  mkdirSync(extensionsRoot, { recursive: true });
  writeFileSync(getExtensionRegistryConfigPath(stateRoot), serializeExtensionRegistryConfig(config));
}

export function isExtensionEnabled(extensionId: string, stateRoot: string = getStateRoot()): boolean {
  const config = readExtensionRegistryConfig(stateRoot);
  if ((config.disabledIds ?? []).includes(extensionId)) return false;
  const entry = listExtensionEntries(stateRoot).find((candidate) => candidate.manifest.id === extensionId);
  if (entry?.manifest.defaultEnabled === false) {
    return (config.enabledIds ?? []).includes(extensionId);
  }
  return true;
}

export function setExtensionEnabled(extensionId: string, enabled: boolean, stateRoot: string = getStateRoot()): void {
  assertCanSetExtensionEnabled({ extensionId, enabled, lockedExtensionIds: LOCKED_EXTENSION_IDS });
  const config = readExtensionRegistryConfig(stateRoot);
  writeExtensionRegistryConfig(buildExtensionEnabledConfigPatch(config, { extensionId, enabled }), stateRoot);
}

export function recordExtensionFailure(input: { extensionId: string; operation: string; error: string; stateRoot?: string }): {
  quarantined: boolean;
  failures: number;
} {
  const stateRoot = input.stateRoot ?? getStateRoot();
  const now = Date.now();
  const cutoff = now - EXTENSION_FAILURE_WINDOW_MS;
  const records = readExtensionFailureRecords(stateRoot);
  const existing = records[input.extensionId] ?? [];
  const next = [
    ...pruneRecentFailureRecords(existing, cutoff),
    buildFailureRecord({ operation: input.operation, error: input.error, now }),
  ];
  records[input.extensionId] = next;
  writeExtensionFailureRecords(records, stateRoot);

  if (!shouldQuarantineExtensionFailure({ failureCount: next.length, threshold: EXTENSION_FAILURE_THRESHOLD })) {
    return buildExtensionFailureResponse({ quarantined: false, failures: next.length });
  }

  const config = readExtensionRegistryConfig(stateRoot);
  writeExtensionRegistryConfig(
    applyExtensionQuarantine(config, {
      extensionId: input.extensionId,
      reason: input.error,
      at: new Date(now).toISOString(),
      failures: next.length,
    }),
    stateRoot,
  );
  return buildExtensionFailureResponse({ quarantined: true, failures: next.length });
}

export function clearExtensionFailureRecords(extensionId: string, stateRoot: string = getStateRoot()): void {
  const records = readExtensionFailureRecords(stateRoot);
  if (!(extensionId in records)) return;
  delete records[extensionId];
  writeExtensionFailureRecords(records, stateRoot);
}

export function beginExtensionStartupGuard(stateRoot: string = getStateRoot()): { safeMode: boolean; disabledIds: string[] } {
  const markerPath = getExtensionStartupMarkerPath(stateRoot);
  const safeMode = existsSync(markerPath);
  const disabledIds: string[] = [];
  if (safeMode) {
    const config = readExtensionRegistryConfig(stateRoot);
    const at = new Date().toISOString();
    const plan = planStartupGuardQuarantines(
      config,
      listExtensionEntries(stateRoot).map((entry) => ({
        id: entry.manifest.id,
        source: entry.source,
        enabled: isExtensionEnabled(entry.manifest.id, stateRoot),
      })),
      at,
    );
    disabledIds.push(...plan.disabledIds);
    writeExtensionRegistryConfig(plan.config, stateRoot);
  }
  mkdirSync(getRuntimeExtensionsRoot(stateRoot), { recursive: true });
  writeFileSync(markerPath, buildExtensionStartupMarker(new Date().toISOString()));
  return buildExtensionStartupGuardResult({ safeMode, disabledIds });
}

export function completeExtensionStartupGuard(stateRoot: string = getStateRoot()): void {
  rmSync(getExtensionStartupMarkerPath(stateRoot), { force: true });
}

export function setExtensionKeybinding(input: {
  extensionId: string;
  keybindingId: string;
  title?: string;
  command?: string;
  args?: unknown;
  scope?: 'global' | 'surface';
  packageType?: ExtensionPackageType;
  keys?: string[];
  enabled?: boolean;
  reset?: boolean;
  stateRoot?: string;
}): void {
  const stateRoot = input.stateRoot ?? getStateRoot();
  const config = readExtensionRegistryConfig(stateRoot);
  if (input.command && input.title) {
    const command = findExtensionCommandRegistration(input.command);
    if (!command) {
      throw new Error(`Cannot create keybinding for unknown command: ${input.command}`);
    }
    if (command.extensionId !== input.extensionId) {
      throw new Error(`Cannot create keybinding for command owned by ${command.extensionId}.`);
    }
  }

  writeExtensionRegistryConfig(applyExtensionKeybindingConfigPatch(config, input), stateRoot);
}

function validateExtensionContributions(contributes: Record<string, unknown>): void {
  if (contributes.views !== undefined) {
    validateViewContributions(contributes.views);
  }

  if (contributes.nav !== undefined) {
    validateNavigationContributions(contributes.nav);
  }

  if (contributes.commands !== undefined) {
    validateCommandContributions(contributes.commands);
  }

  if (contributes.keybindings !== undefined) {
    validateKeybindingContributions(contributes.keybindings);
  }

  if (contributes.slashCommands !== undefined) {
    validateSlashCommandContributions(contributes.slashCommands);
  }

  if (contributes.mentions !== undefined) {
    validateMentionContributions(contributes.mentions);
  }

  if (contributes.promptReferences !== undefined) {
    validatePromptReferenceContributions(contributes.promptReferences);
  }

  if (contributes.turnContextProviders !== undefined) {
    validateTurnContextProviderContributions(contributes.turnContextProviders);
  }

  if (contributes.runtimeProviders !== undefined) {
    validateRuntimeProviderContributions(contributes.runtimeProviders);
  }

  validateDynamicProviderContributions(contributes, ['skillProviders', 'toolProviders', 'promptTemplateProviders', 'instructionProviders']);

  if (contributes.promptAssemblyHooks !== undefined) {
    validatePromptAssemblyHookContributions(contributes.promptAssemblyHooks);
  }

  if (contributes.quickOpen !== undefined) {
    validateQuickOpenContributions(contributes.quickOpen);
  }

  if (contributes.searchProviders !== undefined) {
    validateSearchProviderContributions(contributes.searchProviders);
  }

  if (contributes.skills !== undefined) {
    validateSkillContributions(contributes.skills);
  }

  if (contributes.tools !== undefined) {
    validateToolContributions(contributes.tools);
  }

  if (contributes.modelProfiles !== undefined) {
    validateModelProfileContributions(contributes.modelProfiles);
  }

  if (contributes.transcriptRenderers !== undefined) {
    validateTranscriptRendererContributions(contributes.transcriptRenderers);
  }

  if (contributes.themes !== undefined) {
    validateThemeContributions(contributes.themes);
  }

  if (contributes.topBarElements !== undefined) {
    validateTopBarElementContributions(contributes.topBarElements);
  }

  if (contributes.messageActions !== undefined) {
    validateMessageActionContributions(contributes.messageActions);
  }

  if (contributes.composerShelves !== undefined) {
    validateComposerShelfContributions(contributes.composerShelves);
  }

  if (contributes.newConversationPanels !== undefined) {
    validateNewConversationPanelContributions(contributes.newConversationPanels);
  }

  if (contributes.composerControls !== undefined) {
    validateComposerControlContributions(contributes.composerControls);
  }

  if (contributes.composerButtons !== undefined) {
    validateComposerButtonContributions(contributes.composerButtons);
  }

  if (contributes.composerInputTools !== undefined) {
    validateComposerInputToolContributions(contributes.composerInputTools);
  }

  if (contributes.toolbarActions !== undefined) {
    validateToolbarActionContributions(contributes.toolbarActions);
  }

  if (contributes.contextMenus !== undefined) {
    validateContextMenuContributions(contributes.contextMenus);
  }

  if (contributes.selectionActions !== undefined) {
    validateSelectionActionContributions(contributes.selectionActions);
  }

  if (contributes.transcriptBlocks !== undefined) {
    validateTranscriptBlockContributions(contributes.transcriptBlocks);
  }

  if (contributes.subscriptions !== undefined) {
    validateSubscriptionContributions(contributes.subscriptions);
  }

  if (contributes.threadHeaderActions !== undefined) {
    validateThreadHeaderActionContributions(contributes.threadHeaderActions);
  }

  if (contributes.statusBarItems !== undefined) {
    validateStatusBarItemContributions(contributes.statusBarItems);
  }

  if (contributes.conversationHeaderElements !== undefined) {
    validateConversationHeaderElementContributions(contributes.conversationHeaderElements);
  }

  if (contributes.conversationDecorators !== undefined) {
    validateConversationDecoratorContributions(contributes.conversationDecorators);
  }

  if (contributes.activityTreeItemElements !== undefined) {
    validateActivityTreeItemElementContributions(contributes.activityTreeItemElements);
  }

  if (contributes.activityTreeItemStyles !== undefined) {
    validateActivityTreeItemStyleContributions(contributes.activityTreeItemStyles);
  }

  if (contributes.conversationLifecycle !== undefined) {
    validateConversationLifecycleContributions(contributes.conversationLifecycle);
  }

  if (contributes.composerAttachmentProviders !== undefined) {
    validateComposerAttachmentProviderContributions(contributes.composerAttachmentProviders);
  }

  if (contributes.composerAttachmentRenderers !== undefined) {
    validateComposerAttachmentRendererContributions(contributes.composerAttachmentRenderers);
  }

  if (contributes.composerAttachmentResolvers !== undefined) {
    validateComposerAttachmentResolverContributions(contributes.composerAttachmentResolvers);
  }

  if (contributes.activityTreeItemActions !== undefined) {
    validateActivityTreeItemActionContributions(contributes.activityTreeItemActions);
  }

  if (contributes.settingsComponent !== undefined) {
    validateSettingsComponentContribution(contributes.settingsComponent);
  }

  if (contributes.settings !== undefined) {
    validateSettingsContributions(contributes.settings);
  }

  if (contributes.secrets !== undefined) {
    validateSecretContributions(contributes.secrets);
  }

  if (contributes.secretBackends !== undefined) {
    throw new Error('Extension manifest contributes.secretBackends is not supported. Use the built-in secrets.provider backends.');
  }
}

function validateExtensionBackend(backend: Record<string, unknown>): void {
  validateExtensionBackendContribution(backend);
}

function validateExtensionSurfaces(surfaces: unknown): void {
  validateExtensionSurfaceContributions(surfaces);
}

export function parseExtensionManifest(value: unknown): ExtensionManifest {
  assertExtensionManifestRecord(value);
  validateExtensionManifestBasics(value);
  if (value.dependsOn !== undefined) {
    validateExtensionManifestDependencies(value.dependsOn);
  }
  if (value.frontend !== undefined) {
    validateExtensionManifestFrontend(value.frontend);
  }
  if (value.contributes !== undefined) {
    if (!isRecord(value.contributes)) throw new Error('Extension manifest contributes must be an object.');
    validateExtensionContributions(value.contributes);
  }
  if (value.backend !== undefined) {
    if (!isRecord(value.backend)) throw new Error('Extension manifest backend must be an object.');
    validateExtensionBackend(value.backend);
  }
  if (value.surfaces !== undefined) validateExtensionSurfaces(value.surfaces);
  if (value.permissions !== undefined) requireStringArray(value.permissions, 'permissions');

  return value as unknown as ExtensionManifest;
}

export function readInvalidRuntimeExtensionEntries(stateRoot: string = getStateRoot()): InvalidExtensionEntry[] {
  return listExtensionPackagePaths({ runtimeRoot: getRuntimeExtensionsRoot(stateRoot) })
    .filter((entry) => entry.source === 'external')
    .flatMap((entry): InvalidExtensionEntry[] => {
      const manifestPath = join(entry.packageRoot, 'extension.json');
      try {
        parseExtensionManifest(JSON.parse(readFileSync(manifestPath, 'utf-8')));
        return [];
      } catch (error) {
        const { id, name } = readInvalidExtensionManifestMetadata(manifestPath, entry.packageRoot);
        return [
          {
            id,
            name,
            packageType: 'user',
            packageRoot: entry.packageRoot,
            source: 'runtime',
            errors: [error instanceof Error ? error.message : String(error)],
          },
        ];
      }
    });
}

export function readRuntimeExtensionEntries(stateRoot: string = getStateRoot()): ExtensionRegistryEntry[] {
  return listExtensionPackagePaths({ runtimeRoot: getRuntimeExtensionsRoot(stateRoot) })
    .filter((entry) => entry.source === 'external')
    .flatMap((entry): ExtensionRegistryEntry[] => {
      const manifestPath = join(entry.packageRoot, 'extension.json');
      try {
        const manifest = parseExtensionManifest(JSON.parse(readFileSync(manifestPath, 'utf-8')));
        return [{ manifest: { ...manifest, packageType: 'user' }, packageRoot: entry.packageRoot, source: 'runtime' }];
      } catch {
        return [];
      }
    });
}

export function listExtensionEntries(stateRoot: string = getStateRoot()): ExtensionRegistryEntry[] {
  const entries = [
    ...SYSTEM_EXTENSION_ENTRIES.map((entry) => ({ manifest: entry.manifest, packageRoot: entry.packageRoot, source: 'system' as const })),
    ...readRuntimeExtensionEntries(stateRoot),
  ];
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.manifest.id)) return false;
    seen.add(entry.manifest.id);
    return true;
  });
}

export function listEnabledExtensionEntries(stateRoot: string = getStateRoot()): ExtensionRegistryEntry[] {
  return listExtensionEntries(stateRoot).filter((entry) => isExtensionEnabled(entry.manifest.id, stateRoot));
}

export function listExtensions(): LoadedExtensionManifest[] {
  return listEnabledExtensionEntries().map((entry) => entry.manifest);
}

export function listExtensionInstallSummaries(stateRoot: string = getStateRoot()): ExtensionInstallSummary[] {
  const valid = listExtensionEntries(stateRoot).map((entry) => {
    const manifest = entry.manifest;
    const surfaces = manifest.surfaces ?? [];
    const views = manifest.contributes?.views ?? [];
    const enabled = isExtensionEnabled(manifest.id, stateRoot);
    const diagnostics = listExtensionContributionDiagnostics(entry);
    const buildError = buildErrors.get(manifest.id);
    const healthError = healthErrors.get(manifest.id);
    const quarantine = readExtensionRegistryConfig(stateRoot).quarantined?.[manifest.id];
    const quarantineDiagnostic = quarantine
      ? `Extension disabled by circuit breaker: ${quarantine.reason} (${quarantine.failures} failures at ${quarantine.at})`
      : null;
    const allDiagnostics = [...diagnostics, ...(quarantineDiagnostic ? [quarantineDiagnostic] : [])];
    return {
      id: manifest.id,
      name: manifest.name,
      packageType: manifest.packageType ?? 'user',
      enabled,
      status: enabled ? ('enabled' as const) : ('disabled' as const),
      ...(buildError ? { buildError } : {}),
      ...(healthError
        ? { healthError, diagnostics: [...allDiagnostics, `Backend health check failed: ${healthError}`] }
        : allDiagnostics.length > 0
          ? { diagnostics: allDiagnostics }
          : {}),
      ...(manifest.description ? { description: manifest.description } : {}),
      ...(manifest.version ? { version: manifest.version } : {}),
      ...(entry.packageRoot ? { packageRoot: entry.packageRoot } : {}),
      manifest,
      permissions: manifest.permissions ?? [],
      surfaces,
      backendActions: manifest.backend?.actions ?? [],
      services: manifest.backend?.services ?? [],
      subscriptions: manifest.contributes?.subscriptions ?? [],
      dependsOn: manifest.dependsOn ?? [],
      skills: isExtensionEnabled(manifest.id, stateRoot) ? buildExtensionSkillRegistrations(entry) : [],
      mentions: isExtensionEnabled(manifest.id, stateRoot) ? buildExtensionMentionRegistrations(entry) : [],
      tools: isExtensionEnabled(manifest.id, stateRoot) ? buildExtensionToolRegistrations(entry) : [],
      modelProfiles: isExtensionEnabled(manifest.id, stateRoot) ? buildExtensionModelProfileRegistrations(entry) : [],
      routes: [
        ...surfaces.flatMap((surface) =>
          surface.kind === 'page' && 'route' in surface ? [{ route: surface.route, surfaceId: surface.id }] : [],
        ),
        ...views.flatMap((view) => (view.location === 'main' && view.route ? [{ route: view.route, surfaceId: view.id }] : [])),
      ],
    };
  });
  const validIds = new Set(valid.map((extension) => extension.id));
  const invalid = readInvalidRuntimeExtensionEntries(stateRoot)
    .filter((entry) => !validIds.has(entry.id))
    .map(
      (entry): ExtensionInstallSummary => ({
        id: entry.id,
        name: entry.name,
        packageType: entry.packageType,
        enabled: false,
        status: 'invalid',
        errors: entry.errors,
        packageRoot: entry.packageRoot,
        manifest: { schemaVersion: 2, id: entry.id, name: entry.name, packageType: entry.packageType },
        permissions: [],
        surfaces: [],
        backendActions: [],
        services: [],
        subscriptions: [],
        dependsOn: [],
        skills: [],
        mentions: [],
        tools: [],
        modelProfiles: [],
        routes: [],
      }),
    );
  return [...valid, ...invalid];
}

export function readExtensionSchema() {
  return {
    manifestVersion: 2,
    placements: EXTENSION_PLACEMENTS,
    surfaceKinds: EXTENSION_SURFACE_KINDS,
    rightSurfaceScopes: EXTENSION_RIGHT_SURFACE_SCOPES,
    routeCapabilities: EXTENSION_ROUTE_CAPABILITIES,
    iconNames: EXTENSION_ICON_NAMES,
    contributions: [
      'views',
      'nav',
      'commands',
      'keybindings',
      'slashCommands',
      'mentions',
      'settings',
      'settingsComponent',
      'skills',
      'skillProviders',
      'tools',
      'toolProviders',
      'promptTemplateProviders',
      'instructionProviders',
      'promptAssemblyHooks',
      'promptReferences',
      'promptContextProviders',
      'turnContextProviders',
      'runtimeProviders',
      'quickOpen',
      'searchProviders',
      'themes',
      'topBarElements',
      'messageActions',
      'composerShelves',
      'newConversationPanels',
      'composerControls',
      'composerButtons',
      'composerInputTools',
      'toolbarActions',
      'selectionActions',
      'transcriptBlocks',
      'subscriptions',
      'conversationDecorators',
      'activityTreeItemElements',
      'activityTreeItemStyles',
      'conversationLifecycle',
      'composerAttachmentProviders',
      'composerAttachmentRenderers',
      'composerAttachmentResolvers',
      'activityTreeItemActions',
      'contextMenus',
      'threadHeaderActions',
      'statusBarItems',
      'conversationHeaderElements',
    ],
  };
}

export function readExtensionRegistrySnapshot(): ExtensionRegistrySnapshot {
  const extensions = listExtensions();
  const surfaces = extensions.flatMap((extension) =>
    (extension.surfaces ?? []).map((surface) => ({ ...surface, extensionId: extension.id, packageType: extension.packageType ?? 'user' })),
  );
  const views = extensions.flatMap((extension) =>
    (extension.contributes?.views ?? []).map((view) => ({
      ...view,
      extensionId: extension.id,
      packageType: extension.packageType ?? 'user',
      ...(extension.frontend ? { frontend: extension.frontend } : {}),
    })),
  );
  const routes = [
    ...surfaces.flatMap((surface) =>
      surface.kind === 'page' && 'route' in surface
        ? [{ route: surface.route, extensionId: surface.extensionId, surfaceId: surface.id, packageType: surface.packageType }]
        : [],
    ),
    ...views.flatMap((view) =>
      view.location === 'main' && view.route
        ? [{ route: view.route, extensionId: view.extensionId, surfaceId: view.id, packageType: view.packageType }]
        : [],
    ),
  ];
  return { extensions, routes, surfaces, views };
}

export function listExtensionMentionRegistrations(): ExtensionMentionRegistration[] {
  return listEnabledExtensionEntries().flatMap(buildExtensionMentionRegistrations);
}

export function listExtensionCommandRegistrations(): ExtensionCommandRegistration[] {
  const snapshot = readExtensionRegistrySnapshot();
  const legacy = snapshot.surfaces.flatMap((surface) =>
    surface.kind === 'command'
      ? [
          {
            extensionId: surface.extensionId,
            surfaceId: surface.id,
            packageType: surface.packageType,
            title: surface.title,
            action: surface.action,
            ...(surface.icon ? { icon: surface.icon } : {}),
          },
        ]
      : [],
  );
  const native = snapshot.extensions.flatMap((extension) => {
    const explicitCommandIds = new Set((extension.contributes?.commands ?? []).map((command) => command.id));
    const contributed = (extension.contributes?.commands ?? []).map((command) => ({
      extensionId: extension.id,
      surfaceId: command.id,
      packageType: extension.packageType ?? 'user',
      title: command.title,
      action: command.action,
      ...(command.args !== undefined ? { args: command.args } : {}),
      ...(command.argsSchema !== undefined ? { argsSchema: command.argsSchema } : {}),
      ...(command.icon ? { icon: command.icon } : {}),
      ...(command.category ? { category: command.category } : {}),
      ...(command.description ? { description: command.description } : {}),
      ...(command.enablement ? { enablement: command.enablement } : {}),
    }));
    const autoCommands = [
      ...(extension.contributes?.nav ?? []).map((nav) => ({
        extensionId: extension.id,
        surfaceId: `open-${nav.id}`,
        packageType: extension.packageType ?? 'user',
        title: `Open ${nav.label}`,
        action: 'app.navigate',
        args: { to: nav.route },
        ...(nav.icon ? { icon: nav.icon } : {}),
        category: extension.name,
      })),
      ...(extension.contributes?.views ?? [])
        .filter((view) => view.location === 'rightRail')
        .map((view) => ({
          extensionId: extension.id,
          surfaceId: `open-${view.id}`,
          packageType: extension.packageType ?? 'user',
          title: `Open ${view.title}`,
          action: 'rail.open',
          args: { extensionId: extension.id, surfaceId: view.id },
          ...(view.icon ? { icon: view.icon } : {}),
          category: extension.name,
        })),
    ].filter((command) => !explicitCommandIds.has(command.surfaceId));
    return [...contributed, ...autoCommands];
  });
  return [...legacy, ...native];
}

export function listExtensionKeybindingRegistrations(stateRoot: string = getStateRoot()): ExtensionKeybindingRegistration[] {
  const snapshot = readExtensionRegistrySnapshot();
  const config = readExtensionRegistryConfig(stateRoot);
  const disabledKeybindings = new Set(config.disabledKeybindings ?? []);
  const keybindingOverrides = config.keybindingOverrides ?? {};
  const declared = snapshot.extensions.flatMap((extension) =>
    (extension.contributes?.keybindings ?? []).flatMap((keybinding) => {
      const id = keybinding.id.trim();
      const title = keybinding.title.trim();
      const command = keybinding.command.trim();
      const registryKey = `${extension.id}:${id}`;
      const defaultKeys = keybinding.keys.map((key) => key.trim()).filter(Boolean);
      const keys = keybindingOverrides[registryKey] ?? defaultKeys;
      if (!id || !title || !command || keys.length === 0) {
        return [];
      }
      return [
        {
          extensionId: extension.id,
          surfaceId: id,
          packageType: extension.packageType ?? 'user',
          title,
          keys,
          command,
          ...(keybinding.args !== undefined ? { args: keybinding.args } : {}),
          ...(keybinding.when ? { when: keybinding.when } : {}),
          scope: keybinding.scope ?? 'global',
          defaultKeys,
          enabled: !disabledKeybindings.has(registryKey),
        },
      ];
    }),
  );
  const declaredKeys = new Set(declared.map((keybinding) => `${keybinding.extensionId}:${keybinding.surfaceId}`));
  const custom = Object.entries(config.commandKeybindings ?? {}).flatMap(([registryKey, keybinding]) => {
    if (declaredKeys.has(registryKey)) return [];
    const keys = keybindingOverrides[registryKey] ?? keybinding.defaultKeys ?? [];
    return [
      {
        extensionId: keybinding.extensionId,
        surfaceId: keybinding.surfaceId,
        packageType: keybinding.packageType ?? (keybinding.extensionId === 'host' ? 'system' : 'user'),
        title: keybinding.title,
        keys,
        command: keybinding.command,
        ...(keybinding.args !== undefined ? { args: keybinding.args } : {}),
        scope: keybinding.scope ?? 'global',
        defaultKeys: keybinding.defaultKeys ?? [],
        enabled: !disabledKeybindings.has(registryKey),
      },
    ];
  });
  return [...declared, ...custom];
}

export function findExtensionCommandRegistration(commandId: string): ExtensionCommandRegistration | undefined {
  return listExtensionCommandRegistrations().find(
    (command) => `${command.extensionId}.${command.surfaceId}` === commandId || command.surfaceId === commandId,
  );
}

export function listExtensionSlashCommandRegistrations(): ExtensionSlashCommandRegistration[] {
  const snapshot = readExtensionRegistrySnapshot();
  const legacy = snapshot.surfaces.flatMap((surface) =>
    surface.kind === 'slashCommand'
      ? [
          {
            extensionId: surface.extensionId,
            surfaceId: surface.id,
            packageType: surface.packageType,
            name: surface.name,
            description: surface.description,
            action: surface.action,
          },
        ]
      : [],
  );
  const native = snapshot.extensions.flatMap((extension) =>
    (extension.contributes?.slashCommands ?? []).map((command) => ({
      extensionId: extension.id,
      surfaceId: command.name,
      packageType: extension.packageType ?? 'user',
      name: command.name,
      description: command.description,
      action: command.action,
    })),
  );
  return [...legacy, ...native];
}

export function listExtensionPromptContextProviderRegistrations(
  stateRoot: string = getStateRoot(),
): ExtensionPromptContextProviderRegistration[] {
  return listEnabledExtensionEntries(stateRoot)
    .flatMap((entry) =>
      [...(entry.manifest.contributes?.promptContextProviders ?? []), ...(entry.manifest.contributes?.turnContextProviders ?? [])].flatMap(
        (provider): ExtensionPromptContextProviderRegistration[] => {
          const id = provider.id.trim();
          const handler = provider.handler.trim();
          if (!id || !handler) return [];
          return [
            {
              extensionId: entry.manifest.id,
              id,
              packageType: entry.manifest.packageType ?? 'user',
              handler,
              ...(provider.title ? { title: provider.title } : {}),
              ...('priority' in provider && Number.isInteger(provider.priority) ? { priority: provider.priority as number } : {}),
              ...('scope' in provider && Array.isArray(provider.scope)
                ? {
                    scope: (provider.scope as Array<'global' | 'workspace' | 'conversation'>).filter(
                      (s) => s === 'global' || s === 'workspace' || s === 'conversation',
                    ),
                  }
                : {}),
            },
          ];
        },
      ),
    )
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0));
}

export function listExtensionRuntimeProviderRegistrations(stateRoot: string = getStateRoot()): ExtensionRuntimeProviderRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.runtimeProviders ?? []).flatMap((provider): ExtensionRuntimeProviderRegistration[] => {
      const id = provider.id.trim();
      const handler = provider.handler.trim();
      const title = provider.title.trim();
      if (!id || !handler || !title) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          handler,
          title,
          ...(provider.description ? { description: provider.description } : {}),
        },
      ];
    }),
  );
}

export function listExtensionAssemblyProviderRegistrations(stateRoot: string = getStateRoot()): ExtensionAssemblyProviderRegistration[] {
  const fields = [
    ['skillProviders', 'skills'],
    ['toolProviders', 'tools'],
    ['promptTemplateProviders', 'promptTemplates'],
    ['instructionProviders', 'instructions'],
  ] as const;
  return listEnabledExtensionEntries(stateRoot)
    .flatMap((entry) =>
      fields.flatMap(([field, kind]) =>
        (entry.manifest.contributes?.[field] ?? []).flatMap((provider): ExtensionAssemblyProviderRegistration[] => {
          const id = provider.id.trim();
          const handler = provider.handler.trim();
          if (!id || !handler) return [];
          return [
            {
              extensionId: entry.manifest.id,
              id,
              packageType: entry.manifest.packageType ?? 'user',
              handler,
              kind,
              ...(provider.title ? { title: provider.title } : {}),
              ...(Number.isInteger(provider.priority) ? { priority: provider.priority } : {}),
            },
          ];
        }),
      ),
    )
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0) || left.id.localeCompare(right.id));
}

export function listExtensionPromptAssemblyHookRegistrations(
  stateRoot: string = getStateRoot(),
): ExtensionPromptAssemblyHookRegistration[] {
  return listEnabledExtensionEntries(stateRoot)
    .flatMap((entry) =>
      (entry.manifest.contributes?.promptAssemblyHooks ?? []).flatMap((hook): ExtensionPromptAssemblyHookRegistration[] => {
        const id = hook.id.trim();
        const handler = hook.handler.trim();
        if (!id || !handler) return [];
        return [
          {
            extensionId: entry.manifest.id,
            id,
            packageType: entry.manifest.packageType ?? 'user',
            handler,
            phase: hook.phase,
            ...(hook.title ? { title: hook.title } : {}),
            ...(Number.isInteger(hook.priority) ? { priority: hook.priority } : {}),
          },
        ];
      }),
    )
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0) || left.id.localeCompare(right.id));
}

export function listExtensionPromptReferenceRegistrations(stateRoot: string = getStateRoot()): ExtensionPromptReferenceRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.promptReferences ?? []).flatMap((resolver): ExtensionPromptReferenceRegistration[] => {
      const id = resolver.id.trim();
      const handler = resolver.handler.trim();
      if (!id || !handler) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          handler,
          ...(resolver.title ? { title: resolver.title } : {}),
        },
      ];
    }),
  );
}

export function listExtensionQuickOpenRegistrations(stateRoot: string = getStateRoot()): ExtensionQuickOpenRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.quickOpen ?? []).flatMap((provider): ExtensionQuickOpenRegistration[] => {
      const id = provider.id.trim();
      const resolvedProvider = provider.provider.trim();
      if (!id || !resolvedProvider) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          provider: resolvedProvider,
          ...(provider.title ? { title: provider.title } : {}),
          ...(provider.section ? { section: provider.section } : {}),
          ...(Number.isInteger(provider.order) ? { order: provider.order } : {}),
        },
      ];
    }),
  );
}

export function listExtensionSearchProviderRegistrations(stateRoot: string = getStateRoot()): ExtensionSearchProviderRegistration[] {
  return listEnabledExtensionEntries(stateRoot)
    .flatMap((entry) =>
      (entry.manifest.contributes?.searchProviders ?? []).flatMap((provider): ExtensionSearchProviderRegistration[] => {
        const id = provider.id.trim();
        const action = provider.action.trim();
        if (!id || !action || !provider.title.trim()) return [];
        return [
          {
            extensionId: entry.manifest.id,
            id,
            packageType: entry.manifest.packageType ?? 'user',
            title: provider.title,
            action,
            ...(provider.kinds?.length ? { kinds: provider.kinds } : {}),
            ...(Number.isInteger(provider.priority) ? { priority: provider.priority } : {}),
          },
        ];
      }),
    )
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function listExtensionComposerShelfRegistrations(stateRoot: string = getStateRoot()): ExtensionComposerShelfRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.composerShelves ?? []).flatMap((shelf): ExtensionComposerShelfRegistration[] => {
      const id = shelf.id.trim();
      const component = shelf.component.trim();
      if (!id || !component) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          component,
          ...(shelf.title ? { title: shelf.title } : {}),
          placement: shelf.placement ?? 'bottom',
        },
      ];
    }),
  );
}

export function listExtensionNewConversationPanelRegistrations(
  stateRoot: string = getStateRoot(),
): ExtensionNewConversationPanelRegistration[] {
  return listEnabledExtensionEntries(stateRoot)
    .flatMap((entry) =>
      (entry.manifest.contributes?.newConversationPanels ?? []).flatMap((panel): ExtensionNewConversationPanelRegistration[] => {
        const id = panel.id.trim();
        const component = panel.component.trim();
        if (!id || !component) return [];
        return [
          {
            extensionId: entry.manifest.id,
            id,
            packageType: entry.manifest.packageType ?? 'user',
            component,
            ...(panel.title ? { title: panel.title } : {}),
            ...(typeof panel.priority === 'number' ? { priority: panel.priority } : {}),
            frontendEntry: entry.manifest.frontend?.entry,
          },
        ];
      }),
    )
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function listExtensionComposerButtonRegistrations(stateRoot: string = getStateRoot()): ExtensionComposerButtonRegistration[] {
  return listEnabledExtensionEntries(stateRoot)
    .flatMap((entry) => {
      const controls = (entry.manifest.contributes?.composerControls ?? []).flatMap((control): ExtensionComposerButtonRegistration[] => {
        const id = control.id.trim();
        const component = control.component.trim();
        if (!id || !component) return [];
        return [
          {
            extensionId: entry.manifest.id,
            id,
            packageType: entry.manifest.packageType ?? 'user',
            component,
            slot: control.slot ?? 'preferences',
            ...(control.title ? { title: control.title } : {}),
            ...(control.when ? { when: control.when } : {}),
            ...(typeof control.priority === 'number' ? { priority: control.priority } : {}),
            frontendEntry: entry.manifest.frontend?.entry,
          },
        ];
      });
      const buttons = (entry.manifest.contributes?.composerButtons ?? []).flatMap((button): ExtensionComposerButtonRegistration[] => {
        const id = button.id.trim();
        const component = button.component.trim();
        if (!id || !component) return [];
        return [
          {
            extensionId: entry.manifest.id,
            id,
            packageType: entry.manifest.packageType ?? 'user',
            component,
            slot: button.placement === 'actions' ? 'actions' : 'preferences',
            ...(button.title ? { title: button.title } : {}),
            ...(button.when ? { when: button.when } : {}),
            ...(typeof button.priority === 'number' ? { priority: button.priority } : {}),
            frontendEntry: entry.manifest.frontend?.entry,
          },
        ];
      });
      return [...controls, ...buttons];
    })
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.extensionId.localeCompare(b.extensionId) || a.id.localeCompare(b.id));
}

export function listExtensionComposerInputToolRegistrations(stateRoot: string = getStateRoot()): ExtensionComposerInputToolRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.composerInputTools ?? []).flatMap((tool): ExtensionComposerInputToolRegistration[] => {
      const id = tool.id.trim();
      const component = tool.component.trim();
      if (!id || !component) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          component,
          ...(tool.title ? { title: tool.title } : {}),
          ...(tool.when ? { when: tool.when } : {}),
          ...(typeof tool.priority === 'number' ? { priority: tool.priority } : {}),
          frontendEntry: entry.manifest.frontend?.entry,
        },
      ];
    }),
  );
}

export function listExtensionToolbarActionRegistrations(stateRoot: string = getStateRoot()): ExtensionToolbarActionRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.toolbarActions ?? []).flatMap((action): ExtensionToolbarActionRegistration[] => {
      const id = action.id.trim();
      const title = action.title.trim();
      const icon = action.icon.trim();
      const resolvedAction = action.action.trim();
      if (!id || !title || !icon || !resolvedAction) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          title,
          icon,
          action: resolvedAction,
          ...(action.when ? { when: action.when } : {}),
          ...(typeof action.priority === 'number' ? { priority: action.priority } : {}),
        },
      ];
    }),
  );
}

export function listExtensionStatusBarItemRegistrations(stateRoot: string = getStateRoot()): ExtensionStatusBarItemRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.statusBarItems ?? []).flatMap((item): ExtensionStatusBarItemRegistration[] => {
      const id = item.id.trim();
      const label = item.label.trim();
      if (!id || !label) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          label,
          ...(item.action ? { action: item.action } : {}),
          ...(item.component ? { component: item.component } : {}),
          alignment: item.alignment ?? 'right',
          ...(typeof item.priority === 'number' ? { priority: item.priority } : {}),
          frontendEntry: entry.manifest.frontend?.entry,
        },
      ];
    }),
  );
}

export function listExtensionContextMenuRegistrations(stateRoot: string = getStateRoot()): ExtensionContextMenuRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.contextMenus ?? []).flatMap((menu): ExtensionContextMenuRegistration[] => {
      const id = menu.id.trim();
      const title = menu.title.trim();
      const action = menu.action.trim();
      if (!id || !title || !action) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          title,
          action,
          surface: menu.surface,
          ...(menu.separator ? { separator: true } : {}),
          ...(menu.when ? { when: menu.when } : {}),
        },
      ];
    }),
  );
}

export function listExtensionConversationHeaderRegistrations(
  stateRoot: string = getStateRoot(),
): ExtensionConversationHeaderRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.conversationHeaderElements ?? []).flatMap((element): ExtensionConversationHeaderRegistration[] => {
      const id = element.id.trim();
      const component = element.component.trim();
      if (!id || !component) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          component,
          ...(element.label ? { label: element.label } : {}),
        },
      ];
    }),
  );
}

export function listExtensionConversationDecoratorRegistrations(
  stateRoot: string = getStateRoot(),
): ExtensionConversationDecoratorRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.conversationDecorators ?? []).flatMap((decorator): ExtensionConversationDecoratorRegistration[] => {
      const id = decorator.id.trim();
      const component = decorator.component.trim();
      if (!id || !component) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          component,
          position: decorator.position,
          ...(typeof decorator.priority === 'number' ? { priority: decorator.priority } : {}),
        },
      ];
    }),
  );
}

export function listExtensionMessageActionRegistrations(stateRoot: string = getStateRoot()): ExtensionMessageActionRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry) =>
    (entry.manifest.contributes?.messageActions ?? []).flatMap((action): ExtensionMessageActionRegistration[] => {
      const id = action.id.trim();
      const title = action.title.trim();
      const resolvedAction = action.action.trim();
      if (!id || !title || !resolvedAction) return [];
      return [
        {
          extensionId: entry.manifest.id,
          id,
          packageType: entry.manifest.packageType ?? 'user',
          title,
          action: resolvedAction,
          ...(action.when ? { when: action.when } : {}),
          ...(typeof action.priority === 'number' ? { priority: action.priority } : {}),
        },
      ];
    }),
  );
}

export function listExtensionSkillRegistrations(stateRoot: string = getStateRoot()): ExtensionSkillRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap(buildExtensionSkillRegistrations);
}

export function listExtensionToolRegistrations(stateRoot: string = getStateRoot()): ExtensionToolRegistration[] {
  const registrations = listEnabledExtensionEntries(stateRoot).flatMap(buildExtensionToolRegistrations);
  return registrations;
}

export function listExtensionModelProfileRegistrations(stateRoot: string = getStateRoot()): ExtensionModelProfileRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap(buildExtensionModelProfileRegistrations);
}

export function resolveExtensionModelProfile(
  input: { provider: string; model: string },
  stateRoot: string = getStateRoot(),
): ExtensionModelProfileResolution<ExtensionModelProfileRegistration> {
  return resolveExtensionModelProfileFromRegistrations({
    provider: input.provider,
    model: input.model,
    profiles: listExtensionModelProfileRegistrations(stateRoot),
  });
}

export function listExtensionAgentRegistrations(stateRoot: string = getStateRoot()): ExtensionAgentRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry): ExtensionAgentRegistration[] => {
    const exportName = entry.manifest.backend?.agentExtension;
    if (!exportName) return [];
    return [
      {
        extensionId: entry.manifest.id,
        packageType: entry.manifest.packageType ?? 'user',
        exportName,
      },
    ];
  });
}

export function listExtensionSettingsRegistrations(stateRoot: string = getStateRoot()): ExtensionSettingsRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap(buildExtensionSettingsRegistrations);
}

export function listExtensionSecretRegistrations(stateRoot: string = getStateRoot()): ExtensionSecretRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap(buildExtensionSecretRegistrations);
}

export function listExtensionSecretBackendRegistrations(_stateRoot: string = getStateRoot()): [] {
  return [];
}

export function listExtensionSettingsComponentRegistrations(stateRoot: string = getStateRoot()): ExtensionSettingsComponentRegistration[] {
  return listEnabledExtensionEntries(stateRoot).flatMap((entry): ExtensionSettingsComponentRegistration[] => {
    const panel = entry.manifest.contributes?.settingsComponent;
    if (!panel) return [];
    const id = panel.id.trim();
    const component = panel.component.trim();
    const sectionId = panel.sectionId.trim();
    const label = panel.label.trim();
    if (!id || !component || !sectionId || !label) return [];
    return [
      {
        extensionId: entry.manifest.id,
        id,
        packageType: entry.manifest.packageType ?? 'user',
        component,
        sectionId,
        label,
        ...(panel.description ? { description: panel.description } : {}),
        ...(typeof panel.order === 'number' ? { order: panel.order } : {}),
        frontendEntry: entry.manifest.frontend?.entry,
      },
    ];
  });
}

export function findExtensionEntry(extensionId: string): ExtensionRegistryEntry | null {
  return listExtensionEntries().find((entry) => entry.manifest.id === extensionId) ?? null;
}
