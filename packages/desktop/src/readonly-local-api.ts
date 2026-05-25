import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { type DesktopLocalApiDispatchResult, resolveLocalApiModuleUrl } from './local-api-module.js';

const WORKER_SAFE_LOCAL_API_ROUTES: Array<{
  methods: ReadonlySet<string>;
  pattern: RegExp;
}> = [
  { methods: new Set(['POST']), pattern: /^\/api\/sessions\/search$/ },
  { methods: new Set(['GET']), pattern: /^\/api\/skill-folders$/ },
  { methods: new Set(['GET']), pattern: /^\/api\/instructions$/ },
  { methods: new Set(['GET']), pattern: /^\/api\/settings$/ },
  { methods: new Set(['GET']), pattern: /^\/api\/settings\/schema$/ },
  { methods: new Set(['GET']), pattern: /^\/api\/tools$/ },
  { methods: new Set(['GET']), pattern: /^\/api\/workspace\/tree$/ },
  { methods: new Set(['GET']), pattern: /^\/api\/workspace\/file$/ },
  { methods: new Set(['GET']), pattern: /^\/api\/workspace\/diff$/ },
  { methods: new Set(['GET']), pattern: /^\/api\/workspace\/uncommitted-diff$/ },
];

interface ReadonlyLocalApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ReadonlyLocalApiWorkerRequest {
  id: number;
  input: ReadonlyLocalApiRequest;
}

interface ReadonlyLocalApiWorkerSuccess {
  id: number;
  ok: true;
  result: DesktopLocalApiDispatchResult;
}

interface ReadonlyLocalApiWorkerFailure {
  id: number;
  ok: false;
  error: string;
}

function renderWorkerExitError(code: number | null): Error {
  return new Error(`Readonly local API worker exited unexpectedly${code === null ? '' : ` (code ${code})`}.`);
}

function createReadonlyLocalApiWorker(): Worker {
  return new Worker(new URL('./readonly-local-api-worker.js', import.meta.url));
}

function matchesWorkerSafeLocalApiRoute(input: { method: string; pathname: string }): boolean {
  return WORKER_SAFE_LOCAL_API_ROUTES.some((route) => route.methods.has(input.method) && route.pattern.test(input.pathname));
}

function canLoadReadonlyLocalApiWorkerModule(): boolean {
  try {
    return existsSync(fileURLToPath(resolveLocalApiModuleUrl()));
  } catch {
    return false;
  }
}

export function shouldDispatchReadonlyLocalApiInWorker(input: {
  method: string;
  path: string;
  hostId?: string | null;
  readonlyLocalApiWorkerAvailable?: boolean;
}): boolean {
  if (input.hostId && input.hostId !== 'local') {
    return false;
  }

  if (!(input.readonlyLocalApiWorkerAvailable ?? canLoadReadonlyLocalApiWorkerModule())) {
    return false;
  }

  const pathname = new URL(input.path, 'http://desktop.local').pathname;
  return matchesWorkerSafeLocalApiRoute({
    method: input.method.toUpperCase(),
    pathname,
  });
}

class ReadonlyLocalApiWorkerClient {
  private worker: Worker | null = null;
  private nextRequestId = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: DesktopLocalApiDispatchResult) => void;
      reject: (error: Error) => void;
    }
  >();

  async dispatch(input: ReadonlyLocalApiRequest): Promise<DesktopLocalApiDispatchResult> {
    const worker = this.ensureWorker();

    return new Promise<DesktopLocalApiDispatchResult>((resolve, reject) => {
      const id = this.nextRequestId + 1;
      this.nextRequestId = id;
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, input } satisfies ReadonlyLocalApiWorkerRequest);
    });
  }

  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker;
    }

    const worker = createReadonlyLocalApiWorker();
    worker.on('message', (message: ReadonlyLocalApiWorkerSuccess | ReadonlyLocalApiWorkerFailure) => {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      if (message.ok) {
        pending.resolve(message.result);
        return;
      }

      pending.reject(new Error(message.error));
    });
    worker.on('error', (error) => {
      this.failPending(error instanceof Error ? error : new Error(String(error)));
      this.disposeWorker(worker);
    });
    worker.on('exit', (code) => {
      if (code === 0) {
        this.disposeWorker(worker);
        return;
      }

      this.failPending(renderWorkerExitError(code));
      this.disposeWorker(worker);
    });
    this.worker = worker;
    return worker;
  }

  private failPending(error: Error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private disposeWorker(worker: Worker) {
    if (this.worker === worker) {
      this.worker = null;
    }
  }
}

let readonlyLocalApiWorkerClient: ReadonlyLocalApiWorkerClient | null = null;

export function dispatchReadonlyLocalApiRequest(input: ReadonlyLocalApiRequest): Promise<DesktopLocalApiDispatchResult> {
  if (!readonlyLocalApiWorkerClient) {
    readonlyLocalApiWorkerClient = new ReadonlyLocalApiWorkerClient();
  }

  return readonlyLocalApiWorkerClient.dispatch(input);
}
