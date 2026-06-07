import { publishAppEvent } from '../shared/appEvents.js';
import { logError, logInfo } from '../shared/logging.js';
import type { ExtensionBackendServerContext } from './extensionBackend.js';
import { runExtensionBackendExportInWorker } from './extensionBackend.js';
import { extensionBackendOperation } from './extensionBackendRunner.js';
import { ExtensionProcessTerminationBlockedError } from './extensionProcessGuard.js';
import {
  clearExtensionFailureRecordsForOperation,
  clearExtensionHealthError,
  findExtensionEntry,
  listExtensionInstallSummaries,
  markExtensionStartupActive,
  recordExtensionFailure,
  setExtensionHealthError,
} from './extensionRegistry.js';

interface RunningExtensionService {
  extensionId: string;
  serviceId: string;
  stop?: () => unknown | Promise<unknown>;
  startedAt: string;
  lastError?: string;
}

const runningServices = new Map<string, RunningExtensionService>();
const serviceKey = (extensionId: string, serviceId: string) => `${extensionId}:${serviceId}`;

export function listRunningExtensionServices(): RunningExtensionService[] {
  return [...runningServices.values()];
}

export function isExtensionServiceRunning(extensionId: string, serviceId: string): boolean {
  return runningServices.has(serviceKey(extensionId, serviceId));
}

async function retryExtensionStartupOperation<T>(operation: () => Promise<T>): Promise<T> {
  const attempts = 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (error instanceof ExtensionProcessTerminationBlockedError || attempt === attempts) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 150 * attempt));
    }
  }
  throw lastError;
}

export async function stopExtensionServices(extensionId: string): Promise<void> {
  for (const service of [...runningServices.values()].filter((candidate) => candidate.extensionId === extensionId)) {
    runningServices.delete(serviceKey(service.extensionId, service.serviceId));
    if (service.stop) await service.stop();
    logInfo('extension service stopped', { extensionId: service.extensionId, serviceId: service.serviceId });
  }
}

async function stopOneService(extensionId: string, serviceId: string): Promise<void> {
  const key = serviceKey(extensionId, serviceId);
  const service = runningServices.get(key);
  if (!service) return;
  runningServices.delete(key);
  if (service.stop) await service.stop();
  logInfo('extension service stopped', { extensionId, serviceId });
}

export async function stopAllExtensionServices(): Promise<void> {
  for (const extensionId of new Set([...runningServices.values()].map((service) => service.extensionId))) {
    await stopExtensionServices(extensionId);
  }
}

async function startOneExtensionService(
  extensionId: string,
  service: { id: string; handler: string; stopHandler?: string; worker?: { enabled?: boolean } },
  serverContext?: ExtensionBackendServerContext,
): Promise<{ extensionId: string; serviceId: string; ok: boolean; error?: string }> {
  const key = serviceKey(extensionId, service.id);
  if (runningServices.has(key)) return { extensionId, serviceId: service.id, ok: true };
  try {
    const SERVICE_STARTUP_TIMEOUT_MS = 30_000;
    const operation = extensionBackendOperation('service-startup', `service ${service.id} startup`, { target: service.id });
    markExtensionStartupActive(extensionId);
    const result = await retryExtensionStartupOperation(() =>
      Promise.race([
        service.worker?.enabled
          ? runExtensionBackendExportInWorker(extensionId, service.handler, operation, [{ serviceId: service.id }], serverContext)
          : Promise.reject(new Error(`Extension service "${service.id}" must declare worker.enabled before it can run.`)),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Service "${service.id}" startup timed out after ${SERVICE_STARTUP_TIMEOUT_MS / 1000}s.`)),
            SERVICE_STARTUP_TIMEOUT_MS,
          ).unref(),
        ),
      ]),
    );
    markExtensionStartupActive(undefined);
    if (typeof result === 'function') {
      throw new Error(`Extension service "${service.id}" returned an in-process stop function; use stopHandler instead.`);
    }
    const stop = service.stopHandler
      ? () =>
          runExtensionBackendExportInWorker(
            extensionId,
            service.stopHandler!,
            extensionBackendOperation('service-stop', `service ${service.id} stop`, { target: service.id }),
            [{ serviceId: service.id }],
            serverContext,
          )
      : undefined;
    runningServices.set(key, { extensionId, serviceId: service.id, stop, startedAt: new Date().toISOString() });
    clearExtensionHealthError(extensionId);
    clearExtensionFailureRecordsForOperation(extensionId, `service ${service.id} startup`);
    logInfo('extension service started', { extensionId, serviceId: service.id });
    return { extensionId, serviceId: service.id, ok: true };
  } catch (error) {
    markExtensionStartupActive(undefined);
    const message = error instanceof Error ? error.message : String(error);
    setExtensionHealthError(extensionId, message);
    if (error instanceof ExtensionProcessTerminationBlockedError) {
      const { setExtensionEnabled } = await import('./extensionRegistry.js');
      setExtensionEnabled(extensionId, false);
    } else {
      recordExtensionFailure({ extensionId, operation: `service ${service.id} startup`, error: message });
    }
    logError('extension service failed', { extensionId, serviceId: service.id, message });
    publishAppEvent({ type: 'notification', extensionId, message: `Extension service failed: ${message}`, severity: 'error' });
    return { extensionId, serviceId: service.id, ok: false, error: message };
  }
}

export async function startExtensionServices(
  serverContext?: ExtensionBackendServerContext,
): Promise<Array<{ extensionId: string; serviceId: string; ok: boolean; error?: string }>> {
  const enabled = listExtensionInstallSummaries().filter((s) => s.status === 'enabled');
  const results = await Promise.all(
    enabled.flatMap((summary) => {
      const entry = findExtensionEntry(summary.id);
      return (entry?.manifest.backend?.services ?? []).map((service) => startOneExtensionService(summary.id, service, serverContext));
    }),
  );
  return results;
}

export async function startServicesForExtension(
  extensionId: string,
  serverContext?: ExtensionBackendServerContext,
): Promise<Array<{ extensionId: string; serviceId: string; ok: boolean; error?: string }>> {
  const summary = listExtensionInstallSummaries().find((s) => s.id === extensionId);
  if (summary?.status !== 'enabled') return [];
  const entry = findExtensionEntry(extensionId);
  const services = entry?.manifest.backend?.services ?? [];
  return Promise.all(services.map((service) => startOneExtensionService(extensionId, service, serverContext)));
}

export async function runExtensionServiceHealthChecks(serverContext?: ExtensionBackendServerContext): Promise<void> {
  for (const summary of listExtensionInstallSummaries()) {
    if (summary.status !== 'enabled') continue;
    const entry = findExtensionEntry(summary.id);
    for (const service of entry?.manifest.backend?.services ?? []) {
      if (!service.healthCheck) continue;
      const key = serviceKey(summary.id, service.id);
      try {
        const HEALTH_CHECK_TIMEOUT_MS = 15_000;
        const result = await Promise.race([
          service.worker?.enabled
            ? runExtensionBackendExportInWorker(
                summary.id,
                service.healthCheck,
                extensionBackendOperation('service-health-check', `service ${service.id} health check`, { target: service.id }),
                [{ serviceId: service.id }],
                serverContext,
              )
            : Promise.reject(new Error(`Extension service "${service.id}" must declare worker.enabled before health checks can run.`)),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Health check for service "${service.id}" timed out after ${HEALTH_CHECK_TIMEOUT_MS / 1000}s.`)),
              HEALTH_CHECK_TIMEOUT_MS,
            ).unref(),
          ),
        ]);
        if (result && typeof result === 'object' && 'running' in result && (result as { running?: unknown }).running === false) {
          throw new Error('Service health check reported stopped.');
        }
        const running = runningServices.get(key);
        if (running) delete running.lastError;
        clearExtensionHealthError(summary.id);
        clearExtensionFailureRecordsForOperation(summary.id, `service ${service.id} health check`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const running = runningServices.get(key);
        if (running) running.lastError = message;
        setExtensionHealthError(summary.id, message);
        if (error instanceof ExtensionProcessTerminationBlockedError) {
          const { setExtensionEnabled } = await import('./extensionRegistry.js');
          setExtensionEnabled(summary.id, false);
          await stopOneService(summary.id, service.id);
          continue;
        }
        recordExtensionFailure({ extensionId: summary.id, operation: `service ${service.id} health check`, error: message });
        if (service.restart === 'always' || service.restart === 'on-failure') {
          await stopOneService(summary.id, service.id);
          await startOneExtensionService(summary.id, service, serverContext);
        }
      }
    }
  }
}
