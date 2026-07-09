import { readFileSync, statSync } from 'node:fs';
import { dirname, extname, join as joinPath, resolve as resolvePath, sep } from 'node:path';

import type { Express, Request, Response } from 'express';
import type { NextFunction } from 'express';

import { buildCriticalExtensionRegistryResponse } from '../app/localApiExtensionRegistryPresentation.js';
import {
  createConversationAttachmentCapability,
  deleteConversationAttachmentCapability,
  readConversationAttachmentCapability,
  readConversationAttachmentDownloadCapability,
  readConversationAttachmentsCapability,
  updateConversationAttachmentCapability,
} from '../conversations/conversationAssetsCapability.js';
import { pingDaemon, startBackgroundRun } from '../daemon/index.js';
import { writeExtensionActivityEntrySafe } from '../extensions/extensionActivityProducers.js';
import { acknowledgeHostCommand, executeHostCommandInRenderer } from '../extensions/extensionCommandBridge.js';
import { findExtensionCommandRegistration } from '../extensions/extensionCommandLookup.js';
import { createExtensionConversationsCapability } from '../extensions/extensionConversations.js';
import { validateExtensionPackage } from '../extensions/extensionDoctor.js';
import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { createExtensionHostServerContextSnapshot } from '../extensions/extensionHostServerContext.js';
import type { CreateRuntimeExtensionInput } from '../extensions/extensionLifecycle.js';
import {
  buildRuntimeExtension,
  createRuntimeExtension,
  exportRuntimeExtension,
  importRuntimeExtensionBundle,
  snapshotRuntimeExtension,
} from '../extensions/extensionLifecycle.js';
import type { ExtensionManifest } from '../extensions/extensionManifest.js';
import { getAggregatedBadgeCount } from '../extensions/extensionNotifications.js';
import { createExtensionRunsCapability } from '../extensions/extensionRuns.js';
import { listPendingExtensionUiConfirms, resolveExtensionUiConfirm } from '../extensions/extensionUiConfirmBridge.js';
import { logError } from '../middleware/index.js';
import { createSettingsStore } from '../settings/settingsStore.js';
import { invalidateAppTopics } from '../shared/appEvents.js';
import { getLocalhostWebappProxyStatus, trustLocalhostWebappProxyCertificate } from '../shared/localhostWebappProxy.js';
import { isSameOriginUnsafeRequest } from '../shared/webSecurity.js';
import type { ServerRouteContext } from './context.js';

type ExtensionRouteContext = Pick<ServerRouteContext, 'getRuntimeScope'> &
  Partial<Pick<ServerRouteContext, 'getStateRoot' | 'getServerPort' | 'getDesktopRootLayout' | 'publishDesktopAppEvent'>>;

async function readRegistryPresentationFromHost(context?: ExtensionRouteContext) {
  return getExtensionHostClient().readRegistryPresentation(createExtensionHostServerContextSnapshot(context));
}

async function readExtensionInstallSummariesWithRuntimeState(context?: ExtensionRouteContext) {
  const [{ installSummaries }, runningServices] = await Promise.all([
    readRegistryPresentationFromHost(context),
    getExtensionHostClient().listServices(),
  ]);
  const running = new Map(runningServices.map((service) => [`${service.extensionId}:${service.serviceId}`, service]));
  return installSummaries.map((summary) => ({
    ...summary,
    serviceStatuses: (Array.isArray(summary.services) ? summary.services : []).map((service) => {
      const extensionId = typeof summary.id === 'string' ? summary.id : '';
      const serviceId = typeof (service as { id?: unknown }).id === 'string' ? (service as { id: string }).id : '';
      const status = running.get(`${extensionId}:${serviceId}`);
      return { id: serviceId, running: Boolean(status), startedAt: status?.startedAt ?? null };
    }),
  }));
}

async function publishExtensionRegistryChanged(context?: ExtensionRouteContext): Promise<void> {
  invalidateAppTopics('extensions');
  await context?.publishDesktopAppEvent?.({ type: 'invalidate', topics: ['extensions'] });
}

async function readExtensionManifestFromHost(extensionId: string, context?: ExtensionRouteContext): Promise<ExtensionManifest | null> {
  const { snapshot } = await readRegistryPresentationFromHost(context);
  const manifest = snapshot.extensions.find((extension) => extension.id === extensionId);
  return (manifest ?? null) as ExtensionManifest | null;
}

async function readExtensionInstallSummaryFromHost(
  extensionId: string,
  context?: ExtensionRouteContext,
): Promise<Record<string, unknown> | null> {
  const { installSummaries } = await readRegistryPresentationFromHost(context);
  return installSummaries.find((extension) => extension.id === extensionId) ?? null;
}

type ExtensionWebappSummary = {
  id: string;
  title: string;
  description?: string;
  entry?: string;
  target?: string;
  spaFallback?: boolean;
  extensionId: string;
  packageType: 'system' | 'user';
  localhostName: string;
};

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function extensionActionResultDetails(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = (value as { result?: unknown }).result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return {};
  const details = (result as { details?: unknown }).details;
  return details && typeof details === 'object' && !Array.isArray(details) ? (details as Record<string, unknown>) : {};
}

export function readSystemConversationSetTitleMutation(
  body: Record<string, unknown>,
  result: unknown,
): { conversationId: string; title: string } | null {
  const details = extensionActionResultDetails(result);
  const conversationId = optionalString(body.conversationId) ?? optionalString(details.conversationId);
  const title = optionalString(body.title) ?? optionalString(details.title);
  return conversationId && title ? { conversationId, title } : null;
}

async function syncSystemConversationToolMutation(input: {
  extensionId: string;
  actionId: string;
  body: unknown;
  result: unknown;
  context?: Pick<ServerRouteContext, 'getRuntimeScope'> & Partial<Pick<ServerRouteContext, 'getStateRoot' | 'getServerPort'>>;
}): Promise<void> {
  if (input.extensionId !== 'system-conversation-tools' || input.actionId !== 'conversationTool') return;
  if (!input.body || typeof input.body !== 'object' || Array.isArray(input.body)) return;
  const body = input.body as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const actionResult = input.result && typeof input.result === 'object' ? (input.result as { ok?: unknown }) : {};
  if (actionResult.ok !== true) return;
  if (!input.context) return;

  const conversations = createExtensionConversationsCapability(input.context as ServerRouteContext, input.extensionId);
  if (action === 'set_title') {
    const mutation = readSystemConversationSetTitleMutation(body, input.result);
    if (mutation) {
      await conversations.setTitle(mutation.conversationId, mutation.title);
    }
    return;
  }
  if (action === 'delete') {
    await conversations.delete({ conversationIds: optionalStringArray(body.conversationIds) ?? [] });
    return;
  }
  if (action === 'retention_prune' && body.dryRun !== true) {
    const olderThanMs = Number(body.olderThanMs);
    await conversations.prune({
      olderThanMs,
      archivedOnly: body.archivedOnly === true,
      dryRun: false,
    });
  }
}

function normalizeHostHeader(value: string | undefined): string {
  const host = (value ?? '').trim().toLowerCase();
  if (!host) return '';
  if (host.startsWith('[')) {
    const closing = host.indexOf(']');
    return closing >= 0 ? host.slice(1, closing) : host;
  }
  return host.split(':')[0] ?? '';
}

function normalizeRequestPath(path: string | undefined): string {
  const value = path && path.trim() ? path : '/';
  return value.startsWith('/') ? value : `/${value}`;
}

function isExtensionWebappLocalhostHost(hostname: string): boolean {
  const name = hostname.endsWith('.localhost') ? hostname.slice(0, -'.localhost'.length) : '';
  return name.length > 0;
}

function webappLocalhostUrl(webapp: Pick<ExtensionWebappSummary, 'localhostName'>): string {
  const proxy = getLocalhostWebappProxyStatus();
  const scheme = proxy?.urls.scheme ?? 'https';
  const port =
    scheme === 'https'
      ? proxy?.https.enabled && proxy.https.port !== 443
        ? proxy.https.port
        : null
      : proxy?.http.enabled && proxy.http.port !== 80
        ? proxy.http.port
        : null;
  return `${scheme}://${webapp.localhostName}.localhost${port ? `:${String(port)}` : ''}`;
}

function webappDirectUrl(webapp: Pick<ExtensionWebappSummary, 'localhostName'>, context?: { getServerPort?: () => number }): string | null {
  const port = context?.getServerPort?.();
  return typeof port === 'number' && Number.isFinite(port) && port > 0 ? `http://${webapp.localhostName}.localhost:${port}` : null;
}

function parseLoopbackWebappTarget(target: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  const hostname = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '');
  return ['localhost', '127.0.0.1', '::1'].includes(hostname) ? parsed : null;
}

function enrichWebappSummary(webapp: ExtensionWebappSummary, context?: { getServerPort?: () => number }) {
  return {
    ...webapp,
    localhostUrl: webappLocalhostUrl(webapp),
    directUrl: webappDirectUrl(webapp, context),
  };
}

function getExtensionLifecycleScope(context?: Partial<Pick<ServerRouteContext, 'getStateRoot' | 'getDesktopRootLayout'>>): {
  stateRoot: string | undefined;
  layout: ReturnType<ServerRouteContext['getDesktopRootLayout']> | undefined;
} {
  return {
    stateRoot: context?.getStateRoot?.(),
    layout: context?.getDesktopRootLayout?.(),
  };
}

async function listWebappsFromHost(context?: ExtensionRouteContext): Promise<ExtensionWebappSummary[]> {
  const { snapshot } = await readRegistryPresentationFromHost(context);
  return ((snapshot as { webapps?: unknown[] }).webapps ?? []).filter(
    (webapp): webapp is ExtensionWebappSummary =>
      Boolean(webapp) &&
      typeof webapp === 'object' &&
      typeof (webapp as { id?: unknown }).id === 'string' &&
      typeof (webapp as { extensionId?: unknown }).extensionId === 'string' &&
      typeof (webapp as { localhostName?: unknown }).localhostName === 'string',
  );
}

async function findWebappFromHost(extensionId: string, webappId: string): Promise<ExtensionWebappSummary | null> {
  const webapps = await listWebappsFromHost();
  return webapps.find((webapp) => webapp.extensionId === extensionId && webapp.id === webappId) ?? null;
}

async function findWebappByHost(hostname: string): Promise<ExtensionWebappSummary | null> {
  if (!hostname.endsWith('.localhost')) return null;
  const name = hostname.slice(0, -'.localhost'.length);
  if (!name) return null;
  const webapps = await listWebappsFromHost();
  return webapps.find((webapp) => webapp.localhostName === name) ?? null;
}

function contentTypeForExtensionWebappPath(path: string): string | null {
  switch (extname(path).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return null;
  }
}

function resolveStaticExtensionWebappRelativePath(webapp: ExtensionWebappSummary, requestPath: string): string | null {
  const normalizedPath = normalizeRequestPath(requestPath);
  if (normalizedPath === '/') return webapp.entry ?? null;
  const assetPath = normalizedPath.replace(/^\/+/, '');
  const segments = assetPath.split(/[\\/]+/);
  if (segments.some((segment) => segment === '..')) return null;
  return joinPath(dirname(webapp.entry ?? ''), assetPath);
}

function isInsidePath(root: string, candidate: string): boolean {
  const resolvedRoot = resolvePath(root);
  const resolvedCandidate = resolvePath(candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${sep}`);
}

async function serveStaticExtensionWebapp(webapp: ExtensionWebappSummary, requestPath: string, res: Response): Promise<void> {
  if (!webapp.entry) {
    res.status(404).json({ error: 'Extension webapp has no static entry.' });
    return;
  }
  const relativePath = resolveStaticExtensionWebappRelativePath(webapp, requestPath);
  if (!relativePath) {
    res.status(400).json({ error: 'Extension webapp asset path escapes entry directory.' });
    return;
  }
  const entryFilePath = await getExtensionHostClient().resolveFilePath({ extensionId: webapp.extensionId, relativePath: webapp.entry });
  const entryDirectory = dirname(entryFilePath);
  let filePath = await getExtensionHostClient().resolveFilePath({ extensionId: webapp.extensionId, relativePath });
  if (!isInsidePath(entryDirectory, filePath)) {
    res.status(400).json({ error: 'Extension webapp asset path escapes resolved entry directory.' });
    return;
  }
  let stats = statSync(filePath, { throwIfNoEntry: false });
  if (!stats?.isFile() && webapp.spaFallback !== false) {
    filePath = entryFilePath;
    stats = statSync(filePath, { throwIfNoEntry: false });
  }
  if (!stats?.isFile()) {
    res.status(404).json({ error: 'Extension webapp asset not found.' });
    return;
  }
  const contentType = contentTypeForExtensionWebappPath(filePath);
  if (contentType) res.type(contentType);
  res.sendFile(filePath);
}

async function proxyExtensionWebapp(webapp: ExtensionWebappSummary, req: Request, res: Response, requestPath: string): Promise<void> {
  if (!webapp.target) {
    res.status(404).json({ error: 'Extension webapp has no proxy target.' });
    return;
  }
  const target = parseLoopbackWebappTarget(webapp.target);
  if (!target) {
    res.status(502).json({ error: 'Extension webapp proxy target must be a loopback HTTP URL.' });
    return;
  }
  const upstream = new URL(normalizeRequestPath(requestPath), target.href.endsWith('/') ? target.href : `${target.href}/`);
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  upstream.search = query.startsWith('?') ? query.slice(1) : '';
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    const header = key.toLowerCase();
    if (
      !value ||
      [
        'host',
        'connection',
        'content-length',
        'authorization',
        'cookie',
        'proxy-authorization',
        'x-forwarded-for',
        'x-forwarded-host',
        'x-forwarded-proto',
      ].includes(header) ||
      header.startsWith('sec-')
    )
      continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const body = buildProxyRequestBody(req);
  const response = await fetch(upstream, {
    method: req.method,
    headers,
    body,
  });
  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  res.send(buffer);
}

function buildProxyRequestBody(req: Request): BodyInit | undefined {
  if (['GET', 'HEAD'].includes(req.method.toUpperCase()) || req.body === undefined || req.body === null) return undefined;
  if (typeof req.body === 'string') return req.body;
  if (req.body instanceof Uint8Array) {
    const body = new ArrayBuffer(req.body.byteLength);
    new Uint8Array(body).set(req.body);
    return new Blob([body]);
  }
  return JSON.stringify(req.body);
}

async function dispatchExtensionWebappRequest(
  webapp: ExtensionWebappSummary,
  req: Request,
  res: Response,
  requestPath: string,
): Promise<void> {
  if (webapp.target) {
    await proxyExtensionWebapp(webapp, req, res, requestPath);
    return;
  }
  await serveStaticExtensionWebapp(webapp, requestPath, res);
}

function webappBridgePath(path: string): string | null {
  const normalized = normalizeRequestPath(path);
  if (normalized === '/.neon') return '/';
  if (!normalized.startsWith('/.neon/')) return null;
  return normalizeRequestPath(normalized.slice('/.neon'.length));
}

function runtimeScopeForWebappBridge(context?: Pick<ServerRouteContext, 'getRuntimeScope'>): string {
  return context?.getRuntimeScope?.() ?? 'shared';
}

async function readWebappBridgeRequestBody(req: Request): Promise<unknown> {
  const parseBodyValue = (value: unknown): unknown => {
    if (Buffer.isBuffer(value)) return parseBodyValue(value.toString('utf8'));
    if (
      value &&
      typeof value === 'object' &&
      (value as { type?: unknown }).type === 'Buffer' &&
      Array.isArray((value as { data?: unknown }).data)
    ) {
      return parseBodyValue(Buffer.from((value as { data: number[] }).data).toString('utf8'));
    }
    if (typeof value !== 'string') return value;
    const text = value.trim();
    if (!text) return undefined;
    const contentType = req.get('content-type')?.toLowerCase() ?? '';
    if (contentType.includes('application/json')) return JSON.parse(text) as unknown;
    return value;
  };

  if (req.body !== undefined) return parseBodyValue(req.body);
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > 25 * 1024 * 1024) throw new Error('Webapp bridge request body is too large.');
    chunks.push(buffer);
  }

  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf8');
  return parseBodyValue(text);
}

async function dispatchExtensionWebappBridgeRequest(
  webapp: ExtensionWebappSummary,
  req: Request,
  res: Response,
  context?: Pick<ServerRouteContext, 'getRuntimeScope'> & Partial<Pick<ServerRouteContext, 'getStateRoot' | 'getServerPort'>>,
): Promise<boolean> {
  const path = webappBridgePath(req.path || '/');
  if (!path) return false;

  const method = req.method.toUpperCase();
  if (!isSameOriginUnsafeRequest(req)) {
    res.status(403).json({ error: 'Cross-origin request rejected.' });
    return true;
  }

  const signal = createExtensionRequestAbortSignal(req, res);
  let bodyPromise: Promise<unknown> | null = null;
  const body = () => {
    bodyPromise ??= readWebappBridgeRequestBody(req);
    return bodyPromise;
  };

  try {
    if (method === 'GET' && path === '/api/extensions/webapps/current') {
      res.json(enrichWebappSummary(webapp, context));
      return true;
    }

    if (method === 'GET' && path === '/api/extensions/webapps') {
      const webapps = await listWebappsFromHost();
      res.json(webapps.map((item) => enrichWebappSummary(item, context)));
      return true;
    }

    if (method === 'GET' && path === '/api/extensions/webapps/localhost-proxy') {
      res.json(getLocalhostWebappProxyStatus() ?? { running: false });
      return true;
    }

    const actionMatch = /^\/api\/extensions\/([^/]+)\/actions\/([^/]+)$/u.exec(path);
    if (method === 'POST' && actionMatch) {
      res.json(
        await getExtensionHostClient().invokeAction({
          extensionId: decodeURIComponent(actionMatch[1] ?? ''),
          actionId: decodeURIComponent(actionMatch[2] ?? ''),
          input: await body(),
          serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
          signal,
        }),
      );
      return true;
    }

    const profile = runtimeScopeForWebappBridge(context);
    const attachmentAssetMatch = /^\/api\/conversations\/([^/]+)\/attachments\/([^/]+)\/asset$/u.exec(path);
    if (method === 'GET' && attachmentAssetMatch) {
      res.json(
        readConversationAttachmentDownloadCapability(profile, {
          conversationId: decodeURIComponent(attachmentAssetMatch[1] ?? ''),
          attachmentId: decodeURIComponent(attachmentAssetMatch[2] ?? ''),
          asset: req.query.asset === 'preview' ? 'preview' : 'source',
          revision: typeof req.query.revision === 'string' ? Number(req.query.revision) : undefined,
        }),
      );
      return true;
    }

    const attachmentMatch = /^\/api\/conversations\/([^/]+)\/attachments\/([^/]+)$/u.exec(path);
    if (attachmentMatch) {
      const conversationId = decodeURIComponent(attachmentMatch[1] ?? '');
      const attachmentId = decodeURIComponent(attachmentMatch[2] ?? '');
      if (method === 'GET') {
        res.json(readConversationAttachmentCapability(profile, { conversationId, attachmentId }));
        return true;
      }
      if (method === 'PATCH') {
        const input = await body();
        res.json(
          updateConversationAttachmentCapability(profile, {
            conversationId,
            attachmentId,
            ...((input && typeof input === 'object' ? input : {}) as object),
          }),
        );
        return true;
      }
      if (method === 'DELETE') {
        res.json(deleteConversationAttachmentCapability(profile, { conversationId, attachmentId }));
        return true;
      }
    }

    const attachmentsMatch = /^\/api\/conversations\/([^/]+)\/attachments$/u.exec(path);
    if (attachmentsMatch) {
      const conversationId = decodeURIComponent(attachmentsMatch[1] ?? '');
      if (method === 'GET') {
        res.json(readConversationAttachmentsCapability(profile, conversationId));
        return true;
      }
      if (method === 'POST') {
        const input = await body();
        res.json(
          createConversationAttachmentCapability(profile, {
            conversationId,
            ...((input && typeof input === 'object' ? input : {}) as object),
          }),
        );
        return true;
      }
    }

    res.status(404).json({ error: 'Unknown Neon Pilot webapp bridge route.' });
    return true;
  } catch (err) {
    sendRouteError(res, 'extension webapp bridge error', err);
    return true;
  }
}

async function readExtensionActionTargetFromHost(
  extensionId: string,
  actionId: string,
  context?: ExtensionRouteContext,
): Promise<{ manifest: ExtensionManifest; action: NonNullable<NonNullable<ExtensionManifest['backend']>['actions']>[number] } | null> {
  const { installSummaries } = await readRegistryPresentationFromHost(context);
  const summary = installSummaries.find((extension) => extension.id === extensionId);
  if (!summary || summary.status !== 'enabled') return null;
  const manifest = (summary as { manifest?: unknown }).manifest as ExtensionManifest | undefined;
  const action = manifest?.backend?.actions?.find((candidate) => candidate.id === actionId);
  return manifest && action ? { manifest, action } : null;
}

async function findExtensionCommandRegistrationFromHost(commandId: string, context?: ExtensionRouteContext) {
  const { commandRegistrations } = await readRegistryPresentationFromHost(context);
  const commands = commandRegistrations
    .map((command) => ({
      ...command,
      extensionId: typeof command.extensionId === 'string' ? command.extensionId : '',
      surfaceId: typeof command.surfaceId === 'string' ? command.surfaceId : '',
      action: typeof command.action === 'string' ? command.action : '',
      args: (command as { args?: unknown }).args,
    }))
    .filter((command) => command.extensionId && command.surfaceId && command.action);
  return findExtensionCommandRegistration(commands, commandId);
}

function isHostCommandAction(action: string): boolean {
  return (
    action === 'app.navigate' ||
    action === 'palette.open' ||
    action === 'rail.open' ||
    action === 'layout.set' ||
    action === 'conversation.new' ||
    action === 'conversation.open' ||
    action === 'conversation.next' ||
    action === 'conversation.previous' ||
    action === 'composer.focus' ||
    action === 'sidebar.focus' ||
    action === 'focus.next' ||
    action === 'focus.previous' ||
    action === 'selection.activate'
  );
}

function sendRouteError(res: Response, label: string, err: unknown): void {
  logError(label, { message: err instanceof Error ? err.message : String(err) });
  res.status(500).json({ error: String(err) });
}

function normalizeRouteQuery(query: Request['query']): Record<string, string | string[]> {
  const normalized: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') normalized[key] = value;
    else if (Array.isArray(value)) normalized[key] = value.filter((item): item is string => typeof item === 'string');
  }
  return normalized;
}

export function createExtensionRequestAbortSignal(req: Request, res: Response): AbortSignal {
  const abort = new AbortController();
  req.on?.('aborted', () => abort.abort());
  res.on?.('close', () => abort.abort());
  return abort.signal;
}

async function dispatchExtensionBackendRoute(req: Request, res: Response, context?: ExtensionRouteContext): Promise<void> {
  const signal = createExtensionRequestAbortSignal(req, res);
  try {
    const extensionId = req.params.id;
    const routePath = `/${req.params[0] ?? ''}`;
    const result = await getExtensionHostClient().invokeRoute({
      extensionId,
      method: req.method,
      routePath,
      request: {
        method: req.method,
        path: routePath,
        query: normalizeRouteQuery(req.query),
        params: {},
        body: req.body,
        signal,
      },
      serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
    });
    for (const [key, value] of Object.entries(result.headers ?? {})) res.setHeader(key, value);
    const status = result.status ?? 200;
    if (result.stream === 'sse' && result.events) {
      await sendExtensionSseResponse(res, status, result.events, signal);
      return;
    }
    if (Buffer.isBuffer(result.body) || result.body instanceof Uint8Array) {
      res.status(status).send(Buffer.from(result.body));
      return;
    }
    res.status(status).json(result.body ?? null);
  } catch (err) {
    if (!res.headersSent) sendRouteError(res, 'extension backend route error', err);
  }
}

async function sendExtensionSseResponse(
  res: Response,
  status: number,
  events: AsyncIterable<{ event?: string; data?: unknown; id?: string; retry?: number }>,
  signal: AbortSignal,
): Promise<void> {
  res.status(status);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const iterator = events[Symbol.asyncIterator]();
  try {
    for (;;) {
      const next = await nextSseEventOrAbort(iterator, signal);
      if (next.done || signal.aborted) break;
      const event = next.value;
      if (event.id) res.write(`id: ${event.id}\n`);
      if (event.event) res.write(`event: ${event.event}\n`);
      if (typeof event.retry === 'number') res.write(`retry: ${event.retry}\n`);
      const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data ?? null);
      for (const line of data.split(/\r?\n/)) res.write(`data: ${line}\n`);
      res.write('\n');
    }
  } finally {
    await iterator.return?.();
    res.end();
  }
}

function nextSseEventOrAbort<T>(iterator: AsyncIterator<T>, signal: AbortSignal): Promise<IteratorResult<T>> {
  if (signal.aborted) return Promise.resolve({ done: true, value: undefined });
  return new Promise<IteratorResult<T>>((resolve, reject) => {
    const onAbort = () => resolve({ done: true, value: undefined });
    signal.addEventListener('abort', onAbort, { once: true });
    iterator.next().then(
      (next) => {
        signal.removeEventListener('abort', onAbort);
        resolve(next);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function readExtensionFile(req: Request, res: Response): Promise<void> {
  try {
    const extensionId = req.params.id;
    const relativePath = req.params[0];
    if (!extensionId || !relativePath) {
      res.status(400).json({ error: 'Extension id and file path are required.' });
      return;
    }

    const filePath = await getExtensionHostClient().resolveFilePath({ extensionId, relativePath });
    if (!statSync(filePath).isFile()) {
      res.status(404).json({ error: 'Extension file not found.' });
      return;
    }

    if (filePath.endsWith('.html')) {
      res.type('html').send(readFileSync(filePath, 'utf-8'));
      return;
    }
    if (filePath.endsWith('.css')) {
      res.type('css').send(readFileSync(filePath, 'utf-8'));
      return;
    }
    if (filePath.endsWith('.js')) {
      res.type('text/javascript; charset=utf-8').send(readFileSync(filePath, 'utf-8'));
      return;
    }

    res.sendFile(filePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found|ENOENT/i.test(message)) {
      res.status(404).json({ error: 'Extension file not found.' });
      return;
    }
    res.status(400).json({ error: message });
  }
}

export function registerExtensionRoutes(
  router: Pick<Express, 'delete' | 'get' | 'patch' | 'post' | 'put'>,
  context?: ExtensionRouteContext,
): void {
  router.get('/api/extensions/:id/routes/*', (req, res) => dispatchExtensionBackendRoute(req, res, context));
  router.post('/api/extensions/:id/routes/*', (req, res) => dispatchExtensionBackendRoute(req, res, context));
  router.put('/api/extensions/:id/routes/*', (req, res) => dispatchExtensionBackendRoute(req, res, context));
  router.patch('/api/extensions/:id/routes/*', (req, res) => dispatchExtensionBackendRoute(req, res, context));
  router.delete('/api/extensions/:id/routes/*', (req, res) => dispatchExtensionBackendRoute(req, res, context));

  router.get('/api/extensions/schema', async (_req, res) => {
    try {
      res.json((await readRegistryPresentationFromHost(context)).schema);
    } catch (err) {
      sendRouteError(res, 'extensions schema error', err);
    }
  });

  router.get('/api/extensions/telemetry', async (req, res) => {
    try {
      const extensionId = typeof req.query.extensionId === 'string' ? req.query.extensionId : undefined;
      res.json(await getExtensionHostClient().listActionTelemetry(extensionId));
    } catch (err) {
      sendRouteError(res, 'extensions telemetry error', err);
    }
  });

  router.get('/api/extensions/audit-events', async (_req, res) => {
    try {
      res.json(await getExtensionHostClient().listAuditEvents());
    } catch (err) {
      sendRouteError(res, 'extensions audit error', err);
    }
  });

  router.get('/api/extensions/installed', async (_req, res) => {
    try {
      res.json(await readExtensionInstallSummariesWithRuntimeState(context));
    } catch (err) {
      sendRouteError(res, 'extensions installed error', err);
    }
  });

  router.get('/api/extensions/registry', async (_req, res) => {
    try {
      const [extensions, registryPresentation, settings] = await Promise.all([
        readExtensionInstallSummariesWithRuntimeState(context),
        readRegistryPresentationFromHost(context),
        Promise.resolve(createSettingsStore(context?.getDesktopRootLayout?.() ?? context?.getStateRoot?.()).read()),
      ]);
      const snapshot = registryPresentation.snapshot;
      res.json({
        extensions,
        routes: snapshot.routes,
        surfaces: [...snapshot.surfaces, ...snapshot.views],
        settings,
      });
    } catch (err) {
      sendRouteError(res, 'extensions registry error', err);
    }
  });

  router.get('/api/extensions/webapps', async (_req, res) => {
    try {
      const webapps = await listWebappsFromHost(context);
      res.json(webapps.map((webapp) => enrichWebappSummary(webapp, context)));
    } catch (err) {
      sendRouteError(res, 'extensions webapps error', err);
    }
  });

  router.get('/api/extensions/webapps/localhost-proxy', async (_req, res) => {
    res.json(getLocalhostWebappProxyStatus() ?? { running: false });
  });

  router.post('/api/extensions/webapps/localhost-proxy/trust', async (_req, res) => {
    const result = trustLocalhostWebappProxyCertificate();
    if (!result) {
      res.status(503).json({ ok: false, error: 'Neon Pilot localhost webapp proxy is not running.' });
      return;
    }
    res.status(result.ok ? 200 : 503).json(result);
  });

  router.get('/api/extensions/registry/critical', async (_req, res) => {
    try {
      res.json(
        buildCriticalExtensionRegistryResponse(
          (await readRegistryPresentationFromHost(context)).snapshot as unknown as Parameters<
            typeof buildCriticalExtensionRegistryResponse
          >[0],
        ),
      );
    } catch (err) {
      sendRouteError(res, 'extensions critical registry error', err);
    }
  });

  router.get('/api/extensions', async (_req, res) => {
    try {
      res.json((await readRegistryPresentationFromHost(context)).snapshot.extensions);
    } catch (err) {
      sendRouteError(res, 'extensions list error', err);
    }
  });

  router.post('/api/extensions', (req, res) => {
    try {
      const { stateRoot, layout } = getExtensionLifecycleScope(context);
      const result = createRuntimeExtension(req.body as CreateRuntimeExtensionInput, stateRoot, layout);
      if (result?.extension?.id) {
        writeExtensionActivityEntrySafe(
          result.extension.id,
          'created',
          result.extension.name ?? result.extension.id,
          undefined,
          context?.getDesktopRootLayout?.(),
        );
      }
      res.status(201).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /required|must|already exists/i.test(message) ? 400 : 500;
      logError('extension create error', { message, stack: err instanceof Error ? err.stack : undefined });
      res.status(status).json({ error: message });
    }
  });

  router.post('/api/extensions/import', (req, res) => {
    try {
      const { stateRoot, layout } = getExtensionLifecycleScope(context);
      const result = importRuntimeExtensionBundle(req.body as { zipPath?: unknown }, stateRoot, layout);
      if (result?.extension?.id) {
        writeExtensionActivityEntrySafe(
          result.extension.id,
          'imported',
          result.extension.name ?? result.extension.id,
          undefined,
          context?.getDesktopRootLayout?.(),
        );
      }
      res.status(201).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /required|not found|unsafe|symlink|must|already exists|empty/i.test(message) ? 400 : 500;
      logError('extension import error', { message, stack: err instanceof Error ? err.stack : undefined });
      res.status(status).json({ error: message });
    }
  });

  router.post('/api/extensions/clean-room-import', async (req, res) => {
    try {
      const body = req.body as { zipPath?: unknown };
      const zipPath = typeof body.zipPath === 'string' && body.zipPath.trim().length > 0 ? body.zipPath.trim() : undefined;
      if (!zipPath) {
        res.status(400).json({ error: 'zipPath is required.' });
        return;
      }

      if (!(await pingDaemon())) {
        res.status(503).json({ error: 'Daemon is not responding. Ensure the desktop app is running.' });
        return;
      }

      const cwd =
        typeof req.body !== 'undefined' && typeof (req.body as Record<string, unknown>).cwd === 'string'
          ? ((req.body as Record<string, unknown>).cwd as string)
          : process.cwd();
      const zipName = zipPath.split(/[\\/]/).pop() ?? zipPath;
      const prompt = [
        'You are a clean-room analysis agent. Your only job is to safely analyze a third-party plugin bundle.',
        '',
        'RULES:',
        '- You ONLY have access to web_fetch and web_search. DO NOT use any other tools.',
        '- Do NOT read, write, or execute any local files.',
        '- Do NOT run any shell commands.',
        '- If you cannot complete the analysis with web tools alone, report what you found and what is missing.',
        '',
        'TASK: Analyze the extension bundle at `' +
          zipPath +
          '` (or the repository it came from) and produce a detailed specification document.',
        '',
        '1. First, try to find the source repository by searching for the bundle name or any identifying metadata.',
        '2. Fetch the repository README, source files, and extension manifest to understand:',
        '   - What the extension does',
        '   - What surfaces/hooks/tools it registers',
        '   - What permissions it requires',
        '   - What external services it calls',
        '3. Scan for security concerns:',
        '   - Suspicious permissions (filesystem, shell, network access)',
        '   - Hardcoded secrets or API keys',
        '   - Network exfiltration patterns',
        '   - Prompt injection vectors',
        '   - Backdoor functionality',
        '4. Generate a clean-room specification that a full agent can use to re-implement the extension from scratch.',
        '',
        'OUTPUT FORMAT:',
        '---SPEC---',
        '[Extension name]',
        '',
        '## Description',
        '[What it does]',
        '',
        '## Surfaces',
        '[Pages, panels, tools, etc.]',
        '',
        '## Permissions required',
        '[List of permissions]',
        '',
        '## Security concerns found',
        "[List of concerns, or 'None identified']",
        '',
        '## Clean-room implementation notes',
        '[What a full agent needs to re-implement this]',
        '',
        '---END SPEC---',
      ].join('\n');

      const result = await startBackgroundRun({
        taskSlug:
          'clean-room-analysis-' +
          zipName
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .toLowerCase()
            .slice(0, 48),
        cwd,
        agent: { prompt, noSession: true, allowedTools: ['web_fetch', 'web_search'] },
        source: { type: 'app', id: 'extension-manager', filePath: '' },
      });

      if (!result.accepted) {
        res.status(500).json({ error: result.reason ?? 'Could not start clean-room analysis run.' });
        return;
      }

      res.status(201).json({
        ok: true,
        runId: result.runId,
        logPath: result.logPath,
        prompt,
      });
    } catch (err) {
      sendRouteError(res, 'clean-room import error', err);
    }
  });

  router.get('/api/extensions/routes', async (_req, res) => {
    try {
      res.json((await readRegistryPresentationFromHost(context)).snapshot.routes);
    } catch (err) {
      sendRouteError(res, 'extensions routes error', err);
    }
  });

  router.get('/api/extensions/:id/manifest', async (req, res) => {
    try {
      const manifest = await readExtensionManifestFromHost(req.params.id, context);
      if (!manifest) {
        res.status(404).json({ error: 'Extension not found.' });
        return;
      }
      res.json(manifest);
    } catch (err) {
      sendRouteError(res, 'extension manifest error', err);
    }
  });

  router.get('/api/extensions/:id/surfaces', async (req, res) => {
    try {
      const manifest = await readExtensionManifestFromHost(req.params.id, context);
      if (!manifest) {
        res.status(404).json({ error: 'Extension not found.' });
        return;
      }
      res.json([...(manifest.surfaces ?? []), ...(manifest.contributes?.views ?? [])]);
    } catch (err) {
      sendRouteError(res, 'extension surfaces error', err);
    }
  });

  router.get('/webapps/:id/:webappId', async (req, res) => {
    try {
      const webapp = await findWebappFromHost(req.params.id, req.params.webappId);
      if (!webapp) {
        res.status(404).json({ error: 'Extension webapp not found.' });
        return;
      }
      await dispatchExtensionWebappRequest(webapp, req, res, '/');
    } catch (err) {
      sendRouteError(res, 'extension webapp route error', err);
    }
  });

  router.get('/webapps/:id/:webappId/*', async (req, res) => {
    try {
      const webapp = await findWebappFromHost(req.params.id, req.params.webappId);
      if (!webapp) {
        res.status(404).json({ error: 'Extension webapp not found.' });
        return;
      }
      await dispatchExtensionWebappRequest(webapp, req, res, `/${(req.params as Record<string, string | undefined>)[0] ?? ''}`);
    } catch (err) {
      sendRouteError(res, 'extension webapp route error', err);
    }
  });

  router.get('/api/extensions/surfaces', async (_req, res) => {
    try {
      const snapshot = (await readRegistryPresentationFromHost(context)).snapshot;
      res.json([...snapshot.surfaces, ...snapshot.views]);
    } catch (err) {
      sendRouteError(res, 'extensions surfaces error', err);
    }
  });

  router.get('/api/extensions/commands', async (_req, res) => {
    try {
      res.json((await readRegistryPresentationFromHost(context)).commandRegistrations);
    } catch (err) {
      sendRouteError(res, 'extensions commands error', err);
    }
  });

  router.post('/api/extensions/commands/:commandId/execute', async (req, res) => {
    const signal = createExtensionRequestAbortSignal(req, res);
    try {
      const command = await findExtensionCommandRegistrationFromHost(req.params.commandId, context);
      if (!command) {
        const handled = await executeHostCommandInRenderer({ command: req.params.commandId, args: req.body ?? {} });
        res.json({ ok: true, result: handled });
        return;
      }
      if (isHostCommandAction(command.action)) {
        const handled = await executeHostCommandInRenderer({ command: command.action, args: req.body ?? command.args ?? {} });
        res.json({ ok: true, result: handled });
        return;
      }
      const result = await getExtensionHostClient().invokeAction({
        extensionId: command.extensionId,
        actionId: command.action,
        input: req.body ?? command.args ?? {},
        serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
        signal,
      });
      res.json({ ok: true, result });
    } catch (err) {
      sendRouteError(res, 'extension command execute error', err);
    }
  });

  router.post('/api/extensions/commands/acks/:requestId', (req, res) => {
    try {
      const handled = typeof req.body?.handled === 'boolean' ? req.body.handled : false;
      res.json({ ok: true, acknowledged: acknowledgeHostCommand(req.params.requestId, handled) });
    } catch (err) {
      sendRouteError(res, 'extension command ack error', err);
    }
  });

  router.post('/api/extensions/ui-confirmations/:requestId', (req, res) => {
    try {
      const status = req.body?.status === 'confirmed' || req.body?.status === 'timeout' ? req.body.status : 'declined';
      res.json({ ok: true, acknowledged: resolveExtensionUiConfirm(req.params.requestId, status) });
    } catch (err) {
      sendRouteError(res, 'extension UI confirmation error', err);
    }
  });

  router.get('/api/extensions/ui-confirmations', (_req, res) => {
    try {
      res.json({ ok: true, confirmations: listPendingExtensionUiConfirms() });
    } catch (err) {
      sendRouteError(res, 'extension UI confirmation list error', err);
    }
  });

  router.get('/api/extensions/keybindings', async (_req, res) => {
    try {
      res.json((await readRegistryPresentationFromHost(context)).keybindingRegistrations);
    } catch (err) {
      sendRouteError(res, 'extensions keybindings error', err);
    }
  });

  router.patch('/api/extensions/keybindings/:extensionId/:keybindingId', async (req, res) => {
    try {
      const { stateRoot, layout } = getExtensionLifecycleScope(context);
      await getExtensionHostClient().setKeybinding({
        extensionId: req.params.extensionId,
        keybindingId: req.params.keybindingId,
        ...(typeof req.body?.title === 'string' ? { title: req.body.title } : {}),
        ...(typeof req.body?.command === 'string' ? { command: req.body.command } : {}),
        ...(req.body?.args !== undefined ? { args: req.body.args } : {}),
        ...(typeof req.body?.when === 'string' ? { when: req.body.when } : {}),
        ...(req.body?.scope === 'global' || req.body?.scope === 'surface' ? { scope: req.body.scope } : {}),
        ...(req.body?.packageType === 'system' || req.body?.packageType === 'user' ? { packageType: req.body.packageType } : {}),
        ...(Array.isArray(req.body?.keys) ? { keys: req.body.keys } : {}),
        ...(typeof req.body?.enabled === 'boolean' ? { enabled: req.body.enabled } : {}),
        ...(typeof req.body?.reset === 'boolean' ? { reset: req.body.reset } : {}),
        stateRoot,
        layout,
      });
      res.json({ ok: true });
    } catch (err) {
      sendRouteError(res, 'extension keybinding update error', err);
    }
  });

  router.get('/api/extensions/slash-commands', async (_req, res) => {
    try {
      res.json((await readRegistryPresentationFromHost(context)).slashCommandRegistrations);
    } catch (err) {
      sendRouteError(res, 'extensions slash commands error', err);
    }
  });

  router.get('/api/extensions/mentions', async (_req, res) => {
    try {
      res.json((await readRegistryPresentationFromHost(context)).mentionRegistrations);
    } catch (err) {
      sendRouteError(res, 'extensions mentions error', err);
    }
  });

  router.get('/api/extensions/quick-open', async (_req, res) => {
    try {
      res.json((await readRegistryPresentationFromHost(context)).quickOpenRegistrations);
    } catch (err) {
      sendRouteError(res, 'extensions quick-open error', err);
    }
  });

  router.get('/api/extensions/search-providers', async (_req, res) => {
    try {
      res.json((await readRegistryPresentationFromHost(context)).searchProviderRegistrations);
    } catch (err) {
      sendRouteError(res, 'extensions search providers error', err);
    }
  });

  router.post('/api/extensions/search', async (req, res) => {
    const signal = createExtensionRequestAbortSignal(req, res);
    try {
      const query = typeof req.body?.query === 'string' ? req.body.query : '';
      const limit = Number.isInteger(req.body?.limit) ? Math.max(1, Math.min(100, req.body.limit)) : 50;
      const providerId = typeof req.body?.providerId === 'string' ? req.body.providerId : null;
      const providers = (await readRegistryPresentationFromHost(context)).searchProviderRegistrations
        .map((provider) => ({
          ...provider,
          id: typeof provider.id === 'string' ? provider.id : '',
          extensionId: typeof provider.extensionId === 'string' ? provider.extensionId : '',
          action: typeof provider.action === 'string' ? provider.action : '',
        }))
        .filter((provider) => provider.id && provider.extensionId && provider.action && (!providerId || provider.id === providerId));
      const groups = await Promise.all(
        providers.map(async (provider) => {
          const result = await getExtensionHostClient().invokeAction({
            extensionId: provider.extensionId,
            actionId: provider.action,
            input: { query, limit, providerId: provider.id },
            signal,
          });
          return { provider, result };
        }),
      );
      res.json({
        providers,
        items: groups.flatMap(({ provider, result }) => {
          if (!result.ok) return [];
          const payload = result.result;
          const items = Array.isArray(payload)
            ? payload
            : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)
              ? (payload as { items: unknown[] }).items
              : [];
          return items.map((item) => ({
            providerId: provider.id,
            extensionId: provider.extensionId,
            ...(item && typeof item === 'object' ? item : { title: String(item) }),
          }));
        }),
      });
    } catch (err) {
      sendRouteError(res, 'extensions search error', err);
    }
  });

  router.get('/api/extensions/:id/state', async (req, res) => {
    try {
      const state = await getExtensionHostClient().stateOperation({
        operation: 'list',
        extensionId: req.params.id,
        prefix: typeof req.query.prefix === 'string' ? req.query.prefix : '',
        serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
      });
      res.json(state.operation === 'list' ? state.documents : []);
    } catch (err) {
      sendRouteError(res, 'extension state list error', err);
    }
  });

  router.get('/api/extensions/:id/state/*', async (req, res) => {
    try {
      const state = await getExtensionHostClient().stateOperation({
        operation: 'read',
        extensionId: req.params.id,
        key: (req.params as Record<string, string>)['0'],
        serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
      });
      const document = state.operation === 'read' ? state.document : null;
      if (!document) {
        res.status(404).json({ error: 'Extension state document not found.' });
        return;
      }
      res.json(document);
    } catch (err) {
      sendRouteError(res, 'extension state read error', err);
    }
  });

  router.put('/api/extensions/:id/state/*', async (req, res) => {
    try {
      const body = req.body as { value?: unknown; expectedVersion?: unknown };
      const expectedVersion =
        typeof body.expectedVersion === 'number' && Number.isSafeInteger(body.expectedVersion) ? body.expectedVersion : undefined;
      const state = await getExtensionHostClient().stateOperation({
        operation: 'write',
        extensionId: req.params.id,
        key: (req.params as Record<string, string>)['0'],
        value: body.value,
        expectedVersion,
        serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
      });
      res.json(state.operation === 'write' ? state.document : null);
    } catch (err) {
      const conflict = err instanceof Error && err.message === 'Extension state version conflict.';
      if (conflict) {
        res.status(409).json({ error: err.message, current: (err as Error & { current?: unknown }).current ?? null });
        return;
      }
      sendRouteError(res, 'extension state write error', err);
    }
  });

  router.delete('/api/extensions/:id/state/*', async (req, res) => {
    try {
      const state = await getExtensionHostClient().stateOperation({
        operation: 'delete',
        extensionId: req.params.id,
        key: (req.params as Record<string, string>)['0'],
        serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
      });
      res.json({ ok: true, deleted: state.operation === 'delete' ? state.deleted : false });
    } catch (err) {
      sendRouteError(res, 'extension state delete error', err);
    }
  });

  router.post('/api/extensions/:id/runs', async (req, res) => {
    try {
      res.status(201).json(await createExtensionRunsCapability(req.params.id).start(req.body));
    } catch (err) {
      sendRouteError(res, 'extension run start error', err);
    }
  });

  router.get('/api/extensions/:id/files/*', readExtensionFile);

  router.post('/api/extensions/:id/actions/:actionId', async (req, res) => {
    const signal = createExtensionRequestAbortSignal(req, res);
    try {
      const actionTarget = await readExtensionActionTargetFromHost(req.params.id, req.params.actionId, context);
      if (!actionTarget) {
        const manifest = await readExtensionManifestFromHost(req.params.id, context);
        const disabled = (await readRegistryPresentationFromHost(context)).installSummaries.some(
          (summary) => summary.id === req.params.id && summary.status !== 'enabled',
        );
        if (!manifest || disabled) {
          res.status(404).json({ error: `Extension "${req.params.id}" not found or is disabled.` });
          return;
        }
        res.status(404).json({ error: `Action "${req.params.actionId}" is not declared in extension "${req.params.id}" backend.actions.` });
        return;
      }
      if (!actionTarget.manifest.backend?.entry) {
        res.status(404).json({ error: `Extension "${req.params.id}" not found or is disabled.` });
        return;
      }
      const result = await getExtensionHostClient().invokeAction({
        extensionId: req.params.id,
        actionId: req.params.actionId,
        input: req.body,
        serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
        signal,
      });
      await syncSystemConversationToolMutation({
        extensionId: req.params.id,
        actionId: req.params.actionId,
        body: req.body,
        result,
        context,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /not found/i.test(message) ? 404 : 500;
      logError('extension action error', { message, stack: err instanceof Error ? err.stack : undefined });
      res.status(status).json({ error: message });
    }
  });

  router.post('/api/extensions/:id/snapshot', (req, res) => {
    try {
      const { stateRoot, layout } = getExtensionLifecycleScope(context);
      const result = snapshotRuntimeExtension(req.params.id, stateRoot, layout);
      writeExtensionActivityEntrySafe(req.params.id, 'snapshotted', req.params.id, undefined, context?.getDesktopRootLayout?.());
      res.status(201).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /not found/i.test(message) ? 404 : /package root/i.test(message) ? 400 : 500;
      logError('extension snapshot error', { message, stack: err instanceof Error ? err.stack : undefined });
      res.status(status).json({ error: message });
    }
  });

  router.post('/api/extensions/:id/export', (req, res) => {
    try {
      const { stateRoot, layout } = getExtensionLifecycleScope(context);
      const result = exportRuntimeExtension(req.params.id, stateRoot, layout);
      writeExtensionActivityEntrySafe(req.params.id, 'exported', req.params.id, undefined, context?.getDesktopRootLayout?.());
      res.status(201).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /not found/i.test(message) ? 404 : /package root/i.test(message) ? 400 : 500;
      logError('extension export error', { message, stack: err instanceof Error ? err.stack : undefined });
      res.status(status).json({ error: message });
    }
  });

  router.patch('/api/extensions/:id', async (req, res) => {
    const signal = createExtensionRequestAbortSignal(req, res);
    try {
      const enabled = (req.body as { enabled?: unknown }).enabled;
      if (typeof enabled !== 'boolean') {
        res.status(400).json({ error: 'enabled must be a boolean.' });
        return;
      }
      const result = await getExtensionHostClient().setEnabled({
        extensionId: req.params.id,
        enabled,
        serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
        signal,
      });
      if (!result.ok) {
        res.status(result.status ?? 400).json({ error: result.error ?? 'Extension update failed.' });
        return;
      }
      const extName = typeof result.extension?.name === 'string' ? result.extension.name : req.params.id;
      writeExtensionActivityEntrySafe(
        req.params.id,
        enabled ? 'enabled' : 'disabled',
        extName,
        undefined,
        context?.getDesktopRootLayout?.(),
      );
      res.json({ ok: true, extension: result.extension, ...(result.actionResult ? { actionResult: result.actionResult } : {}) });
    } catch (err) {
      sendRouteError(res, 'extension update error', err);
    }
  });

  router.delete('/api/extensions/:id', async (req, res) => {
    try {
      const { deleteRuntimeExtension } = await import('../extensions/extensionLifecycle.js');
      const { stateRoot, layout } = getExtensionLifecycleScope(context);
      const result = await deleteRuntimeExtension(req.params.id, stateRoot, layout);
      if (result.deleted) {
        writeExtensionActivityEntrySafe(req.params.id, 'deleted', req.params.id, undefined, context?.getDesktopRootLayout?.());
      }
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /not found/i.test(message) ? 404 : /packaged system|package root|path escapes/i.test(message) ? 400 : 500;
      logError('extension delete error', { message, stack: err instanceof Error ? err.stack : undefined });
      res.status(status).json({ error: message });
    }
  });

  router.post('/api/extensions/reload', async (_req, res) => {
    try {
      await getExtensionHostClient().registryMaintenance({ operation: 'invalidateReadCaches' });
      await publishExtensionRegistryChanged(context);
      res.json({ ok: true, reloaded: true, message: 'Extension registry caches were invalidated; reopen contributed routes if needed.' });
    } catch (err) {
      sendRouteError(res, 'extension reload error', err);
    }
  });

  router.post('/api/extensions/:id/build', async (req, res) => {
    try {
      const { stateRoot, layout } = getExtensionLifecycleScope(context);
      const result = await buildRuntimeExtension(req.params.id, stateRoot, layout);
      await getExtensionHostClient().registryMaintenance({ operation: 'clearBuildError', extensionId: req.params.id });
      await publishExtensionRegistryChanged(context);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await getExtensionHostClient().registryMaintenance({ operation: 'setBuildError', extensionId: req.params.id, error: message });
      await publishExtensionRegistryChanged(context);
      const status = /not found/i.test(message)
        ? 404
        : /package root|schemaVersion|manifest|contributes|frontend|backend|surfaces|permissions|no longer builds|outside the app|compile extensions at runtime|prebuild dist\/frontend\.js and dist\/backend\.mjs/i.test(
              message,
            )
          ? 400
          : 500;
      logError('extension build error', { message, stack: err instanceof Error ? err.stack : undefined });
      res.status(status).json({ error: message });
    }
  });

  router.post('/api/extensions/:id/self-test', async (req, res) => {
    try {
      res.json(await getExtensionHostClient().runSelfTest({ extensionId: req.params.id }));
    } catch (err) {
      sendRouteError(res, 'extension self-test error', err);
    }
  });

  router.post('/api/extensions/:id/validate', async (req, res) => {
    try {
      const report = await validateExtensionPackage({ extensionId: req.params.id });
      res.status(report.ok ? 200 : 400).json(report);
    } catch (err) {
      sendRouteError(res, 'extension validate error', err);
    }
  });

  router.post('/api/extensions/validate', async (req, res) => {
    try {
      const body = req.body as { id?: unknown; extensionId?: unknown; packageRoot?: unknown };
      const extensionId = typeof body.extensionId === 'string' ? body.extensionId : typeof body.id === 'string' ? body.id : undefined;
      const packageRoot = typeof body.packageRoot === 'string' ? body.packageRoot : undefined;
      const report = await validateExtensionPackage({ extensionId, packageRoot });
      res.status(report.ok ? 200 : 400).json(report);
    } catch (err) {
      sendRouteError(res, 'extension validate error', err);
    }
  });

  router.post('/api/extensions/:id/reload', async (req, res) => {
    try {
      await getExtensionHostClient().registryMaintenance({ operation: 'invalidateReadCaches' });
      await getExtensionHostClient().registryMaintenance({ operation: 'clearBuildError', extensionId: req.params.id });
      const summary = await readExtensionInstallSummaryFromHost(req.params.id, context);
      if (!summary) {
        res.status(404).json({ error: 'Extension not found.' });
        return;
      }
      if (summary?.status === 'invalid') {
        const errors = Array.isArray(summary.errors) ? summary.errors.filter((error): error is string => typeof error === 'string') : [];
        res.status(400).json({ error: errors[0] ?? 'Extension manifest is invalid.' });
        return;
      }
      const manifest = (summary as { manifest?: unknown } | null)?.manifest as ExtensionManifest | undefined;
      if (!manifest?.backend?.entry) {
        await publishExtensionRegistryChanged(context);
        res.json({ ok: true, id: req.params.id, reloaded: true, message: 'Extension registry caches were invalidated.' });
        return;
      }
      const result = await getExtensionHostClient().reloadBackend({
        extensionId: req.params.id,
        serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
      });
      await publishExtensionRegistryChanged(context);
      res.json({
        ok: true,
        id: req.params.id,
        reloaded: true,
        message: result.rebuilt ? 'Extension backend rebuilt.' : 'Extension backend reloaded.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status =
        /no longer builds|outside the app|backend artifact is missing|compile extensions at runtime|prebuilt backend bundle/i.test(message)
          ? 400
          : 500;
      logError('extension reload error', { message, stack: err instanceof Error ? err.stack : undefined });
      res.status(status).json({ error: message });
    }
  });

  // ── Inter-extension event bus ────────────────────────────────────────

  router.get('/api/extensions/events/subscriptions', async (_req, res) => {
    try {
      res.json(await getExtensionHostClient().listEventSubscriptions());
    } catch (err) {
      sendRouteError(res, 'extension event subscriptions error', err);
    }
  });

  // ── Inter-extension action listing ───────────────────────────────────

  router.get('/api/extensions/actions', async (_req, res) => {
    try {
      const { installSummaries } = await readRegistryPresentationFromHost(context);
      const summaries = installSummaries
        .filter(
          (extension) => extension.status === 'enabled' && Array.isArray(extension.backendActions) && extension.backendActions.length > 0,
        )
        .map((extension) => ({
          extensionId: typeof extension.id === 'string' ? extension.id : '',
          extensionName: typeof extension.name === 'string' ? extension.name : '',
          actions: (Array.isArray(extension.backendActions) ? extension.backendActions : []).map((action) => ({
            id: typeof (action as { id?: unknown }).id === 'string' ? (action as { id: string }).id : '',
            title: typeof (action as { title?: unknown }).title === 'string' ? (action as { title: string }).title : undefined,
            description:
              typeof (action as { description?: unknown }).description === 'string'
                ? (action as { description: string }).description
                : undefined,
          })),
        }))
        .filter((extension) => extension.extensionId);
      res.json(summaries);
    } catch (err) {
      sendRouteError(res, 'extension actions list error', err);
    }
  });

  // ── Extension status check ──────────────────────────────────────────

  router.get('/api/extensions/:id/status', async (req, res) => {
    try {
      const summary = (await readRegistryPresentationFromHost(context)).installSummaries.find((e) => e.id === req.params.id);
      if (!summary) {
        res.json({ enabled: false, healthy: false, error: 'Extension not found.' });
        return;
      }
      const errors = Array.isArray(summary.errors) ? summary.errors.filter((error): error is string => typeof error === 'string') : [];
      const enabled = summary.status === 'enabled' || (summary.enabled === true && summary.status !== 'disabled');
      res.json({
        enabled,
        healthy: enabled && errors.length === 0,
        ...(errors.length ? { errors } : {}),
      });
    } catch (err) {
      sendRouteError(res, 'extension status error', err);
    }
  });

  // ── Notification badge state ─────────────────────────────────────────

  router.get('/api/extensions/badge', (_req, res) => {
    try {
      res.json({ aggregated: getAggregatedBadgeCount() });
    } catch (err) {
      sendRouteError(res, 'extension badge error', err);
    }
  });

  const dispatchHostWebapp = async (req: Request, res: Response, next?: NextFunction) => {
    try {
      const host = normalizeHostHeader(req.get('host'));
      const webapp = await findWebappByHost(host);
      if (!webapp) {
        if (isExtensionWebappLocalhostHost(host)) {
          res.status(404).json({ error: 'No Neon Pilot webapp is registered for this host.' });
          return;
        }
        next?.();
        return;
      }
      if (await dispatchExtensionWebappBridgeRequest(webapp, req, res, context)) {
        return;
      }
      await dispatchExtensionWebappRequest(webapp, req, res, req.path || '/');
    } catch (err) {
      sendRouteError(res, 'extension webapp host route error', err);
    }
  };

  router.get('*', dispatchHostWebapp);
  router.post('*', dispatchHostWebapp);
  router.put('*', dispatchHostWebapp);
  router.patch('*', dispatchHostWebapp);
  router.delete('*', dispatchHostWebapp);

  router.get('/api/extensions/:id/*', (req, res) => dispatchExtensionBackendRoute(req, res, context));
  router.post('/api/extensions/:id/*', (req, res) => dispatchExtensionBackendRoute(req, res, context));
  router.put('/api/extensions/:id/*', (req, res) => dispatchExtensionBackendRoute(req, res, context));
  router.patch('/api/extensions/:id/*', (req, res) => dispatchExtensionBackendRoute(req, res, context));
  router.delete('/api/extensions/:id/*', (req, res) => dispatchExtensionBackendRoute(req, res, context));
}
