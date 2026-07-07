import { existsSync } from 'node:fs';
import { join, resolve as resolvePath, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { getStateRoot } from '@neon-pilot/core';

import { extractMentionIds } from '../knowledge/promptReferences.js';
import type { ExtensionBackendServerContext } from './extensionBackend.js';
import { setDefaultExtensionBackendWorkerUrl } from './extensionBackendWorkerClient.js';
import { recordExtensionHostAuditEvent } from './extensionHostAudit.js';
import type {
  ExtensionHostActionInvokeResult,
  ExtensionHostActionTelemetryEntry,
  ExtensionHostAuditEvent,
  ExtensionHostBackendOperationResult,
  ExtensionHostBackendServerContext,
  ExtensionHostBeginStartupGuardRequest,
  ExtensionHostCompleteStartupGuardRequest,
  ExtensionHostEventSubscription,
  ExtensionHostInstallSubscriptionsRequest,
  ExtensionHostInvokeActionRequest,
  ExtensionHostInvokeProtocolEntrypointRequest,
  ExtensionHostInvokeRouteRequest,
  ExtensionHostModelProfileResolution,
  ExtensionHostPromptAssemblyContributions,
  ExtensionHostPromptReferenceResolution,
  ExtensionHostRegistryMaintenanceRequest,
  ExtensionHostRegistryPresentation,
  ExtensionHostReloadBackendRequest,
  ExtensionHostReloadBackendResult,
  ExtensionHostRequest,
  ExtensionHostResolveFilePathRequest,
  ExtensionHostResolveModelProfileRequest,
  ExtensionHostResolvePromptReferencesRequest,
  ExtensionHostResponse,
  ExtensionHostRouteResponse,
  ExtensionHostRunningService,
  ExtensionHostRunSelfTestRequest,
  ExtensionHostSelfTestResult,
  ExtensionHostServiceOperationResult,
  ExtensionHostSetEnabledRequest,
  ExtensionHostSetEnabledResult,
  ExtensionHostSetKeybindingRequest,
  ExtensionHostStartServicesRequest,
  ExtensionHostStartStartupActionsRequest,
  ExtensionHostStartupGuardResult,
  ExtensionHostStateOperationRequest,
  ExtensionHostStateOperationResult,
  ExtensionHostStaticContributions,
} from './extensionHostProtocol.js';
import { extensionHostRequestName } from './extensionHostProtocol.js';

function asExtensionBackendServerContext(
  context: ExtensionHostBackendServerContext | undefined,
): ExtensionBackendServerContext | undefined {
  return context as ExtensionBackendServerContext | undefined;
}

async function resolveRequestServerContext(request: {
  serverContext?: ExtensionHostBackendServerContext;
  serverContextSnapshot?: ExtensionHostInvokeActionRequest['serverContextSnapshot'];
}): Promise<ExtensionBackendServerContext | undefined> {
  const { resolveExtensionBackendServerContext } = await import('./extensionHostServerContext.js');
  return asExtensionBackendServerContext(resolveExtensionBackendServerContext(request));
}

function normalizeDependencyId(dependency: string | { id: string; optional?: boolean }): { id: string; optional: boolean } {
  return typeof dependency === 'string'
    ? { id: dependency, optional: false }
    : { id: dependency.id, optional: Boolean(dependency.optional) };
}

function normalizePromptReferenceResolution(value: unknown): ExtensionHostPromptReferenceResolution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { contextBlocks: [], references: [] };
  const record = value as Record<string, unknown>;
  const contextBlocks = Array.isArray(record.contextBlocks)
    ? record.contextBlocks.flatMap((block): string[] => {
        if (typeof block === 'string' && block.trim()) return [block];
        if (block && typeof block === 'object' && !Array.isArray(block) && typeof (block as { content?: unknown }).content === 'string') {
          const content = (block as { content: string }).content;
          return content.trim() ? [content] : [];
        }
        return [];
      })
    : [];
  const references = Array.isArray(record.references)
    ? record.references.flatMap((reference): ExtensionHostPromptReferenceResolution['references'] => {
        if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return [];
        const candidate = reference as Record<string, unknown>;
        if (typeof candidate.kind !== 'string' || typeof candidate.id !== 'string') return [];
        return [
          {
            kind: candidate.kind,
            id: candidate.id,
            ...(typeof candidate.path === 'string' ? { path: candidate.path } : {}),
          },
        ];
      })
    : [];
  return { contextBlocks, references };
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type ExtensionHostWireInput<T> = Omit<T, 'type' | 'serverContext'>;

export type ExtensionHostInvokeActionInput = ExtensionHostWireInput<ExtensionHostInvokeActionRequest>;
export type ExtensionHostInstallSubscriptionsInput = ExtensionHostWireInput<ExtensionHostInstallSubscriptionsRequest>;
export type ExtensionHostInvokeProtocolEntrypointInput = ExtensionHostWireInput<ExtensionHostInvokeProtocolEntrypointRequest>;
export type ExtensionHostInvokeRouteInput = ExtensionHostWireInput<ExtensionHostInvokeRouteRequest>;
export type ExtensionHostRegistryMaintenanceInput = DistributiveOmit<ExtensionHostRegistryMaintenanceRequest, 'type'>;
export type ExtensionHostReloadBackendInput = Omit<ExtensionHostReloadBackendRequest, 'type'>;
export type ExtensionHostResolveFilePathInput = Omit<ExtensionHostResolveFilePathRequest, 'type'>;
export type ExtensionHostResolveModelProfileInput = Omit<ExtensionHostResolveModelProfileRequest, 'type'>;
export type ExtensionHostResolvePromptReferencesInput = Omit<ExtensionHostResolvePromptReferencesRequest, 'type'>;
export type ExtensionHostRunSelfTestInput = Omit<ExtensionHostRunSelfTestRequest, 'type'>;
export type ExtensionHostSetEnabledInput = ExtensionHostWireInput<ExtensionHostSetEnabledRequest>;
export type ExtensionHostSetKeybindingInput = Omit<ExtensionHostSetKeybindingRequest, 'type'>;
export type ExtensionHostStartServicesInput = ExtensionHostWireInput<ExtensionHostStartServicesRequest>;
export type ExtensionHostStartStartupActionsInput = ExtensionHostWireInput<ExtensionHostStartStartupActionsRequest>;
export type ExtensionHostBeginStartupGuardInput = Omit<ExtensionHostBeginStartupGuardRequest, 'type'>;
export type ExtensionHostCompleteStartupGuardInput = Omit<ExtensionHostCompleteStartupGuardRequest, 'type'>;
export type ExtensionHostStateOperationInput = DistributiveOmit<ExtensionHostStateOperationRequest, 'type'>;

export interface ExtensionHostClient {
  health(): Promise<{ status: 'ready' }>;
  abortConversationResources(conversationId: string): Promise<{ ok: true; killed: number }>;
  checkBackendHealth(): Promise<ExtensionHostBackendOperationResult[]>;
  invokeAction(input: ExtensionHostInvokeActionInput): Promise<ExtensionHostActionInvokeResult>;
  installSubscriptions(input: ExtensionHostInstallSubscriptionsInput): Promise<void>;
  uninstallSubscriptions(extensionId: string): Promise<void>;
  listServices(): Promise<ExtensionHostRunningService[]>;
  startServices(input?: ExtensionHostStartServicesInput): Promise<ExtensionHostServiceOperationResult[]>;
  stopServices(extensionId: string): Promise<void>;
  listPromptAssemblyContributions(): Promise<ExtensionHostPromptAssemblyContributions>;
  listStaticContributions(): Promise<ExtensionHostStaticContributions>;
  listEventSubscriptions(): Promise<ExtensionHostEventSubscription[]>;
  stateOperation(input: ExtensionHostStateOperationInput): Promise<ExtensionHostStateOperationResult>;
  registryMaintenance(input: ExtensionHostRegistryMaintenanceInput): Promise<void>;
  readRegistryPresentation(): Promise<ExtensionHostRegistryPresentation>;
  resolveFilePath(input: ExtensionHostResolveFilePathInput): Promise<string>;
  resolveModelProfile(input: ExtensionHostResolveModelProfileInput): Promise<ExtensionHostModelProfileResolution>;
  resolvePromptReferences(input: ExtensionHostResolvePromptReferencesInput): Promise<ExtensionHostPromptReferenceResolution>;
  invokeProtocolEntrypoint(input: ExtensionHostInvokeProtocolEntrypointInput): Promise<void>;
  invokeRoute(input: ExtensionHostInvokeRouteInput): Promise<ExtensionHostRouteResponse>;
  listActionTelemetry(extensionId?: string): Promise<ExtensionHostActionTelemetryEntry[]>;
  listAuditEvents(): Promise<ExtensionHostAuditEvent[]>;
  reloadBackend(input: ExtensionHostReloadBackendInput): Promise<ExtensionHostReloadBackendResult>;
  runSelfTest(input: ExtensionHostRunSelfTestInput): Promise<ExtensionHostSelfTestResult>;
  setEnabled(input: ExtensionHostSetEnabledInput): Promise<ExtensionHostSetEnabledResult>;
  setKeybinding(input: ExtensionHostSetKeybindingInput): Promise<void>;
  beginStartupGuard(input?: ExtensionHostBeginStartupGuardInput): Promise<ExtensionHostStartupGuardResult>;
  completeStartupGuard(input?: ExtensionHostCompleteStartupGuardInput): Promise<void>;
  startStartupActions(input?: ExtensionHostStartStartupActionsInput): Promise<ExtensionHostBackendOperationResult[]>;
  publishEvent(source: string, payload: unknown): Promise<void>;
}

const EXTENSION_HOST_CLIENT_GLOBAL = Symbol.for('neon-pilot.extensionHostClient');

type ExtensionHostClientGlobal = typeof globalThis & {
  [EXTENSION_HOST_CLIENT_GLOBAL]?: ExtensionHostClient;
};

export function setExtensionHostClient(client: ExtensionHostClient | undefined): void {
  if (client) {
    (globalThis as ExtensionHostClientGlobal)[EXTENSION_HOST_CLIENT_GLOBAL] = client;
  } else {
    delete (globalThis as ExtensionHostClientGlobal)[EXTENSION_HOST_CLIENT_GLOBAL];
  }
}

export function getExtensionHostClient(): ExtensionHostClient {
  const configuredExtensionHostClient = (globalThis as ExtensionHostClientGlobal)[EXTENSION_HOST_CLIENT_GLOBAL];
  if (!configuredExtensionHostClient) {
    throw new Error('Extension host client is not configured. Product runtime must connect to the extension host RPC process.');
  }
  return configuredExtensionHostClient;
}

export function createCliFallbackExtensionHostClient(): ExtensionHostClient {
  const builtWorkerPath = join(process.cwd(), 'packages/desktop/server/dist/extensions/extensionBackendWorker.js');
  if (existsSync(builtWorkerPath)) {
    setDefaultExtensionBackendWorkerUrl(pathToFileURL(builtWorkerPath));
  }
  return createInProcessExtensionHostClient();
}

export function createInProcessExtensionHostClient(): ExtensionHostClient {
  return {
    async health() {
      const response = await handleInProcessExtensionHostRequest({ type: 'health' });
      if (!response.ok) throw new Error(response.error);
      if (!('status' in response)) throw new Error('Extension host returned an invalid health response.');
      return { status: response.status };
    },
    async abortConversationResources(conversationId) {
      const response = await handleInProcessExtensionHostRequest({ type: 'abortConversationResources', conversationId });
      if (!response.ok) throw new Error(response.error);
      if (!('abortedResources' in response)) throw new Error('Extension host returned an invalid abort resources response.');
      return response.abortedResources;
    },
    async checkBackendHealth() {
      const response = await handleInProcessExtensionHostRequest({ type: 'checkBackendHealth' });
      if (!response.ok) throw new Error(response.error);
      if (!('results' in response)) throw new Error('Extension host returned an invalid backend health response.');
      return response.results;
    },
    async invokeAction(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'invokeAction', ...input });
      if (!response.ok) return { ok: false, error: response.error };
      if (!('result' in response)) return { ok: false, error: 'Extension host returned an invalid action response.' };
      return response.result;
    },
    async publishEvent(source, payload) {
      const response = await handleInProcessExtensionHostRequest({ type: 'publishEvent', source, payload });
      if (!response.ok) throw new Error(response.error);
      if (!('published' in response)) throw new Error('Extension host returned an invalid publish response.');
    },
    async installSubscriptions(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'installSubscriptions', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('subscriptionsUpdated' in response)) throw new Error('Extension host returned an invalid subscription response.');
    },
    async uninstallSubscriptions(extensionId) {
      const response = await handleInProcessExtensionHostRequest({ type: 'uninstallSubscriptions', extensionId });
      if (!response.ok) throw new Error(response.error);
      if (!('subscriptionsUpdated' in response)) throw new Error('Extension host returned an invalid subscription response.');
    },
    async listServices() {
      const response = await handleInProcessExtensionHostRequest({ type: 'listServices' });
      if (!response.ok) throw new Error(response.error);
      if (!('services' in response)) throw new Error('Extension host returned an invalid service list response.');
      return response.services;
    },
    async startServices(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'startServices', ...(input ?? {}) });
      if (!response.ok) throw new Error(response.error);
      if (!('serviceResults' in response)) throw new Error('Extension host returned an invalid service start response.');
      return response.serviceResults;
    },
    async stopServices(extensionId) {
      const response = await handleInProcessExtensionHostRequest({ type: 'stopServices', extensionId });
      if (!response.ok) throw new Error(response.error);
      if (!('servicesStopped' in response)) throw new Error('Extension host returned an invalid service stop response.');
    },
    async listPromptAssemblyContributions() {
      const response = await handleInProcessExtensionHostRequest({ type: 'listPromptAssemblyContributions' });
      if (!response.ok) throw new Error(response.error);
      if (!('promptAssemblyContributions' in response)) throw new Error('Extension host returned invalid prompt assembly contributions.');
      return response.promptAssemblyContributions;
    },
    async listStaticContributions() {
      const response = await handleInProcessExtensionHostRequest({ type: 'listStaticContributions' });
      if (!response.ok) throw new Error(response.error);
      if (!('staticContributions' in response)) throw new Error('Extension host returned invalid static contributions.');
      return response.staticContributions;
    },
    async listEventSubscriptions() {
      const response = await handleInProcessExtensionHostRequest({ type: 'listEventSubscriptions' });
      if (!response.ok) throw new Error(response.error);
      if (!('eventSubscriptions' in response)) throw new Error('Extension host returned invalid event subscriptions.');
      return response.eventSubscriptions;
    },
    async stateOperation(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'stateOperation', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('state' in response)) throw new Error('Extension host returned invalid state operation response.');
      return response.state;
    },
    async registryMaintenance(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'registryMaintenance', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('registryMaintained' in response)) throw new Error('Extension host returned invalid registry maintenance response.');
    },
    async readRegistryPresentation() {
      const response = await handleInProcessExtensionHostRequest({ type: 'readRegistryPresentation' });
      if (!response.ok) throw new Error(response.error);
      if (!('registryPresentation' in response)) throw new Error('Extension host returned invalid registry presentation.');
      return response.registryPresentation;
    },
    async resolveModelProfile(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'resolveModelProfile', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('modelProfile' in response)) throw new Error('Extension host returned invalid model profile resolution.');
      return response.modelProfile;
    },
    async resolveFilePath(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'resolveFilePath', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('filePath' in response)) throw new Error('Extension host returned invalid file path resolution.');
      return response.filePath;
    },
    async resolvePromptReferences(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'resolvePromptReferences', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('promptReferences' in response)) throw new Error('Extension host returned invalid prompt reference resolution.');
      return response.promptReferences;
    },
    async invokeProtocolEntrypoint(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'invokeProtocolEntrypoint', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('invoked' in response)) throw new Error('Extension host returned an invalid protocol entrypoint response.');
    },
    async invokeRoute(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'invokeRoute', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('route' in response)) throw new Error('Extension host returned an invalid route response.');
      return response.route;
    },
    async listActionTelemetry(extensionId) {
      const response = await handleInProcessExtensionHostRequest({
        type: 'listActionTelemetry',
        ...(extensionId ? { extensionId } : {}),
      });
      if (!response.ok) throw new Error(response.error);
      if (!('telemetry' in response)) throw new Error('Extension host returned an invalid telemetry response.');
      return response.telemetry;
    },
    async listAuditEvents() {
      const response = await handleInProcessExtensionHostRequest({ type: 'listAuditEvents' });
      if (!response.ok) throw new Error(response.error);
      if (!('auditEvents' in response)) throw new Error('Extension host returned an invalid audit event response.');
      return response.auditEvents;
    },
    async reloadBackend(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'reloadBackend', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('reload' in response)) throw new Error('Extension host returned an invalid reload response.');
      return response.reload;
    },
    async runSelfTest(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'runSelfTest', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('selfTest' in response)) throw new Error('Extension host returned an invalid self-test response.');
      return response.selfTest;
    },
    async setEnabled(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'setEnabled', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('enabledResult' in response)) throw new Error('Extension host returned an invalid extension enablement response.');
      return response.enabledResult;
    },
    async setKeybinding(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'setKeybinding', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('keybindingUpdated' in response)) throw new Error('Extension host returned an invalid keybinding update response.');
    },
    async beginStartupGuard(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'beginStartupGuard', ...(input ?? {}) });
      if (!response.ok) throw new Error(response.error);
      if (!('startupGuard' in response)) throw new Error('Extension host returned an invalid startup guard response.');
      return response.startupGuard;
    },
    async completeStartupGuard(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'completeStartupGuard', ...(input ?? {}) });
      if (!response.ok) throw new Error(response.error);
      if (!('startupGuardCompleted' in response)) throw new Error('Extension host returned an invalid startup guard completion response.');
    },
    async startStartupActions(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'startStartupActions', ...(input ?? {}) });
      if (!response.ok) throw new Error(response.error);
      if (!('results' in response)) throw new Error('Extension host returned an invalid startup actions response.');
      return response.results;
    },
  };
}

export async function handleInProcessExtensionHostRequest(request: ExtensionHostRequest): Promise<ExtensionHostResponse> {
  const startedAt = performance.now();
  const response = await handleInProcessExtensionHostRequestUnchecked(request);
  recordExtensionHostAuditEvent({
    requestType: request.type,
    requestName: extensionHostRequestName(request),
    ok: response.ok,
    durationMs: performance.now() - startedAt,
    ...(!response.ok ? { error: response.error } : {}),
  });
  return response;
}

async function handleInProcessExtensionHostRequestUnchecked(request: ExtensionHostRequest): Promise<ExtensionHostResponse> {
  try {
    if (request.type === 'health') {
      return { ok: true, status: 'ready' };
    }
    if (request.type === 'abortConversationResources') {
      const { abortExtensionShellSpawnHandlesForConversation } = await import('./extensionBackendCapabilities.js');
      return { ok: true, abortedResources: await abortExtensionShellSpawnHandlesForConversation(request.conversationId) };
    }
    const { invokeExtensionAction } = await import('./extensionBackend.js');
    if (request.type === 'invokeAction') {
      const { createExtensionBackendToolContextFromSnapshot } = await import('./extensionHostToolContext.js');
      const actionArgs: Parameters<typeof invokeExtensionAction> = [
        request.extensionId,
        request.actionId,
        request.input,
        await resolveRequestServerContext(request),
        request.toolContext
          ? { ...createExtensionBackendToolContextFromSnapshot(request.toolContextSnapshot), ...request.toolContext }
          : createExtensionBackendToolContextFromSnapshot(request.toolContextSnapshot),
        request.agentToolContext,
      ];
      if (request.signal) actionArgs.push(request.signal);
      return {
        ok: true,
        result: await invokeExtensionAction(...actionArgs),
      };
    }
    if (request.type === 'invokeProtocolEntrypoint') {
      const { invokeExtensionProtocolEntrypoint } = await import('./extensionBackend.js');
      await invokeExtensionProtocolEntrypoint(request.protocolId, request.input, {
        serverContext: await resolveRequestServerContext(request),
        stdio: request.stdio,
        signal: request.signal,
      });
      return { ok: true, invoked: true };
    }
    if (request.type === 'checkBackendHealth') {
      const { checkEnabledExtensionBackendHealth } = await import('./extensionBackend.js');
      return { ok: true, results: await checkEnabledExtensionBackendHealth() };
    }
    if (request.type === 'invokeRoute') {
      const { invokeExtensionRoute } = await import('./extensionBackend.js');
      return {
        ok: true,
        route: await invokeExtensionRoute(
          request.extensionId,
          request.method,
          request.routePath,
          request.request,
          await resolveRequestServerContext(request),
        ),
      };
    }
    if (request.type === 'listActionTelemetry') {
      const { listExtensionActionTelemetry } = await import('./extensionBackend.js');
      return { ok: true, telemetry: listExtensionActionTelemetry(request.extensionId) };
    }
    if (request.type === 'listAuditEvents') {
      const { listExtensionHostAuditEvents } = await import('./extensionHostAudit.js');
      return { ok: true, auditEvents: listExtensionHostAuditEvents() };
    }
    if (request.type === 'reloadBackend') {
      const { reloadExtensionBackend } = await import('./extensionBackend.js');
      return { ok: true, reload: await reloadExtensionBackend(request.extensionId) };
    }
    if (request.type === 'runSelfTest') {
      const { runExtensionSelfTest } = await import('./extensionBackend.js');
      return { ok: true, selfTest: await runExtensionSelfTest(request.extensionId) };
    }
    if (request.type === 'setEnabled') {
      const serverContext = await resolveRequestServerContext(request);
      const stateRoot = serverContext?.getStateRoot?.() ?? getStateRoot();
      const layout = serverContext?.getDesktopRootLayout?.();
      const { findExtensionEntry, listExtensionInstallSummaries, setExtensionEnabled } = await import('./extensionRegistry.js');
      const entry = findExtensionEntry(request.extensionId, stateRoot, layout);
      const summary = listExtensionInstallSummaries(stateRoot, layout).find((extension) => extension.id === request.extensionId);
      if (!entry && summary?.status === 'invalid') {
        return { ok: true, enabledResult: { ok: false, status: 400, error: summary.errors?.[0] ?? 'Extension manifest is invalid.' } };
      }
      if (!entry) {
        return { ok: true, enabledResult: { ok: false, status: 404, error: 'Extension not found.' } };
      }
      if (!request.enabled && summary?.required === true) {
        return {
          ok: true,
          enabledResult: {
            ok: false,
            status: 400,
            error: `Cannot disable ${entry.manifest.id}: this extension is required by the application.`,
          },
        };
      }
      if (request.enabled) {
        const installed = new Set(listExtensionInstallSummaries(stateRoot, layout).map((extension) => extension.id));
        const missingDependencies = (entry.manifest.dependsOn ?? [])
          .map(normalizeDependencyId)
          .filter((dependency) => !dependency.optional && !installed.has(dependency.id))
          .map((dependency) => dependency.id);
        if (missingDependencies.length > 0) {
          return {
            ok: true,
            enabledResult: {
              ok: false,
              status: 400,
              error: `Missing required extension dependencies: ${missingDependencies.join(', ')}`,
            },
          };
        }
        if (entry.manifest.backend?.entry) {
          const { runExtensionSelfTest } = await import('./extensionBackend.js');
          const selfTest = await runExtensionSelfTest(entry.manifest.id);
          if (!selfTest.ok) {
            return {
              ok: true,
              enabledResult: {
                ok: false,
                status: 400,
                error: selfTest.checks.find((check) => !check.ok)?.error ?? 'Extension backend failed validation.',
              },
            };
          }
        }
      }
      let actionResult: ExtensionHostActionInvokeResult | undefined;
      if (request.enabled) {
        setExtensionEnabled(entry.manifest.id, true, stateRoot, layout);
        const onEnableAction = entry.manifest.backend?.onEnableAction;
        actionResult = onEnableAction
          ? await invokeExtensionAction(entry.manifest.id, onEnableAction, {}, serverContext, undefined, undefined)
          : undefined;
      } else {
        const [{ stopExtensionServices }, { uninstallExtensionSubscriptions }, { unregisterBashProcessWrapper }] = await Promise.all([
          import('./extensionServices.js'),
          import('./extensionSubscriptions.js'),
          import('../conversations/processWrappers.js'),
        ]);
        await stopExtensionServices(entry.manifest.id);
        unregisterBashProcessWrapper(entry.manifest.id);
        await uninstallExtensionSubscriptions(entry.manifest.id);
        const onDisableAction = entry.manifest.backend?.onDisableAction;
        actionResult = onDisableAction
          ? await invokeExtensionAction(entry.manifest.id, onDisableAction, {}, serverContext, undefined, undefined)
          : undefined;
        setExtensionEnabled(entry.manifest.id, false, stateRoot, layout);
      }
      if (request.enabled) {
        const [{ installSubscriptionsForExtension }, { startServicesForExtension }] = await Promise.all([
          import('./extensionSubscriptions.js'),
          import('./extensionServices.js'),
        ]);
        await installSubscriptionsForExtension(entry.manifest.id, serverContext);
        await startServicesForExtension(entry.manifest.id, serverContext);
      }
      return {
        ok: true,
        enabledResult: {
          ok: true,
          extension: listExtensionInstallSummaries(stateRoot, layout).find(
            (extension) => extension.id === entry.manifest.id,
          ) as unknown as Record<string, unknown>,
          ...(actionResult ? { actionResult } : {}),
        },
      };
    }
    if (request.type === 'setKeybinding') {
      const { setExtensionKeybinding } = await import('./extensionRegistry.js');
      setExtensionKeybinding({
        extensionId: request.extensionId,
        keybindingId: request.keybindingId,
        ...(request.title !== undefined ? { title: request.title } : {}),
        ...(request.command !== undefined ? { command: request.command } : {}),
        ...(request.args !== undefined ? { args: request.args } : {}),
        ...(request.when !== undefined ? { when: request.when } : {}),
        ...(request.scope !== undefined ? { scope: request.scope } : {}),
        ...(request.packageType !== undefined ? { packageType: request.packageType } : {}),
        ...(request.keys !== undefined ? { keys: request.keys } : {}),
        ...(request.enabled !== undefined ? { enabled: request.enabled } : {}),
        ...(request.reset !== undefined ? { reset: request.reset } : {}),
      });
      return { ok: true, keybindingUpdated: true };
    }
    if (request.type === 'startStartupActions') {
      const { startExtensionStartupActions } = await import('./extensionBackend.js');
      return {
        ok: true,
        results: await startExtensionStartupActions(await resolveRequestServerContext(request)),
      };
    }
    const { publishExtensionHostEvent } = await import('./extensionSubscriptions.js');
    if (request.type === 'publishEvent') {
      await publishExtensionHostEvent(request.source, request.payload);
      return { ok: true, published: true };
    }
    if (request.type === 'installSubscriptions') {
      const { installSubscriptionsForExtension } = await import('./extensionSubscriptions.js');
      await installSubscriptionsForExtension(request.extensionId, await resolveRequestServerContext(request));
      return { ok: true, subscriptionsUpdated: true };
    }
    if (request.type === 'listServices') {
      const { listRunningExtensionServices } = await import('./extensionServices.js');
      return {
        ok: true,
        services: listRunningExtensionServices().map(({ extensionId, serviceId, startedAt, lastError }) => ({
          extensionId,
          serviceId,
          startedAt,
          lastError,
        })),
      };
    }
    if (request.type === 'startServices') {
      const { startExtensionServices } = await import('./extensionServices.js');
      return {
        ok: true,
        serviceResults: await startExtensionServices(await resolveRequestServerContext(request)),
      };
    }
    if (request.type === 'stopServices') {
      const { stopExtensionServices } = await import('./extensionServices.js');
      await stopExtensionServices(request.extensionId);
      return { ok: true, servicesStopped: true };
    }
    if (request.type === 'listPromptAssemblyContributions') {
      const {
        listExtensionAssemblyProviderRegistrations,
        listExtensionPromptAssemblyHookRegistrations,
        listExtensionPromptContextProviderRegistrations,
      } = await import('./extensionRegistry.js');
      return {
        ok: true,
        promptAssemblyContributions: {
          contextProviders: listExtensionPromptContextProviderRegistrations(),
          assemblyProviders: listExtensionAssemblyProviderRegistrations(),
          hooks: listExtensionPromptAssemblyHookRegistrations(),
        },
      };
    }
    if (request.type === 'listStaticContributions') {
      const { listEnabledExtensionEntries, listExtensionSkillRegistrations, listExtensionToolRegistrations } =
        await import('./extensionRegistry.js');
      return {
        ok: true,
        staticContributions: {
          tools: listExtensionToolRegistrations(),
          skills: listExtensionSkillRegistrations(),
          modelDiscovery: listEnabledExtensionEntries().flatMap((entry) => {
            const action = entry.manifest.contributes?.modelDiscovery?.action;
            return typeof action === 'string' ? [{ extensionId: entry.manifest.id, action }] : [];
          }),
        },
      };
    }
    if (request.type === 'listEventSubscriptions') {
      const { listExtensionEventSubscriptions } = await import('./extensionEventBus.js');
      return { ok: true, eventSubscriptions: listExtensionEventSubscriptions() };
    }
    if (request.type === 'stateOperation') {
      const { deleteExtensionState, listExtensionState, readExtensionState, writeExtensionState } = await import('./extensionStorage.js');
      if (request.operation === 'list') {
        return {
          ok: true,
          state: { operation: 'list', documents: listExtensionState(request.extensionId, request.prefix ?? '') },
        };
      }
      if (request.operation === 'read') {
        return {
          ok: true,
          state: { operation: 'read', document: readExtensionState(request.extensionId, request.key) },
        };
      }
      if (request.operation === 'write') {
        return {
          ok: true,
          state: {
            operation: 'write',
            document: writeExtensionState(request.extensionId, request.key, request.value, { expectedVersion: request.expectedVersion }),
          },
        };
      }
      return {
        ok: true,
        state: { operation: 'delete', deleted: deleteExtensionState(request.extensionId, request.key).deleted },
      };
    }
    if (request.type === 'registryMaintenance') {
      const { clearBuildError, invalidateExtensionRegistryReadCaches, setBuildError } = await import('./extensionRegistry.js');
      if (request.operation === 'invalidateReadCaches') {
        invalidateExtensionRegistryReadCaches();
      } else if (request.operation === 'clearBuildError') {
        clearBuildError(request.extensionId);
      } else {
        setBuildError(request.extensionId, request.error);
      }
      return { ok: true, registryMaintained: true };
    }
    if (request.type === 'readRegistryPresentation') {
      const {
        listExtensionInstallSummaries,
        listExtensionCliCommandRegistrations,
        listExtensionCommandRegistrations,
        listExtensionKeybindingRegistrations,
        listExtensionMentionRegistrations,
        listExtensionQuickOpenRegistrations,
        listExtensionSearchProviderRegistrations,
        listExtensionSlashCommandRegistrations,
        readExtensionSchema,
        readExtensionRegistrySnapshot,
      } = await import('./extensionRegistry.js');
      return {
        ok: true,
        registryPresentation: {
          schema: readExtensionSchema() as unknown as Record<string, unknown>,
          installSummaries: listExtensionInstallSummaries() as unknown as Array<Record<string, unknown>>,
          commandRegistrations: listExtensionCommandRegistrations() as unknown as Array<Record<string, unknown>>,
          cliCommandRegistrations: listExtensionCliCommandRegistrations() as unknown as Array<Record<string, unknown>>,
          keybindingRegistrations: listExtensionKeybindingRegistrations() as unknown as Array<Record<string, unknown>>,
          slashCommandRegistrations: listExtensionSlashCommandRegistrations() as unknown as Array<Record<string, unknown>>,
          mentionRegistrations: listExtensionMentionRegistrations() as unknown as Array<Record<string, unknown>>,
          quickOpenRegistrations: listExtensionQuickOpenRegistrations() as unknown as Array<Record<string, unknown>>,
          searchProviderRegistrations: listExtensionSearchProviderRegistrations() as unknown as Array<Record<string, unknown>>,
          snapshot: readExtensionRegistrySnapshot() as unknown as ExtensionHostRegistryPresentation['snapshot'],
        },
      };
    }
    if (request.type === 'resolveModelProfile') {
      const { resolveExtensionModelProfile } = await import('./extensionRegistry.js');
      return {
        ok: true,
        modelProfile: resolveExtensionModelProfile({
          provider: request.provider,
          model: request.model,
        }) as ExtensionHostModelProfileResolution,
      };
    }
    if (request.type === 'resolveFilePath') {
      const { findExtensionEntry } = await import('./extensionRegistry.js');
      const entry = findExtensionEntry(request.extensionId);
      if (!entry?.packageRoot) {
        throw new Error('Extension files are unavailable for this extension.');
      }
      const packageRoot = resolvePath(entry.packageRoot);
      const filePath = resolvePath(packageRoot, request.relativePath);
      if (filePath !== packageRoot && !filePath.startsWith(`${packageRoot}${sep}`)) {
        throw new Error('Extension file path escapes package root.');
      }
      return { ok: true, filePath };
    }
    if (request.type === 'resolvePromptReferences') {
      const mentionIds = extractMentionIds(request.text);
      if (mentionIds.length === 0) {
        return { ok: true, promptReferences: { contextBlocks: [], references: [] } };
      }
      const { listExtensionPromptReferenceRegistrations } = await import('./extensionRegistry.js');
      const contextBlocks: string[] = [];
      const references: ExtensionHostPromptReferenceResolution['references'] = [];
      for (const resolver of listExtensionPromptReferenceRegistrations()) {
        const result = await invokeExtensionAction(resolver.extensionId, resolver.handler, { text: request.text, mentionIds });
        if (!result.ok) continue;
        const normalized = normalizePromptReferenceResolution(result.result);
        contextBlocks.push(...normalized.contextBlocks);
        references.push(...normalized.references);
      }
      return { ok: true, promptReferences: { contextBlocks, references } };
    }
    if (request.type === 'beginStartupGuard') {
      const { beginExtensionStartupGuard } = await import('./extensionRegistry.js');
      return { ok: true, startupGuard: beginExtensionStartupGuard() };
    }
    if (request.type === 'completeStartupGuard') {
      const { completeExtensionStartupGuard } = await import('./extensionRegistry.js');
      completeExtensionStartupGuard();
      return { ok: true, startupGuardCompleted: true };
    }
    if (request.type === 'uninstallSubscriptions') {
      const { uninstallExtensionSubscriptions } = await import('./extensionSubscriptions.js');
      uninstallExtensionSubscriptions(request.extensionId);
      return { ok: true, subscriptionsUpdated: true };
    }
    return { ok: false, error: 'Unsupported extension host request.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
