import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  countGitStatusEntries,
  parseGitNumstat,
  parseGitStatusBranch,
  parseGitStatusChanges,
  readGitRepoInfo,
  readGitStatusSummary,
  readGitStatusSummaryWithTelemetry,
} from './gitStatus.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runGit(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('parseGitNumstat', () => {
  it('sums added and deleted lines and ignores binary markers', () => {
    expect(parseGitNumstat(['2\t1\ttracked.txt', '-\t-\tbinary.dat', '5\t0\tnested/file.ts'].join('\n'))).toEqual({
      linesAdded: 7,
      linesDeleted: 1,
    });
  });

  it('ignores malformed and unsafe numstat counts', () => {
    expect(
      parseGitNumstat(['2abc\t1\tpartial.txt', `${Number.MAX_SAFE_INTEGER + 1}\t3\tunsafe.txt`, '4\t5\tvalid.txt'].join('\n')),
    ).toEqual({
      linesAdded: 4,
      linesDeleted: 9,
    });
  });
});

describe('countGitStatusEntries', () => {
  it('counts non-empty porcelain lines', () => {
    expect(countGitStatusEntries(' M tracked.txt\nMM staged-and-unstaged.ts\n?? new-file.txt\n')).toBe(3);
  });
});

describe('parseGitStatusBranch', () => {
  it('keeps detached HEAD visible for the composer git indicator', () => {
    expect(parseGitStatusBranch('## HEAD (no branch)\n M tracked.txt\n')).toBe('detached HEAD');
  });
});

describe('parseGitStatusChanges', () => {
  it('normalizes rename, copy, and add/delete conflict porcelain statuses', () => {
    expect(
      parseGitStatusChanges(
        [
          '## main',
          'AA conflict-added.txt',
          'DD conflict-deleted.txt',
          'C  source.txt -> copied.txt',
          'R  old-name.txt -> new-name.txt',
        ].join('\n'),
      ),
    ).toEqual([
      { relativePath: 'conflict-added.txt', change: 'conflicted' },
      { relativePath: 'conflict-deleted.txt', change: 'conflicted' },
      { relativePath: 'copied.txt', change: 'copied' },
      { relativePath: 'new-name.txt', change: 'renamed' },
    ]);
  });
});

describe('readGitStatusSummary', () => {
  it('returns null outside a git repository', () => {
    const dir = createTempDir('neon-pilot-web-git-outside-');
    expect(readGitRepoInfo(dir)).toBeNull();
    expect(readGitStatusSummary(dir)).toBeNull();
  });

  it('reads the containing git repo root and basename', () => {
    const dir = createTempDir('neon-pilot-web-git-repo-info-');
    runGit(['init'], dir);

    const nestedRoot = join(dir, 'nested');
    const nested = join(nestedRoot, 'deeper');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(dir, 'tracked.txt'), 'one\n');
    runGit(['add', '.'], dir);
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], dir);
    writeFileSync(join(nestedRoot, '.keep'), '');
    runGit(['add', '.'], dir);
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'nested'], dir);

    expect(readGitRepoInfo(nested)).toEqual(
      expect.objectContaining({
        root: expect.stringContaining(`/neon-pilot-web-git-repo-info-`),
        name: expect.stringContaining('neon-pilot-web-git-repo-info-'),
      }),
    );
  });

  it('reports cache telemetry for repeated git status reads', () => {
    const dir = createTempDir('neon-pilot-web-git-repo-cache-');
    runGit(['init'], dir);

    writeFileSync(join(dir, 'tracked.txt'), 'one\n');
    runGit(['add', '.'], dir);
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], dir);

    writeFileSync(join(dir, 'tracked.txt'), 'one\ntwo\n');

    const firstRead = readGitStatusSummaryWithTelemetry(dir);
    expect(firstRead.summary).toMatchObject({
      changeCount: 1,
      linesAdded: 1,
      linesDeleted: 0,
      changes: [{ relativePath: 'tracked.txt', change: 'modified' }],
    });
    expect(firstRead.telemetry).toMatchObject({
      cache: 'miss',
      hasRepo: true,
    });
    expect(firstRead.telemetry.durationMs).toBeGreaterThanOrEqual(0);

    const secondRead = readGitStatusSummaryWithTelemetry(dir);
    expect(secondRead.summary).toEqual(firstRead.summary);
    expect(secondRead.telemetry).toMatchObject({
      cache: 'hit',
      hasRepo: true,
    });
    expect(secondRead.telemetry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('shares cached git status across different cwd values in the same repo', () => {
    const dir = createTempDir('neon-pilot-web-git-repo-shared-cache-');
    runGit(['init'], dir);

    const nested = join(dir, 'packages', 'web');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(dir, 'tracked.txt'), 'one\n');
    runGit(['add', '.'], dir);
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], dir);

    writeFileSync(join(dir, 'tracked.txt'), 'one\ntwo\n');

    const firstRead = readGitStatusSummaryWithTelemetry(dir);
    expect(firstRead.telemetry).toMatchObject({
      cache: 'miss',
      hasRepo: true,
    });

    const secondRead = readGitStatusSummaryWithTelemetry(nested);
    expect(secondRead.summary).toEqual(firstRead.summary);
    expect(secondRead.telemetry).toMatchObject({
      cache: 'hit',
      hasRepo: true,
    });
  });

  it('summarizes staged, unstaged, and untracked changes', () => {
    const dir = createTempDir('neon-pilot-web-git-repo-');
    runGit(['init'], dir);

    writeFileSync(join(dir, 'tracked.txt'), 'one\n');
    writeFileSync(join(dir, 'deleted.txt'), 'alpha\nbeta\n');
    runGit(['add', '.'], dir);
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], dir);

    writeFileSync(join(dir, 'tracked.txt'), 'one\ntwo\n');
    runGit(['add', 'tracked.txt'], dir);
    writeFileSync(join(dir, 'tracked.txt'), 'one\ntwo\nthree\n');
    writeFileSync(join(dir, 'deleted.txt'), 'alpha\n');
    writeFileSync(join(dir, 'untracked.txt'), 'draft\nnotes\n');

    const summary = readGitStatusSummary(dir);

    expect(summary).not.toBeNull();
    expect(summary).toMatchObject({
      changeCount: 3,
      linesAdded: 4,
      linesDeleted: 1,
      changes: expect.arrayContaining([
        { relativePath: 'deleted.txt', change: 'modified' },
        { relativePath: 'tracked.txt', change: 'modified' },
        { relativePath: 'untracked.txt', change: 'untracked' },
      ]),
    });
    expect(summary?.branch).toEqual(expect.any(String));
  });

  it('reports detached HEAD as a visible branch label', () => {
    const dir = createTempDir('neon-pilot-web-git-detached-');
    runGit(['init'], dir);

    writeFileSync(join(dir, 'tracked.txt'), 'one\n');
    runGit(['add', '.'], dir);
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], dir);
    runGit(['checkout', '--detach', 'HEAD'], dir);
    writeFileSync(join(dir, 'tracked.txt'), 'one\ntwo\n');

    const summary = readGitStatusSummary(dir);

    expect(summary).toMatchObject({
      branch: 'detached HEAD',
      changeCount: 1,
      linesAdded: 1,
      linesDeleted: 0,
    });
  });

  it('summarizes real conflicted merge entries without raw git error output', () => {
    const dir = createTempDir('neon-pilot-web-git-conflict-');
    runGit(['init', '-b', 'main'], dir);

    writeFileSync(join(dir, 'tracked.txt'), 'base\n');
    runGit(['add', '.'], dir);
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], dir);
    runGit(['checkout', '-b', 'other'], dir);
    writeFileSync(join(dir, 'tracked.txt'), 'other\n');
    runGit(['add', '.'], dir);
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'other'], dir);
    runGit(['checkout', 'main'], dir);
    writeFileSync(join(dir, 'tracked.txt'), 'main\n');
    runGit(['add', '.'], dir);
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'main'], dir);

    expect(() => runGit(['merge', 'other'], dir)).toThrow();

    const summary = readGitStatusSummary(dir);

    expect(summary).toMatchObject({
      branch: 'main',
      changeCount: 1,
      changes: [{ relativePath: 'tracked.txt', change: 'conflicted' }],
    });
    expect(JSON.stringify(summary)).not.toContain('CONFLICT');
    expect(JSON.stringify(summary)).not.toContain('Automatic merge failed');
  });
});
