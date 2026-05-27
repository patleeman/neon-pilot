import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMemoryDoc, filterMemoryDocs, lintMemoryDocs, loadMemoryDocs, loadMemoryPackageReferences } from './memory-store.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const knowledgeRoot = join(root, 'sync');
  mkdirSync(knowledgeRoot, { recursive: true });
  tempDirs.push(root);
  return knowledgeRoot;
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

function memoryPath(knowledgeRoot: string, memoryId: string): string {
  return join(knowledgeRoot, 'notes', memoryId, 'INDEX.md');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('memory store organization metadata', () => {
  it('parses note nodes from sync/notes and tracks package-local references', () => {
    const knowledgeRoot = createTempDir('neon-pilot-memory-store-');

    writeFile(
      memoryPath(knowledgeRoot, 'neon-pilot'),
      `---
id: neon-pilot
kind: note
title: Personal-agent
summary: Hub doc.
description: Tell the agent to use this note for durable neon-pilot architecture guidance.
status: active
links:
  related:
    - runpod
updatedAt: 2026-03-18
tags:
  - area:neon-pilot
  - role:structure
  - noteType:project
  - status:active
  - type:note
---
# Personal-agent

Hub doc.
`,
    );

    writeFile(
      join(knowledgeRoot, 'notes', 'neon-pilot', 'references', 'desktop-ui.md'),
      `---
name: desktop-ui
description: Durable UI notes.
metadata:
  title: Desktop UI preferences
  updated: 2026-03-18
---
# Desktop UI preferences

Keep the right rail visible and resizable.
`,
    );

    writeFile(
      join(knowledgeRoot, 'notes', 'neon-pilot', 'references', 'state-model.md'),
      `# Project state model

Keep planning state durable.
`,
    );

    const loaded = loadMemoryDocs({ knowledgeRoot });
    expect(loaded.parseErrors).toHaveLength(0);
    expect(loaded.docs.map((doc) => doc.id)).toEqual(['neon-pilot']);

    const hub = loaded.docs[0];
    expect(hub).toMatchObject({
      area: 'neon-pilot',
      role: 'structure',
      related: ['runpod'],
      title: 'Personal-agent',
      summary: 'Hub doc.',
      description: 'Tell the agent to use this note for durable neon-pilot architecture guidance.',
    });
    expect(hub?.referencePaths).toHaveLength(2);

    const references = loadMemoryPackageReferences(join(knowledgeRoot, 'notes', 'neon-pilot'));
    expect(references.map((reference) => reference.title)).toEqual(['desktop-ui', 'Project state model']);
    expect(references[0]).toMatchObject({
      relativePath: 'references/desktop-ui.md',
      summary: 'Durable UI notes.',
    });

    const filtered = filterMemoryDocs(loaded.docs, {
      area: 'neon-pilot',
      text: 'neon-pilot',
    });
    expect(filtered.map((doc) => doc.id)).toEqual(['neon-pilot']);
  });

  it('creates note nodes in sync/notes', () => {
    const knowledgeRoot = createTempDir('neon-pilot-memory-create-');

    const created = createMemoryDoc(
      {
        id: 'memory-index',
        title: 'Memory index',
        summary: 'Top-level memory hub.',
        description: 'Tell the agent to use this as the top-level routing note for shared memory.',
        type: 'index',
        status: 'active',
        area: 'notes',
        role: 'hub',
        related: ['neon-pilot'],
      },
      { knowledgeRoot },
    );

    expect(created).toMatchObject({
      id: 'memory-index',
      area: 'notes',
      role: 'structure',
      overwritten: false,
    });

    const fileContent = readFileSync(created.filePath, 'utf-8');
    expect(created.filePath).toBe(join(knowledgeRoot, 'notes', 'memory-index.md'));
    expect(fileContent).toContain('id: memory-index');
    expect(fileContent).toContain('type:note');
    expect(fileContent).toContain('summary: Top-level memory hub.');
    expect(fileContent).toContain('description: Tell the agent to use this as the top-level routing note for shared memory.');
    expect(fileContent).toContain('title: Memory index');
    expect(fileContent).toContain('area:notes');
    expect(fileContent).toContain('structure');
    expect(fileContent).toContain('links:');
    expect(fileContent).toContain('related:');
    expect(fileContent).toContain('- neon-pilot');
  });

  it('ignores project child markdown when listing top-level notes', () => {
    const knowledgeRoot = createTempDir('neon-pilot-memory-scope-');

    writeFile(
      join(knowledgeRoot, 'notes', 'top-level.md'),
      `---
id: top-level
title: Top-level note
summary: Canonical note.
status: active
updatedAt: 2026-03-31
tags:
  - noteType:note
  - status:active
  - type:note
---
# Top-level note
`,
    );

    writeFile(
      join(knowledgeRoot, 'projects', 'ship-it', 'project.md'),
      `---
id: ship-it
kind: project
title: Ship It
summary: Ship the feature.
status: active
createdAt: 2026-04-01T00:00:00.000Z
updatedAt: 2026-04-01T01:00:00.000Z
---
# Ship It
`,
    );

    writeFile(
      join(knowledgeRoot, 'projects', 'ship-it', 'notes', 'scratch.md'),
      `---
id: ship-it-scratch
title: Scratch note
summary: Project-local scratch file.
status: active
updatedAt: 2026-03-31
tags:
  - noteType:note
  - status:active
  - type:note
---
# Scratch note
`,
    );

    const loaded = loadMemoryDocs({ knowledgeRoot });
    expect(loaded.docs.map((doc) => doc.id)).toEqual(['top-level']);
  });

  it('ignores legacy runtime notes outside the knowledge base on load', () => {
    const knowledgeRoot = createTempDir('neon-pilot-memory-runtime-');
    const runtimeNotePath = join(knowledgeRoot, '..', 'neon-pilot-runtime', 'notes', 'desktop.md');

    writeFile(
      runtimeNotePath,
      `---
id: desktop
title: Desktop Notes
summary: Desktop box facts.
type: note
status: active
updatedAt: 2026-03-31
---
# Desktop Notes
`,
    );

    const loaded = loadMemoryDocs({ knowledgeRoot });
    expect(loaded.docs.map((doc) => doc.id)).not.toContain('desktop');
    expect(existsSync(runtimeNotePath)).toBe(true);
    expect(existsSync(join(knowledgeRoot, 'notes', 'desktop.md'))).toBe(false);
  });

  it('reports broken related references during lint', () => {
    const knowledgeRoot = createTempDir('neon-pilot-memory-lint-');

    writeFile(
      memoryPath(knowledgeRoot, 'runpod'),
      `---
id: runpod
kind: note
title: Runpod
summary: Runpod hub.
status: active
links:
  related:
    - missing-hub
    - runpod
updatedAt: 2026-03-18
tags:
  - noteType:note
  - status:active
  - type:note
---
# Runpod

Broken related references.
`,
    );

    const result = lintMemoryDocs({ knowledgeRoot });
    expect(result.parseErrors).toEqual([]);
    expect(result.duplicateIds).toHaveLength(0);
    expect(result.referenceErrors).toEqual([
      expect.objectContaining({
        id: 'runpod',
        field: 'related',
        targetId: 'missing-hub',
      }),
      expect.objectContaining({
        id: 'runpod',
        field: 'related',
        targetId: 'runpod',
      }),
    ]);
  });
});
