import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { listExtensionInstallSummaries } from '@neon-pilot/extensions/backend/extensions';
import { buildMergedMcpConfigDocument, readBundledSkillMcpManifests, readMcpConfigDocument } from '@neon-pilot/extensions/backend/mcp';
import {
  buildInstructionPlan,
  buildPromptAssemblyPlanAsync,
  buildPromptTemplatePlanAsync,
  buildToolInjectionPlanAsync,
} from '@neon-pilot/extensions/backend/promptAssembly';
import { buildSkillInventoryAsync, setSkillEnabled } from '@neon-pilot/extensions/backend/skills';

type CapabilityKind = 'extension' | 'instruction' | 'skill' | 'tool' | 'mcp-server' | 'prompt-template' | 'context';

type CapabilityStatus = 'enabled' | 'disabled' | 'active' | 'inactive' | 'invalid' | 'warning' | 'error';

interface RuntimeCapability {
  id: string;
  kind: CapabilityKind;
  title: string;
  description?: string;
  ownerExtensionId?: string;
  source?: Record<string, unknown>;
  scope?: string;
  enabled: boolean;
  status: CapabilityStatus;
  priority?: number;
  metadata?: Record<string, unknown>;
  diagnostics?: unknown[];
  required?: boolean;
}

export async function inspectAgentRuntime(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const runtime = (
    ctx as unknown as {
      runtime?: { getLiveSessionResourceOptions?: () => { cwd?: string }; getRepoRoot?: () => string };
    }
  ).runtime;
  const resourceOptions = runtime?.getLiveSessionResourceOptions?.() ?? {};
  const repoRoot =
    typeof body.repoRoot === 'string' && body.repoRoot.trim() ? body.repoRoot.trim() : (runtime?.getRepoRoot?.() ?? process.cwd());
  const cwd = typeof body.cwd === 'string' && body.cwd.trim() ? body.cwd.trim() : (resourceOptions.cwd ?? repoRoot);
  const modelRef = typeof body.modelRef === 'string' ? body.modelRef : undefined;
  const runtimeScope = ctx.runtimeScope;
  const runtimeCtx = { runtimeScope, repoRoot, cwd, modelRef };
  const [plan, skills, tools, promptTemplates, instructions, extensions, mcp] = await Promise.all([
    buildPromptAssemblyPlanAsync(runtimeCtx),
    buildSkillInventoryAsync(runtimeCtx),
    buildToolInjectionPlanAsync(runtimeCtx),
    buildPromptTemplatePlanAsync(runtimeCtx),
    buildInstructionPlan(runtimeCtx),
    listExtensionInstallSummaries(),
    safeInspectMcpSettings(ctx),
  ]);
  const capabilities: RuntimeCapability[] = [
    ...extensions.map(extensionToCapability),
    ...instructions.layers
      .filter((layer) => layer.providerId !== 'runtime-template')
      .map((layer) => ({
        id: layer.id,
        kind: 'instruction' as const,
        title: layer.title,
        ownerExtensionId: layer.source.extensionId,
        source: layer.source as Record<string, unknown>,
        scope: layer.scope,
        enabled: true,
        status: layer.diagnostics?.some((diagnostic) => (diagnostic as { severity?: string }).severity === 'error') ? 'error' : 'active',
        priority: layer.priority,
        metadata: { providerId: layer.providerId, risk: layer.risk, mutable: layer.mutable, contentLength: layer.content.length },
        diagnostics: layer.diagnostics,
      })),
    ...skills.map((skill) => ({
      id: skill.id,
      kind: 'skill' as const,
      title: skill.title,
      description: skill.description,
      ownerExtensionId: skill.source.extensionId,
      source: skill.source as Record<string, unknown>,
      scope: skill.source.kind,
      enabled: skill.enabled,
      status: skill.enabled ? 'active' : 'disabled',
      priority: skill.priority,
      metadata: { providerId: skill.providerId, location: skill.location, inline: !skill.location },
      diagnostics: skill.diagnostics,
    })),
    ...tools.tools.map((tool) => ({
      id: tool.id,
      kind: 'tool' as const,
      title: tool.title ?? tool.name,
      description: tool.description,
      ownerExtensionId: tool.source.extensionId,
      source: tool.source as Record<string, unknown>,
      enabled: tool.enabled,
      status: tool.active ? 'active' : tool.enabled ? 'inactive' : 'disabled',
      priority: tool.priority,
      metadata: { name: tool.name, providerId: tool.providerId, action: tool.action, replaces: tool.replaces, reason: tool.reason },
      diagnostics: tool.diagnostics,
    })),
    ...promptTemplates.templates.map((template) => ({
      id: template.id,
      kind: 'prompt-template' as const,
      title: template.title,
      enabled: template.enabled,
      status: template.enabled ? 'active' : 'disabled',
      source: template.source as Record<string, unknown>,
      metadata: { location: template.location },
      diagnostics: template.diagnostics,
    })),
    ...(mcp?.servers ?? []).map((server) => ({
      id: `mcp:${server.name}`,
      kind: 'mcp-server' as const,
      title: server.name,
      ownerExtensionId: 'system-mcp',
      source: { kind: server.source ?? 'config', label: server.sourcePath ?? server.name, root: server.sourcePath },
      scope: server.source ?? 'config',
      enabled: true,
      status: 'enabled' as const,
      metadata: {
        transport: server.transport,
        command: server.command,
        url: server.url,
        hasOAuth: server.hasOAuth,
        skillName: server.skillName,
        manifestPath: server.manifestPath,
      },
    })),
    ...((plan.context?.blocks ?? []) as unknown[]).map((block, index) => ({
      id: `context:${index}`,
      kind: 'context' as const,
      title: contextBlockTitle(block, index),
      enabled: true,
      status: 'active' as const,
      metadata: { block },
    })),
  ];
  const counts = capabilities.reduce<Record<string, number>>((acc, capability) => {
    acc[capability.kind] = (acc[capability.kind] ?? 0) + 1;
    return acc;
  }, {});
  return {
    ok: true,
    runtimeScope,
    repoRoot,
    cwd,
    capabilities,
    counts,
    plan,
    skills,
    tools: tools.tools,
    promptTemplates: promptTemplates.templates,
    instructions: instructions.layers,
    extensions,
    mcp,
    diagnostics: [...(plan.diagnostics ?? []), ...(mcp?.diagnostics ?? [])],
  };
}

export const inspectPromptAssembly = inspectAgentRuntime;

export async function updateSkillEnabled(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) throw new Error('skill id is required.');
  const enabled = body.enabled !== false;
  await setSkillEnabled(id, enabled);
  await ctx.runtime.refreshSkillMcpConfig();
  return { ok: true, id, enabled };
}

export async function updateRuntimeCapability(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const kind = typeof body.kind === 'string' ? body.kind : '';
  const enabled = body.enabled !== false;
  if (!id) throw new Error('capability id is required.');
  if (kind === 'skill') {
    await setSkillEnabled(id, enabled);
    await ctx.runtime.refreshSkillMcpConfig();
  } else if (kind === 'extension') {
    const extension = (await listExtensionInstallSummaries()).find((candidate) => candidate.id === id);
    if (!enabled && extension?.required === true) {
      throw new Error(`Cannot disable ${id}: this extension is required by the application.`);
    }
    ctx.extensions.setEnabled(id, enabled);
    ctx.ui.invalidate(['extensions']);
  } else {
    throw new Error(`Capability kind ${kind || 'unknown'} cannot be toggled.`);
  }
  return { ok: true, id, kind, enabled };
}

export async function promptAssemblyCli(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const cli = asRecord(body.cli);
  const args = Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
  const flags = asRecord(cli.flags);
  const action = typeof body.action === 'string' ? body.action : 'inspect';
  if (action === 'inspect') {
    return inspectAgentRuntime({ ...body, cwd: stringFlag(flags, 'cwd'), repoRoot: stringFlag(flags, 'repo-root') }, ctx);
  }
  if (action === 'skill-enable' || action === 'skill-disable') {
    return updateSkillEnabled({ id: args[0], enabled: action === 'skill-enable' }, ctx);
  }
  if (action === 'capability-enable' || action === 'capability-disable') {
    return updateRuntimeCapability({ id: args[0], kind: stringFlag(flags, 'kind'), enabled: action === 'capability-enable' }, ctx);
  }
  throw new Error(`Unsupported prompt assembly CLI action: ${action}`);
}

function stringFlag(flags: Record<string, unknown>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function extensionToCapability(extension: Record<string, unknown>): RuntimeCapability {
  const status = typeof extension.status === 'string' ? extension.status : extension.enabled ? 'enabled' : 'disabled';
  const manifest = asRecord(extension.manifest);
  const contributes = asRecord(manifest.contributes);
  const views = arrayOf(contributes.views).filter(isObjectRecord);
  return {
    id: String(extension.id ?? 'unknown-extension'),
    kind: 'extension',
    title: String(extension.name ?? extension.id ?? 'Unknown extension'),
    description: typeof extension.description === 'string' ? extension.description : undefined,
    ownerExtensionId: typeof extension.id === 'string' ? extension.id : undefined,
    required: extension.required === true,
    source: {
      kind: extension.packageType === 'user' ? 'user-extension' : 'system-extension',
      label: String(extension.packageRoot ?? extension.id ?? ''),
    },
    enabled: extension.enabled !== false && status !== 'invalid',
    status: status === 'invalid' ? 'invalid' : extension.enabled === false ? 'disabled' : 'enabled',
    metadata: {
      packageType: extension.packageType,
      version: extension.version,
      permissions: extension.permissions,
      packageRoot: extension.packageRoot,
      contributions: Object.keys(contributes),
      counts: {
        pages: views.filter((view) => view.location === 'main').length,
        rails: views.filter((view) => view.location === 'rightRail').length,
        workbench: views.filter((view) => view.location === 'workbench').length,
        tools: arrayOf(extension.tools).length,
        modelProfiles: arrayOf(extension.modelProfiles).length,
        keybindings: arrayOf(asRecord(contributes).keybindings).length,
        backend: arrayOf(extension.backendActions).length,
        skills: arrayOf(extension.skills).length,
        agentHooks: asRecord(manifest.backend).agentExtension ? 1 : 0,
      },
      surfaces: extension.surfaces,
      routes: extension.routes,
    },
    diagnostics: [...arrayOf(extension.errors), ...arrayOf(extension.diagnostics), extension.buildError, extension.healthError].filter(
      Boolean,
    ),
  };
}

interface McpRuntimeSummary {
  configPath: string;
  configExists: boolean;
  searchedPaths: string[];
  servers: Array<{
    name: string;
    transport?: string;
    command?: string;
    url?: string;
    source?: string;
    sourcePath?: string;
    skillName?: string;
    manifestPath?: string;
    hasOAuth?: boolean;
  }>;
  bundledSkills: unknown[];
  diagnostics?: unknown[];
}

async function safeInspectMcpSettings(ctx: ExtensionBackendContext): Promise<McpRuntimeSummary | null> {
  try {
    const runtime = (
      ctx as unknown as {
        runtime?: { getLiveSessionResourceOptions?: () => { additionalSkillPaths?: string[]; cwd?: string }; getRepoRoot?: () => string };
      }
    ).runtime;
    const resourceOptions = runtime?.getLiveSessionResourceOptions?.() ?? {};
    const skillDirs = resourceOptions.additionalSkillPaths ?? [];
    const cwd = resourceOptions.cwd ?? runtime?.getRepoRoot?.() ?? process.cwd();
    const configDiscoveryEnv = { ...process.env };
    delete configDiscoveryEnv.MCP_CONFIG_PATH;
    const merged = (await buildMergedMcpConfigDocument({ cwd, env: configDiscoveryEnv, skillDirs })) as {
      baseConfigPath: string;
      baseConfigExists: boolean;
      searchedPaths: string[];
      document: { mcpServers: Record<string, unknown> };
      baseServerNames: string[];
    };
    const bundledSkills = (await readBundledSkillMcpManifests(skillDirs)) as Array<{
      skillName: string;
      skillDir: string;
      manifestPath: string;
      serverNames: string[];
    }>;
    const parsed = (await readMcpConfigDocument({
      path: merged.baseConfigPath,
      exists: merged.baseConfigExists || Object.keys(merged.document.mcpServers).length > 0,
      searchedPaths: merged.searchedPaths,
      document: merged.document,
    })) as {
      path: string;
      searchedPaths: string[];
      servers: Array<{
        name: string;
        transport?: string;
        command?: string;
        url?: string;
        oauthClientInfo?: unknown;
        oauthClientMetadata?: unknown;
        callbackHost?: string;
        callbackPort?: number;
        callbackPath?: string;
      }>;
    };
    const explicitServerNames = new Set(merged.baseServerNames);
    const bundledByServer = new Map<string, (typeof bundledSkills)[number]>();
    for (const manifest of bundledSkills) {
      for (const serverName of manifest.serverNames) bundledByServer.set(serverName, manifest);
    }
    return {
      configPath: parsed.path,
      configExists: merged.baseConfigExists,
      searchedPaths: parsed.searchedPaths,
      servers: parsed.servers.map((server) => {
        const source = explicitServerNames.has(server.name) ? 'config' : 'skill';
        const bundled = bundledByServer.get(server.name);
        return {
          name: server.name,
          transport: server.transport,
          command: server.command,
          url: server.url,
          source,
          sourcePath: source === 'skill' ? bundled?.manifestPath : parsed.path,
          skillName: source === 'skill' ? bundled?.skillName : undefined,
          manifestPath: source === 'skill' ? bundled?.manifestPath : undefined,
          hasOAuth: Boolean(
            server.oauthClientInfo || server.oauthClientMetadata || server.callbackHost || server.callbackPort || server.callbackPath,
          ),
        };
      }),
      bundledSkills,
    };
  } catch (err) {
    return {
      configPath: '',
      configExists: false,
      searchedPaths: [],
      explicitConfigJson: '',
      servers: [],
      bundledSkills: [],
      diagnostics: [{ severity: 'warning', code: 'mcp-inspection-failed', message: err instanceof Error ? err.message : String(err) }],
    };
  }
}

function contextBlockTitle(block: unknown, index: number): string {
  const record = asRecord(block);
  return typeof record.title === 'string' ? record.title : typeof record.kind === 'string' ? record.kind : `Context block ${index + 1}`;
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

function isObjectRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object' && !Array.isArray(input));
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
