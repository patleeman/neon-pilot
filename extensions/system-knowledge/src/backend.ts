import { existsSync, readFileSync } from 'node:fs';

import { getDurableAgentFilePath, getVaultRoot, resolveRuntimeResources } from '@neon-pilot/core';
import type { ExtensionBackendContext, ExtensionRouteRequest, ExtensionRouteResponse } from '@neon-pilot/extensions';
import { buildRecentReadUsage, listMemoryDocs, listSkillsForProfile, normalizeMemoryPath } from '@neon-pilot/extensions/backend/knowledge';

import { readKnowledgeState, syncKnowledgeState, updateKnowledgeState } from './backend/knowledge/state';
import * as vault from './backend/knowledge/vault';

export async function readState(_input: unknown, ctx: ExtensionBackendContext) {
  return readKnowledgeState(ctx);
}

export async function updateState(input: { repoUrl?: string | null; branch?: string | null }, ctx: ExtensionBackendContext) {
  return updateKnowledgeState(input, ctx);
}

export async function sync(_input: unknown, ctx: ExtensionBackendContext) {
  return syncKnowledgeState(ctx);
}

export async function vaultListFiles(input: unknown, ctx: ExtensionBackendContext) {
  return vault.listFiles(input, ctx);
}

export async function vaultTree(input: { dir?: string }, ctx: ExtensionBackendContext) {
  return vault.tree(input, ctx);
}

export async function vaultReadFile(input: { id: string }, ctx: ExtensionBackendContext) {
  return vault.readFile(input, ctx);
}

export async function vaultWriteFile(input: { id: string; content: string }, ctx: ExtensionBackendContext) {
  return vault.writeFile(input, ctx);
}

export async function vaultCreateFolder(input: { id: string }, ctx: ExtensionBackendContext) {
  return vault.createFolder(input, ctx);
}

export async function vaultDeleteFile(input: { id: string }, ctx: ExtensionBackendContext) {
  return vault.deleteFile(input, ctx);
}

export async function vaultRename(input: { id: string; newName: string }, ctx: ExtensionBackendContext) {
  return vault.rename(input, ctx);
}

export async function vaultMove(input: { id: string; targetDir: string }, ctx: ExtensionBackendContext) {
  return vault.move(input, ctx);
}

export async function vaultBacklinks(input: { id: string }, ctx: ExtensionBackendContext) {
  return vault.backlinks(input, ctx);
}

export async function vaultSearch(input: { q: string; limit?: number }, ctx: ExtensionBackendContext) {
  return vault.search(input, ctx);
}

export async function vaultUploadImage(input: { filename: string; dataUrl: string }, ctx: ExtensionBackendContext) {
  return vault.uploadImage(input, ctx);
}

export async function vaultImportUrl(
  input: { url: string; title?: string; directoryId?: string; sourceApp?: string },
  ctx: ExtensionBackendContext,
) {
  return vault.importUrl(input, ctx);
}

export async function vaultImportSharedItem(input: Parameters<typeof vault.importSharedItem>[0], ctx: ExtensionBackendContext) {
  return vault.importSharedItem(input, ctx);
}

export async function resolvePromptReferences(input: { text: string }, ctx: ExtensionBackendContext) {
  return vault.resolvePromptReferences(input, ctx);
}

export async function readMemory(_input: unknown, ctx: ExtensionBackendContext) {
  const runtime = (ctx as unknown as { runtime?: { getRepoRoot?: () => string } }).runtime;
  const runtimeScope = ctx.runtimeScope ?? ctx.profile;
  const repoRoot = runtime?.getRepoRoot?.() ?? process.cwd();
  const resolvedResources = resolveRuntimeResources(runtimeScope, { repoRoot });
  const agentsMd = resolvedResources.agentsFiles.map((filePath) => ({
    source: inferAgentSource(filePath),
    path: filePath,
    exists: existsSync(filePath),
    content: existsSync(filePath) ? readFileSync(filePath, 'utf-8') : undefined,
  }));
  const skills = listSkillsForProfile(runtimeScope);
  const memoryDocs = listMemoryDocs();
  const usageByPath = buildRecentReadUsage([...skills.map((item) => item.path), ...memoryDocs.map((item) => item.path)]);

  for (const skill of skills) {
    const usage = usageByPath.get(normalizeMemoryPath(skill.path));
    if (usage) Object.assign(skill, usage);
  }
  for (const doc of memoryDocs) {
    const usage = usageByPath.get(normalizeMemoryPath(doc.path));
    if (usage) Object.assign(doc, usage);
  }

  return { agentsMd, skills, memoryDocs };
}

function inferAgentSource(filePath: string): string {
  const baseAgentFile = getDurableAgentFilePath(getVaultRoot());
  if (filePath === baseAgentFile) return 'vault';
  if (filePath.includes('/skills/')) return 'global';
  return 'project';
}

function queryString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function ok(body: unknown): ExtensionRouteResponse {
  return { status: 200, body };
}

export async function asset(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  return vault.assetRoute(req, ctx);
}

export async function vaultTreeRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  return ok(await vault.tree({ dir: queryString(req.query.dir) }, ctx));
}

export async function vaultReadFileRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const id = queryString(req.query.id);
  if (!id) return { status: 400, body: { error: 'id is required' } };
  return ok(await vault.readFile({ id }, ctx));
}

export async function vaultWriteFileRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as { id?: unknown; content?: unknown };
  if (typeof body.id !== 'string' || typeof body.content !== 'string') {
    return { status: 400, body: { error: 'id and content are required' } };
  }
  return ok(await vault.writeFile({ id: body.id, content: body.content }, ctx));
}

export async function vaultDeleteFileRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const id = queryString(req.query.id);
  if (!id) return { status: 400, body: { error: 'id is required' } };
  return ok(await vault.deleteFile({ id }, ctx));
}

export async function vaultCreateFolderRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as { id?: unknown };
  if (typeof body.id !== 'string') return { status: 400, body: { error: 'id is required' } };
  return ok(await vault.createFolder({ id: body.id }, ctx));
}

export async function vaultRenameRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as { id?: unknown; newName?: unknown };
  if (typeof body.id !== 'string' || typeof body.newName !== 'string') {
    return { status: 400, body: { error: 'id and newName are required' } };
  }
  return ok(await vault.rename({ id: body.id, newName: body.newName }, ctx));
}

export async function vaultMoveRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as { id?: unknown; targetDir?: unknown };
  if (typeof body.id !== 'string' || typeof body.targetDir !== 'string') {
    return { status: 400, body: { error: 'id and targetDir are required' } };
  }
  return ok(await vault.move({ id: body.id, targetDir: body.targetDir }, ctx));
}

export async function vaultBacklinksRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const id = queryString(req.query.id);
  if (!id) return { status: 400, body: { error: 'id is required' } };
  return ok(await vault.backlinks({ id }, ctx));
}

export async function vaultSearchRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  return ok(await vault.search({ q: queryString(req.query.q) ?? '', limit: Number(queryString(req.query.limit) ?? 20) }, ctx));
}

export async function vaultUploadImageRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as { filename?: unknown; dataUrl?: unknown };
  if (typeof body.filename !== 'string' || typeof body.dataUrl !== 'string') {
    return { status: 400, body: { error: 'filename and dataUrl are required' } };
  }
  return ok(await vault.uploadImage({ filename: body.filename, dataUrl: body.dataUrl }, ctx));
}

export async function vaultEventsRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  return vault.eventsRoute(req, ctx);
}

export async function memoryRoute(_req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  return ok(await readMemory({}, ctx));
}

export async function vaultImportUrlRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return ok(
    await vault.importSharedItem(
      {
        ...(body.kind === 'text' || body.kind === 'url' || body.kind === 'image' ? { kind: body.kind } : {}),
        ...(typeof body.url === 'string' ? { url: body.url } : {}),
        ...(typeof body.text === 'string' ? { text: body.text } : {}),
        ...(typeof body.title === 'string' ? { title: body.title } : {}),
        ...(typeof body.directoryId === 'string' ? { directoryId: body.directoryId } : {}),
        ...(typeof body.mimeType === 'string' ? { mimeType: body.mimeType } : {}),
        ...(typeof body.fileName === 'string' ? { fileName: body.fileName } : {}),
        ...(typeof body.dataBase64 === 'string' ? { dataBase64: body.dataBase64 } : {}),
        ...(typeof body.sourceApp === 'string' ? { sourceApp: body.sourceApp } : {}),
        ...(typeof body.createdAt === 'string' ? { createdAt: body.createdAt } : {}),
      },
      ctx,
    ),
  );
}
