import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, watch, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

import type { ExtensionBackendContext, ExtensionRouteRequest, ExtensionRouteResponse } from '@neon-pilot/extensions';

import { readEffectiveKnowledgeRoots } from './state';

export interface KnowledgeEntry {
  id: string;
  kind: 'file' | 'folder';
  name: string;
  path: string;
  rootId?: string;
  rootPath?: string;
  sizeBytes: number;
  updatedAt: string;
}

const SKIPPED_DIRS = new Set(['.git', '.next', '.obsidian', '_profiles', 'profiles', 'coverage', 'dist', 'dist-server', 'node_modules']);
const SKIPPED_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const IMAGE_FILE_EXTENSIONS = new Set(['avif', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
const MIME_EXTENSIONS = new Map([
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/svg+xml', 'svg'],
  ['image/webp', 'webp'],
]);

interface KnowledgeRoot {
  id: string;
  path: string;
}

async function roots(ctx: ExtensionBackendContext): Promise<KnowledgeRoot[]> {
  const paths = await readEffectiveKnowledgeRoots(ctx);
  return paths.map((path, index) => ({ id: index === 0 ? 'knowledge' : `knowledge-${index + 1}`, path: resolve(path) }));
}

async function root(ctx: ExtensionBackendContext): Promise<string> {
  return (await roots(ctx))[0]?.path ?? '';
}

function normalizeId(id: string): string {
  if (!id || id.includes('\u0000')) throw new Error('invalid path');
  const clean = id.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').trim();
  if (!clean) throw new Error('invalid path');
  if (clean.split('/').some((part) => part === '.' || part === '..' || SKIPPED_DIRS.has(part))) throw new Error('invalid path');
  return clean;
}

function inside(base: string, target: string): boolean {
  const rel = relative(base, target);
  return rel === '' || (!rel.startsWith('..') && rel !== '..');
}

function splitRootQualifiedId(id: string): { rootId: string | null; relativeId: string } {
  const normalized = id.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  const separator = normalized.indexOf(':');
  if (separator <= 0) return { rootId: null, relativeId: normalized };
  const rootId = normalized.slice(0, separator);
  const relativeId = normalized.slice(separator + 1).replace(/^\/+/, '');
  return { rootId, relativeId };
}

function displayId(rootRef: KnowledgeRoot, rel: string, rootCount: number): string {
  return rootCount > 1 && rootRef.id !== 'knowledge' ? `${rootRef.id}:${rel}` : rel;
}

async function resolveId(
  ctx: ExtensionBackendContext,
  id: string,
): Promise<{ root: string; rootId: string; rootCount: number; id: string; path: string }> {
  const allRoots = await roots(ctx);
  const requested = splitRootQualifiedId(id);
  const rootRef = requested.rootId ? allRoots.find((candidate) => candidate.id === requested.rootId) : allRoots[0];
  if (!rootRef) throw new Error('invalid knowledge root');
  const clean = normalizeId(requested.relativeId);
  const base = rootRef.path;
  const target = resolve(base, clean);
  if (!inside(base, target)) throw new Error('invalid path');
  return { root: base, rootId: rootRef.id, rootCount: allRoots.length, id: displayId(rootRef, clean, allRoots.length), path: target };
}

function entryFromPath(rootRef: KnowledgeRoot, absolutePath: string, rootCount = 1): KnowledgeEntry | null {
  if (!existsSync(absolutePath)) return null;
  const stats = statSync(absolutePath);
  if (!stats.isDirectory() && !stats.isFile()) return null;
  const kind = stats.isDirectory() ? 'folder' : 'file';
  const name = basename(absolutePath);
  if (kind === 'folder' ? SKIPPED_DIRS.has(name) : SKIPPED_FILES.has(name) || name.startsWith('._')) return null;
  const rel = relative(rootRef.path, absolutePath).replace(/\\/g, '/');
  if (!rel) return null;
  return {
    id: displayId(rootRef, kind === 'folder' ? `${rel}/` : rel, rootCount),
    kind,
    name,
    path: rel,
    rootId: rootRef.id,
    rootPath: rootRef.path,
    sizeBytes: kind === 'file' ? stats.size : 0,
    updatedAt: new Date(stats.mtimeMs).toISOString(),
  };
}

function sorted(entries: KnowledgeEntry[]): KnowledgeEntry[] {
  return entries.sort(
    (a, b) => (a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : a.name.localeCompare(b.name)) || a.id.localeCompare(b.id),
  );
}

function walkFiles(base: string, rootRef: KnowledgeRoot = { id: 'knowledge', path: base }, rootCount = 1): KnowledgeEntry[] {
  if (!existsSync(rootRef.path)) return [];
  const out: KnowledgeEntry[] = [];
  const stack = [rootRef.path];
  while (stack.length) {
    const current = stack.pop() as string;
    for (const dirent of readdirSync(current, { withFileTypes: true })) {
      if (dirent.isSymbolicLink()) continue;
      const p = join(current, dirent.name);
      if (dirent.isDirectory()) {
        if (SKIPPED_DIRS.has(dirent.name)) continue;
        const entry = entryFromPath(rootRef, p, rootCount);
        if (entry) out.push(entry);
        stack.push(p);
      } else if (dirent.isFile()) {
        const entry = entryFromPath(rootRef, p, rootCount);
        if (entry) out.push(entry);
      }
    }
  }
  return sorted(out);
}

async function collectMarkdown(ctx: ExtensionBackendContext): Promise<KnowledgeEntry[]> {
  const allRoots = await roots(ctx);
  return allRoots
    .flatMap((rootRef) => walkFiles(rootRef.path, rootRef, allRoots.length))
    .filter((entry) => entry.kind === 'file' && entry.name.toLowerCase().endsWith('.md'));
}

function parseLimit(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? '20'), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 50) : 20;
}

function decodeImage(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(',');
  const metadata = dataUrl.slice(0, comma).trim().toLowerCase();
  if (comma < 0 || !metadata.startsWith('data:image/') || !metadata.includes(';base64'))
    throw new Error('dataUrl must be an image data: URL');
  return Buffer.from(dataUrl.slice(comma + 1), 'base64');
}

function imageName(filename: string, dataUrl: string): string {
  const metadata = dataUrl.slice(0, dataUrl.indexOf(',')).trim().toLowerCase();
  const mimeExt = MIME_EXTENSIONS.get(metadata.slice('data:'.length).split(';')[0] ?? '');
  const fileExt = extname(filename).replace(/^\./, '').toLowerCase();
  const extension = mimeExt || (IMAGE_FILE_EXTENSIONS.has(fileExt) ? fileExt : 'png');
  const base =
    basename(filename)
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-') || 'image';
  return `${Date.now()}-${base}.${extension}`;
}

async function assetPath(ctx: ExtensionBackendContext, id: string): Promise<string> {
  const resolved = await resolveId(ctx, id);
  if (!existsSync(resolved.path) || !statSync(resolved.path).isFile()) throw new Error('file not found');
  return resolved.path;
}

export async function listFiles(_input: unknown, ctx: ExtensionBackendContext) {
  const allRoots = await roots(ctx);
  const primaryRoot = allRoots[0]?.path ?? '';
  return {
    root: primaryRoot,
    roots: allRoots.map((rootRef) => ({ id: rootRef.id, path: rootRef.path })),
    files: allRoots.flatMap((rootRef) => walkFiles(rootRef.path, rootRef, allRoots.length)),
  };
}

export async function tree(input: { dir?: string } | undefined, ctx: ExtensionBackendContext) {
  const allRoots = await roots(ctx);
  const resolvedDir = input?.dir ? await resolveId(ctx, input.dir) : null;
  const rootRef = resolvedDir
    ? { id: resolvedDir.rootId, path: resolvedDir.root }
    : (allRoots[0] ?? { id: 'knowledge', path: await root(ctx) });
  const dir = resolvedDir?.path ?? rootRef.path;
  if (!inside(rootRef.path, dir)) throw new Error('invalid path');
  const entries = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => !entry.isSymbolicLink())
        .map((entry) => entryFromPath(rootRef, join(dir, entry.name), allRoots.length))
        .filter((entry): entry is KnowledgeEntry => Boolean(entry))
    : [];
  return { root: rootRef.path, entries: sorted(entries) };
}

export async function readFile(input: { id: string }, ctx: ExtensionBackendContext) {
  const resolved = await resolveId(ctx, input.id);
  if (!existsSync(resolved.path) || !statSync(resolved.path).isFile()) throw new Error('file not found');
  const stats = statSync(resolved.path);
  return { id: resolved.id, content: readFileSync(resolved.path, 'utf-8'), updatedAt: new Date(stats.mtimeMs).toISOString() };
}

export async function writeFile(input: { id: string; content: string }, ctx: ExtensionBackendContext) {
  const resolved = await resolveId(ctx, input.id);
  mkdirSync(dirname(resolved.path), { recursive: true });
  writeFileSync(resolved.path, input.content, 'utf-8');
  ctx.ui.invalidate('knowledgeBase');
  return entryFromPath({ id: resolved.rootId, path: resolved.root }, resolved.path, resolved.rootCount);
}

export async function createFolder(input: { id: string }, ctx: ExtensionBackendContext) {
  const resolved = await resolveId(ctx, input.id);
  mkdirSync(resolved.path, { recursive: true });
  ctx.ui.invalidate('knowledgeBase');
  return entryFromPath({ id: resolved.rootId, path: resolved.root }, resolved.path, resolved.rootCount);
}

export async function deleteFile(input: { id: string }, ctx: ExtensionBackendContext) {
  const resolved = await resolveId(ctx, input.id);
  rmSync(resolved.path, { recursive: true, force: true });
  ctx.ui.invalidate('knowledgeBase');
  return { ok: true };
}

export async function rename(input: { id: string; newName: string }, ctx: ExtensionBackendContext) {
  const source = await resolveId(ctx, input.id);
  const target = resolve(dirname(source.path), basename(input.newName));
  if (!inside(source.root, target)) throw new Error('invalid path');
  mkdirSync(dirname(target), { recursive: true });
  renameSync(source.path, target);
  ctx.ui.invalidate('knowledgeBase');
  return entryFromPath({ id: source.rootId, path: source.root }, target, source.rootCount);
}

export async function move(input: { id: string; targetDir: string }, ctx: ExtensionBackendContext) {
  const source = await resolveId(ctx, input.id);
  const targetDir = input.targetDir ? (await resolveId(ctx, input.targetDir)).path : source.root;
  const target = resolve(targetDir, basename(source.id));
  if (!inside(source.root, target)) throw new Error('invalid path');
  mkdirSync(dirname(target), { recursive: true });
  renameSync(source.path, target);
  ctx.ui.invalidate('knowledgeBase');
  return entryFromPath({ id: source.rootId, path: source.root }, target, source.rootCount);
}

export async function backlinks(input: { id: string }, ctx: ExtensionBackendContext) {
  const targetName = basename(input.id).replace(/\.md$/i, '');
  const pattern = new RegExp(`\\[\\[${targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\|[^\\]]*)?\\]\\]`, 'gi');
  const results = [];
  for (const entry of await collectMarkdown(ctx)) {
    if (entry.id === input.id) continue;
    const content = readFileSync(join(entry.rootPath ?? (await root(ctx)), entry.path), 'utf-8');
    const matchIndex = content.search(pattern);
    if (matchIndex < 0) continue;
    results.push({
      id: entry.id,
      title: basename(entry.id).replace(/\.md$/i, ''),
      excerpt: content
        .slice(Math.max(0, matchIndex - 60), matchIndex + 80)
        .replace(/\s+/g, ' ')
        .trim(),
    });
  }
  return { backlinks: results };
}

export async function search(input: { q: string; limit?: number }, ctx: ExtensionBackendContext) {
  const q = String(input.q ?? '')
    .trim()
    .toLowerCase();
  const results = [];
  for (const entry of await collectMarkdown(ctx)) {
    const content = readFileSync(join(entry.rootPath ?? (await root(ctx)), entry.path), 'utf-8');
    const title = entry.name.replace(/\.md$/i, '');
    const haystacks = [entry.id.toLowerCase(), title.toLowerCase(), content.toLowerCase()];
    const index = haystacks.findIndex((value) => !q || value.includes(q));
    if (index < 0) continue;
    const contentIndex = q ? content.toLowerCase().indexOf(q) : -1;
    results.push({
      id: entry.id,
      name: entry.name,
      title,
      excerpt:
        contentIndex >= 0
          ? content
              .slice(Math.max(0, contentIndex - 80), contentIndex + 160)
              .replace(/\s+/g, ' ')
              .trim()
          : entry.id,
      score: index === 1 ? 500 : index === 0 ? 300 : 100,
    });
  }
  return {
    results: results
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, parseLimit(input.limit))
      .map(({ score: _score, ...rest }) => rest),
  };
}

export async function uploadImage(input: { filename: string; dataUrl: string }, ctx: ExtensionBackendContext) {
  const id = `_attachments/${imageName(input.filename, input.dataUrl)}`;
  const resolved = await resolveId(ctx, id);
  mkdirSync(dirname(resolved.path), { recursive: true });
  writeFileSync(resolved.path, decodeImage(input.dataUrl));
  ctx.ui.invalidate('knowledgeBase');
  return { id, url: `/api/extensions/system-knowledge/asset?id=${encodeURIComponent(id)}` };
}

export async function importUrl(
  input: { url: string; title?: string; directoryId?: string; sourceApp?: string },
  ctx: ExtensionBackendContext,
) {
  return importSharedItem({ kind: 'url', ...input }, ctx);
}

export async function importSharedItem(
  input: {
    kind?: 'text' | 'url' | 'image';
    directoryId?: string | null;
    title?: string | null;
    text?: string | null;
    url?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
    dataBase64?: string | null;
    sourceApp?: string | null;
    createdAt?: string | null;
  },
  ctx: ExtensionBackendContext,
) {
  const kind = input.kind ?? 'url';
  const dir = input.directoryId ? normalizeId(input.directoryId) : 'inbox';
  if (kind === 'image') {
    if (!input.dataBase64?.trim()) throw new Error('dataBase64 is required for image imports.');
    const fileName = input.fileName?.trim() || input.title?.trim() || 'image.png';
    const mimeType = input.mimeType?.trim() || 'image/png';
    const image = await uploadImage({ filename: fileName, dataUrl: `data:${mimeType};base64,${input.dataBase64.trim()}` }, ctx);
    const title = safeTitle(input.title || fileName || 'Imported image');
    return writeImportedNote({ ctx, dir, title, body: `![${title}](${image.url})\n\nSource: ${input.sourceApp ?? 'share'}\n` });
  }

  if (kind === 'url') {
    if (!input.url?.trim()) throw new Error('url is required for URL imports.');
    const title = safeTitle(input.title?.trim() || new URL(input.url).hostname || 'Imported link');
    return writeImportedNote({ ctx, dir, title, body: `${input.url}\n\nSource: ${input.sourceApp ?? 'share'}\n` });
  }

  if (!input.text?.trim()) throw new Error('text is required for text imports.');
  const title = safeTitle(input.title || 'Imported text');
  return writeImportedNote({ ctx, dir, title, body: `${input.text.trim()}\n\nSource: ${input.sourceApp ?? 'share'}\n` });
}

async function writeImportedNote(input: { ctx: ExtensionBackendContext; dir: string; title: string; body: string }) {
  const id = `${input.dir}/${uniqueImportFileName(input.title)}`;
  const resolved = await resolveId(input.ctx, id);
  mkdirSync(dirname(resolved.path), { recursive: true });
  writeFileSync(resolved.path, `# ${input.title}\n\n${input.body}`, 'utf-8');
  input.ctx.ui.invalidate('knowledgeBase');
  return entryFromPath({ id: resolved.rootId, path: resolved.root }, resolved.path, resolved.rootCount);
}

function safeTitle(value: string) {
  return (value.trim() || 'Imported item').replace(/[\\/:*?"<>|]+/g, '-');
}

function uniqueImportFileName(title: string) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `${title}-${stamp}.md`;
}

export async function resolvePromptReferences(input: { text: string }, ctx: ExtensionBackendContext) {
  const base = await root(ctx);
  const ids = Array.from(input.text.matchAll(/@([^\s`'"<>]+(?:\.md|\/))/gu))
    .map((match) => match[1])
    .filter(Boolean);
  const files: Array<{ id: string; path: string }> = [];
  for (const id of ids) {
    try {
      const resolved = await resolveId(ctx, id);
      if (!existsSync(resolved.path)) continue;
      const stats = statSync(resolved.path);
      if (stats.isFile()) {
        files.push({ id: resolved.id, path: resolved.path });
      } else if (stats.isDirectory()) {
        files.push(
          ...walkFiles(resolved.path)
            .filter((entry) => entry.kind === 'file')
            .slice(0, 20)
            .map((entry) => ({ id: join(resolved.id, entry.path).replace(/\\/g, '/'), path: join(resolved.path, entry.path) })),
        );
      }
    } catch {
      // Ignore invalid references.
    }
  }
  return {
    contextBlocks: files.length
      ? [{ content: files.map((file) => `## ${file.id}\n\n${readFileSync(file.path, 'utf-8')}`).join('\n\n') }]
      : [],
    references: files.map((file) => ({
      kind: 'knowledgeFile',
      id: file.id,
      path: file.id || relative(base, file.path).replace(/\\/g, '/'),
    })),
  };
}

export async function eventsRoute(_req: ExtensionRouteRequest, ctx: ExtensionBackendContext): Promise<ExtensionRouteResponse> {
  const allRoots = await roots(ctx);
  async function* events(): AsyncIterable<{ data: unknown }> {
    yield {
      data: { type: 'ready', root: allRoots[0]?.path ?? '', roots: allRoots.map((rootRef) => ({ id: rootRef.id, path: rootRef.path })) },
    };
    const queue: Array<{ eventType: string; path: string | null; rootId: string; rootPath: string }> = [];
    let notify: (() => void) | null = null;
    const watchers = allRoots.map((rootRef) =>
      watch(rootRef.path, { recursive: true }, (eventType, filename) => {
        queue.push({ eventType, path: typeof filename === 'string' ? filename : null, rootId: rootRef.id, rootPath: rootRef.path });
        notify?.();
        notify = null;
      }),
    );
    const onAbort = () => {
      for (const watcher of watchers) watcher.close();
      notify?.();
      notify = null;
    };
    _req.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      while (!_req.signal?.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((resolveWait) => {
            notify = resolveWait;
          });
          continue;
        }
        const event = queue.shift();
        if (event) yield { data: event };
      }
    } finally {
      _req.signal?.removeEventListener('abort', onAbort);
      for (const watcher of watchers) watcher.close();
    }
  }
  return { status: 200, stream: 'sse', events: events() };
}

export async function assetRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext): Promise<ExtensionRouteResponse> {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return { status: 400, body: { error: 'id is required' } };
  const filePath = await assetPath(ctx, id);
  const ext = extname(filePath).replace(/^\./, '').toLowerCase();
  const contentType =
    ext === 'svg'
      ? 'image/svg+xml'
      : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'gif'
          ? 'image/gif'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/png';
  return { status: 200, headers: { 'content-type': contentType }, body: readFileSync(filePath) };
}
