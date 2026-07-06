import type { Express, Response } from 'express';

import { getDurableRunLogCursor, readDurableRunLogDelta } from '../automation/durableRuns.js';
import { type DocumentsStore, getDocumentsStore } from '../documents/store.js';
import {
  cancelExecution,
  followUpExecution,
  getExecution,
  getExecutionLog,
  isExecutionActive,
  listConversationExecutions,
  listExecutions,
  rerunExecution,
  writeExecutionActivityEntry,
} from '../executions/executionService.js';
import { invalidateAppTopics, logError } from '../middleware/index.js';
import type { ServerRouteContext } from './context.js';

function parseLogTail(queryTail: unknown): number | undefined {
  if (typeof queryTail !== 'string') return undefined;
  const normalized = queryTail.trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(1000, parsed) : undefined;
}

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

function parseExecutionVisibilityQuery(value: unknown): 'primary' | 'system' | 'hidden' | 'visible' | 'all' | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized === 'primary' || normalized === 'system' || normalized === 'hidden' || normalized === 'visible' || normalized === 'all'
    ? normalized
    : undefined;
}

const ACTIVE_EXECUTION_POLL_INTERVAL_MS = 1_000;
const ACTIVE_EXECUTION_LOG_POLL_INTERVAL_MS = 500;
const TERMINAL_EXECUTION_STREAM_GRACE_MS = 1_500;

function handleError(res: Response, err: unknown): void {
  logError('request handler error', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: String(err) });
}

function formatExecutionActionRejection(err: unknown, action: 'rerun' | 'follow-up'): string | null {
  const message = err instanceof Error ? err.message : String(err);
  if (/run not found/i.test(message)) return 'Execution not found.';
  if (/still active/i.test(message)) return 'This execution is still running.';
  if (/not a replayable background run/i.test(message)) return 'This execution cannot be rerun.';
  if (/does not contain its original (?:agent prompt|shell command)/i.test(message)) {
    return 'This execution cannot be rerun because its original command is unavailable.';
  }
  if (/does not support follow-up prompts/i.test(message)) return 'This execution does not support follow-up prompts.';
  if (/follow-up prompt must be non-empty/i.test(message)) return 'Follow-up prompt is required.';
  if (action === 'follow-up' && /cannot be rerun/i.test(message)) return 'This execution does not support follow-up prompts.';
  return null;
}

// Store lifecycle is optional and drives activity producers when routes
// are registered with desktop server context.

interface ExecutionRouteContext {
  getStateRoot: ServerRouteContext['getStateRoot'];
  getDesktopRootLayout?: ServerRouteContext['getDesktopRootLayout'];
}

function getStore(context: ExecutionRouteContext | undefined): DocumentsStore | undefined {
  if (!context) return undefined;
  const stateRoot = context.getStateRoot?.();
  if (!stateRoot) return undefined;
  return getDocumentsStore(stateRoot, context.getDesktopRootLayout?.());
}

// Lifecycle kind helpers.

function lifecycleKindForStatus(status: string): 'activity' | 'error' {
  if (status === 'failed' || status === 'cancelled' || status === 'interrupted') return 'error';
  return 'activity';
}

export function registerExecutionRoutes(router: Pick<Express, 'get' | 'post'>, context?: ExecutionRouteContext): void {
  const store = getStore(context);
  router.get('/api/executions', async (_req, res) => {
    try {
      res.json(await listExecutions());
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get('/api/conversations/:id/executions', async (req, res) => {
    try {
      res.json(
        await listConversationExecutions(req.params.id, {
          active: parseBooleanQuery(req.query.active),
          visibility: parseExecutionVisibilityQuery(req.query.visibility),
        }),
      );
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get('/api/executions/:id', async (req, res) => {
    try {
      const result = await getExecution(req.params.id);
      if (!result) {
        res.status(404).json({ error: 'Execution not found' });
        return;
      }
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get('/api/executions/:id/events', async (req, res) => {
    const executionId = req.params.id;
    const tail = parseLogTail(req.query.tail);
    try {
      const [initialDetail, initialLog] = await Promise.all([getExecution(executionId), getExecutionLog(executionId, tail)]);
      if (!initialDetail || !initialLog) {
        res.status(404).json({ error: 'Execution not found' });
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
      let terminalStopTimer: ReturnType<typeof setTimeout> | null = null;
      let logPath = initialLog.path;
      let logCursor = getDurableRunLogCursor(logPath);
      let previousStatus = initialDetail.execution.status;
      let active = isExecutionActive(initialDetail.execution);
      const heartbeat = setInterval(() => {
        if (!closed) res.write(': heartbeat\n\n');
      }, 15_000);

      const stopStream = () => {
        closed = true;
        clearInterval(heartbeat);
        if (detailPollTimer) clearTimeout(detailPollTimer);
        if (logPollTimer) clearTimeout(logPollTimer);
        if (terminalStopTimer) clearTimeout(terminalStopTimer);
      };

      const scheduleTerminalStop = () => {
        if (closed || terminalStopTimer) return;
        terminalStopTimer = setTimeout(() => {
          if (!closed) {
            stopStream();
            res.end();
          }
        }, TERMINAL_EXECUTION_STREAM_GRACE_MS);
      };

      const scheduleDetailPoll = (delayMs: number) => {
        if (!closed && active) detailPollTimer = setTimeout(() => void pollDetailOnce(), delayMs);
      };
      const scheduleLogPoll = (delayMs: number) => {
        if (!closed) logPollTimer = setTimeout(() => void pollLogOnce(), delayMs);
      };

      const pollDetailOnce = async () => {
        if (closed) return;
        try {
          const detail = await getExecution(executionId);
          if (closed) return;
          if (!detail) {
            writeEvent({ type: 'deleted', executionId });
            stopStream();
            res.end();
            return;
          }
          const nextStatus = detail.execution.status;
          active = isExecutionActive(detail.execution);
          if (nextStatus !== previousStatus) {
            // Terminal transitions produce an activity entry.
            if (
              store &&
              active === false &&
              (nextStatus === 'completed' || nextStatus === 'failed' || nextStatus === 'cancelled' || nextStatus === 'interrupted')
            ) {
              try {
                writeExecutionActivityEntry(store, executionId, detail.execution.title, nextStatus, lifecycleKindForStatus(nextStatus));
              } catch {
                // Best-effort; the SSE stream carries on
              }
            }
            previousStatus = nextStatus;
            invalidateAppTopics('executions', 'runs');
          }
          writeEvent({ type: 'detail', detail });
          if (!active) {
            scheduleTerminalStop();
            return;
          }
          scheduleDetailPoll(ACTIVE_EXECUTION_POLL_INTERVAL_MS);
        } catch {
          scheduleDetailPoll(ACTIVE_EXECUTION_POLL_INTERVAL_MS);
        }
      };

      const pollLogOnce = async () => {
        if (closed) return;
        try {
          const delta = readDurableRunLogDelta(logPath, logCursor);
          if (closed) return;
          if (delta?.reset) {
            const log = await getExecutionLog(executionId, tail);
            if (!log) {
              writeEvent({ type: 'deleted', executionId });
              stopStream();
              res.end();
              return;
            }
            logPath = log.path;
            logCursor = getDurableRunLogCursor(logPath);
            writeEvent({ type: 'log', log });
          } else if (delta) {
            logCursor = delta.nextCursor;
            if (delta.delta.length > 0) writeEvent({ type: 'log_delta', path: delta.path, delta: delta.delta });
          }
        } finally {
          if (active) {
            scheduleLogPoll(ACTIVE_EXECUTION_LOG_POLL_INTERVAL_MS);
          } else {
            scheduleTerminalStop();
          }
        }
      };

      writeEvent({ type: 'snapshot', detail: initialDetail, log: initialLog });
      if (active) {
        scheduleDetailPoll(ACTIVE_EXECUTION_POLL_INTERVAL_MS);
        scheduleLogPoll(ACTIVE_EXECUTION_LOG_POLL_INTERVAL_MS);
      } else {
        scheduleTerminalStop();
      }
      req.on('close', stopStream);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get('/api/executions/:id/log', async (req, res) => {
    try {
      const result = await getExecutionLog(req.params.id, parseLogTail(req.query.tail));
      if (!result) {
        res.status(404).json({ error: 'Execution not found' });
        return;
      }
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post('/api/executions/:id/cancel', async (req, res) => {
    try {
      const id = req.params.id;
      const result = await cancelExecution(id);
      if (!result.cancelled) {
        res.status(409).json({ error: result.reason ?? 'Could not cancel execution.' });
        return;
      }
      if (store) {
        const prior = await getExecution(id).catch(() => undefined);
        if (prior) {
          writeExecutionActivityEntry(store, id, prior.execution.title, 'cancelled', 'error', {
            runId: id,
          });
        }
      }
      invalidateAppTopics('executions', 'runs');
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post('/api/executions/:id/rerun', async (req, res) => {
    try {
      const sourceId = req.params.id;
      const result = await rerunExecution(sourceId);
      if (!result.accepted) {
        res.status(409).json({ error: result.reason ?? 'Could not rerun execution.' });
        return;
      }
      if (store) {
        const newDetail = await getExecution(result.runId).catch(() => undefined);
        if (newDetail) {
          writeExecutionActivityEntry(store, result.runId, newDetail.execution.title, 'started', 'activity', {
            sourceRunId: sourceId,
            rerun: true,
          });
        }
      }
      invalidateAppTopics('executions', 'runs');
      res.json(result);
    } catch (err) {
      const rejection = formatExecutionActionRejection(err, 'rerun');
      if (rejection) {
        res.status(409).json({ error: rejection });
        return;
      }
      handleError(res, err);
    }
  });

  router.post('/api/executions/:id/follow-up', async (req, res) => {
    try {
      const sourceId = req.params.id;
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : undefined;
      const result = await followUpExecution(sourceId, prompt);
      if (!result.accepted) {
        res.status(409).json({ error: result.reason ?? 'Could not continue execution.' });
        return;
      }
      if (store) {
        const newDetail = await getExecution(result.runId).catch(() => undefined);
        if (newDetail) {
          writeExecutionActivityEntry(store, result.runId, newDetail.execution.title, 'started', 'activity', {
            sourceRunId: sourceId,
            followUp: true,
          });
        }
      }
      invalidateAppTopics('executions', 'runs');
      res.json(result);
    } catch (err) {
      const rejection = formatExecutionActionRejection(err, 'follow-up');
      if (rejection) {
        res.status(409).json({ error: rejection });
        return;
      }
      handleError(res, err);
    }
  });
}
