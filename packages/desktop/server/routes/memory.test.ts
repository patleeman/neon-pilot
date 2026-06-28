import { beforeEach, describe, expect, it, vi } from 'vitest';

const memoryStore = vi.hoisted(() => ({
  createMemoryScope: vi.fn(),
  getMemoryState: vi.fn(),
  initializeMemory: vi.fn(),
  listMemoryFileHistory: vi.fn(),
  memoryScopeSlugForPath: vi.fn(() => 'workspace'),
  writeMemoryFile: vi.fn(),
}));

vi.mock('../memory/memoryStore.js', () => memoryStore);

import { registerMemoryRoutes } from './memory.js';

function createResponse() {
  return {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };
}

function createHarness() {
  const routes = new Map<string, (req: Record<string, unknown>, res: ReturnType<typeof createResponse>) => Promise<void> | void>();
  const router = {
    get: vi.fn((path: string, handler: (req: Record<string, unknown>, res: ReturnType<typeof createResponse>) => Promise<void> | void) => {
      routes.set(`GET ${path}`, handler);
    }),
    post: vi.fn((path: string, handler: (req: Record<string, unknown>, res: ReturnType<typeof createResponse>) => Promise<void> | void) => {
      routes.set(`POST ${path}`, handler);
    }),
    put: vi.fn((path: string, handler: (req: Record<string, unknown>, res: ReturnType<typeof createResponse>) => Promise<void> | void) => {
      routes.set(`PUT ${path}`, handler);
    }),
  };

  registerMemoryRoutes(
    router as never,
    {
      getDefaultWebCwd: () => '/workspace/default',
    } as never,
  );

  return routes;
}

describe('registerMemoryRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryStore.getMemoryState.mockResolvedValue({ initialized: true, root: '/memory' });
    memoryStore.initializeMemory.mockResolvedValue({ initialized: true, root: '/memory' });
    memoryStore.createMemoryScope.mockResolvedValue({ initialized: true, scopes: [{ slug: 'app' }] });
    memoryStore.writeMemoryFile.mockResolvedValue({ initialized: true });
    memoryStore.listMemoryFileHistory.mockResolvedValue([{ hash: 'abc' }]);
  });

  it('reads memory state for the requested cwd', async () => {
    const routes = createHarness();
    const res = createResponse();

    await routes.get('GET /api/memory')!({ query: { cwd: '/repo' } }, res);

    expect(memoryStore.getMemoryState).toHaveBeenCalledWith({ cwd: '/repo' });
    expect(res.json).toHaveBeenCalledWith({ initialized: true, root: '/memory' });
  });

  it('initializes memory with the default cwd when no cwd is supplied', async () => {
    const routes = createHarness();
    const res = createResponse();

    await routes.get('POST /api/memory/init')!({ body: {} }, res);

    expect(memoryStore.initializeMemory).toHaveBeenCalledWith({ cwd: '/workspace/default' });
    expect(res.json).toHaveBeenCalledWith({ initialized: true, root: '/memory' });
  });

  it('validates scope creation input', async () => {
    const routes = createHarness();
    const invalidRes = createResponse();

    await routes.get('POST /api/memory/scopes')!({ body: { roots: ['/repo'] } }, invalidRes);

    expect(invalidRes.status).toHaveBeenCalledWith(400);
    expect(invalidRes.json).toHaveBeenCalledWith({ error: 'Scope name is required.' });

    const res = createResponse();
    await routes.get('POST /api/memory/scopes')!({ body: { name: 'App', roots: ['/repo'], aliases: ['app'], inject: true } }, res);

    expect(memoryStore.createMemoryScope).toHaveBeenCalledWith({
      name: 'App',
      roots: ['/repo'],
      aliases: ['app'],
      inject: true,
      slug: undefined,
      type: undefined,
      reason: undefined,
    });
  });

  it('writes files and lists file history', async () => {
    const routes = createHarness();
    const writeRes = createResponse();
    const historyRes = createResponse();

    await routes.get('PUT /api/memory/file')!(
      { body: { relativePath: 'system.md', content: '# Memory', reason: 'Update memory' } },
      writeRes,
    );
    await routes.get('GET /api/memory/file/history')!({ query: { relativePath: 'system.md' } }, historyRes);

    expect(memoryStore.writeMemoryFile).toHaveBeenCalledWith({ relativePath: 'system.md', content: '# Memory', reason: 'Update memory' });
    expect(memoryStore.listMemoryFileHistory).toHaveBeenCalledWith('system.md');
    expect(historyRes.json).toHaveBeenCalledWith({ history: [{ hash: 'abc' }] });
  });
});
