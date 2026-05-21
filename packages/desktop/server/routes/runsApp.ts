/**
 * Runs routes (app)
 *
 * Handles durable run SSE events and shared run UI assets.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Express, Response } from 'express';

import { getDurableRunLogCursor, readDurableRunLogDelta } from '../automation/durableRuns.js';
import { logError } from '../middleware/index.js';
import type { ServerRouteContext } from './context.js';

// Lazy-load PA component CSS
let paComponentsCss: string | null = null;
const currentDir = dirname(fileURLToPath(import.meta.url));

function candidatePaComponentsCssPaths(): string[] {
  return [
    process.env.NEON_PILOT_REPO_ROOT
      ? resolve(process.env.NEON_PILOT_REPO_ROOT, 'packages/desktop/server/extensions/pa-components.css')
      : null,
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'extensions/pa-components.css') : null,
    resolve(process.cwd(), 'server/extensions/pa-components.css'),
    resolve(process.cwd(), 'extensions/pa-components.css'),
    resolve(currentDir, '../extensions/pa-components.css'),
    resolve(currentDir, '../../../server/extensions/pa-components.css'),
    resolve(currentDir, '../../../../packages/desktop/server/extensions/pa-components.css'),
  ].filter((value): value is string => Boolean(value));
}

function getPaComponentsCss(): string {
  if (paComponentsCss !== null) {
    return paComponentsCss;
  }

  for (const cssPath of candidatePaComponentsCssPaths()) {
    if (!existsSync(cssPath)) {
      continue;
    }
    paComponentsCss = readFileSync(cssPath, 'utf-8');
    return paComponentsCss;
  }

  paComponentsCss = '/* PA components not available */';
  return paComponentsCss;
}

const ACTIVE_RUN_POLL_INTERVAL_MS = 1_000;
const IDLE_RUN_POLL_INTERVAL_MS = 5_000;
const ACTIVE_RUN_LOG_POLL_INTERVAL_MS = 250;
const IDLE_RUN_LOG_POLL_INTERVAL_MS = 2_000;

function parseRunLogTail(raw: unknown): number {
  const normalized = typeof raw === 'string' ? raw.trim() : '';
  const parsed = /^\d+$/.test(normalized) ? Number.parseInt(normalized, 10) : undefined;
  return Number.isSafeInteger(parsed) && (parsed as number) > 0 ? Math.min(1000, parsed as number) : 120;
}

function isRunStreamActive(snapshot: { detail: { run: { status?: { status?: string } | string } } }): boolean {
  const runStatus = typeof snapshot.detail.run.status === 'string' ? snapshot.detail.run.status : snapshot.detail.run.status?.status;

  return runStatus === 'queued' || runStatus === 'waiting' || runStatus === 'running' || runStatus === 'recovering';
}

function getRunStreamPollInterval(snapshot: { detail: { run: { status?: { status?: string } | string } } }): number {
  return isRunStreamActive(snapshot) ? ACTIVE_RUN_POLL_INTERVAL_MS : IDLE_RUN_POLL_INTERVAL_MS;
}

function getRunLogPollInterval(active: boolean): number {
  return active ? ACTIVE_RUN_LOG_POLL_INTERVAL_MS : IDLE_RUN_LOG_POLL_INTERVAL_MS;
}

let getDurableRunSnapshotFn: (runId: string, tail: number) => Promise<unknown | null> = async () => {
  throw new Error('not initialized');
};

function initializeRunsAppRoutesContext(context: Pick<ServerRouteContext, 'getDurableRunSnapshot'>): void {
  getDurableRunSnapshotFn = context.getDurableRunSnapshot;
}

export function registerRunAppRoutes(
  router: Pick<Express, 'get' | 'post' | 'patch'>,
  context: Pick<ServerRouteContext, 'getDurableRunSnapshot'>,
): void {
  initializeRunsAppRoutesContext(context);

  function sendPaComponents(_req: unknown, res: Response) {
    try {
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(getPaComponentsCss());
    } catch (err) {
      logError('PA components serve error', {
        message: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to serve PA components' });
    }
  }

  // Serve shared component CSS for native extension bundles and generated previews.
  router.get('/pa/components.css', sendPaComponents);
  router.get('/api/pa/components.css', sendPaComponents);

  router.get('/api/runs/:id/events', async (req, res) => {
    const runId = req.params.id;
    const tail = parseRunLogTail(req.query.tail);
    try {
      const initial = await getDurableRunSnapshotFn(runId, tail);
      if (!initial) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const writeEvent = (event: unknown) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      let closed = false;
      let detailPollTimer: ReturnType<typeof setTimeout> | null = null;
      let logPollTimer: ReturnType<typeof setTimeout> | null = null;
      let logPath = (initial as { log: { path: string } }).log.path;
      let logCursor = getDurableRunLogCursor(logPath);
      let runActive = isRunStreamActive(initial as { detail: { run: { status?: { status?: string } | string } } });
      const heartbeat = setInterval(() => {
        if (!closed) res.write(': heartbeat\n\n');
      }, 15_000);

      const stopStream = () => {
        closed = true;
        clearInterval(heartbeat);
        if (detailPollTimer) {
          clearTimeout(detailPollTimer);
          detailPollTimer = null;
        }
        if (logPollTimer) {
          clearTimeout(logPollTimer);
          logPollTimer = null;
        }
      };

      const scheduleDetailPoll = (delayMs: number) => {
        if (closed) {
          return;
        }

        detailPollTimer = setTimeout(() => {
          void pollDetailOnce();
        }, delayMs);
      };

      const scheduleLogPoll = (delayMs: number) => {
        if (closed) {
          return;
        }

        logPollTimer = setTimeout(() => {
          void pollLogOnce();
        }, delayMs);
      };

      const pollDetailOnce = async () => {
        if (closed) {
          return;
        }

        try {
          const next = await getDurableRunSnapshotFn(runId, tail);
          if (closed) {
            return;
          }

          if (!next) {
            writeEvent({ type: 'deleted', runId });
            stopStream();
            res.end();
            return;
          }

          const typedNext = next as { detail: { run: { status?: { status?: string } | string } }; log: { path: string; log: string } };
          runActive = isRunStreamActive(typedNext);
          if (typedNext.log.path !== logPath) {
            logPath = typedNext.log.path;
            logCursor = getDurableRunLogCursor(logPath);
            writeEvent({ type: 'snapshot', detail: typedNext.detail, log: typedNext.log });
          } else {
            writeEvent({ type: 'detail', detail: typedNext.detail });
          }
          scheduleDetailPoll(getRunStreamPollInterval(typedNext));
        } catch {
          scheduleDetailPoll(ACTIVE_RUN_POLL_INTERVAL_MS);
        }
      };

      const pollLogOnce = async () => {
        if (closed) {
          return;
        }

        try {
          const delta = readDurableRunLogDelta(logPath, logCursor);
          if (closed) {
            return;
          }

          if (delta?.reset) {
            const next = await getDurableRunSnapshotFn(runId, tail);
            if (closed) {
              return;
            }

            if (!next) {
              writeEvent({ type: 'deleted', runId });
              stopStream();
              res.end();
              return;
            }

            const typedNext = next as {
              detail: { run: { status?: { status?: string } | string } };
              log: { path: string; log: string };
            };
            runActive = isRunStreamActive(typedNext);
            logPath = typedNext.log.path;
            logCursor = getDurableRunLogCursor(logPath);
            writeEvent({ type: 'snapshot', detail: typedNext.detail, log: typedNext.log });
          } else if (delta) {
            logCursor = delta.nextCursor;
            if (delta.delta.length > 0) {
              writeEvent({ type: 'log_delta', path: delta.path, delta: delta.delta });
            }
          }
        } finally {
          scheduleLogPoll(getRunLogPollInterval(runActive));
        }
      };

      writeEvent({ type: 'snapshot', detail: (initial as { detail: unknown }).detail, log: (initial as { log: unknown }).log });
      scheduleDetailPoll(getRunStreamPollInterval(initial as { detail: { run: { status?: { status?: string } | string } } }));
      scheduleLogPoll(getRunLogPollInterval(runActive));

      req.on('close', () => {
        stopStream();
      });
    } catch (err) {
      logError('request handler error', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).json({ error: String(err) });
    }
  });
}
