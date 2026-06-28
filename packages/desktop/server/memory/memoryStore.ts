import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import {
  getDurableMemoryRoot,
  getDurableMemoryScopesDir,
  getDurableMemorySkillsDir,
  getDurableMemorySystemFilePath,
  getKnowledgeRoot,
} from '@neon-pilot/core';
import { parseDocument, stringify as stringifyYaml } from 'yaml';

import { listMemoryDocs } from '../knowledge/memoryDocs.js';
import { execGitProcess } from '../shared/processLauncher.js';

const MEMORY_COMMIT_AUTHOR = ['-c', 'user.name=Neon Pilot Memory', '-c', 'user.email=memory@neonpilot.local'];
const LEGACY_IMPORT_START = '<!-- legacy-knowledge-import:start -->';
const LEGACY_IMPORT_END = '<!-- legacy-knowledge-import:end -->';

export interface MemoryGitChange {
  hash: string;
  author: string;
  date: string;
  subject: string;
  files: string[];
}

export interface MemoryIssue {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  relativePath?: string;
}

export interface MemorySystemFile {
  relativePath: string;
  path: string;
  exists: boolean;
  content: string;
  loaded: true;
  updatedAt?: string;
}

export interface MemoryScope {
  slug: string;
  name: string;
  type: string;
  relativePath: string;
  path: string;
  roots: string[];
  aliases: string[];
  inject: boolean;
  active: boolean;
  content: string;
  updatedAt?: string;
}

export interface MemorySkill {
  name: string;
  description: string;
  relativePath: string;
  path: string;
  content: string;
  source: 'memory';
}

export interface MemoryState {
  initialized: boolean;
  root: string;
  system: MemorySystemFile;
  scopes: MemoryScope[];
  skills: MemorySkill[];
  recentChanges: MemoryGitChange[];
  issues: MemoryIssue[];
  git: {
    initialized: boolean;
    branch: string | null;
    remoteUrl: string | null;
    dirty: boolean;
    ahead: number;
    behind: number;
  };
}

export interface InitializeMemoryOptions {
  cwd?: string;
}

export interface CreateMemoryScopeInput {
  name: string;
  slug?: string;
  roots?: string[];
  aliases?: string[];
  type?: string;
  inject?: boolean;
  reason?: string;
}

export interface WriteMemoryFileInput {
  relativePath: string;
  content: string;
  reason?: string;
}

export interface MemoryImportResult {
  importedCount: number;
  state: MemoryState;
}

function memoryRoot(): string {
  return getDurableMemoryRoot(getKnowledgeRoot());
}

function systemFilePath(): string {
  return getDurableMemorySystemFilePath(getKnowledgeRoot());
}

function scopesDir(): string {
  return getDurableMemoryScopesDir(getKnowledgeRoot());
}

function skillsDir(): string {
  return getDurableMemorySkillsDir(getKnowledgeRoot());
}

function normalizeNewlines(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .slice(0, 64)
      .replace(/-+$/g, '') || 'memory-scope'
  );
}

function safeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolvedRoot = resolve(memoryRoot());
  const resolvedPath = resolve(resolvedRoot, normalized);
  const rel = relative(resolvedRoot, resolvedPath);
  if (!rel || rel.startsWith('..') || resolve(resolvedRoot, rel) !== resolvedPath) {
    throw new Error('Memory path must stay inside the memory folder.');
  }
  if (!isEditableMemoryRelativePath(rel)) {
    throw new Error('Memory path is not editable.');
  }
  return rel;
}

function isEditableMemoryRelativePath(relativePath: string): boolean {
  if (relativePath === 'system.md') return true;
  if (/^scopes\/[^/]+\/memory\.md$/.test(relativePath)) return true;
  if (/^skills\/[^/]+\/(SKILL|INDEX)\.md$/.test(relativePath)) return true;
  if (/^reflections\/[^/]+\.md$/.test(relativePath)) return true;
  return false;
}

function frontmatterErrorMessage(content: string, relativePath: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return null;
  const document = parseDocument(match[1] ?? '', { prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) {
    return `Invalid frontmatter in ${relativePath}: ${document.errors[0]?.message ?? 'YAML could not be parsed.'}`;
  }
  const parsed = document.toJS() as unknown;
  if (parsed !== null && parsed !== undefined && (typeof parsed !== 'object' || Array.isArray(parsed))) {
    return `Invalid frontmatter in ${relativePath}: frontmatter must be a mapping.`;
  }
  const data = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const stringFields = ['name', 'type', 'description'];
  for (const field of stringFields) {
    if (data[field] !== undefined && typeof data[field] !== 'string') {
      return `Invalid frontmatter in ${relativePath}: ${field} must be a string.`;
    }
  }
  for (const field of ['roots', 'aliases']) {
    if (
      data[field] !== undefined &&
      (!Array.isArray(data[field]) || !(data[field] as unknown[]).every((entry) => typeof entry === 'string'))
    ) {
      return `Invalid frontmatter in ${relativePath}: ${field} must be a list of strings.`;
    }
  }
  if (data.inject !== undefined && typeof data.inject !== 'boolean') {
    return `Invalid frontmatter in ${relativePath}: inject must be true or false.`;
  }
  return null;
}

function validateMemoryFileContent(relativePath: string, content: string): void {
  const message = frontmatterErrorMessage(content, relativePath);
  if (message) throw new Error(message);
}

function parseFrontmatter(content: string): { data: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: content };
  const document = parseDocument(match[1] ?? '', { prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) return { data: {}, body: match[2] ?? '' };
  const parsed = document.toJS() as unknown;
  return {
    data: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {},
    body: match[2] ?? '',
  };
}

function stringifyMarkdown(data: Record<string, unknown>, body: string): string {
  const frontmatter = stringifyYaml(data, { lineWidth: 0, indent: 2, minContentWidth: 0 }).trimEnd();
  return normalizeNewlines(`---\n${frontmatter}\n---\n\n${body.replace(/^\n+/, '')}`);
}

function readText(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

async function git(args: string[], options: { allowFailure?: boolean } = {}): Promise<string | null> {
  try {
    return (await execGitProcess({ args, cwd: memoryRoot(), timeoutMs: 5_000, maxBuffer: 1024 * 1024 })).stdout.trim();
  } catch (error) {
    if (options.allowFailure) return null;
    throw error;
  }
}

async function commitMemoryChanges(subject: string): Promise<void> {
  await git(['add', '--all']);
  const status = await git(['status', '--porcelain'], { allowFailure: true });
  if (!status) return;
  await git([...MEMORY_COMMIT_AUTHOR, 'commit', '-m', subject || 'Update memory']);
}

async function readDirtyState(): Promise<boolean> {
  const status = await git(['status', '--porcelain'], { allowFailure: true });
  return Boolean(status);
}

async function readAheadBehind(ref = '@{upstream}'): Promise<{ ahead: number; behind: number }> {
  const output = await git(['rev-list', '--left-right', '--count', `HEAD...${ref}`], { allowFailure: true });
  const [aheadRaw, behindRaw] = (output ?? '').split(/\s+/);
  const ahead = Number.parseInt(aheadRaw ?? '', 10);
  const behind = Number.parseInt(behindRaw ?? '', 10);
  return {
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
  };
}

function collectFrontmatterIssues(): MemoryIssue[] {
  const candidates: string[] = [];
  if (existsSync(systemFilePath())) candidates.push('system.md');
  if (existsSync(scopesDir())) {
    for (const scope of readdirSync(scopesDir()).filter((entry) => !entry.startsWith('.'))) {
      candidates.push(`scopes/${scope}/memory.md`);
    }
  }
  if (existsSync(skillsDir())) {
    for (const skill of readdirSync(skillsDir()).filter((entry) => !entry.startsWith('.'))) {
      for (const fileName of ['SKILL.md', 'INDEX.md']) {
        const relativePath = `skills/${skill}/${fileName}`;
        if (existsSync(join(memoryRoot(), relativePath))) candidates.push(relativePath);
      }
    }
  }

  return candidates.flatMap((relativePath) => {
    const message = frontmatterErrorMessage(readText(join(memoryRoot(), relativePath)), relativePath);
    return message ? [{ severity: 'error' as const, code: 'invalid_frontmatter', message, relativePath }] : [];
  });
}

function collectMemoryIssues(input: { dirty: boolean; ahead: number; behind: number }): MemoryIssue[] {
  const issues = collectFrontmatterIssues();
  if (input.dirty) {
    issues.push({
      severity: 'warning',
      code: 'uncommitted_changes',
      message: 'Memory has uncommitted file changes outside Neon Pilot.',
    });
  }
  if (input.behind > 0) {
    issues.push({
      severity: 'warning',
      code: 'remote_behind',
      message: `Memory is ${input.behind} commit${input.behind === 1 ? '' : 's'} behind its remote.`,
    });
  }
  return issues;
}

async function ensureGitRepository(): Promise<void> {
  if (!existsSync(join(memoryRoot(), '.git'))) {
    await git(['init']);
  }
}

function defaultSystemMarkdown(): string {
  return stringifyMarkdown(
    {
      name: 'System memory',
      type: 'system',
      inject: true,
    },
    '# System Memory\n\nStable instructions, preferences, and operating context that should always be available to Neon Pilot agents.\n',
  );
}

function defaultScopeMarkdown(input: CreateMemoryScopeInput & { slug: string }): string {
  const roots = (input.roots ?? []).map((item) => item.trim()).filter(Boolean);
  const aliases = (input.aliases ?? []).map((item) => item.trim()).filter(Boolean);
  return stringifyMarkdown(
    {
      name: input.name.trim(),
      type: input.type?.trim() || 'workspace',
      roots,
      aliases,
      inject: input.inject ?? true,
    },
    `# ${input.name.trim()}\n\nStable memory for this scope.\n`,
  );
}

function importedKnowledgeMarkdown(): { content: string; count: number } {
  const docs = listMemoryDocs({ includeSearchText: false });
  const rows = docs.map((doc) => {
    const details = [
      `- Path: ${doc.path}`,
      doc.summary ? `- Summary: ${doc.summary}` : null,
      doc.description ? `- Description: ${doc.description}` : null,
      doc.type ? `- Type: ${doc.type}` : null,
      doc.updated ? `- Updated: ${doc.updated}` : null,
    ].filter(Boolean);
    return `## ${doc.title}\n\n${details.join('\n')}\n`;
  });
  return {
    count: docs.length,
    content: stringifyMarkdown(
      {
        name: 'Imported knowledge',
        type: 'legacy-knowledge',
        roots: [],
        aliases: ['knowledge base'],
        inject: false,
      },
      `# Imported Knowledge\n\nLegacy knowledge notes imported for review. This scope is not injected into agent context by default.\n\n${LEGACY_IMPORT_START}\n${rows.join('\n')}${LEGACY_IMPORT_END}\n`,
    ),
  };
}

function replaceLegacyImportBlock(existing: string, next: string): string {
  const nextStart = next.indexOf(LEGACY_IMPORT_START);
  const nextEnd = next.indexOf(LEGACY_IMPORT_END, nextStart);
  if (nextStart < 0 || nextEnd < 0) return next;
  const nextBlock = next.slice(nextStart, nextEnd + LEGACY_IMPORT_END.length);
  const existingStart = existing.indexOf(LEGACY_IMPORT_START);
  const existingEnd = existing.indexOf(LEGACY_IMPORT_END, existingStart);
  if (existingStart < 0 || existingEnd < 0) return next;
  return normalizeNewlines(`${existing.slice(0, existingStart)}${nextBlock}${existing.slice(existingEnd + LEGACY_IMPORT_END.length)}`);
}

function validateRemoteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error('Remote URL is required.');
  if (/[\n\r\0]/.test(trimmed)) throw new Error('Remote URL is invalid.');
  return trimmed;
}

export async function initializeMemory(options: InitializeMemoryOptions = {}): Promise<MemoryState> {
  mkdirSync(scopesDir(), { recursive: true });
  mkdirSync(skillsDir(), { recursive: true });
  mkdirSync(join(memoryRoot(), 'archive'), { recursive: true });
  mkdirSync(join(memoryRoot(), 'reflections'), { recursive: true });

  if (!existsSync(systemFilePath())) {
    writeFileSync(systemFilePath(), defaultSystemMarkdown(), 'utf-8');
  }
  for (const marker of [
    join(scopesDir(), '.gitkeep'),
    join(skillsDir(), '.gitkeep'),
    join(memoryRoot(), 'archive', '.gitkeep'),
    join(memoryRoot(), 'reflections', '.gitkeep'),
  ]) {
    if (!existsSync(marker)) writeFileSync(marker, '', 'utf-8');
  }

  await ensureGitRepository();
  await commitMemoryChanges('chore: initialize memory');
  return getMemoryState({ cwd: options.cwd });
}

function fileUpdatedAt(filePath: string): string | undefined {
  try {
    return statSync(filePath).mtime.toISOString();
  } catch {
    return undefined;
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pathContains(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const rel = relative(resolvedRoot, resolvedCandidate);
  return rel === '' || (!!rel && !rel.startsWith('..') && !rel.startsWith('/'));
}

function scopeIsActive(scope: Pick<MemoryScope, 'roots'>, cwd?: string): boolean {
  if (!cwd) return false;
  return scope.roots.some((root) => pathContains(root, cwd));
}

function listScopes(cwd?: string): MemoryScope[] {
  if (!existsSync(scopesDir())) return [];
  return readdirSync(scopesDir())
    .filter((entry) => !entry.startsWith('.'))
    .map((entry) => {
      const dir = join(scopesDir(), entry);
      const filePath = join(dir, 'memory.md');
      if (!existsSync(filePath)) return null;
      const content = readText(filePath);
      const parsed = parseFrontmatter(content);
      const scope: MemoryScope = {
        slug: entry,
        name: typeof parsed.data.name === 'string' && parsed.data.name.trim() ? parsed.data.name.trim() : entry,
        type: typeof parsed.data.type === 'string' && parsed.data.type.trim() ? parsed.data.type.trim() : 'workspace',
        relativePath: relative(memoryRoot(), filePath),
        path: filePath,
        roots: stringArray(parsed.data.roots),
        aliases: stringArray(parsed.data.aliases),
        inject: boolValue(parsed.data.inject, true),
        active: false,
        content,
        updatedAt: fileUpdatedAt(filePath),
      };
      scope.active = scope.inject && scopeIsActive(scope, cwd);
      return scope;
    })
    .filter((scope): scope is MemoryScope => scope !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function readSkillMetadata(content: string): { name: string; description: string } {
  const parsed = parseFrontmatter(content);
  return {
    name: typeof parsed.data.name === 'string' ? parsed.data.name.trim() : '',
    description: typeof parsed.data.description === 'string' ? parsed.data.description.trim() : '',
  };
}

function listMemorySkills(): MemorySkill[] {
  if (!existsSync(skillsDir())) return [];
  return readdirSync(skillsDir())
    .filter((entry) => !entry.startsWith('.'))
    .map((entry) => {
      const dir = join(skillsDir(), entry);
      const filePath = [join(dir, 'SKILL.md'), join(dir, 'INDEX.md')].find((candidate) => existsSync(candidate));
      if (!filePath) return null;
      const content = readText(filePath);
      const metadata = readSkillMetadata(content);
      return {
        name: metadata.name || entry,
        description: metadata.description,
        relativePath: relative(memoryRoot(), filePath),
        path: filePath,
        content,
        source: 'memory' as const,
      };
    })
    .filter((skill): skill is MemorySkill => skill !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function parseGitLog(output: string | null): MemoryGitChange[] {
  if (!output) return [];
  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [header, ...files] = record.split('\n');
      const [hash = '', author = '', date = '', subject = ''] = (header ?? '').split('\x1f');
      return { hash, author, date, subject, files: files.map((file) => file.trim()).filter(Boolean) };
    })
    .filter((change) => change.hash.length > 0);
}

async function readRecentChanges(): Promise<MemoryGitChange[]> {
  const output = await git(['log', '--date=iso', '--name-only', '--pretty=format:%x1e%H%x1f%an%x1f%ad%x1f%s', '-n', '30'], {
    allowFailure: true,
  });
  return parseGitLog(output);
}

export async function getMemoryState(options: { cwd?: string } = {}): Promise<MemoryState> {
  const root = memoryRoot();
  const initialized = existsSync(systemFilePath()) && existsSync(join(root, '.git'));
  const branch = initialized ? await git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFailure: true }) : null;
  const remoteUrl = initialized ? await git(['config', '--get', 'remote.origin.url'], { allowFailure: true }) : null;
  const dirty = initialized ? await readDirtyState() : false;
  const { ahead, behind } = initialized ? await readAheadBehind() : { ahead: 0, behind: 0 };
  const systemContent = readText(systemFilePath());
  return {
    initialized,
    root,
    system: {
      relativePath: 'system.md',
      path: systemFilePath(),
      exists: existsSync(systemFilePath()),
      content: systemContent,
      loaded: true,
      updatedAt: fileUpdatedAt(systemFilePath()),
    },
    scopes: listScopes(options.cwd),
    skills: listMemorySkills(),
    recentChanges: initialized ? await readRecentChanges() : [],
    issues: initialized ? collectMemoryIssues({ dirty, ahead, behind }) : [],
    git: {
      initialized: existsSync(join(root, '.git')),
      branch: branch && branch !== 'HEAD' ? branch : null,
      remoteUrl,
      dirty,
      ahead,
      behind,
    },
  };
}

export async function createMemoryScope(input: CreateMemoryScopeInput): Promise<MemoryState> {
  const name = input.name.trim();
  if (!name) throw new Error('Scope name is required.');
  await initializeMemory();
  const slug = slugify(input.slug || name);
  const target = join(scopesDir(), slug, 'memory.md');
  if (existsSync(target)) throw new Error(`Memory scope already exists: ${slug}`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, defaultScopeMarkdown({ ...input, name, slug }), 'utf-8');
  await commitMemoryChanges(input.reason?.trim() || `Add ${name} memory scope`);
  return getMemoryState();
}

export async function writeMemoryFile(input: WriteMemoryFileInput): Promise<MemoryState> {
  const relativePath = safeRelativePath(input.relativePath);
  validateMemoryFileContent(relativePath, input.content);
  await initializeMemory();
  const target = join(memoryRoot(), relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, normalizeNewlines(input.content), 'utf-8');
  await commitMemoryChanges(input.reason?.trim() || `Update ${relativePath}`);
  return getMemoryState();
}

export async function setMemoryRemote(url: string): Promise<MemoryState> {
  const remoteUrl = validateRemoteUrl(url);
  await initializeMemory();
  const existing = await git(['remote', 'get-url', 'origin'], { allowFailure: true });
  await git(existing ? ['remote', 'set-url', 'origin', remoteUrl] : ['remote', 'add', 'origin', remoteUrl]);
  await commitMemoryChanges('chore: configure memory remote');
  return getMemoryState();
}

export async function syncMemoryRemote(): Promise<MemoryState> {
  if (!existsSync(systemFilePath()) || !existsSync(join(memoryRoot(), '.git'))) {
    await initializeMemory();
  }
  const remoteUrl = await git(['remote', 'get-url', 'origin'], { allowFailure: true });
  if (!remoteUrl) throw new Error('Configure a memory remote before syncing.');
  const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFailure: true })) || 'main';
  await git(['fetch', 'origin']);
  const remoteBranch = await git(['rev-parse', '--verify', `origin/${branch}`], { allowFailure: true });
  if (remoteBranch) {
    const status = await git(['status', '--porcelain'], { allowFailure: true });
    const { behind } = await readAheadBehind(`origin/${branch}`);
    if (status && behind > 0) {
      throw new Error('Memory has local file changes and the remote has new commits. Sync after saving or resolving memory changes.');
    }
  }
  await commitMemoryChanges('chore: save memory before sync');
  if (remoteBranch) {
    await git(['pull', '--ff-only', 'origin', branch]);
  }
  await git(['push', '-u', 'origin', branch]);
  return getMemoryState();
}

export async function importKnowledgeMemoryDocs(): Promise<MemoryImportResult> {
  await initializeMemory();
  const { content, count } = importedKnowledgeMarkdown();
  const target = join(scopesDir(), 'imported-knowledge', 'memory.md');
  const nextContent = existsSync(target) ? replaceLegacyImportBlock(readText(target), content) : content;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, nextContent, 'utf-8');
  await commitMemoryChanges('Import legacy knowledge notes');
  return { importedCount: count, state: await getMemoryState() };
}

export async function listMemoryFileHistory(relativePath: string): Promise<MemoryGitChange[]> {
  const safePath = safeRelativePath(relativePath);
  if (!existsSync(join(memoryRoot(), '.git'))) return [];
  const output = await git(['log', '--follow', '--date=iso', '--pretty=format:%x1e%H%x1f%an%x1f%ad%x1f%s', '--name-only', '--', safePath], {
    allowFailure: true,
  });
  return parseGitLog(output);
}

export function getActiveMemoryInstructionFiles(
  input: { cwd?: string; repoRoot?: string } = {},
): Array<{ id: string; title: string; path: string; content: string; priority: number }> {
  const files: Array<{ id: string; title: string; path: string; content: string; priority: number }> = [];
  if (existsSync(systemFilePath())) {
    files.push({
      id: `memory-system:${systemFilePath()}`,
      title: 'system.md',
      path: systemFilePath(),
      content: readText(systemFilePath()),
      priority: 80,
    });
  }

  const cwd = input.cwd || input.repoRoot;
  for (const scope of listScopes(cwd)) {
    if (!scope.active) continue;
    files.push({
      id: `memory-scope:${scope.slug}`,
      title: `${scope.name} memory`,
      path: scope.path,
      content: scope.content,
      priority: 160,
    });
  }
  return files;
}

export function memoryScopeSlugForPath(value: string): string {
  return slugify(basename(resolve(value)) || value);
}
