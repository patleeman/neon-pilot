import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import type { MethodHandler } from '../codexJsonRpcServer.js';

/**
 * Codex `fs/*` handler functions.
 * These operate on absolute paths (host file system).
 * The extension runs in the desktop server process and has Node.js fs access.
 */

function fuzzySearchFiles(params: unknown) {
  const p = params as Record<string, unknown> | undefined;
  const query = typeof p?.query === 'string' ? p.query.toLowerCase() : '';
  const roots = Array.isArray(p?.roots) ? p.roots.filter((root): root is string => typeof root === 'string' && root.trim().length > 0) : [];
  const maxResults = typeof p?.limit === 'number' && p.limit > 0 ? Math.min(Math.floor(p.limit), 500) : 200;
  const maxVisitedPerRoot = typeof p?.maxVisited === 'number' && p.maxVisited > 0 ? Math.min(Math.floor(p.maxVisited), 25_000) : 5_000;
  const files: Array<{ root: string; path: string; matchType: 'file' | 'directory'; fileName: string; score: number; indices?: number[] }> =
    [];

  for (const root of roots) {
    if (!existsSync(root)) continue;
    const stack = [root];
    let visited = 0;
    while (stack.length && visited < maxVisitedPerRoot) {
      const dir = stack.pop()!;
      let entries: ReturnType<typeof readdirSync>;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries.reverse()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target' || entry.name === '.next') continue;
        const fullPath = join(dir, entry.name);
        const rel = relative(root, fullPath) || entry.name;
        const haystack = `${entry.name}\n${rel}`.toLowerCase();
        visited += 1;
        const match = scoreMatch(haystack, query, entry.name.toLowerCase());
        if (query && !match) {
          if (entry.isDirectory()) stack.push(fullPath);
          continue;
        }
        files.push({
          root,
          path: fullPath,
          matchType: entry.isDirectory() ? 'directory' : 'file',
          fileName: basename(fullPath),
          score: match?.score ?? 1,
          ...(match?.indices ? { indices: match.indices } : {}),
        });
        if (entry.isDirectory()) stack.push(fullPath);
        if (!query && files.length >= maxResults) break;
      }
    }
  }

  files.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return { files: files.slice(0, maxResults) };
}

function scoreMatch(haystack: string, query: string, fileName: string): { score: number; indices?: number[] } | null {
  if (!query) return { score: 1 };
  const exactIndex = haystack.indexOf(query);
  if (exactIndex >= 0) {
    const fileNameBonus = fileName.includes(query) ? 500 : 0;
    const prefixBonus = fileName.startsWith(query) ? 250 : 0;
    return { score: 2_000 + fileNameBonus + prefixBonus - exactIndex };
  }

  const indices: number[] = [];
  let searchFrom = 0;
  for (const char of query) {
    const index = haystack.indexOf(char, searchFrom);
    if (index === -1) return null;
    indices.push(index);
    searchFrom = index + 1;
  }
  const span = indices.at(-1)! - indices[0];
  return { score: Math.max(1, 1_000 - span), indices };
}

export const fs = {
  /**
   * `fs/readFile` — read a file and return base64-encoded data.
   */
  readFile: (async (params) => {
    const path = (params as Record<string, unknown> | undefined)?.path as string | undefined;
    if (!path) throw new Error('path is required');
    const data = readFileSync(path);
    return { dataBase64: data.toString('base64') };
  }) as MethodHandler,

  /**
   * `fs/writeFile` — write a file from base64-encoded data.
   */
  writeFile: (async (params) => {
    const p = params as Record<string, unknown> | undefined;
    const path = p?.path as string | undefined;
    const dataBase64 = p?.dataBase64 as string | undefined;
    if (!path) throw new Error('path is required');
    if (typeof dataBase64 !== 'string') throw new Error('dataBase64 is required');
    const decoded = Buffer.from(dataBase64, 'base64');
    // Validate base64 by round-tripping: decode then re-encode.  Malformed
    // input (truncated, missing padding, invalid chars) silently decodes to
    // garbage bytes; this catches that case and prevents silent corruption.
    if (decoded.toString('base64') !== dataBase64) {
      throw new Error('dataBase64 contains invalid base64 encoding');
    }
    writeFileSync(path, decoded);
    return {};
  }) as MethodHandler,

  /**
   * `fs/getMetadata` — get file/directory metadata.
   */
  getMetadata: (async (params) => {
    const path = (params as Record<string, unknown> | undefined)?.path as string | undefined;
    if (!path) throw new Error('path is required');
    const stats = statSync(path);
    return {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymlink: stats.isSymbolicLink(),
      createdAtMs: stats.birthtimeMs,
      modifiedAtMs: stats.mtimeMs,
    };
  }) as MethodHandler,

  /**
   * `fs/createDirectory` — create a directory.
   */
  createDirectory: (async (params) => {
    const p = params as Record<string, unknown> | undefined;
    const path = p?.path as string | undefined;
    const recursive = p?.recursive !== false;
    if (!path) throw new Error('path is required');
    mkdirSync(path, { recursive });
    return {};
  }) as MethodHandler,

  /**
   * `fs/remove` — remove a file or directory.
   */
  remove: (async (params) => {
    const p = params as Record<string, unknown> | undefined;
    const path = p?.path as string | undefined;
    const recursive = p?.recursive !== false;
    const force = p?.force !== false;
    if (!path) throw new Error('path is required');
    rmSync(path, { recursive, force });
    return {};
  }) as MethodHandler,

  /**
   * `fs/copy` — copy a file or directory.
   */
  copy: (async (params) => {
    const p = params as Record<string, unknown> | undefined;
    const from = p?.from as string | undefined;
    const to = p?.to as string | undefined;
    const recursive = p?.recursive === true;
    if (!from) throw new Error('from is required');
    if (!to) throw new Error('to is required');
    cpSync(from, to, { recursive });
    return {};
  }) as MethodHandler,

  /**
   * `fs/readDirectory` — list directory entries.
   */
  fuzzyFileSearch: (async (params) => fuzzySearchFiles(params)) as MethodHandler,

  readDirectory: (async (params) => {
    const path = (params as Record<string, unknown> | undefined)?.path as string | undefined;
    if (!path) throw new Error('path is required');
    const entries = readdirSync(path, { withFileTypes: true });
    return {
      data: entries.map((entry) => ({
        fileName: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      })),
    };
  }) as MethodHandler,
};
