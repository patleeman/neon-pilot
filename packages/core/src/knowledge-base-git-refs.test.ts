import { describe, expect, it } from 'vitest';

import {
  getKnowledgeBaseRemoteRef,
  knowledgeBaseHeadExists,
  knowledgeBaseRefExists,
  readKnowledgeBaseRemoteFileBuffer,
  readKnowledgeBaseRemotePathTimestampMs,
} from './knowledge-base-git-refs';

describe('knowledge-base-git-refs', () => {
  it('builds remote refs and checks ref/head existence through git output', () => {
    expect(getKnowledgeBaseRemoteRef('docs')).toBe('refs/remotes/origin/docs');
    expect(knowledgeBaseRefExists(() => 'abc refs/remotes/origin/main\n', '/repo', 'refs/remotes/origin/main')).toBe(true);
    expect(knowledgeBaseRefExists(() => '', '/repo', 'refs/remotes/origin/main')).toBe(false);
    expect(knowledgeBaseHeadExists(() => 'abc\n', '/repo')).toBe(true);
    expect(knowledgeBaseHeadExists(() => '', '/repo')).toBe(false);
  });

  it('reads remote file buffers only when the remote ref exists', () => {
    const calls: string[][] = [];
    const runGitText = (_cwd: string, args: string[]) => {
      calls.push(args);
      return 'ref';
    };
    const runGitBuffer = (_cwd: string, args: string[]) => {
      calls.push(args);
      return Buffer.from('hello');
    };

    expect(
      readKnowledgeBaseRemoteFileBuffer({ runGitText, runGitBuffer, cwd: '/repo', branch: 'main', relativePath: 'a.md' })?.toString(),
    ).toBe('hello');
    expect(calls).toEqual([
      ['show-ref', '--verify', 'refs/remotes/origin/main'],
      ['show', 'refs/remotes/origin/main:a.md'],
    ]);
    expect(
      readKnowledgeBaseRemoteFileBuffer({
        runGitText: () => '',
        runGitBuffer,
        cwd: '/repo',
        branch: 'missing',
        relativePath: 'a.md',
      }),
    ).toBeNull();
  });

  it('reads latest remote timestamps for existing and deleted paths', () => {
    const calls: string[][] = [];
    const runGitText = (_cwd: string, args: string[]) => {
      calls.push(args);
      return '123\n';
    };

    expect(
      readKnowledgeBaseRemotePathTimestampMs({ runGitText, cwd: '/repo', branch: 'main', relativePath: 'a.md', existsInRemote: true }),
    ).toBe(123000);
    expect(
      readKnowledgeBaseRemotePathTimestampMs({ runGitText, cwd: '/repo', branch: 'main', relativePath: 'b.md', existsInRemote: false }),
    ).toBe(123000);
    expect(calls).toEqual([
      ['log', '-1', '--format=%ct', 'refs/remotes/origin/main', '--', 'a.md'],
      ['log', '-1', '--diff-filter=D', '--format=%ct', 'refs/remotes/origin/main', '--', 'b.md'],
    ]);
    expect(
      readKnowledgeBaseRemotePathTimestampMs({
        runGitText: () => 'not-a-number',
        cwd: '/repo',
        branch: 'main',
        relativePath: 'c.md',
        existsInRemote: true,
      }),
    ).toBe(0);
  });
});
