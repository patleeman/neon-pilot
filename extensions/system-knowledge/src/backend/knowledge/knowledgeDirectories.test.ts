import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { provideKnowledgeInstructions } from '../../backend';
import { eventsRoute, listFiles, resolvePromptReferences, search, writeFile } from './files';
import { readKnowledgeState, updateKnowledgeState } from './state';

describe('knowledge directories', () => {
  const root = join(tmpdir(), `neon-knowledge-directories-test-${process.pid}`);
  const runtimeDir = join(root, 'runtime');
  const first = join(root, 'first');
  const second = join(root, 'second');
  const storage = new Map<string, unknown>();

  const ctx = {
    runtimeDir,
    runtimeSettingsFilePath: join(root, 'runtime-settings.json'),
    storage: {
      get: vi.fn(async (key: string) => storage.get(key)),
      put: vi.fn(async (key: string, value: unknown) => {
        storage.set(key, value);
      }),
    },
    ui: { invalidate: vi.fn() },
  } as unknown as ExtensionBackendContext;

  beforeEach(async () => {
    storage.clear();
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(first, 'notes'), { recursive: true });
    mkdirSync(join(second, 'refs'), { recursive: true });
    writeFileSync(join(first, 'notes', 'alpha.md'), '# Alpha\n\nFirst knowledge path.', 'utf-8');
    writeFileSync(join(second, 'refs', 'beta.md'), '# Beta\n\nSecond knowledge path needle.', 'utf-8');
    await updateKnowledgeState({ repoUrl: '', branch: 'main', directories: [first, second] }, ctx);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('stores multiple local knowledge directories in state', async () => {
    await expect(readKnowledgeState(ctx)).resolves.toMatchObject({
      configured: false,
      directories: [first, second],
      effectiveRoots: [first, second],
      effectiveRoot: first,
    });
  });

  it('lists and searches files across all knowledge directories', async () => {
    await expect(listFiles({}, ctx)).resolves.toMatchObject({
      root: first,
      roots: [
        { id: 'knowledge', path: first },
        { id: 'knowledge-2', path: second },
      ],
      files: expect.arrayContaining([
        expect.objectContaining({ id: 'notes/alpha.md', rootId: 'knowledge', path: 'notes/alpha.md' }),
        expect.objectContaining({ id: 'knowledge-2:refs/beta.md', rootId: 'knowledge-2', path: 'refs/beta.md' }),
      ]),
    });

    await expect(search({ q: 'needle' }, ctx)).resolves.toMatchObject({
      results: [expect.objectContaining({ id: 'knowledge-2:refs/beta.md', name: 'beta.md' })],
    });
  });

  it('resolves @ file mentions against qualified knowledge directory ids', async () => {
    await expect(resolvePromptReferences({ text: 'Read @knowledge-2:refs/beta.md please.' }, ctx)).resolves.toMatchObject({
      contextBlocks: [expect.objectContaining({ content: expect.stringContaining('Second knowledge path needle.') })],
      references: [expect.objectContaining({ kind: 'knowledgeFile', id: 'knowledge-2:refs/beta.md', path: 'knowledge-2:refs/beta.md' })],
    });
  });

  it('keeps secondary directory ids qualified after writes', async () => {
    await expect(writeFile({ id: 'knowledge-2:refs/gamma.md', content: '# Gamma' }, ctx)).resolves.toMatchObject({
      id: 'knowledge-2:refs/gamma.md',
      rootId: 'knowledge-2',
      path: 'refs/gamma.md',
    });
  });

  it('provides agent-visible knowledge paths as an instruction layer', async () => {
    await expect(provideKnowledgeInstructions({}, ctx)).resolves.toMatchObject({
      layers: [
        expect.objectContaining({
          id: 'system-knowledge:knowledge-paths',
          content: expect.stringContaining(`Primary: ${first}`),
        }),
      ],
    });
    const result = (await provideKnowledgeInstructions({}, ctx)) as { layers: Array<{ content: string }> };
    expect(result.layers[0]?.content).toContain(`Additional 1: ${second}`);
  });

  it('announces all knowledge roots on the file event stream', async () => {
    const controller = new AbortController();
    const response = await eventsRoute({ query: {}, signal: controller.signal } as never, ctx);
    const iterator = response.events?.[Symbol.asyncIterator]();
    await expect(iterator?.next()).resolves.toEqual({
      done: false,
      value: {
        data: {
          type: 'ready',
          root: first,
          roots: [
            { id: 'knowledge', path: first },
            { id: 'knowledge-2', path: second },
          ],
        },
      },
    });
    controller.abort();
  });
});
