import type { ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { inspectCliBinary, readPackageSourceTargetState } from '@neon-pilot/core';
import type { Express, Request, Response } from 'express';

import { inspectAvailableTools } from '../conversations/liveSessions.js';
import { logError } from '../middleware/index.js';
import { invokeToolByName } from '../tools/toolGateway.js';
import type { LiveSessionResourceOptions, ServerRouteContext } from './context.js';

let getRuntimeScopeFn: () => string = () => {
  throw new Error('getRuntimeScope not initialized for tools routes');
};

let getRepoRootFn: () => string = () => {
  throw new Error('getRepoRoot not initialized for tools routes');
};

let buildLiveSessionResourceOptionsFn: (profile?: string) => LiveSessionResourceOptions = () => {
  throw new Error('buildLiveSessionResourceOptions not initialized for tools routes');
};

let buildLiveSessionExtensionFactoriesFn: () => ExtensionFactory[] = () => {
  throw new Error('buildLiveSessionExtensionFactories not initialized for tools routes');
};

let withTemporaryRuntimeAgentDirFn: <T>(profile: string, run: (agentDir: string) => Promise<T>) => Promise<T> = async () => {
  throw new Error('withTemporaryRuntimeAgentDir not initialized for tools routes');
};

function initializeToolsRoutesContext(
  context: Pick<
    ServerRouteContext,
    | 'getRuntimeScope'
    | 'getRepoRoot'
    | 'buildLiveSessionResourceOptions'
    | 'buildLiveSessionExtensionFactories'
    | 'withTemporaryRuntimeAgentDir'
  >,
): void {
  getRuntimeScopeFn = context.getRuntimeScope;
  getRepoRootFn = context.getRepoRoot;
  buildLiveSessionResourceOptionsFn = context.buildLiveSessionResourceOptions;
  buildLiveSessionExtensionFactoriesFn = context.buildLiveSessionExtensionFactories;
  withTemporaryRuntimeAgentDirFn = context.withTemporaryRuntimeAgentDir;
}

export async function buildToolsRouteState(
  context: Pick<
    ServerRouteContext,
    | 'getRuntimeScope'
    | 'getRepoRoot'
    | 'buildLiveSessionResourceOptions'
    | 'buildLiveSessionExtensionFactories'
    | 'withTemporaryRuntimeAgentDir'
  >,
) {
  const runtimeName = context.getRuntimeScope();
  const resourceOptions = context.buildLiveSessionResourceOptions(runtimeName);
  const details = await context.withTemporaryRuntimeAgentDir(runtimeName, (agentDir) =>
    inspectAvailableTools(context.getRepoRoot(), {
      ...resourceOptions,
      agentDir,
      extensionFactories: context.buildLiveSessionExtensionFactories(),
    }),
  );
  const onePasswordCommand = process.env.NEON_PILOT_OP_BIN?.trim() || 'op';
  const repoRoot = context.getRepoRoot();
  const dependentCliTools = [
    {
      id: '1password-cli',
      name: '1Password CLI',
      description: 'Resolves op:// secret references used by Neon Pilot features and extensions.',
      configuredBy: 'NEON_PILOT_OP_BIN',
      usedBy: ['op:// secret references', 'web-tools extension'],
      binary: inspectCliBinary({ command: onePasswordCommand, cwd: repoRoot }),
    },
  ];

  return {
    ...details,
    dependentCliTools,
    packageInstall: {
      localTarget: readPackageSourceTargetState('local', { repoRoot }),
    },
  };
}

async function handleToolsRequest(_req: unknown, res: Response): Promise<void> {
  try {
    res.json(
      await buildToolsRouteState({
        getRuntimeScope: getRuntimeScopeFn,
        getRepoRoot: getRepoRootFn,
        buildLiveSessionResourceOptions: buildLiveSessionResourceOptionsFn,
        buildLiveSessionExtensionFactories: buildLiveSessionExtensionFactoriesFn,
        withTemporaryRuntimeAgentDir: withTemporaryRuntimeAgentDirFn,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('request handler error', {
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(500).json({ error: message });
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function handleToolInvokeRequest(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const name = readString(body.name);
    if (!name) {
      res.status(400).json({ error: 'Tool name is required.' });
      return;
    }

    const toolContextInput = body.toolContext && typeof body.toolContext === 'object' ? (body.toolContext as Record<string, unknown>) : {};
    const result = await invokeToolByName(
      {
        name,
        input: body.input,
        runtime: {
          runtimeScope: getRuntimeScopeFn(),
          repoRoot: getRepoRootFn(),
          ...(Array.isArray(body.directToolNames)
            ? { directToolNames: body.directToolNames.filter((item): item is string => typeof item === 'string') }
            : {}),
        },
        toolContext: {
          ...(readString(toolContextInput.conversationId) ? { conversationId: readString(toolContextInput.conversationId) } : {}),
          ...(readString(toolContextInput.sessionId) ? { sessionId: readString(toolContextInput.sessionId) } : {}),
          cwd: readString(toolContextInput.cwd) ?? getRepoRootFn(),
        },
      },
      { getRuntimeScope: getRuntimeScopeFn, getRepoRoot: getRepoRootFn },
    );
    res.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('tool invoke error', {
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    const status = /required|not available|unavailable/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
}

export function registerToolsRoutes(
  app: Pick<Express, 'get' | 'post'>,
  context: Pick<
    ServerRouteContext,
    | 'getRuntimeScope'
    | 'getRepoRoot'
    | 'buildLiveSessionResourceOptions'
    | 'buildLiveSessionExtensionFactories'
    | 'withTemporaryRuntimeAgentDir'
  >,
): void {
  initializeToolsRoutesContext(context);
  app.get('/api/tools', handleToolsRequest);
  app.post('/api/tools/invoke', handleToolInvokeRequest);
}
