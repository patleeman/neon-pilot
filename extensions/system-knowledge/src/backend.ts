import { existsSync, readFileSync } from 'node:fs';

import type { ExtensionBackendContext, ExtensionRouteRequest, ExtensionRouteResponse } from '@neon-pilot/extensions';
import {
  buildRecentReadUsage,
  getDurableAgentFilePath,
  getKnowledgeRoot,
  listMemoryDocs,
  listSkillsForProfile,
  normalizeMemoryPath,
  resolveRuntimeResources,
} from '@neon-pilot/extensions/backend/knowledge';

import * as knowledgeFiles from './backend/knowledge/files';
import { readKnowledgeState, syncKnowledgeState, updateKnowledgeState } from './backend/knowledge/state';

export async function readState(_input: unknown, ctx: ExtensionBackendContext) {
  return readKnowledgeState(ctx);
}

export async function updateState(
  input: { repoUrl?: string | null; branch?: string | null; directories?: string[] | null },
  ctx: ExtensionBackendContext,
) {
  return updateKnowledgeState(input, ctx);
}

export async function sync(_input: unknown, ctx: ExtensionBackendContext) {
  return syncKnowledgeState(ctx);
}

export async function provideKnowledgeInstructions(_input: unknown, ctx: ExtensionBackendContext) {
  const state = await readKnowledgeState(ctx);
  const paths = state.effectiveRoots.length > 0 ? state.effectiveRoots : [state.effectiveRoot].filter(Boolean);
  if (paths.length === 0) return { layers: [] };
  return {
    layers: [
      {
        id: 'system-knowledge:knowledge-paths',
        title: 'Knowledge paths',
        content: [
          '## Knowledge Base Paths',
          '',
          'These directories contain reference material, not behavior instructions. Use them when the user tags files with @ or explicitly asks to inspect knowledge base material.',
          ...paths.map((path, index) => `- ${index === 0 ? 'Primary' : `Additional ${index}`}: ${path}`),
        ].join('\n'),
        scope: 'runtime',
        priority: 925,
        mutable: false,
        risk: 'normal',
      },
    ],
  };
}

export async function knowledgeListFiles(input: unknown, ctx: ExtensionBackendContext) {
  return knowledgeFiles.listFiles(input, ctx);
}

export async function knowledgeTree(input: { dir?: string }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.tree(input, ctx);
}

export async function knowledgeReadFile(input: { id: string }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.readFile(input, ctx);
}

export async function knowledgeWriteFile(input: { id: string; content: string }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.writeFile(input, ctx);
}

export async function knowledgeCreateFolder(input: { id: string }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.createFolder(input, ctx);
}

export async function knowledgeDeleteFile(input: { id: string }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.deleteFile(input, ctx);
}

export async function knowledgeRename(input: { id: string; newName: string }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.rename(input, ctx);
}

export async function knowledgeMove(input: { id: string; targetDir: string }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.move(input, ctx);
}

export async function knowledgeBacklinks(input: { id: string }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.backlinks(input, ctx);
}

export async function knowledgeSearch(input: { q: string; limit?: number }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.search(input, ctx);
}

export async function knowledgeUploadImage(input: { filename: string; dataUrl: string }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.uploadImage(input, ctx);
}

export async function knowledgeImportUrl(
  input: { url: string; title?: string; directoryId?: string; sourceApp?: string },
  ctx: ExtensionBackendContext,
) {
  return knowledgeFiles.importUrl(input, ctx);
}

export async function knowledgeImportSharedItem(
  input: Parameters<typeof knowledgeFiles.importSharedItem>[0],
  ctx: ExtensionBackendContext,
) {
  return knowledgeFiles.importSharedItem(input, ctx);
}

export async function resolvePromptReferences(input: { text: string }, ctx: ExtensionBackendContext) {
  return knowledgeFiles.resolvePromptReferences(input, ctx);
}

export async function readMemory(_input: unknown, ctx: ExtensionBackendContext) {
  const runtime = (ctx as unknown as { runtime?: { getRepoRoot?: () => string } }).runtime;
  const runtimeScope = ctx.runtimeScope ?? ctx.profile;
  const repoRoot = runtime?.getRepoRoot?.() ?? process.cwd();
  const resolvedResources = await resolveRuntimeResources<{ agentsFiles: string[] }>(runtimeScope, { repoRoot });
  const agentsMd = await Promise.all(
    resolvedResources.agentsFiles.map(async (filePath) => ({
      source: await inferAgentSource(filePath),
      path: filePath,
      exists: existsSync(filePath),
      content: existsSync(filePath) ? readFileSync(filePath, 'utf-8') : undefined,
    })),
  );
  const [skills, memoryDocs] = await Promise.all([listSkillsForProfile(runtimeScope), listMemoryDocs()]);
  const usageByPath = await buildRecentReadUsage([...skills.map((item) => item.path), ...memoryDocs.map((item) => item.path)]);

  for (const skill of skills) {
    const usage = usageByPath.get(await normalizeMemoryPath(skill.path));
    if (usage) Object.assign(skill, usage);
  }
  for (const doc of memoryDocs) {
    const usage = usageByPath.get(await normalizeMemoryPath(doc.path));
    if (usage) Object.assign(doc, usage);
  }

  return { agentsMd, skills, memoryDocs };
}

async function inferAgentSource(filePath: string): Promise<string> {
  const baseAgentFile = await getDurableAgentFilePath(await getKnowledgeRoot());
  if (filePath === baseAgentFile) return 'knowledge';
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
  return knowledgeFiles.assetRoute(req, ctx);
}

export async function knowledgeTreeRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  return ok(await knowledgeFiles.tree({ dir: queryString(req.query.dir) }, ctx));
}

export async function knowledgeReadFileRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const id = queryString(req.query.id);
  if (!id) return { status: 400, body: { error: 'id is required' } };
  return ok(await knowledgeFiles.readFile({ id }, ctx));
}

export async function knowledgeWriteFileRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as { id?: unknown; content?: unknown };
  if (typeof body.id !== 'string' || typeof body.content !== 'string') {
    return { status: 400, body: { error: 'id and content are required' } };
  }
  return ok(await knowledgeFiles.writeFile({ id: body.id, content: body.content }, ctx));
}

export async function knowledgeDeleteFileRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const id = queryString(req.query.id);
  if (!id) return { status: 400, body: { error: 'id is required' } };
  return ok(await knowledgeFiles.deleteFile({ id }, ctx));
}

export async function knowledgeCreateFolderRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as { id?: unknown };
  if (typeof body.id !== 'string') return { status: 400, body: { error: 'id is required' } };
  return ok(await knowledgeFiles.createFolder({ id: body.id }, ctx));
}

export async function knowledgeRenameRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as { id?: unknown; newName?: unknown };
  if (typeof body.id !== 'string' || typeof body.newName !== 'string') {
    return { status: 400, body: { error: 'id and newName are required' } };
  }
  return ok(await knowledgeFiles.rename({ id: body.id, newName: body.newName }, ctx));
}

export async function knowledgeMoveRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as { id?: unknown; targetDir?: unknown };
  if (typeof body.id !== 'string' || typeof body.targetDir !== 'string') {
    return { status: 400, body: { error: 'id and targetDir are required' } };
  }
  return ok(await knowledgeFiles.move({ id: body.id, targetDir: body.targetDir }, ctx));
}

export async function knowledgeBacklinksRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const id = queryString(req.query.id);
  if (!id) return { status: 400, body: { error: 'id is required' } };
  return ok(await knowledgeFiles.backlinks({ id }, ctx));
}

export async function knowledgeSearchRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  return ok(await knowledgeFiles.search({ q: queryString(req.query.q) ?? '', limit: Number(queryString(req.query.limit) ?? 20) }, ctx));
}

export async function knowledgeUploadImageRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as { filename?: unknown; dataUrl?: unknown };
  if (typeof body.filename !== 'string' || typeof body.dataUrl !== 'string') {
    return { status: 400, body: { error: 'filename and dataUrl are required' } };
  }
  return ok(await knowledgeFiles.uploadImage({ filename: body.filename, dataUrl: body.dataUrl }, ctx));
}

export async function knowledgeEventsRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  return knowledgeFiles.eventsRoute(req, ctx);
}

export async function memoryRoute(_req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  return ok(await readMemory({}, ctx));
}

export async function knowledgeImportUrlRoute(req: ExtensionRouteRequest, ctx: ExtensionBackendContext) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return ok(
    await knowledgeFiles.importSharedItem(
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
