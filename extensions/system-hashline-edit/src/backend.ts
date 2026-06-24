import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

type BackendContext = ExtensionBackendContext & {
  cwd?: string;
  toolContext?: { cwd?: string; conversationId?: string; sessionId?: string };
};

type Op =
  | { kind: 'swap'; start: number; end: number; body: string[] }
  | { kind: 'delete'; start: number; end: number }
  | { kind: 'insert'; mode: 'head' | 'tail' | 'pre' | 'post'; line?: number; body: string[] };

interface Section {
  path: string;
  tag: string;
  ops: Op[];
}

const MAX_READ_LINES = 2000;
const MAX_READ_BYTES = 512 * 1024;

function getCwd(ctx: BackendContext): string {
  return ctx.toolContext?.cwd ?? ctx.cwd ?? process.cwd();
}

function normalizeWorkspacePath(cwd: string, rawPath: string): { relativePath: string; absolutePath: string } {
  const trimmed = rawPath.trim();
  if (!trimmed) throw new Error('path is required.');
  const absolutePath = resolve(cwd, trimmed);
  const relativePath = relative(cwd, absolutePath).replace(/\\/g, '/');
  if (!relativePath || relativePath.startsWith('..') || relativePath === '.') throw new Error(`Invalid workspace path: ${rawPath}`);
  return { relativePath, absolutePath };
}

function normalizeForHash(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+(?=\n|$)/g, '');
}

function computeTag(text: string): string {
  return createHash('sha256').update(normalizeForHash(text)).digest('hex').slice(0, 4).toUpperCase();
}

function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (normalized.endsWith('\n') && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function joinLines(lines: string[], hadFinalNewline: boolean): string {
  let text = lines.join('\n');
  if (hadFinalNewline && !text.endsWith('\n')) text += '\n';
  return text;
}

function formatNumberedLines(lines: string[], startLine: number): string {
  return lines.map((line, index) => `${startLine + index}:${line}`).join('\n');
}

function clampPositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function formatToolError(error: unknown, fallback: string): string {
  const code = typeof error === 'object' && error ? (error as { code?: unknown }).code : undefined;
  if (code === 'ENOENT') return 'File not found. Check the path and run read_hashline again.';
  if (code === 'EACCES' || code === 'EPERM') return 'File permission denied. Check access and try again.';

  const message = error instanceof Error ? error.message : String(error);
  if (!message || message.includes('\n') || /\s+at\s+\S+/i.test(message)) return fallback;
  return message;
}

function toolError(error: unknown, fallback: string) {
  return {
    content: [{ type: 'text', text: formatToolError(error, fallback) }],
    isError: true,
  };
}

export async function readHashline(input: { path: string; offset?: number; limit?: number }, ctx: BackendContext) {
  try {
    const cwd = getCwd(ctx);
    const { relativePath, absolutePath } = normalizeWorkspacePath(cwd, input.path);
    const raw = await readFile(absolutePath, 'utf8');
    if (Buffer.byteLength(raw, 'utf8') > MAX_READ_BYTES)
      throw new Error(`File is too large for read_hashline (${MAX_READ_BYTES} byte limit).`);
    const tag = computeTag(raw);
    const lines = splitLines(raw);
    const offset = clampPositiveInt(input.offset, 1);
    const limit = Math.min(clampPositiveInt(input.limit, MAX_READ_LINES), MAX_READ_LINES);
    const startIndex = Math.min(offset - 1, lines.length);
    const visible = lines.slice(startIndex, startIndex + limit);
    const omitted =
      startIndex + visible.length < lines.length ? `\n… ${lines.length - (startIndex + visible.length)} more line(s) omitted` : '';
    const text = `[${relativePath}#${tag}]\n${formatNumberedLines(visible, startIndex + 1)}${omitted}`;
    return {
      content: [{ type: 'text', text }],
      details: { path: relativePath, tag, startLine: startIndex + 1, lines: visible.length, totalLines: lines.length },
    };
  } catch (error) {
    return toolError(error, 'Could not read hashline file. Check the path and try again.');
  }
}

function parseHeader(line: string): { path: string; tag: string } | null {
  const match = /^\[([^#\]\r\n]+)#([0-9a-fA-F]{4})\]\s*$/.exec(line);
  if (!match) return null;
  return { path: match[1].trim(), tag: match[2].toUpperCase() };
}

function parseRange(raw: string): { start: number; end: number } {
  const range = /^(\d+)(?:\.=(\d+))?$/.exec(raw.trim());
  if (!range) throw new Error(`Invalid line range: ${raw}`);
  const start = Number(range[1]);
  const end = Number(range[2] ?? range[1]);
  if (start < 1 || end < start) throw new Error(`Invalid line range: ${raw}`);
  return { start, end };
}

function readBody(lines: string[], start: number): { body: string[]; next: number } {
  const body: string[] = [];
  let index = start;
  for (; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!line.startsWith('+')) break;
    body.push(line.slice(1));
  }
  return { body, next: index };
}

function parseSections(input: string): Section[] {
  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section | null = null;
  let index = 0;
  while (index < lines.length) {
    const raw = lines[index] ?? '';
    if (!raw.trim()) {
      index += 1;
      continue;
    }
    const header = parseHeader(raw);
    if (header) {
      current = { path: header.path, tag: header.tag, ops: [] };
      sections.push(current);
      index += 1;
      continue;
    }
    if (!current) throw new Error(`Hashline input must start with [PATH#TAG]; got ${JSON.stringify(raw)}.`);

    let match = /^SWAP\s+(\d+(?:\.=\d+)?)\s*:\s*$/.exec(raw);
    if (match) {
      const { start, end } = parseRange(match[1]);
      const { body, next } = readBody(lines, index + 1);
      current.ops.push({ kind: 'swap', start, end, body });
      index = next;
      continue;
    }

    match = /^DEL\s+(\d+(?:\.=\d+)?)\s*$/.exec(raw);
    if (match) {
      const { start, end } = parseRange(match[1]);
      current.ops.push({ kind: 'delete', start, end });
      index += 1;
      continue;
    }

    match = /^INS\.(HEAD|TAIL)\s*:\s*$/.exec(raw);
    if (match) {
      const { body, next } = readBody(lines, index + 1);
      current.ops.push({ kind: 'insert', mode: match[1] === 'HEAD' ? 'head' : 'tail', body });
      index = next;
      continue;
    }

    match = /^INS\.(PRE|POST)\s+(\d+)\s*:\s*$/.exec(raw);
    if (match) {
      const line = Number(match[2]);
      if (line < 1) throw new Error(`Invalid line number: ${match[2]}`);
      const { body, next } = readBody(lines, index + 1);
      current.ops.push({ kind: 'insert', mode: match[1] === 'PRE' ? 'pre' : 'post', line, body });
      index = next;
      continue;
    }

    throw new Error(`Unsupported hashline operation: ${raw}. Supported ops: SWAP, DEL, INS.PRE, INS.POST, INS.HEAD, INS.TAIL.`);
  }
  if (sections.length === 0) throw new Error('No hashline sections found.');
  return sections;
}

function validateLine(line: number, lines: string[], label: string): void {
  if (line < 1 || line > lines.length) throw new Error(`${label} line ${line} is out of bounds (file has ${lines.length} lines).`);
}

function applyOps(original: string, ops: Op[]): { text: string; firstChangedLine?: number } {
  const hadFinalNewline = original.endsWith('\n') || original.endsWith('\r\n');
  const lines = splitLines(original);
  const next = [...lines];
  let firstChangedLine: number | undefined;

  const ordered = ops
    .map((op, index) => ({ op, index }))
    .sort((a, b) => {
      const lineA =
        a.op.kind === 'insert'
          ? a.op.mode === 'head'
            ? 0
            : a.op.mode === 'tail'
              ? Number.MAX_SAFE_INTEGER
              : (a.op.line ?? 0)
          : a.op.start;
      const lineB =
        b.op.kind === 'insert'
          ? b.op.mode === 'head'
            ? 0
            : b.op.mode === 'tail'
              ? Number.MAX_SAFE_INTEGER
              : (b.op.line ?? 0)
          : b.op.start;
      return lineB - lineA || b.index - a.index;
    });

  for (const { op } of ordered) {
    if (op.kind === 'swap') {
      validateLine(op.start, lines, 'SWAP start');
      validateLine(op.end, lines, 'SWAP end');
      next.splice(op.start - 1, op.end - op.start + 1, ...op.body);
      firstChangedLine = Math.min(firstChangedLine ?? op.start, op.start);
      continue;
    }
    if (op.kind === 'delete') {
      validateLine(op.start, lines, 'DEL start');
      validateLine(op.end, lines, 'DEL end');
      next.splice(op.start - 1, op.end - op.start + 1);
      firstChangedLine = Math.min(firstChangedLine ?? op.start, op.start);
      continue;
    }
    if (op.mode === 'head') {
      next.splice(0, 0, ...op.body);
      firstChangedLine = 1;
    } else if (op.mode === 'tail') {
      next.splice(next.length, 0, ...op.body);
      firstChangedLine = Math.min(firstChangedLine ?? next.length, next.length);
    } else if (op.mode === 'pre') {
      validateLine(op.line ?? 0, lines, 'INS.PRE');
      next.splice((op.line ?? 1) - 1, 0, ...op.body);
      firstChangedLine = Math.min(firstChangedLine ?? op.line ?? 1, op.line ?? 1);
    } else {
      validateLine(op.line ?? 0, lines, 'INS.POST');
      next.splice(op.line ?? 0, 0, ...op.body);
      firstChangedLine = Math.min(firstChangedLine ?? op.line ?? 1, op.line ?? 1);
    }
  }

  return { text: joinLines(next, hadFinalNewline), firstChangedLine };
}

function buildPreview(before: string, after: string, aroundLine?: number): string {
  const lines = splitLines(after);
  const start = Math.max(1, (aroundLine ?? 1) - 3);
  const end = Math.min(lines.length, (aroundLine ?? 1) + 8);
  return formatNumberedLines(lines.slice(start - 1, end), start);
}

export async function hashlineEdit(input: { input: string }, ctx: BackendContext) {
  try {
    const cwd = getCwd(ctx);
    const sections = parseSections(input.input);
    const prepared: Array<{
      section: Section;
      relativePath: string;
      absolutePath: string;
      before: string;
      after: string;
      firstChangedLine?: number;
    }> = [];

    for (const section of sections) {
      const { relativePath, absolutePath } = normalizeWorkspacePath(cwd, section.path);
      const before = await readFile(absolutePath, 'utf8');
      const liveTag = computeTag(before);
      if (liveTag !== section.tag) {
        throw new Error(
          `Edit rejected for ${relativePath}: section tag #${section.tag} does not match live file #${liveTag}. Re-run read_hashline and retry with the fresh header.`,
        );
      }
      const applied = applyOps(before, section.ops);
      if (applied.text === before) throw new Error(`Edits to ${relativePath} produced no change. Re-read the file before retrying.`);
      prepared.push({ section, relativePath, absolutePath, before, after: applied.text, firstChangedLine: applied.firstChangedLine });
    }

    for (const entry of prepared) {
      await mkdir(dirname(entry.absolutePath), { recursive: true });
      await writeFile(entry.absolutePath, entry.after, 'utf8');
    }

    const resultText = prepared
      .map((entry) => {
        const tag = computeTag(entry.after);
        const added = Math.max(0, splitLines(entry.after).length - splitLines(entry.before).length);
        const removed = Math.max(0, splitLines(entry.before).length - splitLines(entry.after).length);
        return `[${entry.relativePath}#${tag}]\n${buildPreview(entry.before, entry.after, entry.firstChangedLine)}\n\n${added} added, ${removed} removed. Reuse the new header or run read_hashline before the next edit.`;
      })
      .join('\n\n');

    return { content: [{ type: 'text', text: resultText }], details: { files: prepared.map((entry) => entry.relativePath) } };
  } catch (error) {
    return toolError(error, 'Could not apply hashline edit. Re-run read_hashline and try again.');
  }
}
