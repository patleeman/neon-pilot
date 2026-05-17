import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

import type { ExtensionBackendContext } from '@personal-agent/extensions/backend';

interface ApplyPatchInput {
  patch?: string;
  path?: string;
  edits?: Array<{ oldText: string; newText: string }>;
}

type FilePatch =
  | { type: 'add'; path: string; lines: string[] }
  | { type: 'delete'; path: string }
  | { type: 'update'; path: string; moveTo?: string; hunks: Hunk[] };

interface Hunk {
  anchor?: string;
  lines: Array<{ kind: 'context' | 'remove' | 'add'; text: string }>;
}

interface ApplyResult {
  action: string;
  path: string;
  linesAdded?: number;
  linesRemoved?: number;
  movedTo?: string;
}

type ToolContext = ExtensionBackendContext & { cwd?: string; toolContext?: { cwd?: string } };

function readCwd(ctx: ToolContext): string {
  return ctx.toolContext?.cwd ?? ctx.cwd ?? process.cwd();
}

function resolveInsideCwd(cwd: string, path: string): string {
  const normalized = path.trim();
  if (!normalized) throw new Error('Patch file path is required.');
  const resolved = resolve(cwd, normalized);
  const root = resolve(cwd);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) throw new Error(`Patch path escapes cwd: ${path}`);
  return resolved;
}

function isFileHeader(line: string): boolean {
  return (
    line.startsWith('*** Add File: ') ||
    line.startsWith('*** Delete File: ') ||
    line.startsWith('*** Update File: ') ||
    line === '*** End Patch'
  );
}

function parsePatch(patch: string): FilePatch[] {
  const lines = patch.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines[0] !== '*** Begin Patch') throw new Error('Patch must start with *** Begin Patch.');
  if (lines.at(-1) !== '*** End Patch') throw new Error('Patch must end with *** End Patch.');

  const patches: FilePatch[] = [];
  let index = 1;
  while (index < lines.length - 1) {
    const line = lines[index++] ?? '';
    if (line.startsWith('*** Add File: ')) {
      const path = line.slice('*** Add File: '.length).trim();
      const content: string[] = [];
      while (index < lines.length - 1 && !isFileHeader(lines[index]!)) {
        const entry = lines[index++] ?? '';
        if (!entry.startsWith('+')) throw new Error(`Add File lines must start with +: ${entry}`);
        content.push(entry.slice(1));
      }
      patches.push({ type: 'add', path, lines: content });
      continue;
    }
    if (line.startsWith('*** Delete File: ')) {
      patches.push({ type: 'delete', path: line.slice('*** Delete File: '.length).trim() });
      continue;
    }
    if (line.startsWith('*** Update File: ')) {
      const path = line.slice('*** Update File: '.length).trim();
      let moveTo: string | undefined;
      const hunks: Hunk[] = [];
      while (index < lines.length - 1 && !isFileHeader(lines[index]!)) {
        if (lines[index]!.startsWith('*** Move to: ')) {
          moveTo = lines[index++]!.slice('*** Move to: '.length).trim();
          continue;
        }
        let anchor: string | undefined;
        if (lines[index]!.startsWith('@@')) {
          const marker = lines[index++]!;
          const rawAnchor = marker.slice(2).trim();
          anchor = rawAnchor.endsWith('@@') ? rawAnchor.slice(0, -2).trim() : rawAnchor;
        }
        const hunkLines: Hunk['lines'] = [];
        while (
          index < lines.length - 1 &&
          !isFileHeader(lines[index]!) &&
          !lines[index]!.startsWith('*** Move to: ') &&
          !lines[index]!.startsWith('@@')
        ) {
          const entry = lines[index++] ?? '';
          const prefix = entry[0];
          if (prefix === ' ') hunkLines.push({ kind: 'context', text: entry.slice(1) });
          else if (prefix === '-') hunkLines.push({ kind: 'remove', text: entry.slice(1) });
          else if (prefix === '+') hunkLines.push({ kind: 'add', text: entry.slice(1) });
          else if (entry === '') hunkLines.push({ kind: 'context', text: '' });
          else throw new Error(`Invalid hunk line prefix: ${entry}`);
        }
        if (hunkLines.length === 0) throw new Error(`Empty update hunk for ${path}.`);
        hunks.push({ ...(anchor ? { anchor } : {}), lines: hunkLines });
      }
      patches.push({ type: 'update', path, ...(moveTo ? { moveTo } : {}), hunks });
      continue;
    }
    if (!line.trim()) continue;
    throw new Error(`Unknown patch header: ${line}`);
  }
  return patches;
}

function splitContent(content: string): { lines: string[]; trailingNewline: boolean } {
  const trailingNewline = content.endsWith('\n');
  const lines = content.replace(/\n$/, '').split('\n');
  return { lines: content.length === 0 ? [] : lines, trailingNewline };
}

function joinContent(lines: string[], trailingNewline: boolean): string {
  return `${lines.join('\n')}${trailingNewline && lines.length > 0 ? '\n' : ''}`;
}

function norm(value: string): string {
  return value.normalize('NFC').trimEnd();
}

function findSequence(lines: string[], sequence: string[], start: number): number {
  if (sequence.length === 0) return start;
  for (let i = start; i <= lines.length - sequence.length; i += 1) {
    if (sequence.every((line, offset) => lines[i + offset] === line)) return i;
  }
  for (let i = start; i <= lines.length - sequence.length; i += 1) {
    if (sequence.every((line, offset) => norm(lines[i + offset] ?? '') === norm(line))) return i;
  }
  return -1;
}

function applyHunks(original: string, hunks: Hunk[]): { content: string; added: number; removed: number } {
  const state = splitContent(original);
  const lines = [...state.lines];
  let cursor = 0;
  let added = 0;
  let removed = 0;

  for (const hunk of hunks) {
    if (hunk.anchor) {
      const anchorIndex = findSequence(lines, [hunk.anchor], cursor);
      if (anchorIndex >= 0) cursor = anchorIndex;
    }
    const oldLines = hunk.lines.filter((line) => line.kind !== 'add').map((line) => line.text);
    const newLines = hunk.lines.filter((line) => line.kind !== 'remove').map((line) => line.text);
    const index = findSequence(lines, oldLines, cursor);
    if (index < 0) throw new Error(`Could not locate patch hunk near${hunk.anchor ? ` anchor "${hunk.anchor}"` : ''}.`);
    lines.splice(index, oldLines.length, ...newLines);
    cursor = index + newLines.length;
    added += hunk.lines.filter((line) => line.kind === 'add').length;
    removed += hunk.lines.filter((line) => line.kind === 'remove').length;
  }

  return { content: joinContent(lines, state.trailingNewline), added, removed };
}

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function preflightFilePatch(filePatch: FilePatch, cwd: string): void {
  const target = resolveInsideCwd(cwd, filePatch.path);
  if (filePatch.type === 'add') {
    if (existsSync(target)) throw new Error(`Cannot add file that already exists: ${filePatch.path}`);
  } else if (filePatch.type === 'delete') {
    if (!existsSync(target)) throw new Error(`Cannot delete missing file: ${filePatch.path}`);
  } else {
    if (!existsSync(target)) throw new Error(`Cannot update missing file: ${filePatch.path}`);
    if (filePatch.hunks.length === 0) throw new Error(`No hunks provided for update: ${filePatch.path}`);
    if (filePatch.moveTo) {
      const movedTarget = resolveInsideCwd(cwd, filePatch.moveTo);
      if (existsSync(movedTarget)) throw new Error(`Cannot move to existing file: ${filePatch.moveTo}`);
    }
  }
}

function applyFilePatch(filePatch: FilePatch, cwd: string): ApplyResult {
  const target = resolveInsideCwd(cwd, filePatch.path);
  if (filePatch.type === 'add') {
    ensureParent(target);
    writeFileSync(target, `${filePatch.lines.join('\n')}${filePatch.lines.length > 0 ? '\n' : ''}`);
    return { action: 'added', path: filePatch.path, linesAdded: filePatch.lines.length };
  }
  if (filePatch.type === 'delete') {
    rmSync(target);
    return { action: 'deleted', path: filePatch.path };
  }

  const original = readFileSync(target, 'utf-8');
  const applied = applyHunks(original, filePatch.hunks);
  writeFileSync(target, applied.content);
  if (filePatch.moveTo) {
    const movedTarget = resolveInsideCwd(cwd, filePatch.moveTo);
    ensureParent(movedTarget);
    renameSync(target, movedTarget);
  }
  return {
    action: filePatch.moveTo ? 'moved' : 'updated',
    path: filePatch.path,
    linesAdded: applied.added,
    linesRemoved: applied.removed,
    ...(filePatch.moveTo ? { movedTo: filePatch.moveTo } : {}),
  };
}

function legacyEditsToPatch(input: ApplyPatchInput): string {
  const path = input.path?.trim();
  if (!path) throw new Error('Either patch or path is required.');
  if (!input.edits?.length) throw new Error('Either patch or edits are required.');
  return [
    '*** Begin Patch',
    `*** Update File: ${path}`,
    ...input.edits.flatMap((edit) => [
      '@@',
      ...edit.oldText.split('\n').map((line) => `-${line}`),
      ...edit.newText.split('\n').map((line) => `+${line}`),
    ]),
    '*** End Patch',
  ].join('\n');
}

function formatResults(results: ApplyResult[]): string {
  return [
    `Applied patch to ${results.length} file${results.length === 1 ? '' : 's'}.`,
    ...results.map((result) => {
      const counts =
        result.linesAdded !== undefined || result.linesRemoved !== undefined
          ? ` (+${result.linesAdded ?? 0}/-${result.linesRemoved ?? 0})`
          : '';
      const move = result.movedTo ? ` -> ${result.movedTo}` : '';
      return `- ${result.action}: ${result.path}${move}${counts}`;
    }),
  ].join('\n');
}

function applyPatchesFromInput(input: ApplyPatchInput, ctx: ToolContext): ApplyResult[] {
  const cwd = readCwd(ctx);
  const patch = input.patch?.trim() ?? legacyEditsToPatch(input);
  const filePatches = parsePatch(patch);

  // Preflight: validate every operation before applying any.
  // This ensures atomicity — if one file fails validation, no changes
  // are written to disk.
  for (const filePatch of filePatches) {
    preflightFilePatch(filePatch, cwd);
  }

  // Apply phase: now safe to write since preflight passed.
  const results = filePatches.map((filePatch) => applyFilePatch(filePatch, cwd));
  return results;
}

export async function applyPatch(input: ApplyPatchInput, ctx: ToolContext) {
  if (!input.patch?.trim()) throw new Error('patch is required.');
  const results = applyPatchesFromInput(input, ctx);
  return { text: formatResults(results), details: { results } };
}

export async function applyPatchEdit(input: ApplyPatchInput, ctx: ToolContext) {
  const patch = input.patch?.trim();
  if (!patch && !input.edits?.length) throw new Error('Either patch or edits are required.');
  const results = applyPatchesFromInput(input, ctx);
  return { text: formatResults(results), details: { results } };
}
