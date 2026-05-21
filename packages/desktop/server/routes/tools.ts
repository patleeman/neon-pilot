import type { ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { inspectCliBinary, readPackageSourceTargetState } from '@neon-pilot/core';
import type { Express, Response } from 'express';

import { inspectAvailableTools } from '../conversations/liveSessions.js';
import { logError } from '../middleware/index.js';
import type { LiveSessionResourceOptions, ServerRouteContext } from './context.js';

let getRuntimeScopeFn: () => string = () => {
  throw new Error('getRuntimeScope not initialized for tools routes');
};

let getRepoRootFn: () => string = () => {
  throw new Error('getRepoRoot not initialized for tools routes');
};

let buildLiveSessionResourceOptionsFn: (profile: string) => LiveSessionResourceOptions = () => {
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

function buildPackageInstallState() {
  return {
    localTarget: readPackageSourceTargetState('local', { repoRoot: getRepoRootFn() }),
  };
}

async function handleToolsRequest(_req: unknown, res: Response): Promise<void> {
  try {
    const runtimeName = getRuntimeScopeFn();
    const resourceOptions = buildLiveSessionResourceOptionsFn(runtimeName);
    const details = await withTemporaryRuntimeAgentDirFn(runtimeName, (agentDir) =>
      inspectAvailableTools(getRepoRootFn(), {
        ...resourceOptions,
        agentDir,
        extensionFactories: buildLiveSessionExtensionFactoriesFn(),
      }),
    );
    const onePasswordCommand = process.env.NEON_PILOT_OP_BIN?.trim() || 'op';
    const dependentCliTools = [
      {
        id: '1password-cli',
        name: '1Password CLI',
        description: 'Resolves op:// secret references used by Neon Pilot features and extensions.',
        configuredBy: 'NEON_PILOT_OP_BIN',
        usedBy: ['op:// secret references', 'web-tools extension'],
        binary: inspectCliBinary({ command: onePasswordCommand, cwd: getRepoRootFn() }),
      },
    ];

    res.json({
      ...details,
      dependentCliTools,
      packageInstall: buildPackageInstallState(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('request handler error', {
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(500).json({ error: message });
  }
}

export function registerToolsRoutes(
  app: Pick<Express, 'get'>,
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
}
