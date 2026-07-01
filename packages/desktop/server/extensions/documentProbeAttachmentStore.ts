import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, join } from 'node:path';

import { getPiAgentRuntimeDir } from '@neon-pilot/core';
import type { DocumentProbeExtractionResult, StoredDocumentProbeAttachment } from '@neon-pilot/extensions/backend/documents';

import type { PromptDocumentAttachment } from '../conversations/liveSessionQueue.js';

export type { StoredDocumentProbeAttachment };

interface PersistedDocumentProbeAttachmentDocument {
  version: 1;
  attachments: StoredDocumentProbeAttachment[];
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

interface ExtractedText {
  text: string;
  extractor: string;
  warnings?: string[];
}

const attachmentsBySession = new Map<string, Map<string, StoredDocumentProbeAttachment>>();
const MAX_DOCUMENT_PROBE_ATTACHMENTS_PER_PROMPT = 16;
const MAX_DOCUMENT_PROBE_BYTES = 250 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 120_000;

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.jsonl',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.htm',
  '.log',
  '.rtf',
]);

function safeFileName(value: string | undefined, fallback: string): string {
  const cleaned = (value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function resolveDocumentProbeSessionDir(sessionId: string): string {
  return join(getPiAgentRuntimeDir(), 'document-probes', safeFileName(sessionId, 'session'));
}

function resolveDocumentProbeMetadataPath(sessionId: string): string {
  return join(resolveDocumentProbeSessionDir(sessionId), 'metadata.json');
}

function documentIdForFile(path: string, sizeBytes: number, mtimeMs: number): string {
  const hash = createHash('sha256').update(path).update('\0').update(String(sizeBytes)).update('\0').update(String(mtimeMs)).digest('hex');
  return `doc_${hash.slice(0, 12)}`;
}

function normalizeStoredDocument(value: unknown): StoredDocumentProbeAttachment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<StoredDocumentProbeAttachment>;
  if (typeof candidate.id !== 'string' || !/^doc_[a-f0-9]{12}$/.test(candidate.id)) return null;
  if (typeof candidate.path !== 'string' || !candidate.path.trim() || !existsSync(candidate.path)) return null;
  if (typeof candidate.mimeType !== 'string' || !candidate.mimeType.trim()) return null;
  if (!Number.isSafeInteger(candidate.sizeBytes) || Number(candidate.sizeBytes) < 0) return null;
  return {
    id: candidate.id,
    path: candidate.path,
    mimeType: candidate.mimeType.trim(),
    ...(typeof candidate.name === 'string' && candidate.name.trim() ? { name: candidate.name.trim() } : {}),
    sizeBytes: Number(candidate.sizeBytes),
  };
}

function readPersistedDocumentProbeAttachments(sessionId: string): Map<string, StoredDocumentProbeAttachment> {
  const metadataPath = resolveDocumentProbeMetadataPath(sessionId);
  if (!existsSync(metadataPath)) return new Map();
  try {
    const parsed = JSON.parse(readFileSync(metadataPath, 'utf-8')) as Partial<PersistedDocumentProbeAttachmentDocument>;
    const next = new Map<string, StoredDocumentProbeAttachment>();
    for (const attachment of Array.isArray(parsed.attachments) ? parsed.attachments : []) {
      const normalized = normalizeStoredDocument(attachment);
      if (normalized) next.set(normalized.id, normalized);
    }
    return next;
  } catch {
    return new Map();
  }
}

function writePersistedDocumentProbeAttachments(sessionId: string, attachments: Map<string, StoredDocumentProbeAttachment>): void {
  const metadataPath = resolveDocumentProbeMetadataPath(sessionId);
  const document: PersistedDocumentProbeAttachmentDocument = { version: 1, attachments: Array.from(attachments.values()) };
  mkdirSync(resolveDocumentProbeSessionDir(sessionId), { recursive: true });
  writeFileSync(metadataPath, `${JSON.stringify(document, null, 2)}\n`);
}

function getSessionAttachments(sessionId: string): Map<string, StoredDocumentProbeAttachment> {
  const cached = attachmentsBySession.get(sessionId);
  if (cached) return cached;
  const persisted = readPersistedDocumentProbeAttachments(sessionId);
  attachmentsBySession.set(sessionId, persisted);
  return persisted;
}

function readDocumentPath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('document path is required.');
  const path = value.trim();
  if (!isAbsolute(path)) throw new Error('Document attachments must use absolute local file paths.');
  if (!existsSync(path)) throw new Error(`Document file does not exist: ${path}`);
  const stats = statSync(path);
  if (!stats.isFile()) throw new Error(`Document path is not a file: ${path}`);
  if (stats.size > MAX_DOCUMENT_PROBE_BYTES) throw new Error(`Document is too large for probing (${stats.size} bytes).`);
  return path;
}

function normalizeDocumentId(value: unknown): string {
  if (typeof value !== 'string' || !/^doc_[a-f0-9]{12}$/.test(value.trim())) {
    throw new Error('documentId must be a valid document attachment ID.');
  }
  return value.trim();
}

function resolveDocumentById(documentId: string): StoredDocumentProbeAttachment {
  const attachments = getDocumentProbeAttachmentsByIdFromAnySession([documentId]);
  const attachment = attachments[0];
  if (!attachment) throw new Error(`Unknown document ID: ${documentId}`);
  return attachment;
}

function runCommand(command: string, args: string[], timeoutMs = 30_000): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} timed out while extracting document text.`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const result = { stdout: Buffer.concat(stdout).toString('utf-8'), stderr: Buffer.concat(stderr).toString('utf-8') };
      if (code === 0) resolve(result);
      else reject(new Error(result.stderr.trim() || `${command} failed with exit code ${code ?? 'unknown'}.`));
    });
  });
}

async function tryCommand(command: string, args: string[], extractor: string): Promise<ExtractedText | null> {
  try {
    const result = await runCommand(command, args);
    if (!result.stdout.trim()) return null;
    return {
      text: result.stdout,
      extractor,
      warnings: result.stderr.trim() ? [result.stderr.trim()] : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return null;
  }
}

function isPlainTextDocument(attachment: StoredDocumentProbeAttachment): boolean {
  const mimeType = attachment.mimeType.toLowerCase();
  const extension = extname(attachment.path).toLowerCase();
  return mimeType.startsWith('text/') || TEXT_EXTENSIONS.has(extension) || mimeType === 'application/json';
}

async function extractPlainText(attachment: StoredDocumentProbeAttachment): Promise<ExtractedText> {
  const buffer = await readFile(attachment.path);
  return { text: buffer.toString('utf-8'), extractor: 'plain-text' };
}

async function extractWithAvailableTools(attachment: StoredDocumentProbeAttachment): Promise<ExtractedText> {
  const extension = extname(attachment.path).toLowerCase();
  if (isPlainTextDocument(attachment)) return extractPlainText(attachment);

  if (attachment.mimeType === 'application/pdf' || extension === '.pdf') {
    const pdfText = await tryCommand('pdftotext', ['-layout', '-enc', 'UTF-8', attachment.path, '-'], 'pdftotext');
    if (pdfText) return pdfText;
  }

  const markitdown = await tryCommand('markitdown', [attachment.path], 'markitdown');
  if (markitdown) return markitdown;

  const pandoc = await tryCommand('pandoc', [attachment.path, '-t', 'plain'], 'pandoc');
  if (pandoc) return pandoc;

  if (process.platform === 'darwin') {
    const textutil = await tryCommand('textutil', ['-convert', 'txt', '-stdout', attachment.path], 'textutil');
    if (textutil) return textutil;
  }

  throw new Error(
    `No document text extractor is available for ${attachment.name ?? basename(attachment.path)}. Install pdftotext, pandoc, markitdown, or use a plain text file.`,
  );
}

function truncateExtractedText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_EXTRACTED_TEXT_CHARS) return { text, truncated: false };
  return {
    text: `${text.slice(0, MAX_EXTRACTED_TEXT_CHARS)}\n\n[Document text truncated after ${MAX_EXTRACTED_TEXT_CHARS} characters.]`,
    truncated: true,
  };
}

export function rememberDocumentProbeAttachments(
  sessionId: string,
  documents: PromptDocumentAttachment[],
): StoredDocumentProbeAttachment[] {
  if (documents.length > MAX_DOCUMENT_PROBE_ATTACHMENTS_PER_PROMPT) {
    throw new Error(`Document probing supports at most ${MAX_DOCUMENT_PROBE_ATTACHMENTS_PER_PROMPT} documents per prompt.`);
  }

  const sessionAttachments = getSessionAttachments(sessionId);
  const stored = documents.map((document, index) => {
    const path = readDocumentPath(document.path);
    const stats = statSync(path);
    const id = documentIdForFile(path, stats.size, stats.mtimeMs);
    const attachment: StoredDocumentProbeAttachment = {
      id,
      path,
      mimeType: document.mimeType.trim() || 'application/octet-stream',
      name: document.name?.trim() || basename(path) || `document-${index + 1}`,
      sizeBytes: stats.size,
    };
    sessionAttachments.set(id, attachment);
    return attachment;
  });
  attachmentsBySession.set(sessionId, sessionAttachments);
  writePersistedDocumentProbeAttachments(sessionId, sessionAttachments);
  return stored;
}

export function getDocumentProbeAttachments(sessionId: string): StoredDocumentProbeAttachment[] {
  return Array.from(getSessionAttachments(sessionId).values());
}

export function getDocumentProbeAttachmentsById(sessionId: string, documentIds: string[]): StoredDocumentProbeAttachment[] {
  const sessionAttachments = getSessionAttachments(sessionId);
  return documentIds
    .map((id) => sessionAttachments.get(id))
    .filter((attachment): attachment is StoredDocumentProbeAttachment => Boolean(attachment));
}

export function getDocumentProbeAttachmentsByIdFromAnySession(documentIds: string[]): StoredDocumentProbeAttachment[] {
  const found = new Map<string, StoredDocumentProbeAttachment>();
  const remaining = new Set(documentIds);
  for (const [, sessionAttachments] of attachmentsBySession) {
    for (const [id, attachment] of sessionAttachments) {
      if (remaining.has(id)) {
        found.set(id, attachment);
        remaining.delete(id);
      }
    }
  }
  if (remaining.size > 0) {
    const probesDir = join(getPiAgentRuntimeDir(), 'document-probes');
    if (existsSync(probesDir)) {
      for (const entry of readdirSync(probesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const sessionAttachments = readPersistedDocumentProbeAttachments(entry.name);
        attachmentsBySession.set(entry.name, sessionAttachments);
        for (const [id, attachment] of sessionAttachments) {
          if (remaining.has(id)) {
            found.set(id, attachment);
            remaining.delete(id);
          }
        }
        if (remaining.size === 0) break;
      }
    }
  }
  return documentIds.map((id) => found.get(id)!).filter(Boolean);
}

export async function extractDocumentText(input: { documentId: string }): Promise<DocumentProbeExtractionResult> {
  const documentId = normalizeDocumentId(input.documentId);
  const attachment = resolveDocumentById(documentId);
  const extracted = await extractWithAvailableTools(attachment);
  const truncated = truncateExtractedText(extracted.text.trim());
  const text = truncated.text || '(no text extracted)';
  return {
    text,
    content: [{ type: 'text', text }],
    details: {
      documentId,
      mimeType: attachment.mimeType,
      ...(attachment.name ? { name: attachment.name } : {}),
      sizeBytes: attachment.sizeBytes,
      extractor: extracted.extractor,
      truncated: truncated.truncated,
      warnings: extracted.warnings ?? [],
    },
  };
}

export function clearDocumentProbeAttachmentCacheForTests(): void {
  attachmentsBySession.clear();
}
