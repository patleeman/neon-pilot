import { relative, resolve } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

type BackendContext = ExtensionBackendContext & { cwd?: string; toolContext?: { cwd?: string } };

interface AstGrepInput {
  pattern: string;
  paths?: string[];
  lang?: string;
  glob?: string;
  limit?: number;
}

interface AstGrepJsonMatch {
  text?: string;
  file?: string;
  lines?: string;
  language?: string;
  range?: {
    start?: { line?: number; column?: number };
    end?: { line?: number; column?: number };
  };
  metaVariables?: Record<string, string>;
}

function getCwd(ctx: BackendContext): string {
  return ctx.toolContext?.cwd ?? ctx.cwd ?? process.cwd();
}

function clampLimit(raw: unknown): number {
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value) || value < 1) return 50;
  return Math.min(Math.floor(value), 200);
}

function normalizeSearchPaths(cwd: string, paths: string[] | undefined): string[] {
  const values = Array.isArray(paths) && paths.length > 0 ? paths : ['.'];
  return values.map((rawPath) => {
    const absolute = resolve(cwd, rawPath.trim() || '.');
    const relativePath = relative(cwd, absolute).replace(/\\/g, '/');
    if (relativePath.startsWith('..')) throw new Error(`Invalid search path outside workspace: ${rawPath}`);
    return relativePath || '.';
  });
}

function parseMatches(stdout: string): AstGrepJsonMatch[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed as AstGrepJsonMatch[];
  } catch {
    // Some ast-grep versions may stream JSON objects. Fall through to line parse.
  }
  const matches: AstGrepJsonMatch[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const candidate = line.trim();
    if (!candidate) continue;
    try {
      matches.push(JSON.parse(candidate) as AstGrepJsonMatch);
    } catch {
      // Ignore non-JSON diagnostics here; stderr is surfaced separately by the caller.
    }
  }
  return matches;
}

function formatMatch(match: AstGrepJsonMatch): string {
  const file = match.file ?? '(unknown file)';
  const startLine = match.range?.start?.line ?? 0;
  const startColumn = match.range?.start?.column ?? 0;
  const location = startLine > 0 ? `${file}:${startLine}:${startColumn}` : file;
  const body = (match.lines ?? match.text ?? '').trimEnd();
  const meta =
    match.metaVariables && Object.keys(match.metaVariables).length > 0
      ? `\n  meta: ${Object.entries(match.metaVariables)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')}`
      : '';
  return `${location}\n${body}${meta}`;
}

export async function astGrep(input: AstGrepInput, ctx: BackendContext) {
  const cwd = getCwd(ctx);
  const pattern = input.pattern?.trim();
  if (!pattern) throw new Error('pattern is required.');
  const limit = clampLimit(input.limit);
  const paths = normalizeSearchPaths(cwd, input.paths);

  const hasSg = await ctx.shell.exec({ command: 'sh', args: ['-lc', 'command -v sg || command -v ast-grep'], cwd });
  const binary = `${hasSg.stdout ?? ''}`.trim().split(/\r?\n/)[0];
  if (!binary) {
    return {
      content: [
        {
          type: 'text',
          text: 'ast_grep requires the ast-grep CLI (`sg`). Install it with `brew install ast-grep` or see https://ast-grep.github.io/guide/quick-start.html.',
        },
      ],
      isError: true,
      details: { missingBinary: true },
    };
  }

  const args = ['run', '--json=compact', '--color', 'never', '--pattern', pattern];
  if (input.lang?.trim()) args.push('--lang', input.lang.trim());
  if (input.glob?.trim()) args.push('--globs', input.glob.trim());
  args.push(...paths);

  const result = await ctx.shell.exec({ command: binary, args, cwd, maxBuffer: 16 * 1024 * 1024 });
  const stdout = `${result.stdout ?? ''}`;
  const stderr = `${result.stderr ?? ''}`.trim();
  const matches = parseMatches(stdout);
  const visible = matches.slice(0, limit);
  const truncated = matches.length > visible.length;

  if (result.exitCode && result.exitCode !== 0 && matches.length === 0) {
    throw new Error(stderr || `ast-grep exited with code ${result.exitCode}`);
  }

  if (matches.length === 0) {
    const suffix = stderr ? `\n\nDiagnostics:\n${stderr}` : '';
    return { content: [{ type: 'text', text: `No structural matches found.${suffix}` }], details: { matchCount: 0, paths } };
  }

  const text = [
    `Found ${matches.length} structural match${matches.length === 1 ? '' : 'es'}${truncated ? ` (showing first ${visible.length})` : ''}.`,
    '',
    ...visible.map(formatMatch),
    ...(stderr ? ['', 'Diagnostics:', stderr] : []),
  ].join('\n\n');

  return {
    content: [{ type: 'text', text }],
    details: {
      matchCount: matches.length,
      shown: visible.length,
      truncated,
      paths,
      files: [...new Set(matches.map((match) => match.file).filter(Boolean))],
    },
  };
}
