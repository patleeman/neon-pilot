import { parseApiDispatchResult, readApiDispatchError } from './hosts/api-dispatch.js';
import type { HostApiDispatchResult } from './hosts/types.js';

export interface DesktopUrlClipperHost {
  ensureActiveHostRunning(): Promise<void>;
  getActiveHostController(): {
    dispatchApiRequest(input: {
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      path: string;
      body?: unknown;
      headers?: Record<string, string>;
    }): Promise<HostApiDispatchResult>;
  };
}

export interface DesktopUrlClipImportResult {
  title: string;
  note?: {
    id?: string;
  };
}

export function normalizeClipboardUrl(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new Error('Clipboard is empty. Copy a URL first.');
  }

  const firstLine =
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? '';
  let parsed: URL;
  try {
    parsed = new URL(firstLine);
  } catch {
    throw new Error('Clipboard does not contain a valid URL. Copy a URL first.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs can be clipped.');
  }

  return parsed.toString();
}

export async function importClipboardUrlToKnowledge(input: {
  host: DesktopUrlClipperHost;
  clipboardText: string;
  createdAt?: string;
}): Promise<DesktopUrlClipImportResult> {
  const url = normalizeClipboardUrl(input.clipboardText);
  await input.host.ensureActiveHostRunning();
  const controller = input.host.getActiveHostController();
  const actionPath = await resolveExtensionActionPathByRouteCapability(controller, 'knowledgeFiles', 'vaultImportSharedItem');
  const response = await controller.dispatchApiRequest({
    method: 'POST',
    path: actionPath,
    body: {
      kind: 'url',
      url,
      directoryId: 'Inbox',
      sourceApp: 'Neon Pilot Desktop',
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(readApiDispatchError(response));
  }

  const result = parseApiDispatchResult<{ ok?: boolean; result?: DesktopUrlClipImportResult; error?: string }>(response);
  if (result.ok === false) {
    throw new Error(result.error || 'Knowledge import failed.');
  }
  return result.result as DesktopUrlClipImportResult;
}

async function resolveExtensionActionPathByRouteCapability(
  controller: ReturnType<DesktopUrlClipperHost['getActiveHostController']>,
  capability: string,
  actionId: string,
): Promise<string> {
  const response = await controller.dispatchApiRequest({ method: 'GET', path: '/api/extensions/installed' });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(readApiDispatchError(response));
  }
  const extensions = parseApiDispatchResult<
    Array<{
      id: string;
      enabled?: boolean;
      manifest?: {
        backend?: { actions?: Array<{ id: string }> };
        contributes?: { views?: Array<{ routeCapabilities?: string[] }> };
      };
      surfaces?: Array<{ routeCapabilities?: string[] }>;
      backendActions?: Array<{ id: string }>;
    }>
  >(response);
  const extension = extensions.find(
    (candidate) =>
      candidate.enabled !== false &&
      (candidate.manifest?.contributes?.views?.some((view) => view.routeCapabilities?.includes(capability)) ||
        candidate.surfaces?.some((surface) => surface.routeCapabilities?.includes(capability))) &&
      (candidate.backendActions ?? candidate.manifest?.backend?.actions ?? []).some((action) => action.id === actionId),
  );
  if (!extension) throw new Error(`No enabled extension provides ${capability}.${actionId}.`);
  return `/api/extensions/${encodeURIComponent(extension.id)}/actions/${encodeURIComponent(actionId)}`;
}
