import { describe, expect, it, vi } from 'vitest';

import { astGrep } from './backend';

function createCtx(exec: ReturnType<typeof vi.fn>, cwd = '/workspace/project') {
  return {
    cwd,
    shell: { exec },
  } as never;
}

describe('system-ast-grep backend', () => {
  it('returns an actionable setup message when ast-grep is not installed', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await expect(astGrep({ pattern: 'console.log($$$)' }, createCtx(exec))).resolves.toMatchObject({
      isError: true,
      details: { missingBinary: true },
      content: [{ type: 'text', text: expect.stringContaining('brew install ast-grep') }],
    });
    expect(exec).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'sh', args: ['-lc', 'command -v sg || command -v ast-grep || true'] }),
    );
  });

  it('returns setup guidance when the host shell throws during binary discovery', async () => {
    const exec = vi.fn().mockRejectedValue(Object.assign(new Error('Command failed with exit code 1.'), { stdout: '', stderr: '' }));

    await expect(astGrep({ pattern: 'console.log($$$)' }, createCtx(exec))).resolves.toMatchObject({
      isError: true,
      details: { missingBinary: true },
      content: [{ type: 'text', text: expect.stringContaining('ast_grep requires the ast-grep CLI') }],
    });
  });

  it('uses binary stdout when the host shell throws after finding a binary', async () => {
    const exec = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Command failed with exit code 1.'), { stdout: '/usr/local/bin/sg\n', stderr: '' }))
      .mockResolvedValueOnce({ stdout: '[]', stderr: '', exitCode: 0 });

    const result = await astGrep({ pattern: 'console.log($$$)' }, createCtx(exec));

    expect(result.details).toEqual({ matchCount: 0, paths: ['.'] });
    expect(exec).toHaveBeenLastCalledWith(expect.objectContaining({ command: '/usr/local/bin/sg' }));
  });

  it('returns user-facing diagnostics for search paths outside the active workspace', async () => {
    const exec = vi.fn();

    await expect(astGrep({ pattern: 'console.log($$$)', paths: ['../outside'] }, createCtx(exec))).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: expect.stringContaining('Invalid search path outside workspace') }],
      details: { invalidPath: true },
    });
    expect(exec).not.toHaveBeenCalled();
  });

  it('formats compact JSON matches and reports truncation details', async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '/opt/homebrew/bin/sg\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            file: 'src/app.ts',
            lines: 'console.log(value);',
            range: { start: { line: 7, column: 3 } },
            metaVariables: {
              single: {
                VALUE: {
                  text: 'value',
                  range: { start: { line: 7, column: 15 } },
                },
              },
              multi: {},
              transformed: {},
            },
          },
          {
            file: 'src/other.ts',
            text: 'console.log(other);',
            range: { start: { line: 2, column: 1 } },
          },
        ]),
        stderr: '',
        exitCode: 0,
      });

    const result = await astGrep(
      { pattern: 'console.log($VALUE)', paths: ['src'], lang: 'typescript', glob: '**/*.ts', limit: 1 },
      createCtx(exec),
    );

    expect(result.content[0]?.text).toContain('Found 2 structural matches (showing first 1).');
    expect(result.content[0]?.text).toContain('src/app.ts:7:3');
    expect(result.content[0]?.text).toContain('meta: single.VALUE=value');
    expect(result.content[0]?.text).not.toContain('[object Object]');
    expect(result.content[0]?.text).not.toContain('src/other.ts');
    expect(result.details).toEqual(
      expect.objectContaining({
        matchCount: 2,
        shown: 1,
        truncated: true,
        paths: ['src'],
        files: ['src/app.ts', 'src/other.ts'],
      }),
    );
    expect(exec).toHaveBeenLastCalledWith(
      expect.objectContaining({
        command: '/opt/homebrew/bin/sg',
        args: [
          'run',
          '--json=compact',
          '--color',
          'never',
          '--pattern',
          'console.log($VALUE)',
          '--lang',
          'typescript',
          '--globs',
          '**/*.ts',
          'src',
        ],
        cwd: '/workspace/project',
      }),
    );
  });

  it('surfaces stderr diagnostics when no structural matches are found', async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/ast-grep\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'parsed 3 files', exitCode: 0 });

    await expect(astGrep({ pattern: 'useState($$$)' }, createCtx(exec))).resolves.toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('Diagnostics:\nparsed 3 files') }],
      details: { matchCount: 0, paths: ['.'] },
    });
  });

  it('treats ast-grep exit code 1 with no output as a no-match result', async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '/opt/homebrew/bin/sg\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });

    await expect(astGrep({ pattern: 'class DefinitelyMissing { $$$ }', paths: ['src'] }, createCtx(exec))).resolves.toMatchObject({
      content: [{ type: 'text', text: 'No structural matches found.' }],
      details: { matchCount: 0, paths: ['src'] },
    });
  });

  it('treats host-thrown ast-grep exit code 1 with empty matches as a no-match result', async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '/opt/homebrew/bin/sg\n', stderr: '', exitCode: 0 })
      .mockRejectedValueOnce(Object.assign(new Error('Command failed with exit code 1.'), { stdout: '[]', stderr: '' }));

    await expect(astGrep({ pattern: 'class DefinitelyMissing { $$$ }', paths: ['src'] }, createCtx(exec))).resolves.toMatchObject({
      content: [{ type: 'text', text: 'No structural matches found.' }],
      details: { matchCount: 0, paths: ['src'] },
    });
  });

  it('returns user-facing diagnostics for ast-grep failures without throwing a route wrapper', async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '/opt/homebrew/bin/sg\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'ERROR: src/missing: No such file or directory', exitCode: 1 });

    await expect(astGrep({ pattern: 'console.log($$$)', paths: ['src/missing'] }, createCtx(exec))).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: expect.stringContaining('ast-grep could not complete the search.') }],
      details: { exitCode: 1, paths: ['src/missing'] },
    });
  });

  it('returns user-facing diagnostics for host-thrown ast-grep failures', async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '/opt/homebrew/bin/sg\n', stderr: '', exitCode: 0 })
      .mockRejectedValueOnce(
        Object.assign(new Error('Command failed with exit code 1.'), {
          stdout: '',
          stderr: 'ERROR: src/missing: No such file or directory',
        }),
      );

    await expect(astGrep({ pattern: 'console.log($$$)', paths: ['src/missing'] }, createCtx(exec))).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: expect.stringContaining('ast-grep could not complete the search.') }],
      details: { exitCode: 1, paths: ['src/missing'] },
    });
  });
});
