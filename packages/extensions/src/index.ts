/**
 * Client surface available to native extension frontend components via the `pa` prop.
 *
 * Every capability here is stable and available in both desktop and web runtimes
 * unless noted otherwise.
 */
export interface NativeExtensionClient {
  /** Call backend actions and inspect this extension's own manifest/surfaces. */
  extension: {
    invoke(actionId: string, input?: unknown): Promise<unknown>;
    getManifest(): Promise<unknown>;
    listSurfaces(): Promise<unknown>;
  };
  /** Automations (scheduled tasks). */
  automations: {
    list(): Promise<unknown[]>;
    readSchedulerHealth(): Promise<unknown>;
    get(taskId: string): Promise<unknown>;
    create(input: unknown): Promise<unknown>;
    update(taskId: string, input: unknown): Promise<unknown>;
    delete(taskId: string): Promise<unknown>;
    run(taskId: string): Promise<unknown>;
    readLog(taskId: string): Promise<unknown>;
  };
  /** Conversation list access. */
  conversations: {
    list(): Promise<unknown>;
    attachments(conversationId: string): Promise<unknown>;
    attachment(conversationId: string, attachmentId: string): Promise<unknown>;
    attachmentAsset(conversationId: string, attachmentId: string, asset: 'source' | 'preview', revision?: number): Promise<unknown>;
    createAttachment(
      conversationId: string,
      input: {
        kind?: 'excalidraw';
        title?: string;
        sourceData: string;
        sourceName?: string;
        sourceMimeType?: string;
        previewData: string;
        previewName?: string;
        previewMimeType?: string;
        note?: string;
      },
    ): Promise<unknown>;
    updateAttachment(
      conversationId: string,
      attachmentId: string,
      input: {
        title?: string;
        sourceData: string;
        sourceName?: string;
        sourceMimeType?: string;
        previewData: string;
        previewName?: string;
        previewMimeType?: string;
        note?: string;
      },
    ): Promise<unknown>;
  };
  /** List available models. */
  models(): Promise<unknown>;
  /**
   * Open a native OS folder picker dialog.
   * Desktop-only; uses the host-provided native bridge.
   *
   * @param input.cwd  Starting directory for the picker.
   * @param input.prompt  Label shown in the dialog title bar.
   * @returns `{ path: string | null; cancelled: boolean }`
   */
  pickFolder(input?: { cwd?: string | null; prompt?: string | null }): Promise<{ path: string | null; cancelled: boolean }>;
  /** Background execution management. */
  executions: {
    start(input: unknown): Promise<unknown>;
    get(executionId: string): Promise<unknown>;
    list(input?: { conversationId?: string | null }): Promise<unknown[]>;
    readLog(executionId: string, tail?: number): Promise<unknown>;
    cancel(executionId: string): Promise<unknown>;
  };
  /** Extension-scoped key/value storage. Persisted across sessions. */
  storage: {
    get<T = unknown>(key: string): Promise<T | null>;
    put(key: string, value: unknown, opts?: { expectedVersion?: number }): Promise<unknown>;
    delete(key: string): Promise<unknown>;
    list<T = unknown>(prefix?: string): Promise<Array<{ key: string; value: T }>>;
  };
  /** Workspace filesystem helpers. */
  workspace: {
    tree(cwd: string, path?: string): Promise<unknown>;
    readFile(cwd: string, path: string, opts?: { force?: boolean }): Promise<unknown>;
    writeFile(cwd: string, path: string, content: string): Promise<unknown>;
    createFile(cwd: string, path: string, content?: string): Promise<unknown>;
    createFolder(cwd: string, path: string): Promise<unknown>;
    deletePath(cwd: string, path: string): Promise<unknown>;
    renamePath(cwd: string, path: string, newName: string): Promise<unknown>;
    movePath(cwd: string, path: string, targetDir: string): Promise<unknown>;
    diff(cwd: string, path: string): Promise<unknown>;
    uncommittedDiff(cwd: string): Promise<unknown>;
  };
  /** Workbench split-pane state sharing between a tab-local `rightRail` view and its paired detail view. */
  workbench: {
    getDetailState<T = unknown>(surfaceId: string): T | null;
    setDetailState(surfaceId: string, state: unknown): void;
    closeTab(tabId?: string | null): void;
  };
  /** Embedded browser control. Desktop-only. */
  browser: {
    isAvailable(): boolean;
    getState(input?: { tabId?: string | null }): Promise<unknown>;
    open(input: { url: string; tabId?: string | null }): Promise<unknown>;
    goBack(input?: { tabId?: string | null }): Promise<unknown>;
    goForward(input?: { tabId?: string | null }): Promise<unknown>;
    reload(input?: { tabId?: string | null }): Promise<unknown>;
    stop(input?: { tabId?: string | null }): Promise<unknown>;
    snapshot(input?: { tabId?: string | null }): Promise<unknown>;
  };
  /** Command palette and app command execution. */
  commands: {
    execute(command: string, args?: unknown): Promise<boolean>;
    list(): Promise<unknown[]>;
    setContext(key: string, value: string | number | boolean | null | undefined): void;
  };
  /** Inter-extension event bus. */
  events: {
    /** Publish an event to all subscribers. */
    publish(event: string, payload: unknown): void;
    /** Subscribe to events matching a pattern. Supports `*` (all) and `namespace:*` (prefix). */
    subscribe(pattern: string, handler: (event: { event: string; payload: unknown }) => void): { unsubscribe: () => void };
  };
  /** Cross-extension action invocation. */
  extensions: {
    callAction(extensionId: string, actionId: string, input?: unknown): Promise<unknown>;
    listActions(): Promise<
      Array<{ extensionId: string; extensionName: string; actions: Array<{ id: string; title?: string; description?: string }> }>
    >;
    getStatus(extensionId: string): Promise<{ enabled: boolean; healthy: boolean; errors?: string[] }>;
  };
  /** Selection state shared across surfaces. */
  selection: {
    get(): unknown;
    set(selection: unknown): void;
    subscribe(handler: (selection: unknown) => void): { unsubscribe: () => void };
  };
  /** Transcript navigation helpers. */
  transcript: {
    spotlight(target: ExtensionTranscriptSpotlightTarget): void;
    targetProps(target: ExtensionTranscriptSpotlightTarget): Record<string, string>;
  };
  /** UI utilities. */
  ui: {
    toast(message: string, type?: 'info' | 'warning' | 'error'): void;
    /** Post a richer notification with optional details and source attribution. */
    notify(options: { message: string; type?: 'info' | 'warning' | 'error'; details?: string; source?: string }): void;
    confirm(options: { title?: string; message: string }): Promise<boolean>;
    /** Subscribe to host app data invalidations such as tasks, runs, automation, or workspace. */
    subscribeInvalidations(handler: (event: { topics: string[] }) => void): { unsubscribe: () => void };
    openModal(options: {
      title?: string;
      component: string;
      props?: Record<string, unknown>;
      size?: 'default' | 'large' | 'fullscreen';
    }): Promise<unknown>;
  };
  [capability: string]: unknown;
}

export type ExtensionTranscriptSpotlightTarget =
  | { kind: 'block'; blockId: string }
  | { kind: 'tool_call'; blockId: string }
  | { kind: 'background_run'; runId: string }
  | { kind: 'extension'; extensionId: string; targetId: string };

export interface ExtensionAgentTool {
  name?: string;
  description?: string;
  parameters?: unknown;
  execute?: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

export interface ExtensionAPI {
  registerTool(tool: ExtensionAgentTool): void;
  on(eventName: string, handler: (event: unknown, context: unknown) => unknown): void;
  appendEntry(customType: string, data: unknown): void;
  sendMessage(message: string): void;
  setSessionName(name: string): void;
}

export const EXTENSION_MANIFEST_VERSION = 2;

export type ExtensionPackageType = 'user' | 'system';
export type ExtensionRightSurfaceScope = 'global' | 'conversation' | 'workspace' | 'selection';
export type ExtensionViewPlacement = 'primary' | 'workbench-tool';
export type ExtensionViewScope = 'global' | 'workspace' | 'conversation';
export type ExtensionViewActivation = 'always' | 'on-route' | 'on-open' | 'on-demand';
export type ExtensionIconName =
  | 'app'
  | 'automation'
  | 'browser'
  | 'database'
  | 'diff'
  | 'file'
  | 'gear'
  | 'graph'
  | 'kanban'
  | 'play'
  | 'sparkle'
  | 'terminal';
export type ExtensionPermission =
  | 'agent:run'
  | 'agent:conversations'
  | 'executions:read'
  | 'executions:start'
  | 'executions:cancel'
  | 'automations:read'
  | 'automations:write'
  | 'automations:readwrite'
  | 'automations:run'
  | 'runtimes:read'
  | 'attention:read'
  | 'attention:write'
  | 'storage:read'
  | 'storage:write'
  | 'storage:readwrite'
  | 'settings:read'
  | 'settings:write'
  | 'settings:readwrite'
  | 'workspace:read'
  | 'workspace:write'
  | 'workspace:readwrite'
  | 'filesystem:read'
  | 'filesystem:write'
  | 'filesystem:readwrite'
  | 'shell:execute'
  | 'commands:read'
  | 'commands:execute'
  | 'browser:read'
  | 'browser:control'
  | 'desktop:control'
  | 'git:read'
  | 'secrets:read'
  | 'extensions:read'
  | 'extensions:write'
  | 'models:read'
  | 'models:write'
  | 'models:readwrite'
  | 'images:read'
  | 'images:write'
  | 'videos:read'
  | 'audio:read'
  | 'documents:read'
  | 'documents:write'
  | 'documents:readwrite'
  | 'knowledge:read'
  | 'knowledge:write'
  | 'knowledge:readwrite'
  | 'mcp:read'
  | 'mcp:write'
  | 'persona:read'
  | 'persona:write'
  | 'persona:readwrite'
  | 'network:read'
  | 'conversations:read'
  | 'conversations:write'
  | 'conversations:readwrite'
  | 'network:listen'
  | 'telemetry:read'
  | 'telemetry:write'
  | 'ui:confirm'
  | 'ui:invalidate'
  | 'ui:notify';

export type ExtensionFileChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'typechange' | 'unmerged' | 'changed';

export interface ExtensionFileChangeMetadata {
  path: string;
  previousPath?: string;
  status: ExtensionFileChangeStatus;
  additions: number;
  deletions: number;
  /** Unified diff patch for this exact tool mutation. May be omitted when too large or unavailable. */
  patch?: string;
  truncated?: boolean;
}

export interface ExtensionFileChangesMetadata {
  fileChanges: ExtensionFileChangeMetadata[];
}

export interface ExtensionFrontend {
  entry: string;
  styles?: string[];
}

export interface ExtensionHostComponentReference {
  host: string;
  props?: Record<string, unknown>;
  /** Extension frontend exports used to customize supported host override slots. */
  overrides?: Record<string, string>;
}

export type ExtensionComponentReference = string | ExtensionHostComponentReference;

export interface ExtensionViewContribution {
  id: string;
  title: string;
  /**
   * Host region for this view.
   * - `main`: required route page content; a nav route must match a main view route.
   * - `sidebar`: optional route-owned middle-left contextual area, bound from nav with `sidebarView`.
   * - `rightRail`: either a route-owned context rail (`placement: "primary"`), bound from nav with
   *   `rightSidebarView`, or a tab-local workbench rail.
   * - `workbench`: large detail content paired with a tab-local rail.
   */
  location: 'main' | 'rightRail' | 'workbench' | 'sidebar';
  component: ExtensionComponentReference;
  route?: string;
  scope?: ExtensionRightSurfaceScope | ExtensionViewScope;
  icon?: ExtensionIconName;
  /** Controls where this view appears across compact/workbench layout modes. */
  placement?: ExtensionViewPlacement;
  /** Controls when the host should mount/load this view. */
  activation?: ExtensionViewActivation;
  defaultOpen?: boolean;
  persistOpen?: boolean;
  /** For tab-local `rightRail` views, optional paired workbench view id rendered in the detail pane while this rail tool is active. */
  detailView?: string;
  /** Optional host layout behaviors enabled when this main view's route is active. */
  routeCapabilities?: Array<'contextRail' | 'workbench' | 'workbenchFilePane' | 'knowledgeFiles' | 'settingsSection'>;
  /**
   * Identifies the logical slot this view occupies in the workbench tool panel.
   * When set, the host uses the slot name (e.g. "files", "diffs", "runs") to position
   * the tool bar button instead of matching by extension id.
   */
  toolSlot?: string;
}

export interface ExtensionWebappContribution {
  id: string;
  title: string;
  description?: string;
  entry?: string;
  target?: string;
  localhostName?: string;
  spaFallback?: boolean;
}

export type ExtensionPageType = 'conversation' | 'table' | 'editor' | 'settings' | 'dashboard' | 'setup';

export interface ExtensionNavContribution {
  id: string;
  label: string;
  route: string;
  icon?: ExtensionIconName;
  badgeAction?: string;
  /**
   * Optional sidebar view id to render in the route-owned middle-left contextual area.
   * If omitted, the global nav remains and the contextual area is blank.
   */
  sidebarView?: string;
  /**
   * Optional `rightRail` view id to render as this route's right-sidebar context rail.
   * The referenced view must use `location: "rightRail"` and `placement: "primary"`.
   * `scope` is optional for route-owned context rails and defaults through the host.
   * If omitted, the shell hides the right-sidebar toggle for this route.
   */
  rightSidebarView?: string;
  /**
   * Optional design-system page type annotation. Used for inventory and
   * conformance audits while the taxonomy is being vetted.
   */
  pageType?: ExtensionPageType;
  /** Nav section. Default 'primary'. Use 'settings' for items in the settings area. */
  section?: 'primary' | 'settings';
}

export interface ExtensionCommandContribution {
  id: string;
  title: string;
  action: string;
  args?: unknown;
  argsSchema?: Record<string, unknown>;
  icon?: ExtensionIconName;
  category?: string;
  description?: string;
  enablement?: string;
}

export interface ExtensionCliCommandContribution {
  id: string;
  /** Space-separated command path after the neon-pilot executable, e.g. "extensions list". */
  command: string;
  title?: string;
  description?: string;
  /** Stable machine-readable intent, e.g. "agent.new_conversation_turn". */
  intent?: string;
  /** Intended callers for command selection and generated docs. */
  audience?: Array<'human' | 'external-agent' | 'internal-agent' | 'extension-author'>;
  /** Whether this is a primary public command or an advanced/internal escape hatch. */
  stability?: 'public' | 'advanced' | 'internal' | 'deprecated';
  /** Human and agent guidance for choosing this command. */
  recommendedFor?: string[];
  /** Common mistakes where another command should be preferred. */
  notFor?: string[];
  /** Commands this command should supersede for normal intents. */
  preferredOver?: string[];
  /** Human CLI usage after the neon-pilot executable, e.g. "tasks list [--json]". */
  usage?: string;
  /** Copy-pasteable examples including the neon-pilot executable. */
  examples?: string[];
  /** JSON schema for positional args after the command path. */
  argsSchema?: Record<string, unknown>;
  /** JSON schema for supported flags without leading "--". */
  flagsSchema?: Record<string, unknown>;
  /** Command behavior class used by help, audits, and agents. */
  mode?: 'read' | 'write' | 'destructive' | 'background' | 'streaming';
  /** Whether this command needs a running app/extension host. */
  requiresApp?: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  startsBackgroundWork?: boolean;
  supportsDryRun?: boolean;
  outputModes?: Array<'text' | 'json' | 'jsonl'>;
  streaming?: {
    supportsFollow?: boolean;
    supportsJsonl?: boolean;
    cancelOnInterruptDefault?: boolean;
  };
  smoke?: {
    argv?: string[];
    expectHumanIncludes?: string[];
    expectJsonFields?: string[];
  };
  /** Backend action id invoked with parsed CLI args and flags. */
  action: string;
  /** Explicit action hint passed to the backend action. Defaults to the final command token. */
  inputAction?: string;
  aliases?: string[];
  /** Print structured data by default when the command returns it. */
  jsonDefault?: boolean;
}

export interface ExtensionKeybindingContribution {
  id: string;
  title: string;
  keys: string[];
  command: string;
  args?: unknown;
  when?: string;
  scope?: 'global' | 'surface';
}

export interface ExtensionSlashCommandContribution {
  name: string;
  description: string;
  action: string;
}

export interface ExtensionMentionContribution {
  id: string;
  title: string;
  description?: string;
  kinds: string[];
  provider: string;
}

export interface ExtensionSkillContribution {
  id: string;
  title?: string;
  description?: string;
  path: string;
}

export interface ExtensionToolCondition {
  /** Provider ids that may use this tool, e.g. "openai" or "openai-codex". */
  providers?: string[];
  /** Model ids or provider/model refs that may use this tool. */
  models?: string[];
}

export type ExtensionToolActivation = 'auto' | 'explicit';

export interface ExtensionToolContribution {
  id: string;
  title?: string;
  label?: string;
  description: string;
  action?: string;
  handler?: string;
  inputSchema?: Record<string, unknown>;
  promptSnippet?: string;
  promptGuidelines?: string[];
  /** Defaults to `auto`. Use `explicit` for page/session-scoped tools. */
  activation?: ExtensionToolActivation;
  name?: string;
  /** Only register this tool when the active model/provider matches. */
  when?: ExtensionToolCondition;
  /**
   * Name of a built-in tool to replace (e.g. "bash", "read", "write", "edit").
   * When set, this tool overrides the built-in tool of that name.
   */
  replaces?: string;
  /** Tool is registered by the extension's agentExtension at runtime. */
  nativeRegistration?: boolean;
}

export interface ExtensionModelProfileContribution {
  id: string;
  title?: string;
  description?: string;
  match: string[];
  priority?: number;
  activeTools?: string[];
}

export type ExtensionModelProfileRuntimeContext =
  | { kind: 'none'; modelRef: string | null }
  | {
      kind: 'resolved';
      modelRef: string;
      profile: { id: string; extensionId: string; title?: string; match: string[]; priority: number; activeTools?: string[] };
    }
  | {
      kind: 'ambiguous';
      modelRef: string;
      profiles: Array<{ id: string; extensionId: string; title?: string; match: string[]; priority: number }>;
    };

export interface ExtensionTranscriptRendererContribution {
  id: string;
  tool: string;
  component: string;
  /** When true, this block renders outside internal-work trace clusters. */
  standalone?: boolean;
}

export interface ExtensionPromptReferenceContribution {
  id: string;
  handler: string;
  title?: string;
}

export interface ExtensionTurnContextProviderContribution {
  id: string;
  handler: string;
  title?: string;
  priority?: number;
  scope?: Array<'global' | 'workspace' | 'conversation'>;
}

export interface ExtensionRuntimeProviderContribution {
  id: string;
  handler: string;
  title: string;
  description?: string;
}

export interface ExtensionAssemblyProviderContribution {
  id: string;
  handler: string;
  title?: string;
  priority?: number;
}

export interface ExtensionPromptAssemblyHookContribution {
  id: string;
  handler: string;
  title?: string;
  priority?: number;
  phase: 'after-discovery' | 'before-policy' | 'after-policy' | 'before-injection' | 'after-assembly';
}

export interface ExtensionQuickOpenContribution {
  id: string;
  provider: string;
  title?: string;
  section?: string;
  order?: number;
}

export interface ExtensionSearchProviderContribution {
  id: string;
  title: string;
  action: string;
  kinds?: string[];
  priority?: number;
}

export interface ExtensionThemeContribution {
  id: string;
  label: string;
  appearance: 'light' | 'dark';
  tokens: Record<string, string>;
}

export interface ExtensionTopBarElementContribution {
  id: string;
  component: string;
  label?: string;
}

export type ExtensionSetupItemSeverity = 'required' | 'recommended' | 'optional';
export type ExtensionSetupItemStatus = 'ready' | 'needs_setup' | 'blocked' | 'not_applicable';
export type ExtensionSetupItemActionTone = 'default' | 'primary' | 'danger';

export interface ExtensionSetupItemActionContribution {
  id: string;
  label: string;
  action?: string;
  route?: string;
  tone?: ExtensionSetupItemActionTone;
}

export interface ExtensionSetupItemContribution {
  id: string;
  title: string;
  description?: string;
  capability?: string;
  severity?: ExtensionSetupItemSeverity;
  statusAction: string;
  actions?: ExtensionSetupItemActionContribution[];
  dismissible?: boolean;
  order?: number;
}

export interface ExtensionMessageActionContribution {
  id: string;
  title: string;
  action: string;
  /** Context condition for when this action is visible, e.g. "role:assistant && hasText" */
  when?: string;
  /** Sort priority. Higher = closer to end of button row. Default 0. */
  priority?: number;
}

export interface ExtensionComposerShelfContribution {
  id: string;
  component: string;
  title?: string;
  /** Where this shelf appears relative to built-in shelves. Default 'bottom'. */
  placement?: 'top' | 'bottom';
}

export interface ExtensionConversationConnectionProviderContribution {
  id: string;
  action: string;
  kind?: 'activity' | 'state' | 'asset' | 'context' | 'integration' | 'surface';
  title?: string;
  surfaces?: Array<'activityShelf' | 'composerShelf' | 'rightRail' | 'workbench' | 'sidebar' | 'cli'>;
  priority?: number;
}

export interface ExtensionDraftConversationCreateContribution {
  id: string;
  /** Backend action called before the draft conversation is created. */
  prepareAction: string;
  /** Optional backend action called after creation when prepareAction asks for follow-up. */
  applyAction?: string;
  /** Sort priority for merge order. Higher runs first. Default 0. */
  priority?: number;
}

export interface ExtensionToolbarActionContribution {
  id: string;
  title: string;
  icon: ExtensionIconName;
  action: string;
  /** Condition for visibility, e.g. "composerHasContent && !streamIsStreaming" */
  when?: string;
  /** Sort priority. Higher = closer to submit button. Default 0. */
  priority?: number;
}

export type ExtensionComposerControlSlot = 'leading' | 'preferences' | 'actions';

export interface ExtensionComposerControlContribution {
  id: string;
  component: string;
  title?: string;
  /** Composer row slot. Defaults to the preferences slot. */
  slot?: ExtensionComposerControlSlot;
  /** Condition for visibility, e.g. "composerHasContent && !streamIsStreaming" */
  when?: string;
  /** Sort priority within slot. Lower renders earlier. Default 0. */
  priority?: number;
}

export interface ExtensionComposerInputToolContribution {
  id: string;
  component: string;
  title?: string;
  /** Condition for visibility, e.g. "!streamIsStreaming" */
  when?: string;
  /** Sort priority. Higher = closer to the text input. Default 0. */
  priority?: number;
}

export interface ExtensionConversationHeaderContribution {
  id: string;
  component: string;
  label?: string;
}

export interface ExtensionThreadHeaderActionContribution {
  id: string;
  component: string;
  title?: string;
  priority?: number;
}

export type ExtensionConversationLifecycleSlot = 'banner' | 'inline';
export type ExtensionConversationLifecycleEvent =
  | 'before-run'
  | 'after-run-start'
  | 'blocked'
  | 'waiting-for-user'
  | 'model-error'
  | 'tool-error'
  | 'goal-active'
  | 'compaction-available';

export interface ExtensionConversationLifecycleContribution {
  id: string;
  component: string;
  events: ExtensionConversationLifecycleEvent[];
  slot?: ExtensionConversationLifecycleSlot;
  priority?: number;
}

export interface ExtensionComposerAttachmentProviderContribution {
  id: string;
  title: string;
  action: string;
  icon?: string;
  priority?: number;
}

export interface ExtensionComposerAttachmentRendererContribution {
  id: string;
  type: string;
  component: string;
  priority?: number;
}

export interface ExtensionComposerAttachmentResolverContribution {
  id: string;
  type: string;
  action: string;
}

export interface ExtensionActivityTreeItemActionContribution {
  id: string;
  title: string;
  action: string;
  icon?: string;
  when?: string;
  priority?: number;
}

export interface ThreadHeaderActionContext {
  activeConversationId?: string | null;
  cwd?: string | null;
}

export interface ThreadHeaderActionProps {
  pa: NativeExtensionClient;
  actionContext: ThreadHeaderActionContext;
}

export interface ExtensionStatusBarItemContribution {
  id: string;
  label: string;
  action?: string;
  /** Optional component for dynamic status bar content. */
  component?: string;
  /** Left or right alignment. Default 'right'. */
  alignment?: 'left' | 'right';
  /** Sort priority within alignment. Higher = closer to edge. Default 0. */
  priority?: number;
}

export interface ExtensionStatusBarItemContext {
  conversationId?: string | null;
  cwd?: string | null;
  branchLabel?: string | null;
  gitSummary?: {
    kind: 'none' | 'summary' | 'diff';
    text?: string;
    added?: string;
    deleted?: string;
  };
  contextUsage?: {
    total: number | null;
    contextWindow: number;
  } | null;
}

export interface ExtensionStatusBarItemProps {
  pa: NativeExtensionClient;
  statusBarContext: ExtensionStatusBarItemContext;
}

export interface ExtensionContextMenuContribution {
  id: string;
  title: string;
  action: string;
  /** Which context menu this item appears in. */
  surface: 'message' | 'conversationList' | 'selection' | 'fileSelection' | 'transcriptSelection';
  /** Show a separator above this item. */
  separator?: boolean;
  /** Context condition, e.g. "selectedText" or "role:assistant" */
  when?: string;
}

export type ExtensionSelectionKind = 'text' | 'messages' | 'files' | 'transcriptRange' | 'resource';

export interface ExtensionSelectionActionContribution {
  id: string;
  title: string;
  action: string;
  kinds: ExtensionSelectionKind[];
  /** Compact visual marker for selection action rows, for example an emoji. */
  icon?: string;
  /** Static action arguments merged with the active selection at execution time. */
  args?: unknown;
  /** Expand this action into one action per item from a string setting. */
  settingItems?: ExtensionSelectionActionSettingItemsContribution;
  when?: string;
  priority?: number;
}

export interface ExtensionSelectionActionSettingItemsContribution {
  /** Extension setting key containing comma, semicolon, or newline separated items. */
  key: string;
  /** Generated action id prefix. Defaults to this contribution id. */
  idPrefix?: string;
  /** Static args key that receives each item string. */
  argsKey?: string;
  /** Derive the compact icon from the first whitespace-delimited token. */
  icon?: 'firstToken' | 'none';
}

export interface ExtensionTranscriptBlockContribution {
  id: string;
  component: string;
  title?: string;
  schemaVersion?: number;
}

export interface ExtensionSubscriptionContribution {
  id: string;
  handler: string;
  source: 'workspaceFiles' | 'knowledgeFiles' | 'settings' | 'conversation' | 'route' | 'selection' | string;
  pattern?: string;
  debounceMs?: number;
}

export interface ExtensionSecretContribution {
  label: string;
  description?: string;
  env?: string;
  placeholder?: string;
  order?: number;
}

export type ExtensionSettingType = 'string' | 'boolean' | 'number' | 'select';

export interface ExtensionSettingsContribution {
  type: ExtensionSettingType;
  /** Optional host-rendered control for specialized value editing. */
  control?: 'emoji-label-list' | string;
  default?: unknown;
  description?: string;
  /** Group label for UI organization. Defaults to 'General'. */
  group?: string;
  /** Enum values for 'select' type. */
  enum?: string[];
  placeholder?: string;
  /** Sort order within group. Default 0. */
  order?: number;
}

export interface ExtensionConversationDecoratorContribution {
  id: string;
  component: string;
  /** Where this decorator appears relative to the conversation title. */
  position: 'before-title' | 'after-title' | 'subtitle';
  /** Sort priority within position. Higher = closer to title. Default 0. */
  priority?: number;
}

export type ExtensionActivityTreeItemSlot = 'leading' | 'before-title' | 'after-title' | 'subtitle' | 'trailing';

export interface ExtensionActivityTreeItemElementContribution {
  id: string;
  component: string;
  /** Which row slot renders this element. */
  slot: ExtensionActivityTreeItemSlot;
  /** Sort priority within slot. Higher renders first. Default 0. */
  priority?: number;
}

export interface ExtensionActivityTreeItemStyleContribution {
  id: string;
  /** Backend action that returns data-only row style metadata. */
  provider: string;
  /** Sort priority for merge order. Higher runs first. Default 0. */
  priority?: number;
}

/** Desktop appearance metadata for agent-built/runtime extension apps in the windowed OS. */
export type ExtensionAppearanceAccent = 'chat' | 'automations' | 'drawing' | 'apps' | 'telemetry' | 'settings';

/** Desktop appearance metadata for agent-built/runtime extension apps in the windowed OS. */
export interface ExtensionAppearanceContribution {
  /** Accent color for the app tile and window chrome. */
  accent?: ExtensionAppearanceAccent;
  /** Search aliases for the Start menu and app launcher. */
  aliases?: string[];
  /** Optional window defaults for the app's own window. */
  window?: {
    /** Default width for new windows (px). */
    defaultWidth?: number;
    /** Default height for new windows (px). */
    defaultHeight?: number;
  };
  /** When true (default), only one instance of this app can exist at a time. */
  singleton?: boolean;
}

export interface ExtensionWidgetContribution {
  id: string;
  title: string;
  /** Extension frontend component reference, following existing component reference conventions. */
  component: ExtensionComponentReference;
  /** Optional collection binding for document-aware widgets, e.g. "owner/collection". */
  collectionBinding?: string;
  /** Sort order among widgets. Lower renders first. Default 0. */
  order?: number;
}

export interface ExtensionSettingsComponentContribution {
  id: string;
  component: string;
  /** Settings page section id, e.g. "settings-dictation". */
  sectionId: string;
  label: string;
  description?: string;
  /** Sort order among extension settings panels. Default 0. */
  order?: number;
}

export interface ExtensionContributions {
  views?: ExtensionViewContribution[];
  webapps?: ExtensionWebappContribution[];
  nav?: ExtensionNavContribution[];
  commands?: ExtensionCommandContribution[];
  cliCommands?: ExtensionCliCommandContribution[];
  keybindings?: ExtensionKeybindingContribution[];
  slashCommands?: ExtensionSlashCommandContribution[];
  mentions?: ExtensionMentionContribution[];
  skills?: Array<string | ExtensionSkillContribution>;
  skillProviders?: ExtensionAssemblyProviderContribution[];
  tools?: ExtensionToolContribution[];
  toolProviders?: ExtensionAssemblyProviderContribution[];
  promptTemplateProviders?: ExtensionAssemblyProviderContribution[];
  instructionProviders?: ExtensionAssemblyProviderContribution[];
  promptAssemblyHooks?: ExtensionPromptAssemblyHookContribution[];
  modelProfiles?: ExtensionModelProfileContribution[];
  transcriptRenderers?: ExtensionTranscriptRendererContribution[];
  promptReferences?: ExtensionPromptReferenceContribution[];
  /** Per-turn context providers. Returned blocks are injected as prompt context before each turn. */
  turnContextProviders?: ExtensionTurnContextProviderContribution[];
  /** Remote/local runtime providers that can advertise conversation execution targets. */
  runtimeProviders?: ExtensionRuntimeProviderContribution[];
  /** Conversation-scoped connection providers for CLI, shelves, and host projections. */
  conversationConnectionProviders?: ExtensionConversationConnectionProviderContribution[];
  quickOpen?: ExtensionQuickOpenContribution[];
  searchProviders?: ExtensionSearchProviderContribution[];
  themes?: ExtensionThemeContribution[];
  topBarElements?: ExtensionTopBarElementContribution[];
  setupItems?: ExtensionSetupItemContribution[];
  messageActions?: ExtensionMessageActionContribution[];
  composerShelves?: ExtensionComposerShelfContribution[];
  draftConversationCreate?: ExtensionDraftConversationCreateContribution[];
  composerControls?: ExtensionComposerControlContribution[];
  composerInputTools?: ExtensionComposerInputToolContribution[];
  toolbarActions?: ExtensionToolbarActionContribution[];
  contextMenus?: ExtensionContextMenuContribution[];
  selectionActions?: ExtensionSelectionActionContribution[];
  transcriptBlocks?: ExtensionTranscriptBlockContribution[];
  subscriptions?: ExtensionSubscriptionContribution[];
  threadHeaderActions?: ExtensionThreadHeaderActionContribution[];
  statusBarItems?: ExtensionStatusBarItemContribution[];
  conversationHeaderElements?: ExtensionConversationHeaderContribution[];
  conversationDecorators?: ExtensionConversationDecoratorContribution[];
  activityTreeItemElements?: ExtensionActivityTreeItemElementContribution[];
  activityTreeItemStyles?: ExtensionActivityTreeItemStyleContribution[];
  conversationLifecycle?: ExtensionConversationLifecycleContribution[];
  composerAttachmentProviders?: ExtensionComposerAttachmentProviderContribution[];
  composerAttachmentRenderers?: ExtensionComposerAttachmentRendererContribution[];
  composerAttachmentResolvers?: ExtensionComposerAttachmentResolverContribution[];
  activityTreeItemActions?: ExtensionActivityTreeItemActionContribution[];
  settings?: Record<string, ExtensionSettingsContribution>;
  secrets?: Record<string, ExtensionSecretContribution>;
  settingsComponent?: ExtensionSettingsComponentContribution;
  /** Home/Dashboard widgets contributed by this extension. */
  widgets?: ExtensionWidgetContribution[];
  /** Desktop appearance metadata for the windowed OS app registry (Start menu, launcher, window chrome). */
  appearance?: ExtensionAppearanceContribution;
}

export interface ExtensionDependencyContribution {
  id: string;
  optional?: boolean;
  version?: string;
}

export interface ExtensionManifest {
  schemaVersion: typeof EXTENSION_MANIFEST_VERSION;
  id: string;
  name: string;
  description?: string;
  version?: string;
  compatibility?: ExtensionCompatibility;
  frontend?: ExtensionFrontend;
  contributes?: ExtensionContributions;
  backend?: ExtensionBackend;
  permissions?: ExtensionPermission[];
  dependsOn?: Array<string | ExtensionDependencyContribution>;
}

export interface ExtensionCompatibility {
  neonPilot?: string;
  extensionApi?: string;
}

export interface ExtensionBackend {
  entry: string;
  actions?: ExtensionBackendAction[];
  routes?: ExtensionBackendRoute[];
  services?: ExtensionBackendService[];
  protocolEntrypoints?: ExtensionBackendProtocolEntrypoint[];
  startupAction?: string;
  onEnableAction?: string;
  onDisableAction?: string;
  onUninstallAction?: string;
  agentExtension?: string;
}

export interface ExtensionBackendService {
  id: string;
  handler: string;
  title?: string;
  description?: string;
  healthCheck?: string;
  stopHandler?: string;
  restart?: 'never' | 'on-failure' | 'always';
  worker?: {
    enabled?: boolean;
  };
}

export interface ExtensionBackendAction {
  id: string;
  handler: string;
  title?: string;
  description?: string;
  worker?: {
    enabled?: boolean;
    /** Optional per-invocation worker timeout in milliseconds. Defaults to 30s. */
    timeoutMs?: number;
    inputActions?: string[];
    /**
     * Allow worker execution even when the action is invoked from an agent tool
     * with live-only context such as an abort signal or progress callback. Use
     * only for actions whose implementation depends on serializable toolContext
     * fields and host capabilities, not the live agent context itself.
     */
    ignoreLiveContext?: boolean;
  };
}

export interface ExtensionBackendProtocolEntrypoint {
  id: string;
  handler: string;
  title?: string;
  description?: string;
}

export interface ExtensionBackendRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  handler: string;
  title?: string;
  description?: string;
  stream?: 'sse';
  worker?: {
    enabled?: boolean;
  };
}

export interface ExtensionRouteRequest {
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ExtensionRouteSseEvent {
  event?: string;
  data?: unknown;
  id?: string;
  retry?: number;
}

export interface ExtensionRouteResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  stream?: 'sse';
  events?: AsyncIterable<ExtensionRouteSseEvent>;
}

export interface ExtensionRenderContext {
  extensionId: string;
  surfaceId: string;
  shellPresentation?: 'windowed';
  route?: string | null;
  pathname: string;
  search: string;
  hash: string;
  conversationId?: string | null;
  cwd?: string | null;
  instanceId?: string | null;
}

export interface ExtensionSettingsPanelContext {
  sectionId: string;
  extensionId: string;
  shellPresentation?: 'windowed';
}

export interface ExtensionSurfaceProps<Params = Record<string, string>> {
  pa: NeonPilotClient;
  context: ExtensionRenderContext;
  surface: ExtensionViewContribution;
  params: Params;
}

export interface ExtensionAutomationSummary {
  id: string;
  title?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface ExtensionRunSummary {
  id: string;
  status?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ExtensionWorkspaceTreeEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | string;
  children?: ExtensionWorkspaceTreeEntry[];
  [key: string]: unknown;
}

export interface ExtensionWorkspaceFileResult {
  path: string;
  content: string;
  encoding?: string;
  [key: string]: unknown;
}

export interface ExtensionBrowserState {
  tabs?: Array<{ id: string; url?: string; title?: string; active?: boolean; [key: string]: unknown }>;
  activeTabId?: string | null;
  [key: string]: unknown;
}

export type PersonalAgentConversationPolicy = 'default' | 'dedicated' | 'new-per-message';

export interface PersonalAgentGatewayBinding {
  id: string;
  gatewayId: string;
  accountId?: string;
  channelId?: string;
  senderId?: string;
  displayName?: string;
  enabled: boolean;
  conversationPolicy: PersonalAgentConversationPolicy;
  trustLevel: 'local' | 'paired' | 'allowlisted' | 'untrusted';
  createdAt: string;
  updatedAt: string;
}

export interface PersonalAgentProfile {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  soul: string;
  defaultConversationId?: string;
  defaultModelRef?: string;
  defaultRuntimeRef?: string;
  defaultCwd?: string;
  memoryScopes: string[];
  skillRefs: string[];
  toolPolicy: 'default' | 'restricted' | 'custom';
  gatewayBindings: PersonalAgentGatewayBinding[];
  createdAt: string;
  updatedAt: string;
}

export interface PersonalAgentGatewayMessage {
  gatewayId: string;
  accountId?: string;
  senderId: string;
  channelId?: string;
  text: string;
  attachments?: Array<{ id?: string; name?: string; mimeType?: string; data?: string; url?: string }>;
  receivedAt: string;
  trustLevel: 'local' | 'paired' | 'allowlisted' | 'untrusted';
  metadata?: Record<string, unknown>;
}

export interface PersonalAgentGatewayRouteTarget {
  agentProfileId: string;
  conversationMode: PersonalAgentConversationPolicy;
  deliveryMode: 'conversation' | 'automation' | 'background';
}

export interface ExtensionSelectionState {
  kind: ExtensionSelectionKind;
  text?: string;
  messageBlockIds?: string[];
  files?: Array<{ cwd: string; path: string }>;
  transcriptRange?: { conversationId: string; startBlockId: string; endBlockId: string };
  /**
   * Route page selection for context rails. Main page views publish the selected
   * row/object here so their route-owned right sidebar can render details without
   * opening a modal. The host clears resource selections when the active route
   * shell changes; pages should republish the current selection after navigation
   * or render a compact empty rail when no resource is selected.
   */
  resource?: {
    type: string;
    id: string;
    label?: string;
    source?: string;
    data?: unknown;
  };
  conversationId?: string | null;
  cwd?: string | null;
  updatedAt: string;
}

export interface ExtensionConversationCreateInput {
  title?: string;
  cwd?: string;
  /** Set to false to create a persisted conversation shell without starting a live agent session. */
  live?: boolean;
  prompt?: string;
  initialPrompt?: string;
  model?: string;
  thinkingLevel?: string;
  serviceTier?: string;
  /** When set, only these tool names are exposed to the created live session. */
  allowedToolNames?: string[];
  metadata?: Record<string, unknown>;
  runtimeId?: string;
}

export interface ExtensionConversationForkInput {
  conversationId: string;
  atBlockId?: string;
  beforeEntry?: boolean;
  title?: string;
  cwd?: string;
  targetCwd?: string;
  model?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExtensionConversationResult {
  conversationId: string;
  title?: string;
  route?: string;
  [key: string]: unknown;
}

export interface ExtensionTranscriptBlockWriteInput {
  conversationId: string;
  blockType: string;
  data: unknown;
  title?: string;
  blockId?: string;
}

export interface NeonPilotClient {
  extension: {
    invoke<T = unknown>(actionId: string, input?: unknown): Promise<T>;
    getManifest(): Promise<ExtensionManifest>;
    listSurfaces(): Promise<ExtensionViewContribution[]>;
  };
  automations: {
    list(): Promise<ExtensionAutomationSummary[]>;
    readSchedulerHealth(): Promise<Record<string, unknown>>;
    get(taskId: string): Promise<ExtensionAutomationSummary>;
    create(input: unknown): Promise<ExtensionAutomationSummary>;
    update(taskId: string, input: unknown): Promise<ExtensionAutomationSummary>;
    delete(taskId: string): Promise<{ ok: true } | Record<string, unknown>>;
    run(taskId: string): Promise<Record<string, unknown>>;
    readLog(taskId: string): Promise<string | Record<string, unknown>>;
  };
  executions: {
    start(input: unknown): Promise<ExtensionRunSummary>;
    get(executionId: string): Promise<unknown>;
    list(input?: { conversationId?: string | null }): Promise<unknown[]>;
    readLog(executionId: string, tail?: number): Promise<string | Record<string, unknown>>;
    cancel(executionId: string): Promise<ExtensionRunSummary | Record<string, unknown>>;
  };
  storage: {
    get<T = unknown>(key: string): Promise<T | null>;
    put(key: string, value: unknown, opts?: { expectedVersion?: number }): Promise<unknown>;
    delete(key: string): Promise<unknown>;
    list<T = unknown>(prefix?: string): Promise<Array<{ key: string; value: T }>>;
  };
  workspace: {
    tree(cwd: string, path?: string): Promise<ExtensionWorkspaceTreeEntry[]>;
    readFile(cwd: string, path: string, opts?: { force?: boolean }): Promise<ExtensionWorkspaceFileResult>;
    writeFile(cwd: string, path: string, content: string): Promise<{ ok: true } | Record<string, unknown>>;
    createFile(cwd: string, path: string, content?: string): Promise<{ ok: true } | Record<string, unknown>>;
    createFolder(cwd: string, path: string): Promise<{ ok: true } | Record<string, unknown>>;
    deletePath(cwd: string, path: string): Promise<{ ok: true } | Record<string, unknown>>;
    renamePath(cwd: string, path: string, newName: string): Promise<{ ok: true } | Record<string, unknown>>;
    movePath(cwd: string, path: string, targetDir: string): Promise<{ ok: true } | Record<string, unknown>>;
    diff(cwd: string, path: string): Promise<string | Record<string, unknown>>;
    uncommittedDiff(cwd: string): Promise<string | Record<string, unknown>>;
  };
  workbench: {
    getDetailState<T = unknown>(surfaceId: string): T | null;
    setDetailState(surfaceId: string, state: unknown): void;
  };
  browser: {
    isAvailable(): boolean;
    getState(input?: { tabId?: string | null }): Promise<ExtensionBrowserState>;
    open(input: { url: string; tabId?: string | null }): Promise<ExtensionBrowserState>;
    goBack(input?: { tabId?: string | null }): Promise<ExtensionBrowserState>;
    goForward(input?: { tabId?: string | null }): Promise<ExtensionBrowserState>;
    reload(input?: { tabId?: string | null }): Promise<ExtensionBrowserState>;
    stop(input?: { tabId?: string | null }): Promise<ExtensionBrowserState>;
    snapshot(input?: { tabId?: string | null }): Promise<Record<string, unknown>>;
  };
  ui: {
    toast(message: string, type?: 'info' | 'warning' | 'error'): void;
    /** Post a richer notification with optional details and source attribution. */
    notify(options: { message: string; type?: 'info' | 'warning' | 'error'; details?: string; source?: string }): void;
    confirm(options: { title?: string; message: string }): Promise<boolean>;
    /** Subscribe to host app data invalidations such as tasks, runs, automation, or workspace. */
    subscribeInvalidations(handler: (event: { topics: string[] }) => void): { unsubscribe: () => void };
    openModal(options: {
      title?: string;
      component: string;
      props?: Record<string, unknown>;
      size?: 'default' | 'large' | 'fullscreen';
    }): Promise<unknown>;
  };
  commands: {
    execute(command: string, args?: unknown): Promise<boolean>;
    list(): Promise<unknown[]>;
    setContext(key: string, value: string | number | boolean | null | undefined): void;
  };
  /** Inter-extension communication. */
  events: {
    /** Publish an event that other extensions can receive. */
    publish(event: string, payload: unknown): Promise<void>;
    /** Subscribe to events matching a pattern. Supports '*' (all) and 'namespace:*' (prefix). */
    subscribe(pattern: string, handler: (event: { event: string; payload: unknown }) => void): { unsubscribe: () => void };
  };
  selection: {
    get(): ExtensionSelectionState | null;
    set(selection: Omit<ExtensionSelectionState, 'updatedAt'> | null): void;
    subscribe(handler: (selection: ExtensionSelectionState | null) => void): { unsubscribe: () => void };
  };
  transcript: {
    spotlight(target: ExtensionTranscriptSpotlightTarget): void;
    targetProps(target: ExtensionTranscriptSpotlightTarget): Record<string, string>;
  };
  /** List and call actions on other extensions. */
  extensions: {
    /** Invoke an action on any installed extension. */
    callAction(extensionId: string, actionId: string, input?: unknown): Promise<unknown>;
    /** List all extensions that expose callable actions. */
    listActions(): Promise<
      Array<{
        extensionId: string;
        extensionName: string;
        actions: Array<{ id: string; title?: string; description?: string }>;
      }>
    >;
    /** Check whether an extension is enabled and healthy. */
    getStatus(extensionId: string): Promise<{ enabled: boolean; healthy: boolean; errors?: string[] }>;
  };
}

export interface ExtensionScopedFileSystem {
  readonly root: { kind: string; id: string; path: string; displayName?: string; labels?: Record<string, string> };
  readBytes(path: string, options?: { maxBytes?: number }): Promise<Uint8Array>;
  readText(path: string, options?: { maxBytes?: number }): Promise<string>;
  writeBytes(path: string, data: Uint8Array, options?: { atomic?: boolean }): Promise<void>;
  writeText(path: string, data: string, options?: { atomic?: boolean }): Promise<void>;
  readJson<T>(path: string, options?: { maxBytes?: number }): Promise<T>;
  writeJson(path: string, value: unknown, options?: { atomic?: boolean }): Promise<void>;
  list(
    path?: string,
    options?: { depth?: number; excludeNames?: string[] },
  ): Promise<Array<{ name: string; path: string; type: string; size?: number; modifiedAt?: string }>>;
  stat(path: string): Promise<{ type: string; size: number | null; modifiedAt: string | null }>;
  move(from: string, to: string, options?: { overwrite?: boolean }): Promise<void>;
  copyIn(to: string, absoluteSource: string): Promise<void>;
  remove(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  createDirectory(path: string): Promise<void>;
  createTempWorkspace(options?: { prefix?: string }): Promise<ExtensionScopedFileSystem>;
}

export interface ExtensionSqliteRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface ExtensionSqliteStatement {
  run(...params: unknown[]): ExtensionSqliteRunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface ExtensionSqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): ExtensionSqliteStatement;
  close(): void;
  pragma(statement: string): void;
  transaction<TArgs extends unknown[]>(fn: (...args: TArgs) => void): (...args: TArgs) => void;
}

export interface ExtensionDatabaseMigration {
  version: number;
  description?: string;
  up: (db: ExtensionSqliteDatabase) => void;
}

export interface ExtensionDatabaseManager {
  open(name?: string, options?: { migrations?: ExtensionDatabaseMigration[] }): Promise<ExtensionSqliteDatabase>;
  close(name?: string): Promise<void>;
  closeAll(): Promise<void>;
}

export interface RuntimeSummary {
  id: string;
  providerId: string;
  extensionId: string;
  title: string;
  kind: 'local' | 'remote' | string;
  status: 'unknown' | 'installing' | 'healthy' | 'degraded' | 'offline' | string;
  version?: string;
  workspaceRoots?: Array<{ id: string; path: string; label?: string }>;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface RuntimeHealth {
  runtimeId: string;
  status: RuntimeSummary['status'];
  message?: string;
  checkedAt: string;
  details?: Record<string, unknown>;
}

export interface ExtensionBackendContext {
  extensionId: string;
  /**
   * Current runtime scope. Neon Pilot no longer has user-selectable profiles;
   * this is the single shared runtime scope kept for storage migration and
   * legacy path compatibility.
   */
  runtimeScope: string;
  /** Absolute path to the neon-pilot-runtime directory. */
  runtimeDir: string;
  /** Absolute path to the runtime settings file. */
  runtimeSettingsFilePath: string;
  runtime: {
    getLiveSessionResourceOptions(): unknown;
    getRepoRoot(): string;
    refreshSkillMcpConfig(): Promise<unknown>;
  };
  storage: {
    get<T = unknown>(key: string): Promise<T | null>;
    put(key: string, value: unknown, opts?: { expectedVersion?: number }): Promise<{ ok: true }>;
    delete(key: string): Promise<{ ok: true; deleted: boolean }>;
    list<T = unknown>(prefix?: string): Promise<Array<{ key: string; value: T }>>;
  };
  database: ExtensionDatabaseManager;
  documents: {
    listCollections(input?: { owner?: string }): Promise<unknown[]>;
    getCollection(input: { owner: string; collection: string }): Promise<unknown>;
    upsertCollection(input: {
      owner: string;
      collection: string;
      options?: {
        description?: string;
        defaultGrantRead?: 'owner' | 'all' | 'none';
        defaultGrantWrite?: 'owner' | 'all' | 'none';
      };
    }): Promise<unknown>;
    listDocuments(input: { owner: string; collection: string; limit?: number; offset?: number }): Promise<unknown>;
    getDocument(input: { owner: string; collection: string; id: string }): Promise<unknown>;
    putDocument(input: { owner: string; collection: string; id: string; body: unknown }): Promise<unknown>;
    deleteDocument(input: { owner: string; collection: string; id: string }): Promise<unknown>;
    listGrants(input: { owner: string; collection: string }): Promise<unknown>;
    getGrant(input: { owner: string; collection: string; granteeAppId: string }): Promise<unknown>;
    setGrant(input: { owner: string; collection: string; granteeAppId: string; canRead: boolean; canWrite: boolean }): Promise<unknown>;
    deleteGrant(input: { owner: string; collection: string; granteeAppId: string }): Promise<unknown>;
  };
  attention: {
    enqueue(input: {
      conversationId?: string;
      sessionFile?: string;
      title?: string;
      prompt: string;
      delay?: string;
      at?: string;
      source?: { kind?: string; id?: string };
      delivery?: {
        mode?: 'batchable' | 'sequential' | 'isolated';
        priority?: 'low' | 'normal' | 'high';
        requireAck?: boolean;
        autoResumeIfOpen?: boolean;
        behavior?: 'steer' | 'followUp';
        batchKey?: string;
      };
    }): Promise<unknown>;
    list(input?: { sessionFile?: string }): Promise<unknown[]>;
    cancel(input: { id: string; sessionFile?: string }): Promise<unknown>;
  };
  automations: Record<string, (...args: never[]) => Promise<unknown>>;
  models: {
    list(): Promise<unknown[]>;
    saveProvider(input: {
      provider: string;
      baseUrl?: string;
      api?: string;
      apiKey?: string;
      authHeader?: boolean;
      headers?: Record<string, string>;
      compat?: Record<string, unknown>;
      modelOverrides?: Record<string, unknown>;
    }): Promise<unknown>;
    saveProviderModel(input: {
      provider: string;
      modelId: string;
      name?: string;
      api?: string;
      baseUrl?: string;
      reasoning?: boolean;
      input?: Array<'text' | 'image'>;
      contextWindow?: number;
      maxTokens?: number;
      headers?: Record<string, string>;
      cost?: {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
      };
      compat?: Record<string, unknown>;
    }): Promise<unknown>;
    deleteProvider(provider: string): Promise<unknown>;
    deleteProviderModel(input: { provider: string; modelId: string }): Promise<unknown>;
  };
  knowledge: Record<string, (...args: never[]) => Promise<unknown>>;
  conversations: Record<string, (...args: never[]) => Promise<unknown>> & {
    list(...args: never[]): Promise<unknown>;
    activity(
      conversationId: string,
      options?: { active?: boolean; visibility?: 'primary' | 'system' | 'hidden' | 'visible' | 'all' },
    ): Promise<unknown>;
    connections(
      conversationId: string,
      options?: {
        active?: boolean;
        kind?: 'activity' | 'state' | 'asset' | 'context' | 'integration' | 'surface' | 'all';
        surface?: 'activityShelf' | 'composerShelf' | 'rightRail' | 'workbench' | 'sidebar' | 'cli' | 'all';
        visibility?: 'primary' | 'system' | 'hidden' | 'visible' | 'all';
      },
    ): Promise<unknown>;
    getMeta(conversationId: string): Promise<unknown>;
    get(conversationId: string, options?: { tailBlocks?: number }): Promise<unknown>;
    getBlocks(conversationId: string, options?: { tailBlocks?: number }): Promise<unknown>;
    searchIndex(sessionIds: string[]): Promise<unknown>;
    getWorkspace(): Promise<unknown>;
    delete(input: { conversationIds: string[] }): Promise<unknown>;
    prune(input: { olderThanMs: number; archivedOnly?: boolean | null; dryRun?: boolean | null }): Promise<unknown>;
    updateWorkspace(input: {
      openConversationIds?: string[] | null;
      pinnedConversationIds?: string[] | null;
      archivedConversationIds?: string[] | null;
      activeConversationId?: string | null;
      workspacePaths?: string[] | null;
      remoteControlledConversationIds?: string[] | null;
    }): Promise<unknown>;
    sendMessage(
      conversationId: string,
      text: string,
      options?: {
        steer?: boolean;
        images?: Array<{ data: string; mimeType: string; name?: string }>;
        videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
        audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
        documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
      },
    ): Promise<{ accepted: boolean; delivery?: 'started' | 'queued' }>;
    startParallelPrompt(
      conversationId: string,
      input: {
        text: string;
        cwd?: string;
        images?: Array<{ data: string; mimeType: string; name?: string }>;
        videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
        audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
        documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
        model?: string | null;
        thinkingLevel?: string | null;
        serviceTier?: string | null;
        purpose?: string;
        metadata?: Record<string, unknown>;
        autoImport?: boolean;
      },
    ): Promise<{ ok: true; accepted: true; jobId: string; childConversationId: string }>;
    manageParallelJob(input: {
      conversationId: string;
      jobId: string;
      action: 'importNow' | 'skip' | 'cancel';
    }): Promise<{ ok: true; status: 'imported' | 'queued' | 'skipped' | 'cancelled' }>;
    setActiveTools(conversationId: string, toolNames: string[]): Promise<{ conversationId: string; toolNames: string[] }>;
    appendCustomEntry(conversationId: string, customType: string, data?: unknown): Promise<{ ok: true }>;
    runTurn(
      conversationId: string,
      text: string,
      options?: {
        cwd?: string;
        steer?: boolean;
        images?: Array<{ data: string; mimeType: string; name?: string }>;
        timeoutMs?: number;
        onEvent?: (event: unknown) => void;
      },
    ): Promise<{ accepted: boolean }>;
    startParallelPrompt(
      conversationId: string,
      input: {
        text: string;
        cwd?: string;
        images?: Array<{ data: string; mimeType: string; name?: string }>;
        videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
        audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
        documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
        attachmentRefs?: unknown;
        contextMessages?: unknown;
        relatedConversationIds?: unknown;
        surfaceId?: string;
        model?: string | null;
        thinkingLevel?: string | null;
        serviceTier?: string | null;
        purpose?: string;
        metadata?: Record<string, unknown>;
        autoImport?: boolean;
      },
    ): Promise<{
      ok: true;
      accepted: true;
      jobId: string;
      childConversationId: string;
      referencedTaskIds: string[];
      referencedMemoryDocIds: string[];
      referencedKnowledgeFileIds: string[];
      referencedAttachmentIds: string[];
      relatedConversationPointerWarnings?: string[];
    }>;
    manageParallelJob(input: {
      conversationId: string;
      jobId: string;
      action: 'importNow' | 'skip' | 'cancel';
    }): Promise<{ ok: true; status: string }>;
    createSpeculativeWorkspace(conversationId: string): Promise<{
      id: string;
      sourcePath: string;
      rootPath: string;
      strategy: 'apfs-clone' | 'copy';
    }>;
    applySpeculativeWorkspace(input: { id: string; sourcePath?: string; rootPath?: string; paths?: string[] }): Promise<{
      changes: Array<{ path: string; type: 'added' | 'modified' | 'deleted'; kind: 'file' | 'symlink' }>;
      summary: { added: number; modified: number; deleted: number };
    }>;
    disposeSpeculativeWorkspace(input: string | { id: string; rootPath?: string }): Promise<{ ok: true }>;
    setTitle(conversationId: string, title: string): Promise<unknown>;
    compact(conversationId: string, customInstructions?: string): Promise<unknown>;
    abort(conversationId: string): Promise<{ ok: true }>;
    rollback(conversationId: string, count: number): Promise<{ rolledBackTo: string | null }>;
    create(input?: ExtensionConversationCreateInput): Promise<ExtensionConversationResult>;
    ensureLive(conversationId: string, options?: { cwd?: string; runtimeId?: string }): Promise<ExtensionConversationResult>;
    requestWorkingDirectoryChange(
      conversationId: string,
      cwd: string,
      options?: { continuePrompt?: string },
    ): Promise<{ conversationId: string; cwd: string; queued: boolean; unchanged?: boolean }>;
    fork(input: ExtensionConversationForkInput): Promise<ExtensionConversationResult>;
    appendTranscriptBlock(input: ExtensionTranscriptBlockWriteInput): Promise<{ blockId: string }>;
    updateTranscriptBlock(input: ExtensionTranscriptBlockWriteInput & { blockId: string }): Promise<{ blockId: string }>;
    metadata: {
      get(input: { conversationId: string; namespace?: string }): Promise<Record<string, unknown>>;
      set(input: { conversationId: string; namespace?: string; values: Record<string, unknown> }): Promise<Record<string, unknown>>;
      query(input: {
        namespace?: string;
        where?: Array<{ key: string; op?: 'eq' | 'neq' | 'in' | 'exists'; value?: unknown }>;
        limit?: number;
      }): Promise<Array<{ conversationId: string; metadata: Record<string, unknown> }>>;
    };
  };
  filesystem: {
    requestRoot(input: {
      kind?: 'workspace' | 'app' | 'cache' | 'temp';
      cwd?: string;
      access?: string[];
      reason?: string;
    }): Promise<ExtensionScopedFileSystem>;
    workspace(input?: { cwd?: string; access?: string[]; reason?: string }): Promise<ExtensionScopedFileSystem>;
    app(input?: { access?: string[]; reason?: string }): Promise<ExtensionScopedFileSystem>;
    cache(input?: { access?: string[]; reason?: string }): Promise<ExtensionScopedFileSystem>;
    temp(input?: { access?: string[]; reason?: string; prefix?: string }): Promise<ExtensionScopedFileSystem>;
  };
  workspace: Record<string, (...args: never[]) => Promise<unknown>>;
  git: Record<string, (...args: never[]) => Promise<unknown>>;
  shell: {
    exec(input: {
      command: string;
      args?: string[];
      cwd?: string;
      timeoutMs?: number;
      maxBuffer?: number;
      env?: Record<string, string>;
      signal?: AbortSignal;
    }): Promise<{
      command: string;
      args: string[];
      cwd?: string;
      stdout: string;
      stderr: string;
      executionWrappers: Array<{ id: string; label?: string }>;
    }>;
    spawn(input: {
      command: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      /**
       * When true, allocates a pseudo-terminal (PTY) via node-pty.
       * Accepts `{ cols, rows }` to set initial terminal dimensions.
       * PTY mode merges stdout/stderr into the `onStdout` callback.
       */
      pty?: boolean | { cols?: number; rows?: number };
      onStdout?: (chunk: string) => void;
      onStderr?: (chunk: string) => void;
      onExit?: (event: { code: number | null; signal: NodeJS.Signals | null }) => void;
    }): Promise<{
      pid: number | null;
      usingPty: boolean;
      executionWrappers: Array<{ id: string; label?: string }>;
      kill: () => void;
      /** Write data to the process stdin. */
      write: (data: string) => void;
      /**
       * Resize the terminal (cols, rows).
       * Only meaningful for PTY-backed processes; no-op for non-PTY spawns.
       */
      resize: (cols: number, rows: number) => void;
    }>;
  };
  commands: {
    execute(command: string, args?: unknown): Promise<boolean>;
    list(): Promise<unknown[]>;
  };
  persona: {
    getName(): Promise<{ name: string; isDefault: boolean }>;
    setName(name: string): Promise<{ ok: true }>;
  };
  notify: {
    toast(message: string, type?: 'info' | 'warning' | 'error'): void;
    system(input: { message: string; title?: string; subtitle?: string; persistent?: boolean }): boolean;
    setBadge(count: number): { badge: number; aggregated: number };
    clearBadge(): void;
    isSystemAvailable(): boolean;
  };
  events: {
    publish(input: { event: string; payload: unknown }): Promise<void>;
    subscribe(
      pattern: string,
      handler: (event: { event: string; payload: unknown; sourceExtensionId: string; publishedAt: string }) => void | Promise<void>,
    ): { unsubscribe: () => void };
  };
  extensions: {
    callAction(extensionId: string, actionId: string, input?: unknown): Promise<unknown>;
    listActions(): Promise<
      Array<{
        extensionId: string;
        extensionName: string;
        actions: Array<{ id: string; title?: string; description?: string }>;
      }>
    >;
    getStatus(extensionId: string): Promise<{ enabled: boolean; healthy: boolean; errors?: string[] }>;
    /** Enable or disable an extension by ID. */
    setEnabled(extensionId: string, enabled: boolean): void;
    /** Grant or revoke a declared permission for an extension by ID. Requires extensions:write. */
    setPermissionGranted(extensionId: string, permission: ExtensionPermission, granted: boolean): Promise<void>;
  };
  secrets: {
    /** Resolve a secret registered in this extension's manifest. */
    get(secretId: string): string | undefined;
  };
  ui: {
    invalidate(topics: string | string[]): void;
    confirm(options: {
      title?: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      timeoutMs?: number;
      details?: Array<{ label: string; value: string }>;
    }): Promise<{ confirmed: boolean; status: 'confirmed' | 'declined' | 'timeout' }>;
  };
  telemetry: {
    record(event: {
      source?: 'server' | 'renderer' | 'agent' | 'system';
      category: string;
      name: string;
      sessionId?: string;
      runId?: string;
      route?: string;
      status?: number;
      durationMs?: number;
      count?: number;
      value?: number;
      metadata?: Record<string, unknown>;
    }): void;
  };
  runtimes: {
    list(): Promise<RuntimeSummary[]>;
    get(runtimeId: string): Promise<RuntimeSummary>;
    healthCheck(runtimeId: string): Promise<RuntimeHealth>;
  };
  log: {
    info(message: string, fields?: Record<string, unknown>): void;
    warn(message: string, fields?: Record<string, unknown>): void;
    error(message: string, fields?: Record<string, unknown>): void;
  };
}

export interface ExtensionProtocolContext extends ExtensionBackendContext {
  protocolId: string;
  stdio: {
    stdin: NodeJS.ReadableStream;
    stdout: NodeJS.WritableStream;
    stderr: NodeJS.WritableStream;
  };
  signal: AbortSignal;
}
