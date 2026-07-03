import {
  api,
  type AppTelemetryLogBundleExport,
  type AppTelemetryLogDiagnostics,
  CORE_KEYBOARD_SHORTCUT_REGISTRATIONS,
  createDesktopAwareEventSource,
  createModelEditorDraft,
  createProviderEditorDraft,
  DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS,
  type DesktopAppPreferencesState,
  type DesktopEnvironmentState,
  EXTENSION_REGISTRY_CHANGED_EVENT,
  type ExtensionKeybindingRegistration,
  formatContextWindowLabel,
  formatServiceTierLabel,
  formatThinkingLevelLabel,
  getDesktopBridge,
  getModelSelectableServiceTierOptions,
  groupModelsByProvider,
  isDesktopShell,
  listHostCommands,
  type ModelEditorDraft,
  type ModelProviderApi,
  type ModelProviderConfig,
  type ModelProviderState,
  type ModelState,
  parseOptionalJsonObject,
  parseOptionalNonNegativeNumber,
  parseOptionalPositiveInteger,
  parseOptionalStringRecord,
  type ProviderAuthSummary,
  type ProviderConnectionTestResult,
  type ProviderEditorDraft,
  type ProviderOAuthLoginState,
  type ProviderOAuthLoginStreamEvent,
  readDesktopEnvironment,
  type SecretsState,
  type SecretStatusEntry,
  SettingsField,
  SettingsPanel,
  SettingsPanelHost,
  SettingsRow,
  subscribeDesktopProviderOAuthLogin,
  type TelemetryDbMaintenanceResult,
  type ThemeAccent,
  THINKING_LEVEL_OPTIONS,
  type UnifiedSettingsEntry,
  useApi,
  useExtensionRegistry,
  useTheme,
} from '@neon-pilot/extensions/settings';
import {
  AppPageLayout,
  Button,
  Checkbox,
  cx,
  Disclosure,
  type ExtensionSurfaceProps,
  formatKeyboardShortcutLabel,
  IconButton,
  KeyboardShortcutCaptureInput,
  RowButton,
  SearchInput,
  SegmentedControl,
  Select,
  SidebarRow,
  SidebarSection,
  SwatchOption,
  Switch,
  Textarea,
  TextButton,
  TextInput,
  ToolbarButton,
  WindowedList,
  WindowedListItem,
  WindowedPageMain,
  WindowedPageRail,
  WindowedPageShell,
} from '@neon-pilot/extensions/ui';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const SETTINGS_QUICK_LINKS = [
  { id: 'settings-appearance', label: 'Appearance' },
  { id: 'settings-providers', label: 'Providers' },
  { id: 'settings-conversation', label: 'Conversation' },
  { id: 'settings-workspace', label: 'Workspace' },
  { id: 'settings-commands', label: 'Commands' },
  { id: 'settings-security', label: 'Security' },
  { id: 'settings-extensions', label: 'Extensions' },
  { id: 'settings-desktop', label: 'Desktop' },
] as const satisfies readonly { id: string; label: string }[];

const SETTINGS_ROOT_ROUTES: Record<(typeof SETTINGS_QUICK_LINKS)[number]['id'], string> = {
  'settings-appearance': '/settings/appearance',
  'settings-providers': '/settings/providers',
  'settings-conversation': '/settings/conversation',
  'settings-workspace': '/settings/workspace',
  'settings-commands': '/settings/commands',
  'settings-security': '/settings/security',
  'settings-extensions': '/settings/extensions',
  'settings-desktop': '/settings/desktop',
};

const SETTINGS_PANEL_COMPACT_CLASS = 'settings-page-panel-compact';
const SETTINGS_PANEL_DENSE_CLASS = 'settings-page-panel-dense';

const SETTINGS_ENTRY_LABELS: Record<string, string> = {
  'conversation.transcriptDisclosure': 'Tool and reasoning details',
  'conversation.diffDisclosure': 'Code changes',
  'conversation.pinnedToolCalls': 'Keep important tool results visible',
};

const SETTINGS_SELECT_LABELS: Record<string, Record<string, string>> = {
  'conversation.transcriptDisclosure': {
    auto: 'Automatic',
    expanded: 'Always expanded',
  },
  'conversation.diffDisclosure': {
    collapsed: 'Start collapsed',
    expanded: 'Always expanded',
  },
  'systemFiles.transcriptPathLinkTarget': {
    fileExplorer: 'File Explorer',
    desktop: 'Desktop',
  },
};
const SETTINGS_ROW_GROUP_CLASS = 'settings-page-row-group';

type SettingsQuickLink = {
  id: string;
  label: ReactNode;
  summary?: ReactNode;
  route?: string;
  extensionId?: string;
  children?: readonly SettingsQuickLink[];
};
type SettingsQuickLinkId = string;
const VisibleSettingsSectionsContext = createContext<ReadonlySet<SettingsQuickLinkId> | null>(null);
const HideSettingsSectionHeadingsContext = createContext(false);
type ModelOption = ModelState['models'][number];
type SettingsIconName = 'check' | 'edit' | 'external' | 'key' | 'plus' | 'refresh' | 'trash' | 'x';

interface CliInstallStatus {
  target: string;
  binDir: string;
  linkPath: string;
  globallyInstalled: boolean;
  linkExists: boolean;
  linkConflict: boolean;
  linkTarget?: string;
  removed?: boolean;
}

function SettingsIcon({ name }: { name: SettingsIconName }) {
  const paths: Record<SettingsIconName, ReactNode> = {
    check: <path d="m5 12 4 4L19 6" />,
    edit: (
      <>
        <path d="M5 19h4" />
        <path d="m7 17 9.5-9.5 2 2L9 19H7v-2Z" />
      </>
    ),
    external: (
      <>
        <path d="M7 17 17 7" />
        <path d="M9 7h8v8" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="14" r="3" />
        <path d="m10.5 11.5 6-6" />
        <path d="m15 7 2 2" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
        <path d="M4 4v4h4" />
        <path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" />
        <path d="M20 20v-4h-4" />
      </>
    ),
    trash: (
      <>
        <path d="M5 7h14" />
        <path d="M9 7V5h6v2" />
        <path d="M8 10v8" />
        <path d="M16 10v8" />
        <path d="M7 7l1 13h8l1-13" />
      </>
    ),
    x: (
      <>
        <path d="M7 7l10 10" />
        <path d="M17 7 7 17" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      {paths[name]}
    </svg>
  );
}

type DesktopKeyboardShortcutId = keyof DesktopAppPreferencesState['keyboardShortcuts'];

const DESKTOP_KEYBOARD_SHORTCUT_IDS = CORE_KEYBOARD_SHORTCUT_REGISTRATIONS.map(
  (registration) => registration.id,
) as DesktopKeyboardShortcutId[];
const DESKTOP_KEYBOARD_SHORTCUT_LABELS = Object.fromEntries(
  CORE_KEYBOARD_SHORTCUT_REGISTRATIONS.map((registration) => [
    registration.id,
    { label: registration.title, description: registration.description },
  ]),
) as Record<DesktopKeyboardShortcutId, { label: string; description: string }>;
const DEFAULT_DESKTOP_KEYBOARD_SHORTCUT_DRAFT = DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS as DesktopAppPreferencesState['keyboardShortcuts'];

export function readSettingsSectionIdFromHash(hash: string): string {
  const rawSectionId = hash.replace(/^#/, '');
  if (!rawSectionId) return '';
  try {
    return decodeURIComponent(rawSectionId);
  } catch {
    return '';
  }
}

export function readSettingsSectionIdFromPathname(pathname: string): SettingsQuickLinkId | '' {
  const normalizedPathname = pathname.replace(/\/+$/, '');
  const extensionSettingsMatch = normalizedPathname.match(/^\/settings\/extensions\/([^/]+)$/);
  if (extensionSettingsMatch) {
    try {
      return settingsExtensionAnchorId(decodeURIComponent(extensionSettingsMatch[1]));
    } catch {
      return '';
    }
  }

  switch (normalizedPathname) {
    case '/settings/appearance':
      return 'settings-appearance';
    case '/settings/conversation':
      return 'settings-conversation';
    case '/settings/providers':
      return 'settings-providers';
    case '/settings/workspace':
      return 'settings-workspace';
    case '/settings/commands':
      return 'settings-commands';
    case '/settings/security':
      return 'settings-security';
    case '/settings/extensions':
      return 'settings-extensions';
    case '/settings':
      return '';
    case '/settings/desktop':
      return 'settings-desktop';
    default:
      return '';
  }
}

function readSettingsSectionIdFromLocation(pathname = '', hash = ''): SettingsQuickLinkId | '' {
  const fromPath = readSettingsSectionIdFromPathname(pathname);
  if (fromPath && fromPath !== 'settings-extensions') {
    return fromPath;
  }
  return readSettingsSectionIdFromHash(hash) || fromPath;
}

export function readSettingsSectionIdFromContext(
  context: ExtensionSurfaceProps['context'] | undefined,
  fallback: { pathname?: string; hash?: string } = {},
): SettingsQuickLinkId | '' {
  const fromFallback = readSettingsSectionIdFromLocation(fallback.pathname, fallback.hash);
  if (fromFallback) {
    return fromFallback;
  }
  if (typeof window !== 'undefined') {
    const fromWindow = readSettingsSectionIdFromLocation(window.location.pathname, window.location.hash);
    if (fromWindow) {
      return fromWindow;
    }
  }
  const fromContext = readSettingsSectionIdFromLocation(context?.pathname, context?.hash);
  if (fromContext) {
    return fromContext;
  }
  return '';
}

export function formatDefaultCwdSaveError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Directory does not exist:/i.test(message)) {
    return 'That folder does not exist. Choose an existing folder.';
  }
  if (/^5\d\d\s+.+?\s+from\s+\/api\/default-cwd:/i.test(message)) {
    return 'The default project folder could not be saved.';
  }
  return message;
}

function formatModelPreferenceSaveError(error: unknown, field: 'model' | 'visionModel' | 'thinking' | 'serviceTier'): string {
  const fallbackByField: Record<typeof field, string> = {
    model: 'Could not save the default model. Try again.',
    visionModel: 'Could not save the default image model. Try again.',
    thinking: 'Could not save the default thinking level. Try again.',
    serviceTier: 'Could not save the default service tier. Try again.',
  };
  const message = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = message.trim();
  if (!trimmed || hasInternalProviderCredentialFailureDetails(trimmed)) {
    return fallbackByField[field];
  }
  return trimmed;
}

export function scrollSettingsSectionIntoView(container: HTMLElement | null, sectionId: SettingsQuickLinkId) {
  const section = typeof document === 'undefined' ? null : document.getElementById(sectionId);
  if (section && container?.contains(section)) {
    if (typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ block: 'start' });
    }
    const sectionRect = section.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const sectionTop = sectionRect.top - containerRect.top;
    if (Math.abs(sectionTop) > 24 && typeof container.scrollTo === 'function') {
      container.scrollTo({ top: Math.max(0, container.scrollTop + sectionTop - 16) });
    }
    return;
  }

  if (container && typeof container.scrollTo === 'function') {
    container.scrollTo({ top: 0 });
  }
}

function scheduleSettingsSectionScroll(container: HTMLElement | null, sectionId: SettingsQuickLinkId): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const timers: Array<ReturnType<typeof window.setTimeout>> = [];
  let frame: number | null = null;
  let attempts = 0;
  const isSectionVisible = () => {
    const section = document.getElementById(sectionId);
    if (!section || !container?.contains(section)) return false;
    const sectionRect = section.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return sectionRect.top >= containerRect.top - 24 && sectionRect.top <= containerRect.top + 120;
  };
  const scroll = () => {
    attempts += 1;
    scrollSettingsSectionIntoView(container, sectionId);
    if (attempts < 16 && !isSectionVisible()) {
      timers.push(window.setTimeout(scroll, attempts < 6 ? 100 : 300));
    }
  };
  frame = window.requestAnimationFrame(scroll);
  return () => {
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
    }
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}

type ShortcutListItem = {
  id: string;
  owner: string;
  label: string;
  description?: string;
  shortcuts: string[];
  editable: boolean;
  conflictScope: 'global' | `surface:${string}`;
  extensionId?: string;
  keybindingId?: string;
  enabled?: boolean;
  defaultShortcuts?: string[];
};

type ShortcutListConflict = {
  shortcut: string;
  first: ShortcutListItem;
  second: ShortcutListItem;
};

export interface CommandSettingsEntry {
  id?: string;
  surfaceId?: string;
  extensionId?: string;
  packageType?: 'system' | 'user';
  title?: string;
  category?: string;
  action?: string;
  args?: unknown;
  argsSchema?: unknown;
  enablement?: string;
}

interface CommandKeybindingSettingsEntry extends ExtensionKeybindingRegistration {
  packageType?: 'system' | 'user';
}

interface CommandWithKeybindings extends CommandSettingsEntry {
  keybindings: CommandKeybindingSettingsEntry[];
}

function normalizeShortcutForConflict(shortcut: unknown): string {
  if (typeof shortcut !== 'string') return '';
  const modifierOrder = ['mod', 'ctrl', 'meta', 'alt', 'shift'];
  const modifierAliases: Record<string, string> = {
    commandorcontrol: 'mod',
    cmdorctrl: 'mod',
    cmd: 'mod',
    command: 'mod',
    control: 'ctrl',
    ctrl: 'ctrl',
    meta: 'meta',
    alt: 'alt',
    option: 'alt',
    shift: 'shift',
    mod: 'mod',
  };
  const keyAliases: Record<string, string> = {
    arrowdown: 'down',
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'up',
  };
  const parts = shortcut
    .trim()
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const modifiers = new Set<string>();
  let key = '';
  for (const part of parts) {
    const modifier = modifierAliases[part];
    if (modifier) modifiers.add(modifier);
    else key = keyAliases[part] ?? part;
  }
  return [...modifierOrder.filter((modifier) => modifiers.has(modifier)), key].filter(Boolean).join('+');
}

function buildDesktopShortcutItems(
  draft: DesktopAppPreferencesState['keyboardShortcuts'],
  extensionKeybindings: ExtensionKeybindingRegistration[],
): ShortcutListItem[] {
  const coreItems = DESKTOP_KEYBOARD_SHORTCUT_IDS.map((id) => ({
    id,
    owner: 'Core',
    label: DESKTOP_KEYBOARD_SHORTCUT_LABELS[id].label,
    description: DESKTOP_KEYBOARD_SHORTCUT_LABELS[id].description,
    shortcuts: [draft[id]],
    editable: true,
    conflictScope: 'global' as const,
  }));
  const extensionItems = extensionKeybindings.map((keybinding) => ({
    id: `${keybinding.extensionId}:${keybinding.surfaceId}`,
    owner: keybinding.packageType === 'system' ? 'Built-in extension' : 'Extension',
    label: keybinding.title,
    description: keybinding.scope === 'surface' ? 'Surface shortcut' : 'Global shortcut',
    shortcuts: keybinding.enabled ? keybinding.keys : [],
    editable: true,
    conflictScope: keybinding.scope === 'surface' ? (`surface:${keybinding.extensionId}` as const) : ('global' as const),
    extensionId: keybinding.extensionId,
    keybindingId: keybinding.surfaceId,
    enabled: keybinding.enabled,
    defaultShortcuts: keybinding.defaultKeys,
  }));
  return [...coreItems, ...extensionItems];
}

function findDuplicateShortcut(items: ShortcutListItem[]): ShortcutListConflict | null {
  const seen = new Map<string, ShortcutListItem>();
  for (const item of items) {
    for (const shortcut of item.shortcuts) {
      const normalizedShortcut = normalizeShortcutForConflict(shortcut);
      if (!normalizedShortcut) continue;
      const normalized = `${item.conflictScope}:${normalizedShortcut}`;
      const previous = seen.get(normalized);
      if (previous) return { shortcut, first: previous, second: item };
      seen.set(normalized, item);
    }
  }
  return null;
}

function findShortcutConflictForItem(
  items: ShortcutListItem[],
  targetId: string,
  shortcuts: string[],
): { shortcut: string; title: string } | null {
  const target = items.find((item) => item.id === targetId);
  if (!target) return null;
  const requestedShortcuts = new Map(shortcuts.map((shortcut) => [normalizeShortcutForConflict(shortcut), shortcut]));
  for (const item of items) {
    if (item.id === targetId || item.conflictScope !== target.conflictScope) continue;
    for (const existingShortcut of item.shortcuts) {
      const requestedShortcut = requestedShortcuts.get(normalizeShortcutForConflict(existingShortcut));
      if (requestedShortcut) return { shortcut: requestedShortcut, title: item.label };
    }
  }
  return null;
}

function formatDuplicateShortcutError(shortcut: string, title?: string): string {
  return `Duplicate shortcut: ${shortcut} is already assigned.${title ? ` ${title} already uses it.` : ''}`;
}

const MODEL_PROVIDER_API_OPTIONS: Array<{ value: ModelProviderApi; label: string }> = [
  { value: 'openai-completions', label: 'OpenAI Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
  { value: 'google-generative-ai', label: 'Google Generative AI' },
];
const COMMON_PROVIDER_IDS = ['anthropic', 'openai', 'opencode-go', 'google'];

const NEW_MODEL_PROVIDER_ID = '__new-model-provider__';
const NEW_MODEL_ID = '__new-model__';
const ADD_CUSTOM_PROVIDER_ID = '__add-custom-provider__';

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  'azure-openai-responses': 'Azure OpenAI Responses',
  'github-copilot': 'GitHub Copilot',
  google: 'Google Gemini',
  huggingface: 'Hugging Face',
  'kimi-coding': 'Kimi Coding',
  minimax: 'MiniMax',
  'minimax-cn': 'MiniMax China',
  openai: 'OpenAI',
  'openai-codex': 'OpenAI Codex',
  opencode: 'OpenCode',
  'opencode-go': 'OpenCode Gateway',
  openrouter: 'OpenRouter',
  'vercel-ai-gateway': 'Vercel AI Gateway',
  xai: 'xAI',
};

function formatProviderDisplayName(providerId: string, providerAuth?: ProviderAuthSummary | null): string {
  const oauthName = providerAuth?.oauthProviderName?.trim();
  if (oauthName) {
    return oauthName;
  }

  const normalized = providerId.trim();
  if (!normalized) {
    return 'Provider';
  }

  return (
    PROVIDER_DISPLAY_NAMES[normalized] ??
    normalized
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
      .join(' ')
  );
}

function formatProviderMenuLabel(
  providerId: string,
  providerAuth: ProviderAuthSummary | null | undefined,
  providerIds: readonly string[],
): string {
  const label = formatProviderDisplayName(providerId, providerAuth);
  const duplicateLabel = providerIds.some(
    (candidate) => candidate !== providerId && formatProviderDisplayName(candidate).toLocaleLowerCase() === label.toLocaleLowerCase(),
  );
  return duplicateLabel || label === providerId ? `${label} (${providerId})` : label;
}

function formatModelProviderSummary(provider: ModelProviderConfig): string {
  if (provider.models.length === 0) {
    return 'Provider only';
  }

  return `${provider.models.length} ${provider.models.length === 1 ? 'model' : 'models'}`;
}

function parseLooseObject(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function formatProviderAdvancedJson(draft: ProviderEditorDraft): string {
  return JSON.stringify(
    {
      headers: parseLooseObject(draft.headersText),
      compat: parseLooseObject(draft.compatText),
      modelOverrides: parseLooseObject(draft.modelOverridesText),
    },
    null,
    2,
  );
}

function applyProviderAdvancedJson(draft: ProviderEditorDraft, text: string): ProviderEditorDraft {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Advanced provider JSON must be an object.');
  }
  const object = parsed as Record<string, unknown>;
  return {
    ...draft,
    headersText: JSON.stringify((object.headers as Record<string, unknown> | undefined) ?? {}, null, 2),
    compatText: JSON.stringify((object.compat as Record<string, unknown> | undefined) ?? {}, null, 2),
    modelOverridesText: JSON.stringify((object.modelOverrides as Record<string, unknown> | undefined) ?? {}, null, 2),
  };
}

function listKnownModelProviderIds(
  modelProviderState: ModelProviderState | undefined,
  providerAuthState: { providers: ProviderAuthSummary[] } | undefined,
  models: ModelOption[] | undefined,
): string[] {
  const providerIds = new Set<string>();

  for (const provider of modelProviderState?.providers ?? []) {
    const id = provider.id.trim();
    if (id) {
      providerIds.add(id);
    }
  }

  for (const provider of providerAuthState?.providers ?? []) {
    const id = provider.id.trim();
    if (id) {
      providerIds.add(id);
    }
  }

  for (const model of models ?? []) {
    const provider = model.provider.trim();
    if (provider) {
      providerIds.add(provider);
    }
  }

  return [...providerIds].sort((left, right) => left.localeCompare(right));
}

function formatModelSummary(model: ModelOption | null, fallback: string): string {
  if (!model) {
    return fallback;
  }

  return `${model.id} · ${model.provider} · ${formatContextWindowLabel(model.context)} ctx`;
}

function modelIdHasMultipleProviders(models: readonly ModelOption[], modelId: string): boolean {
  return models.filter((model) => model.id === modelId).length > 1;
}

export function formatSettingsModelOptionValue(model: ModelOption, models: readonly ModelOption[]): string {
  return modelIdHasMultipleProviders(models, model.id) ? `${model.provider}/${model.id}` : model.id;
}

export function resolveSettingsModelOption(models: readonly ModelOption[], modelRef: string): ModelOption | null {
  const normalized = modelRef.trim();
  if (!normalized) {
    return null;
  }

  const slashIndex = normalized.indexOf('/');
  if (slashIndex > 0 && slashIndex < normalized.length - 1) {
    const provider = normalized.slice(0, slashIndex);
    const id = normalized.slice(slashIndex + 1);
    return models.find((model) => model.provider === provider && model.id === id) ?? null;
  }

  const exactMatch = models.find((model) => model.id === normalized);
  if (!exactMatch) {
    return null;
  }

  return modelIdHasMultipleProviders(models, exactMatch.id) ? null : exactMatch;
}

function canProviderUseApiKey(provider: ProviderAuthSummary | null): boolean {
  if (!provider) {
    return false;
  }

  return provider.apiKeySupported || provider.authType === 'api_key';
}

function hasInternalProviderCredentialFailureDetails(message: string): boolean {
  return (
    /Local API route did not complete/i.test(message) ||
    /\/api\//i.test(message) ||
    /file:\/\//i.test(message) ||
    /localApi\.js/i.test(message) ||
    /\bModule\.[A-Za-z_$][\w$]*/.test(message) ||
    /\s+at\s+\S+/i.test(message) ||
    /packages\/desktop\//i.test(message) ||
    /\bENOENT\b|\bEACCES\b|\bENOTDIR\b|permission denied|no such file or directory/i.test(message)
  );
}

function formatProviderCredentialError(error: unknown, action: 'save' | 'remove'): string {
  const fallback =
    action === 'save' ? 'Could not save this provider credential. Try again.' : 'Could not remove this provider credential. Try again.';
  const message = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = message.trim();
  if (!trimmed || hasInternalProviderCredentialFailureDetails(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function formatProviderEditorActionError(
  error: unknown,
  action: 'saveProvider' | 'deleteProvider' | 'saveModel' | 'deleteModel' | 'testProvider',
): string {
  const fallbackByAction: Record<typeof action, string> = {
    saveProvider: 'Could not save this provider. Check the settings and try again.',
    deleteProvider: 'Could not remove this provider. Try again.',
    saveModel: 'Could not save this model. Check the settings and try again.',
    deleteModel: 'Could not remove this model. Try again.',
    testProvider: 'Could not test this provider. Try again.',
  };
  const message = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = message.trim();
  if (!trimmed || hasInternalProviderCredentialFailureDetails(trimmed)) {
    return fallbackByAction[action];
  }
  return trimmed;
}

function formatProviderOAuthError(error: unknown, action: 'start' | 'submit' | 'cancel' | 'open' | 'copy' | 'failed'): string {
  const fallbackByAction: Record<typeof action, string> = {
    start: 'Could not start provider login. Try again.',
    submit: 'Could not continue provider login. Try again.',
    cancel: 'Could not cancel provider login. Try again.',
    open: 'Could not open the provider login page. Copy the link and open it in your browser.',
    copy: 'Could not copy the provider login details. Try again.',
    failed: 'Provider login failed. Try again.',
  };
  const message = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = message.trim();
  if (!trimmed || hasInternalProviderCredentialFailureDetails(trimmed)) {
    return fallbackByAction[action];
  }
  return trimmed;
}

function formatProviderAuthStatus(provider: ProviderAuthSummary | null): string {
  if (!provider) {
    return 'No provider selected.';
  }

  switch (provider.authType) {
    case 'api_key':
      return provider.hasStoredCredential ? 'Stored API key in secure provider secrets.' : 'API key is available.';
    case 'oauth':
      return provider.hasStoredCredential ? 'Logged in with saved OAuth credentials.' : 'OAuth credentials are available.';
    case 'environment':
      return 'Credentials resolved from environment or external provider config.';
    default:
      return provider.apiKeySupported
        ? 'No stored provider API key detected yet. Save an API key here instead of relying on environment variables.'
        : 'No stored provider credential detected. This provider may still use environment values or apiKey settings from models.json.';
  }
}

function parseOAuthPromptOptions(message: string): Array<{ id: string; label: string }> {
  const options: Array<{ id: string; label: string }> = [];
  const optionPattern = /(?:^|\s)\d+\.\s+(.+?)\s+\(([^()]+)\)(?=\s+\d+\.|$)/g;
  let match: RegExpExecArray | null;

  while ((match = optionPattern.exec(message)) !== null) {
    const label = match[1]?.replace(/\s*\(default\)\s*/i, '').trim();
    const id = match[2]?.trim();
    if (label && id) {
      options.push({ id, label });
    }
  }

  return options;
}

function SettingsGroup({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  id,
  hideHeader,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
  hideHeader?: boolean;
}) {
  if (hideHeader) {
    return (
      <section
        id={id}
        aria-label={typeof title === 'string' ? title : undefined}
        className={cx('ui-settings-panel', SETTINGS_ROW_GROUP_CLASS, className)}
      >
        <div className={cx('ui-settings-panel-content settings-page-row-list', contentClassName)}>{children}</div>
      </section>
    );
  }

  return (
    <SettingsPanel
      id={id}
      title={title}
      description={description}
      actions={actions}
      className={cx(SETTINGS_ROW_GROUP_CLASS, className)}
      contentClassName={cx('settings-page-row-list', contentClassName)}
    >
      {children}
    </SettingsPanel>
  );
}

function SettingsControlRow({
  title,
  description,
  children,
  disabled,
  className,
  actionsClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
  actionsClassName?: string;
}) {
  return (
    <SettingsRow
      title={title}
      description={description}
      disabled={disabled}
      className={cx('settings-page-control-row', className)}
      actionsClassName={cx('settings-page-control-actions', actionsClassName)}
    >
      {children}
    </SettingsRow>
  );
}

function SettingsSection({
  id,
  label,
  children,
  className,
}: {
  id: SettingsQuickLinkId;
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const visibleSections = useContext(VisibleSettingsSectionsContext);
  const hideHeading = useContext(HideSettingsSectionHeadingsContext);
  if (visibleSections && !visibleSections.has(id)) {
    return null;
  }

  const sectionOrder = SETTINGS_QUICK_LINKS.findIndex((item) => item.id === id);

  return (
    <section
      id={id}
      style={{ order: sectionOrder === -1 ? 1000 : sectionOrder }}
      className={cx('settings-page-section scroll-mt-20 space-y-4 pt-4 first:pt-0', className)}
    >
      {hideHeading ? null : (
        <div className="settings-page-section-heading">
          <h1 className="settings-page-section-title text-[22px] font-semibold leading-tight tracking-[-0.01em] text-primary">{label}</h1>
        </div>
      )}
      {children}
    </section>
  );
}

function formatDesktopUpdateSummary(state: DesktopAppPreferencesState | null): string | undefined {
  if (!state || !state.available) {
    return 'Desktop app settings are unavailable in this window.';
  }

  const update = state.update;
  if (!update.supported) {
    return 'Update checks are only available in packaged desktop builds.';
  }

  switch (update.status) {
    case 'checking':
      return 'Checking for updates...';
    case 'downloading':
      return update.availableVersion
        ? `Downloading Neon Pilot ${update.availableVersion}...`
        : 'Downloading the latest Neon Pilot build...';
    case 'ready':
      return update.downloadedVersion
        ? state.autoInstallUpdates
          ? `Neon Pilot ${update.downloadedVersion} is ready and will install automatically.`
          : `Neon Pilot ${update.downloadedVersion} is ready. Quit the app to finish installing it.`
        : `Current version: ${update.currentVersion}.`;
    case 'installing':
      return update.downloadedVersion ? `Installing Neon Pilot ${update.downloadedVersion}...` : 'Installing the downloaded update...';
    case 'error':
      return update.lastError ? `Update error: ${update.lastError}` : 'The last update action failed.';
    case 'idle':
    default:
      return undefined;
  }
}

function formatExtensionFallbackLabel(extensionId: string): string {
  const words = extensionId
    .replace(/^system-/, '')
    .split(/[-_.]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (words.length === 0) return extensionId;
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');
}

function formatSettingsEntryFallbackLabel(key: string): string {
  const segment = key.split('.').pop() ?? key;
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

function settingsExtensionAnchorId(extensionId: string): SettingsQuickLinkId {
  const suffix = extensionId
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `settings-extension-${suffix || 'extension'}`;
}

function settingsExtensionRoute(extensionId: string): string {
  return `/settings/extensions/${encodeURIComponent(extensionId)}`;
}

function extensionDisplayName(extensionId: string, extensions: ReturnType<typeof useExtensionRegistry>['extensions']): string {
  return extensions.find((extension) => extension.id === extensionId)?.name || formatExtensionFallbackLabel(extensionId);
}

function flattenSettingsQuickLinks(items: readonly SettingsQuickLink[]): SettingsQuickLink[] {
  return items.flatMap((item) => [item, ...(item.children ?? [])]);
}

function settingsQuickLinkLabelText(label: ReactNode): string {
  if (typeof label === 'string' || typeof label === 'number') {
    return String(label);
  }
  return 'Settings';
}

function settingsQuickLinkRoute(item: SettingsQuickLink): string {
  return item.route ?? SETTINGS_ROOT_ROUTES[item.id as keyof typeof SETTINGS_ROOT_ROUTES] ?? `/settings#${item.id}`;
}

let cachedExtensionSettingsQuickLinks: SettingsQuickLink[] = [];

function buildExtensionSettingsQuickLinks({
  schema,
  settingsComponents,
  extensions,
}: {
  schema?: readonly UnifiedSettingsEntry[] | null;
  settingsComponents: ReturnType<typeof useExtensionRegistry>['settingsComponents'];
  extensions: ReturnType<typeof useExtensionRegistry>['extensions'];
}): SettingsQuickLink[] {
  const scalarExtensionIds = new Set<string>();
  for (const entry of schema ?? []) {
    if (entry.key === 'secrets.provider' || entry.extensionId === 'system-settings') continue;
    scalarExtensionIds.add(entry.extensionId);
  }
  for (const extension of extensions) {
    if (extension.id === 'system-settings' || !extension.enabled) continue;
    if (Object.keys(extension.contributes?.settings ?? {}).length > 0) {
      scalarExtensionIds.add(extension.id);
    }
  }

  const componentByExtensionId = new Map<string, (typeof settingsComponents)[number]>();
  for (const component of settingsComponents) {
    if (!componentByExtensionId.has(component.extensionId)) {
      componentByExtensionId.set(component.extensionId, component);
    }
  }

  return [...new Set([...scalarExtensionIds, ...componentByExtensionId.keys()])]
    .map((extensionId) => {
      const component = componentByExtensionId.get(extensionId);
      const hasScalarSettings = scalarExtensionIds.has(extensionId);
      return {
        id: settingsExtensionAnchorId(extensionId),
        label: extensionDisplayName(extensionId, extensions),
        route: settingsExtensionRoute(extensionId),
        extensionId,
        sortGroup: hasScalarSettings ? 0 : 1,
        sortOrder: component?.order ?? 0,
      };
    })
    .sort((a, b) => a.sortGroup - b.sortGroup || a.sortOrder - b.sortOrder || String(a.label).localeCompare(String(b.label)))
    .map(({ id, label, route, extensionId }) => ({ id, label, route, extensionId }));
}

function useSettingsNavigation(sectionIds?: readonly SettingsQuickLinkId[]) {
  const extensionRegistry = useExtensionRegistry();
  const { data: settingsSchemaForToc } = useApi<UnifiedSettingsEntry[]>(api.settingsSchema as never);
  const [desktopEnvironment, setDesktopEnvironment] = useState<DesktopEnvironmentState | null>(null);
  const visibleSectionIds = useMemo(() => (sectionIds ? new Set(sectionIds) : null), [sectionIds]);
  const extensionSettingsQuickLinks = useMemo(
    () =>
      buildExtensionSettingsQuickLinks({
        schema: settingsSchemaForToc,
        settingsComponents: extensionRegistry.settingsComponents,
        extensions: extensionRegistry.extensions,
      }),
    [extensionRegistry.extensions, extensionRegistry.settingsComponents, settingsSchemaForToc],
  );
  useEffect(() => {
    if (extensionSettingsQuickLinks.length > 0) {
      cachedExtensionSettingsQuickLinks = extensionSettingsQuickLinks;
    }
  }, [extensionSettingsQuickLinks]);
  const effectiveExtensionSettingsQuickLinks =
    extensionSettingsQuickLinks.length > 0 ? extensionSettingsQuickLinks : cachedExtensionSettingsQuickLinks;
  const settingsQuickLinks = useMemo<readonly SettingsQuickLink[]>(() => {
    if (effectiveExtensionSettingsQuickLinks.length === 0) {
      return SETTINGS_QUICK_LINKS;
    }
    return SETTINGS_QUICK_LINKS.map((item) =>
      item.id === 'settings-extensions' ? { ...item, children: effectiveExtensionSettingsQuickLinks } : item,
    );
  }, [effectiveExtensionSettingsQuickLinks]);
  const shellQuickLinks = useMemo<readonly SettingsQuickLink[]>(() => {
    const includeDesktopSection = desktopEnvironment?.isElectron || isDesktopShell() || visibleSectionIds?.has('settings-desktop');
    return includeDesktopSection ? settingsQuickLinks : settingsQuickLinks.filter((item) => item.id !== 'settings-desktop');
  }, [desktopEnvironment?.isElectron, settingsQuickLinks, visibleSectionIds]);
  const visibleQuickLinks = useMemo<readonly SettingsQuickLink[]>(() => {
    if (!visibleSectionIds) return shellQuickLinks;
    return shellQuickLinks
      .map((item) => {
        const matchingChildren = item.children?.filter((child) => visibleSectionIds.has(child.id)) ?? [];
        if (visibleSectionIds.has(item.id)) return item;
        if (matchingChildren.length > 0) return { ...item, children: matchingChildren };
        return null;
      })
      .filter((item): item is SettingsQuickLink => item !== null);
  }, [shellQuickLinks, visibleSectionIds]);
  const visibleRootSectionIds = useMemo<ReadonlySet<SettingsQuickLinkId> | null>(() => {
    if (!visibleSectionIds) return null;
    return new Set(visibleQuickLinks.map((item) => item.id));
  }, [visibleQuickLinks, visibleSectionIds]);

  useEffect(() => {
    let cancelled = false;

    readDesktopEnvironment()
      .then((environment) => {
        if (!cancelled) {
          setDesktopEnvironment(environment);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDesktopEnvironment(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    settingsNavLinks: sectionIds ? visibleQuickLinks : shellQuickLinks,
    visibleSectionIds: visibleRootSectionIds,
  };
}

function formatStartOnSystemStartSummary(state: DesktopAppPreferencesState | null): string | undefined {
  if (!state || !state.available) {
    return 'Desktop app settings are unavailable in this window.';
  }

  if (!state.supportsStartOnSystemStart) {
    return 'Start on system start is only available in packaged desktop builds.';
  }

  return undefined;
}

export function DesktopKeyboardShortcutsSettingsSection() {
  const [preferencesState, setPreferencesState] = useState<DesktopAppPreferencesState | null>(null);
  const [draft, setDraft] = useState<DesktopAppPreferencesState['keyboardShortcuts']>(DEFAULT_DESKTOP_KEYBOARD_SHORTCUT_DRAFT);
  const [extensionKeybindings, setExtensionKeybindings] = useState<ExtensionKeybindingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (error)
      window.dispatchEvent(
        new CustomEvent('neon-pilot-notification', { detail: { type: 'error', message: error, source: 'system-settings' } }),
      );
  }, [error]);

  const dirty = useMemo(() => {
    if (!preferencesState) return false;
    return DESKTOP_KEYBOARD_SHORTCUT_IDS.some((id) => draft[id] !== preferencesState.keyboardShortcuts[id]);
  }, [draft, preferencesState]);

  const shortcutItems = useMemo<ShortcutListItem[]>(() => {
    return buildDesktopShortcutItems(draft, extensionKeybindings);
  }, [draft, extensionKeybindings]);

  const duplicateShortcut = useMemo(() => {
    return findDuplicateShortcut(shortcutItems);
  }, [shortcutItems]);

  const loadPreferences = useCallback(async () => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setLoading(false);
      setError('Desktop bridge unavailable. Restart the desktop app and try again.');
      return;
    }

    try {
      const state = await bridge.readDesktopAppPreferences();
      setPreferencesState(state);
      setDraft(state.keyboardShortcuts);
      setError(null);

      try {
        setExtensionKeybindings(await api.extensionKeybindings());
      } catch {
        setExtensionKeybindings([]);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  async function saveExtensionKeybinding(item: ShortcutListItem, input: { keys?: string[]; enabled?: boolean; reset?: boolean }) {
    if (!item.extensionId || !item.keybindingId) return;
    if (input.keys && input.enabled !== false) {
      const conflict = findShortcutConflictForItem(shortcutItems, item.id, input.keys);
      if (conflict) {
        setError(formatDuplicateShortcutError(conflict.shortcut, conflict.title));
        return;
      }
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.updateExtensionKeybinding(item.extensionId, item.keybindingId, input);
      setExtensionKeybindings(await api.extensionKeybindings());
      setNotice('Saved extension shortcut.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function saveKeyboardShortcuts(nextShortcuts = draft, changedId?: DesktopKeyboardShortcutId) {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setError('Desktop bridge unavailable. Restart the desktop app and try again.');
      return;
    }

    // Pre-save duplicate check: reject before calling the API so a conflict
    // isn't persisted before the next render can surface the warning.
    let keybindingsForValidation = extensionKeybindings;
    try {
      keybindingsForValidation = await api.extensionKeybindings();
      setExtensionKeybindings(keybindingsForValidation);
    } catch {
      /* Use the loaded keybindings if the refresh fails. */
    }
    const nextShortcutItems = buildDesktopShortcutItems(nextShortcuts, keybindingsForValidation);
    const conflict = changedId
      ? findShortcutConflictForItem(nextShortcutItems, changedId, [nextShortcuts[changedId]])
      : findDuplicateShortcut(nextShortcutItems);
    if (conflict) {
      setError(
        'title' in conflict
          ? formatDuplicateShortcutError(conflict.shortcut, conflict.title)
          : formatDuplicateShortcutError(conflict.shortcut, conflict.first.label),
      );
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const state = await bridge.updateDesktopAppPreferences({ keyboardShortcuts: nextShortcuts });
      setPreferencesState(state);
      setDraft(state.keyboardShortcuts);
      setNotice('Saved. The app menu updated immediately.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsGroup title="Keyboard shortcuts">
      {loading ? <p className="ui-card-meta">Loading keyboard shortcuts...</p> : null}
      {!loading && !preferencesState ? <p className="ui-card-meta">Keyboard shortcuts are available in the desktop app.</p> : null}
      {preferencesState ? (
        <div className="space-y-4">
          <div className="settings-page-row-list">
            {shortcutItems.map((item) => {
              const editableId = item.extensionId ? null : item.editable ? (item.id as DesktopKeyboardShortcutId) : null;
              const shortcutValue = item.extensionId
                ? (item.shortcuts[0] ?? item.defaultShortcuts?.[0] ?? '')
                : editableId
                  ? draft[editableId]
                  : '';
              return (
                <SettingsControlRow
                  key={item.id}
                  title={item.label}
                  description={
                    <>
                      {item.owner}
                      {item.description ? ` · ${item.description}` : ''}
                    </>
                  }
                  actionsClassName="settings-page-shortcut-actions"
                >
                  {editableId || item.extensionId ? (
                    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                      <KeyboardShortcutCaptureInput
                        id={`settings-keyboard-${item.id}`}
                        value={item.enabled === false ? 'Disabled' : shortcutValue}
                        reservedHint="Some shortcuts (Cmd+Q, Cmd+W, Cmd+N) are reserved by the app and cannot be captured here. Use the desktop app menu to change them."
                        onChange={(shortcut) => {
                          if (editableId) {
                            const nextDraft = { ...draft, [editableId]: shortcut };
                            setDraft(nextDraft);
                            setError(null);
                            setNotice(null);
                            void saveKeyboardShortcuts(nextDraft, editableId);
                            return;
                          }
                          void saveExtensionKeybinding(item, { keys: [shortcut], enabled: true });
                        }}
                        disabled={saving || item.enabled === false}
                      />
                      {item.extensionId ? (
                        <>
                          <ToolbarButton
                            type="button"
                            disabled={saving}
                            onClick={() => void saveExtensionKeybinding(item, { enabled: item.enabled === false })}
                          >
                            {item.enabled === false ? 'Enable' : 'Disable'}
                          </ToolbarButton>
                          <ToolbarButton
                            type="button"
                            disabled={saving}
                            onClick={() => void saveExtensionKeybinding(item, { reset: true })}
                          >
                            Reset
                          </ToolbarButton>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </SettingsControlRow>
              );
            })}
          </div>

          {duplicateShortcut ? (
            <p className="text-[12px] text-danger">
              {formatKeyboardShortcutLabel(duplicateShortcut.shortcut)} is assigned to both {duplicateShortcut.first.label} and{' '}
              {duplicateShortcut.second.label}.
            </p>
          ) : null}
          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          {notice ? <p className="text-[12px] text-success">{notice}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-card-meta">{saving ? 'Saving...' : dirty ? 'Unsaved change pending...' : 'Auto-saved'}</span>
            <ToolbarButton
              type="button"
              onClick={() => {
                setDraft(DEFAULT_DESKTOP_KEYBOARD_SHORTCUT_DRAFT);
                void saveKeyboardShortcuts(DEFAULT_DESKTOP_KEYBOARD_SHORTCUT_DRAFT);
              }}
              disabled={saving || duplicateShortcut !== null}
            >
              Reset to defaults
            </ToolbarButton>
          </div>
        </div>
      ) : null}
    </SettingsGroup>
  );
}

export function CommandsSettingsSection() {
  const [commands, setCommands] = useState<CommandSettingsEntry[]>([]);
  const [keybindings, setKeybindings] = useState<CommandKeybindingSettingsEntry[]>([]);
  const [desktopShortcuts, setDesktopShortcuts] = useState<DesktopAppPreferencesState['keyboardShortcuts'] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadSequenceRef = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    try {
      const [nextCommands, nextKeybindings] = await Promise.all([api.extensionCommands(), api.extensionKeybindings()]);
      if (loadSequenceRef.current !== sequence) return;
      setCommands(nextCommands as CommandSettingsEntry[]);
      setKeybindings(nextKeybindings as CommandKeybindingSettingsEntry[]);
      const bridge = getDesktopBridge();
      if (bridge) {
        try {
          const state = await bridge.readDesktopAppPreferences();
          if (loadSequenceRef.current !== sequence) return;
          setDesktopShortcuts(state.keyboardShortcuts);
        } catch {
          if (loadSequenceRef.current !== sequence) return;
          setDesktopShortcuts(null);
        }
      } else {
        setDesktopShortcuts(null);
      }
    } catch (nextError) {
      if (loadSequenceRef.current !== sequence) return;
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      if (loadSequenceRef.current === sequence) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<CommandWithKeybindings[]>(() => {
    const hostCommands = listHostCommands().map(
      (command): CommandSettingsEntry => ({
        ...command,
        extensionId: 'host',
        packageType: 'system',
        action: command.id,
      }),
    );
    return [...hostCommands, ...commands].map((command) => {
      const matches = keybindings.filter((keybinding) => keybindingMatchesCommandSetting(keybinding, command));
      return { ...command, keybindings: matches.length ? matches : [emptyKeybindingForCommand(command, desktopShortcuts)] };
    });
  }, [commands, desktopShortcuts, keybindings]);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [
        row.title,
        commandDisplayId(row),
        row.extensionId,
        row.category,
        row.action,
        ...row.keybindings.flatMap((keybinding) => keybinding.keys),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, rows]);

  async function saveKeybinding(keybinding: CommandKeybindingSettingsEntry, shortcut: string) {
    const keys = shortcut
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    const id = keybindingSettingId(keybinding);
    if (!keys.length) {
      setError('Shortcut cannot be blank. Disable the keybinding instead.');
      setDrafts((current) => ({ ...current, [id]: keybinding.keys.join(', ') }));
      return;
    }
    const conflict = findCommandShortcutConflict(rows, keybinding, keys);
    if (conflict) {
      setError(`${formatKeyboardShortcutLabel(conflict.shortcut)} is already assigned to ${conflict.title}.`);
      setDrafts((current) => ({ ...current, [id]: keybinding.keys.join(', ') }));
      return;
    }
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await api.updateExtensionKeybinding(keybinding.extensionId, keybinding.surfaceId, {
        ...commandKeybindingMetadataPatch(keybinding),
        keys,
        enabled: true,
      });
      await load();
      setDrafts((current) => ({ ...current, [id]: keys.join(', ') }));
      setNotice('Saved shortcut.');
    } catch (nextError) {
      setDrafts((current) => ({ ...current, [id]: keybinding.keys.join(', ') }));
      setError(formatCommandShortcutError(nextError));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleKeybinding(keybinding: CommandKeybindingSettingsEntry) {
    const id = keybindingSettingId(keybinding);
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await api.updateExtensionKeybinding(keybinding.extensionId, keybinding.surfaceId, {
        ...commandKeybindingMetadataPatch(keybinding),
        enabled: !keybinding.enabled,
      });
      await load();
      setNotice(keybinding.enabled ? 'Disabled shortcut.' : 'Enabled shortcut.');
    } catch (nextError) {
      setError(formatCommandShortcutError(nextError));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands..." />
      {loading ? <p className="ui-card-meta">Loading commands...</p> : null}
      <SettingsGroup title="Command shortcuts" className="settings-page-commands-group">
        {visibleRows.map((command) => (
          <SettingsControlRow
            key={commandDisplayId(command)}
            title={command.title ?? commandDisplayId(command)}
            description={commandShortcutDescription(command)}
            actionsClassName="settings-page-command-actions"
          >
            <div className="space-y-2">
              {command.keybindings.map((keybinding) => {
                const id = keybindingSettingId(keybinding);
                const value = drafts[id] ?? keybinding.keys.join(', ');
                const busy = busyId === id;
                const editable = keybinding.extensionId !== 'host';
                return (
                  <div key={id} className="relative">
                    <KeyboardShortcutCaptureInput
                      id={`settings-command-keybinding-${id}`}
                      value={keybinding.enabled ? value : ''}
                      placeholder={
                        editable
                          ? keybinding.enabled
                            ? 'Click to record shortcut'
                            : 'Shortcut disabled'
                          : 'Configured in Desktop shortcuts'
                      }
                      disabled={busy || !editable}
                      reservedHint="Some shortcuts (Cmd+Q, Cmd+W, Cmd+N) are reserved by the app and cannot be captured here. Use the desktop app menu to change them."
                      onChange={(shortcut) => {
                        if (!editable) return;
                        setDrafts((current) => ({ ...current, [id]: shortcut }));
                        void saveKeybinding(keybinding, shortcut);
                      }}
                    />
                    {editable ? (
                      <IconButton
                        compact
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[15px]"
                        disabled={busy}
                        aria-label={
                          keybinding.enabled ? `Disable shortcut for ${keybinding.title}` : `Enable shortcut for ${keybinding.title}`
                        }
                        title={keybinding.enabled ? 'Disable shortcut' : 'Enable shortcut'}
                        onClick={() => void toggleKeybinding(keybinding)}
                      >
                        {keybinding.enabled ? '×' : '+'}
                      </IconButton>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SettingsControlRow>
        ))}
      </SettingsGroup>
      {!loading && visibleRows.length === 0 ? <p className="ui-card-meta">No commands match that search.</p> : null}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {notice ? <p className="text-[12px] text-success">{notice}</p> : null}
    </div>
  );
}

function commandDisplayId(command: CommandSettingsEntry): string {
  const id = command.id ?? command.surfaceId ?? 'unknown';
  if (command.extensionId === 'host') return id;
  return command.extensionId ? `${command.extensionId}.${id}` : id;
}

function keybindingSettingId(keybinding: Pick<CommandKeybindingSettingsEntry, 'extensionId' | 'surfaceId'>): string {
  return `${keybinding.extensionId}:${keybinding.surfaceId}`;
}

function commandShortcutDescription(command: CommandWithKeybindings): string {
  const category = command.category?.trim() || 'Command';
  if (command.extensionId === 'host') {
    return `${category} · Built-in`;
  }
  return `${category} · ${command.packageType === 'system' ? 'Built-in extension' : 'Extension'}`;
}

function commandKeybindingConflictScope(keybinding: Pick<CommandKeybindingSettingsEntry, 'extensionId' | 'scope'>): string {
  return keybinding.scope === 'surface' ? `surface:${keybinding.extensionId}` : 'global';
}

function formatCommandShortcutError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/unknown command/i.test(message)) {
    return 'Could not save shortcut because its command is no longer available. Reload extensions and try again.';
  }
  if (
    !message.trim() ||
    /Local API route did not complete/i.test(message) ||
    /\/api\//i.test(message) ||
    /file:\/\//i.test(message) ||
    /localApi\.js/i.test(message) ||
    /\bModule\./i.test(message) ||
    /\s+at\s+\S+/i.test(message)
  ) {
    return 'Could not save shortcut. Reload extensions and try again.';
  }
  return message;
}

function commandKeybindingMetadataPatch(
  keybinding: CommandKeybindingSettingsEntry,
): Partial<Pick<CommandKeybindingSettingsEntry, 'title' | 'command' | 'args' | 'when' | 'scope' | 'packageType'>> {
  if (!keybinding.surfaceId.startsWith('command:')) return {};
  return {
    title: keybinding.title,
    command: keybinding.command,
    args: keybinding.args,
    when: keybinding.when,
    scope: keybinding.scope,
    packageType: keybinding.packageType,
  };
}

function findCommandShortcutConflict(
  rows: CommandWithKeybindings[],
  target: CommandKeybindingSettingsEntry,
  shortcuts: string[],
): { shortcut: string; title: string } | null {
  const targetId = keybindingSettingId(target);
  const targetScope = commandKeybindingConflictScope(target);
  const requestedShortcuts = new Map(shortcuts.map((shortcut) => [normalizeShortcutForConflict(shortcut), shortcut]));
  for (const row of rows) {
    for (const existing of row.keybindings) {
      if (!existing.enabled || keybindingSettingId(existing) === targetId) continue;
      if (commandKeybindingConflictScope(existing) !== targetScope) continue;
      for (const existingShortcut of existing.keys) {
        const requestedShortcut = requestedShortcuts.get(normalizeShortcutForConflict(existingShortcut));
        if (requestedShortcut) return { shortcut: requestedShortcut, title: existing.title };
      }
    }
  }
  return null;
}

function keybindingMatchesCommandSetting(keybinding: CommandKeybindingSettingsEntry, command: CommandSettingsEntry): boolean {
  if (!command.extensionId || command.extensionId !== keybinding.extensionId) return false;
  const id = command.id ?? command.surfaceId ?? '';
  const action = command.action ?? '';
  const keybindingCommand = keybinding.command.replace(`${keybinding.extensionId}.`, '');
  if (keybindingCommand === id || keybinding.command === `${command.extensionId}.${id}`) return true;
  if (keybindingCommand !== action) return false;
  return settingsArgsMatch(keybinding.args, command.args);
}

function settingsArgsMatch(left: unknown, right: unknown): boolean {
  if (left === undefined && right === undefined) return true;
  if (left === undefined || right === undefined) return false;
  return stableSettingsArgsString(left) === stableSettingsArgsString(right);
}

function stableSettingsArgsString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSettingsArgsString).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSettingsArgsString(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function emptyKeybindingForCommand(
  command: CommandSettingsEntry,
  desktopShortcuts: DesktopAppPreferencesState['keyboardShortcuts'] | null = null,
): CommandKeybindingSettingsEntry {
  const commandId = commandDisplayId(command);
  const desktopShortcutId = desktopShortcutIdForHostCommand(command);
  const desktopShortcut = desktopShortcutId
    ? (desktopShortcuts?.[desktopShortcutId] ?? DEFAULT_DESKTOP_KEYBOARD_SHORTCUT_DRAFT[desktopShortcutId])
    : '';
  return {
    extensionId: command.extensionId ?? 'host',
    surfaceId: `command:${commandId}`,
    packageType: command.extensionId ? (command.packageType ?? 'user') : 'system',
    title: command.title ?? commandId,
    keys: desktopShortcut ? [desktopShortcut] : [],
    command: commandId,
    args: command.args,
    scope: 'global',
    defaultKeys: desktopShortcutId ? [DEFAULT_DESKTOP_KEYBOARD_SHORTCUT_DRAFT[desktopShortcutId]] : [],
    enabled: true,
  };
}

export function desktopShortcutIdForHostCommand(command: CommandSettingsEntry): DesktopKeyboardShortcutId | null {
  if (command.extensionId !== 'host') return null;
  const commandId = command.id ?? command.surfaceId ?? '';
  for (const registration of CORE_KEYBOARD_SHORTCUT_REGISTRATIONS) {
    if (registration.command === commandId && settingsArgsMatch(registration.args, command.args)) {
      return registration.id as DesktopKeyboardShortcutId;
    }
  }
  return null;
}

function formatTelemetryLogBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function TelemetryLogsSettingsPanel() {
  const { data, loading, error, refetch } = useApi<AppTelemetryLogDiagnostics>(api.telemetryLogs as never, 'telemetry-logs');
  const [action, setAction] = useState<'open' | 'export' | 'maintain' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openPath = useCallback(async (path: string) => {
    const bridge = getDesktopBridge();
    if (!bridge?.openPath) {
      setNotice(`Path: ${path}`);
      return;
    }

    const result = await bridge.openPath(path);
    if (result?.error) {
      setNotice(result.error);
      return;
    }
    setNotice(`Opened ${path}`);
  }, []);

  const openLogFolder = useCallback(async () => {
    if (!data?.logDir) return;
    setAction('open');
    setNotice(null);
    try {
      await openPath(data.logDir);
    } catch (nextError) {
      setNotice(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setAction(null);
    }
  }, [data?.logDir, openPath]);

  const exportLogs = useCallback(async () => {
    setAction('export');
    setNotice(null);
    try {
      const exported = (await api.exportTelemetryLogs()) as AppTelemetryLogBundleExport;
      await refetch({ resetLoading: false });
      await openPath(exported.path);
      setNotice(`Exported ${exported.eventCount} events from ${exported.fileCount} files to ${exported.path}.`);
    } catch (nextError) {
      setNotice(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setAction(null);
    }
  }, [openPath, refetch]);

  const maintainTelemetryDb = useCallback(async () => {
    setAction('maintain');
    setNotice(null);
    try {
      const result = (await api.maintainTelemetryDb()) as TelemetryDbMaintenanceResult;
      const traceDeleted = Object.values(result.trace.deletedRows).reduce((total, value) => total + value, 0);
      setNotice(
        `Pruned ${result.appTelemetry.deletedRows} app activity rows and ${traceDeleted} trace rows, then vacuumed ${result.appTelemetry.dbPath}.`,
      );
    } catch (nextError) {
      setNotice(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setAction(null);
    }
  }, []);

  return (
    <SettingsGroup
      title="Diagnostic logs"
      actions={
        <>
          <IconButton
            compact
            type="button"
            onClick={openLogFolder}
            disabled={!data?.logDir || action !== null}
            aria-label="Open diagnostic log folder"
            title={action === 'open' ? 'Opening...' : 'Open log folder'}
          >
            <SettingsIcon name="external" />
          </IconButton>
          <IconButton
            compact
            type="button"
            onClick={exportLogs}
            disabled={action !== null}
            aria-label="Export diagnostic bundle"
            title={action === 'export' ? 'Exporting...' : 'Export diagnostics bundle'}
          >
            <SettingsIcon name="external" />
          </IconButton>
          <IconButton
            compact
            type="button"
            onClick={maintainTelemetryDb}
            disabled={action !== null}
            aria-label="Clean up diagnostics index"
            title={action === 'maintain' ? 'Cleaning...' : 'Clean up diagnostics index'}
          >
            <SettingsIcon name="trash" />
          </IconButton>
        </>
      }
    >
      {loading ? <p className="ui-card-meta">Loading diagnostic log details...</p> : null}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {data ? (
        <>
          <SettingsControlRow title="Files" description={data.logDir}>
            <span className="text-[13px] text-primary">
              {data.fileCount} · {formatTelemetryLogBytes(data.sizeBytes)}
            </span>
          </SettingsControlRow>
          {data.files.length > 0 ? (
            <div className="settings-page-log-files">
              {data.files.slice(0, 3).map((file) => (
                <div key={file.path} className="flex items-center justify-between gap-3 text-[12px] text-secondary">
                  <span className="min-w-0 truncate font-mono text-primary" title={file.path}>
                    {file.name}
                  </span>
                  <span className="shrink-0 text-dim">{formatTelemetryLogBytes(file.sizeBytes)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="settings-page-panel-message ui-card-meta">No diagnostic log files yet.</p>
          )}
        </>
      ) : null}
      {notice ? <p className="ui-card-meta break-words">{notice}</p> : null}
    </SettingsGroup>
  );
}

function SettingsTableOfContents({
  items,
  activeId,
  onNavigate,
}: {
  items: readonly SettingsQuickLink[];
  activeId: SettingsQuickLinkId;
  onNavigate: (item: SettingsQuickLink) => void;
}) {
  const renderLink = (item: SettingsQuickLink, nested = false) => {
    const active = item.id === activeId;
    return (
      <SidebarRow
        key={item.id}
        title={item.label}
        selected={active}
        className={nested ? 'pl-5' : undefined}
        onClick={() => {
          onNavigate(item);
        }}
      />
    );
  };

  return (
    <nav aria-label="Settings sections" className="grid gap-1">
      {items.map((item) => (
        <div key={item.id} className="grid gap-1">
          {renderLink(item)}
          {item.children &&
          item.children.length > 0 &&
          (item.id === 'settings-extensions' || item.id === activeId || item.children.some((child) => child.id === activeId))
            ? item.children.map((child) => renderLink(child, true))
            : null}
        </div>
      ))}
    </nav>
  );
}

async function navigateSettingsSidebar(pa: ExtensionSurfaceProps['pa'], item: SettingsQuickLink) {
  const to = item.route ?? `/settings#${item.id}`;
  const handled = await pa.commands?.execute?.('app.navigate', { to });
  if (!handled && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neon-pilot-desktop-navigate', { detail: { route: to } }));
  }
}

export function SettingsSidebar({ pa, context }: ExtensionSurfaceProps) {
  const { settingsNavLinks } = useSettingsNavigation();
  const visibleTocLinks = useMemo(() => flattenSettingsQuickLinks(settingsNavLinks), [settingsNavLinks]);
  const initialActiveId = readSettingsSectionIdFromContext(context);
  const [activeQuickLinkId, setActiveQuickLinkId] = useState<SettingsQuickLinkId>(
    visibleTocLinks.some((item) => item.id === initialActiveId) ? initialActiveId : SETTINGS_QUICK_LINKS[0].id,
  );

  useEffect(() => {
    const contextSectionId = readSettingsSectionIdFromContext(context);
    if (visibleTocLinks.some((item) => item.id === contextSectionId)) {
      setActiveQuickLinkId(contextSectionId);
      return;
    }
    if (!visibleTocLinks.some((item) => item.id === activeQuickLinkId)) {
      setActiveQuickLinkId(visibleTocLinks[0]?.id ?? SETTINGS_QUICK_LINKS[0].id);
    }
  }, [activeQuickLinkId, context.hash, context.pathname, visibleTocLinks]);

  return (
    <SidebarSection title="Settings">
      <SettingsTableOfContents
        items={settingsNavLinks}
        activeId={activeQuickLinkId}
        onNavigate={(item) => {
          setActiveQuickLinkId(item.id);
          void navigateSettingsSidebar(pa, item);
        }}
      />
    </SidebarSection>
  );
}

function unwrapExtensionActionResult<T>(response: { ok: true; result: unknown } | { ok: false; error: string }): T {
  if (!response.ok) throw new Error(response.error);
  return response.result as T;
}

function NeonPilotCliSettingsPanel() {
  const [status, setStatus] = useState<CliInstallStatus | null>(null);
  const [action, setAction] = useState<'refresh' | 'install' | 'uninstall' | null>('refresh');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setAction('refresh');
    setError(null);
    try {
      const result = await api.invokeExtensionAction('system-settings', 'manageCli', { action: 'status' });
      setStatus(unwrapExtensionActionResult<CliInstallStatus>(result));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setAction(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runCliAction(nextAction: 'install' | 'uninstall') {
    setAction(nextAction);
    setError(null);
    try {
      const result = await api.invokeExtensionAction('system-settings', 'manageCli', { action: nextAction });
      setStatus(unwrapExtensionActionResult<CliInstallStatus>(result));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setAction(null);
    }
  }

  return (
    <SettingsGroup
      title="Command line"
      actions={
        <>
          <IconButton
            compact
            type="button"
            onClick={() => void refresh()}
            disabled={action !== null}
            aria-label="Refresh CLI status"
            title={action === 'refresh' ? 'Refreshing...' : 'Refresh'}
          >
            <SettingsIcon name="refresh" />
          </IconButton>
          {status?.globallyInstalled ? (
            <IconButton
              compact
              type="button"
              onClick={() => void runCliAction('uninstall')}
              disabled={action !== null}
              aria-label="Uninstall Neon Pilot CLI"
              title={action === 'uninstall' ? 'Removing...' : 'Uninstall'}
            >
              <SettingsIcon name="trash" />
            </IconButton>
          ) : status && !status.linkConflict ? (
            <IconButton
              compact
              type="button"
              className="text-accent"
              onClick={() => void runCliAction('install')}
              disabled={action !== null}
              aria-label="Install Neon Pilot CLI"
              title={action === 'install' ? 'Installing...' : 'Install'}
            >
              <SettingsIcon name="plus" />
            </IconButton>
          ) : null}
        </>
      }
    >
      {status ? (
        <>
          <SettingsControlRow
            title={status.globallyInstalled ? 'Installed' : status.linkConflict ? 'Used by another install' : 'Not installed'}
            description={<code className="break-all">{status.target}</code>}
          >
            <code className="break-all text-[12px] text-secondary">{status.linkPath}</code>
          </SettingsControlRow>
          {status.linkConflict ? (
            <div className="space-y-1 text-[12px] text-secondary">
              <p>
                The shell command is already linked to another Neon Pilot install. Remove that link or uninstall the other profile before
                installing this one.
              </p>
              {status.linkTarget ? (
                <p>
                  Current target: <code className="break-all">{status.linkTarget}</code>
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="ui-card-meta">Loading CLI status...</p>
      )}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
    </SettingsGroup>
  );
}

export function DesktopConnectionsSettingsPanel() {
  const [appPreferencesState, setAppPreferencesState] = useState<DesktopAppPreferencesState | null>(null);
  const [action, setAction] = useState<'save-app-preferences' | null>(null);
  const [appPreferencesError, setAppPreferencesError] = useState<string | null>(null);

  useEffect(() => {
    if (appPreferencesError)
      window.dispatchEvent(
        new CustomEvent('neon-pilot-notification', { detail: { type: 'error', message: appPreferencesError, source: 'system-settings' } }),
      );
  }, [appPreferencesError]);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setAppPreferencesState(null);
      return;
    }

    let cancelled = false;
    bridge
      .readDesktopAppPreferences()
      .then((state) => {
        if (!cancelled) {
          setAppPreferencesState(state as DesktopAppPreferencesState);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setAppPreferencesError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshDesktopAppPreferences = async () => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      return;
    }

    const state = await bridge.readDesktopAppPreferences();
    setAppPreferencesState(state as DesktopAppPreferencesState);
  };

  async function handleUpdateAppPreferences(nextPreferences: {
    autoInstallUpdates?: boolean;
    updatePath?: 'stable' | 'test';
    startOnSystemStart?: boolean;
    keyboardShortcuts?: Record<string, string>;
  }) {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setAppPreferencesError('Desktop bridge unavailable. Restart the desktop app and try again.');
      return;
    }

    setAction('save-app-preferences');
    setAppPreferencesError(null);
    try {
      await bridge.updateDesktopAppPreferences(nextPreferences);
      await refreshDesktopAppPreferences();
    } catch (nextError) {
      setAppPreferencesError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="settings-page-section-stack">
      <SettingsGroup title="App behavior">
        {!getDesktopBridge() && isDesktopShell() ? (
          <p className="text-[12px] text-danger">Desktop bridge unavailable. Restart the desktop app and try again.</p>
        ) : null}
        {appPreferencesState ? (
          <>
            <SettingsControlRow
              title="Install updates automatically"
              description={formatDesktopUpdateSummary(appPreferencesState)}
              disabled={action !== null || !appPreferencesState.update.supported}
            >
              <Switch
                checked={appPreferencesState.autoInstallUpdates}
                disabled={action !== null || !appPreferencesState.update.supported}
                aria-label="Install updates automatically"
                onClick={() => {
                  void handleUpdateAppPreferences({ autoInstallUpdates: !appPreferencesState.autoInstallUpdates });
                }}
              />
            </SettingsControlRow>

            <SettingsControlRow title="Update channel">
              <Select
                id="desktop-update-path"
                value={appPreferencesState.updatePath}
                onChange={(event) => {
                  void handleUpdateAppPreferences({ updatePath: event.target.value === 'test' ? 'test' : 'stable' });
                }}
                disabled={action !== null || !appPreferencesState.update.supported}
                className="max-w-sm"
              >
                <option value="stable">Stable releases only</option>
                <option value="test">Test releases and RCs</option>
              </Select>
            </SettingsControlRow>

            <SettingsControlRow
              title="Launch Neon Pilot when you sign in"
              description={formatStartOnSystemStartSummary(appPreferencesState)}
              disabled={action !== null || !appPreferencesState.supportsStartOnSystemStart}
            >
              <Switch
                checked={appPreferencesState.startOnSystemStart}
                disabled={action !== null || !appPreferencesState.supportsStartOnSystemStart}
                aria-label="Launch Neon Pilot when you sign in"
                onClick={() => {
                  void handleUpdateAppPreferences({ startOnSystemStart: !appPreferencesState.startOnSystemStart });
                }}
              />
            </SettingsControlRow>
          </>
        ) : (
          <p className="ui-card-meta">Loading desktop app settings...</p>
        )}
        {appPreferencesError ? <p className="text-[12px] text-danger">{appPreferencesError}</p> : null}
      </SettingsGroup>
      <NeonPilotCliSettingsPanel />
    </div>
  );
}

function ExtensionSettingsSection({
  includeExtensionIds,
  excludeExtensionIds,
  includeGroups,
  separated = true,
  groupByExtension = false,
  extensionLabels,
}: {
  includeExtensionIds?: readonly string[];
  excludeExtensionIds?: readonly string[];
  includeGroups?: readonly string[];
  separated?: boolean;
  groupByExtension?: boolean;
  extensionLabels?: ReadonlyMap<string, string>;
} = {}) {
  const { data: values, loading, error } = useApi<Record<string, unknown>>(api.settings as never);
  const { data: schema, loading: schemaLoading, error: schemaError } = useApi<UnifiedSettingsEntry[]>(api.settingsSchema as never);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const valuesRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (saveError)
      window.dispatchEvent(
        new CustomEvent('neon-pilot-notification', { detail: { type: 'error', message: saveError, source: 'system-settings' } }),
      );
  }, [saveError]);

  const editedKeys = useRef(new Set<string>());
  const saveSequenceByKey = useRef(new Map<string, number>());

  // Track explicit user edits so the values-refetch merge below preserves
  // only keys the user has touched, not every key that happens to differ.
  const markEdited = useCallback((key: string) => {
    editedKeys.current.add(key);
  }, []);

  useEffect(() => {
    if (values) {
      valuesRef.current = values;
      setDraft((prev) => {
        // Start from the fresh backend snapshot, then overlay only the keys
        // the user explicitly edited since the last save.
        const merged = { ...values };
        for (const key of editedKeys.current) {
          if (key in prev) merged[key] = prev[key];
        }
        return merged;
      });
    }
  }, [values]);

  const autosaveSetting = useCallback(
    async (key: string, val: unknown) => {
      markEdited(key);
      setDraft((prev) => ({ ...prev, [key]: val }));
      const sequence = (saveSequenceByKey.current.get(key) ?? 0) + 1;
      saveSequenceByKey.current.set(key, sequence);
      setSaveError(null);
      try {
        await api.updateSettings({ [key]: val });
        if (saveSequenceByKey.current.get(key) !== sequence) {
          return;
        }
        editedKeys.current.delete(key);
        window.dispatchEvent(new CustomEvent(EXTENSION_REGISTRY_CHANGED_EVENT));
      } catch {
        if (saveSequenceByKey.current.get(key) === sequence) {
          editedKeys.current.delete(key);
          setDraft((prev) => ({ ...prev, [key]: valuesRef.current?.[key] }));
          setSaveError('Could not save this setting. Your change was not saved.');
        }
      }
    },
    [markEdited],
  );

  const filteredEntries = useMemo(() => {
    if (!schema) return [];
    const includedExtensionIds = includeExtensionIds ? new Set(includeExtensionIds) : null;
    const excludedExtensionIds = excludeExtensionIds ? new Set(excludeExtensionIds) : null;
    const includedGroups = includeGroups ? new Set(includeGroups) : null;
    const entries: UnifiedSettingsEntry[] = [];
    for (const entry of schema) {
      if (entry.key === 'secrets.provider') continue;
      const group = entry.group || 'General';
      if (includedExtensionIds && !includedExtensionIds.has(entry.extensionId)) continue;
      if (excludedExtensionIds?.has(entry.extensionId)) continue;
      if (includedGroups && !includedGroups.has(group)) continue;
      entries.push(entry);
    }
    entries.sort(
      (a, b) =>
        a.extensionId.localeCompare(b.extensionId) || (a.group || 'General').localeCompare(b.group || 'General') || a.order - b.order,
    );
    return entries;
  }, [excludeExtensionIds, includeExtensionIds, includeGroups, schema]);

  const grouped = useMemo(() => {
    const groups = new Map<string, UnifiedSettingsEntry[]>();
    for (const entry of filteredEntries) {
      const group = entry.group || 'General';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(entry);
    }
    for (const [, entries] of groups) entries.sort((a, b) => a.order - b.order);
    return groups;
  }, [filteredEntries]);

  const entriesByExtension = useMemo(() => {
    const groups = new Map<string, UnifiedSettingsEntry[]>();
    for (const entry of filteredEntries) {
      if (!groups.has(entry.extensionId)) groups.set(entry.extensionId, []);
      groups.get(entry.extensionId)!.push(entry);
    }
    return [...groups.entries()].sort(([leftId], [rightId]) => {
      const leftLabel = extensionLabels?.get(leftId) ?? formatExtensionFallbackLabel(leftId);
      const rightLabel = extensionLabels?.get(rightId) ?? formatExtensionFallbackLabel(rightId);
      return leftLabel.localeCompare(rightLabel);
    });
  }, [extensionLabels, filteredEntries]);

  if (loading || schemaLoading) return null;
  if (error || schemaError) return null;
  if (filteredEntries.length === 0) return null;

  if (groupByExtension) {
    return (
      <div className={separated ? 'space-y-3 pt-4' : 'space-y-3'}>
        {entriesByExtension.map(([extensionId, entries]) => {
          const entriesByGroup = new Map<string, UnifiedSettingsEntry[]>();
          for (const entry of entries) {
            const group = entry.group || 'General';
            if (!entriesByGroup.has(group)) entriesByGroup.set(group, []);
            entriesByGroup.get(group)!.push(entry);
          }
          const groupedEntries = [...entriesByGroup.entries()];
          const extensionLabel = extensionLabels?.get(extensionId) ?? formatExtensionFallbackLabel(extensionId);
          return (
            <SettingsGroup
              key={extensionId}
              title={extensionLabel}
              id={settingsExtensionAnchorId(extensionId)}
              className={cx(SETTINGS_PANEL_DENSE_CLASS, 'settings-page-extension-settings-group')}
            >
              {groupedEntries.map(([group, groupEntries]) => (
                <div key={group} className="contents">
                  {groupedEntries.length > 1 ? <div className="settings-page-extension-group-label">{group}</div> : null}
                  {groupEntries.map((entry) => (
                    <SettingsField
                      key={entry.key}
                      entry={{ ...entry, enumLabels: SETTINGS_SELECT_LABELS[entry.key] }}
                      value={draft[entry.key]}
                      label={SETTINGS_ENTRY_LABELS[entry.key] ?? formatSettingsEntryFallbackLabel(entry.key)}
                      description={entry.description ?? extensionLabel}
                      showDescription
                      onChange={(key, val) => void autosaveSetting(key, val)}
                    />
                  ))}
                </div>
              ))}
            </SettingsGroup>
          );
        })}
        {saveError ? <p className="settings-page-panel-message text-[12px] text-danger">{saveError}</p> : null}
      </div>
    );
  }

  return (
    <div className={separated ? 'space-y-3 pt-4' : 'space-y-3'}>
      {[...grouped.entries()].map(([group, entries]) => (
        <SettingsGroup key={group} title={group} className={SETTINGS_PANEL_DENSE_CLASS}>
          {entries.map((entry) => (
            <SettingsField
              key={entry.key}
              entry={{ ...entry, enumLabels: SETTINGS_SELECT_LABELS[entry.key] }}
              value={draft[entry.key]}
              label={SETTINGS_ENTRY_LABELS[entry.key] ?? formatSettingsEntryFallbackLabel(entry.key)}
              showDescription={false}
              onChange={(key, val) => void autosaveSetting(key, val)}
            />
          ))}
          {saveError ? <p className="text-[12px] text-danger">{saveError}</p> : null}
        </SettingsGroup>
      ))}
    </div>
  );
}

function ExtensionSettingsIndex({ items }: { items: readonly SettingsQuickLink[] }) {
  const extensionItems = items.find((item) => item.id === 'settings-extensions')?.children ?? [];
  if (extensionItems.length === 0) {
    return <p className="settings-page-panel-message ui-card-meta">No installed extensions expose settings.</p>;
  }

  return (
    <SettingsGroup title="Extension settings" className={SETTINGS_PANEL_DENSE_CLASS}>
      {extensionItems.map((item) => (
        <SettingsControlRow
          key={item.id}
          title={
            <a className="settings-page-extension-index-link" href={item.route ?? `/settings#${item.id}`}>
              {item.label}
            </a>
          }
          description={item.extensionId}
          className="settings-page-extension-index-row"
          actionsClassName="settings-page-extension-index-actions"
        >
          <span className="settings-page-extension-index-chevron" aria-hidden="true">
            ›
          </span>
        </SettingsControlRow>
      ))}
    </SettingsGroup>
  );
}

function ExtensionSettingsComponentPanels({
  registrations,
  includeExtensionIds,
  shellPresentation = 'stable',
}: {
  registrations: ReturnType<typeof useExtensionRegistry>['settingsComponents'];
  includeExtensionIds?: readonly string[];
  shellPresentation?: 'stable' | 'windowed';
}) {
  const includedExtensionIds = includeExtensionIds ? new Set(includeExtensionIds) : null;
  const visibleRegistrations = includedExtensionIds
    ? registrations.filter((registration) => includedExtensionIds.has(registration.extensionId))
    : registrations;
  if (visibleRegistrations.length === 0) return null;
  return (
    <div className="space-y-3 pt-4">
      {visibleRegistrations.map((registration) => (
        <SettingsGroup
          key={`${registration.extensionId}:${registration.id}`}
          id={settingsExtensionAnchorId(registration.extensionId)}
          title={registration.label}
          description={registration.description}
          className={cx(SETTINGS_PANEL_DENSE_CLASS, 'settings-page-extension-components-group')}
        >
          <div className="settings-page-extension-component-body">
            <SettingsPanelHost registration={registration} shellPresentation={shellPresentation} />
          </div>
        </SettingsGroup>
      ))}
    </div>
  );
}

function SecretSourceLabel({ source }: { source: SecretStatusEntry['source'] }) {
  if (!source) return <span>Not configured</span>;
  if (source === 'env') return <span>Environment variable</span>;
  if (source === 'keychain') return <span>macOS Keychain</span>;
  if (source === 'env-only') return <span>Environment only</span>;
  return <span>Local secrets file</span>;
}

function ExtensionSecretsSection() {
  const { data: secretsState, loading, error, replaceData } = useApi<SecretsState>(api.secrets as never);
  const { data: settingsValues } = useApi<Record<string, unknown>>(api.settings as never);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingBackend, setSavingBackend] = useState(false);
  const [selectedBackend, setSelectedBackend] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (error)
      window.dispatchEvent(
        new CustomEvent('neon-pilot-notification', {
          detail: { type: 'error', message: `Failed to load secrets: ${error}`, source: 'system-settings' },
        }),
      );
  }, [error]);

  useEffect(() => {
    if (errorMessage)
      window.dispatchEvent(
        new CustomEvent('neon-pilot-notification', { detail: { type: 'error', message: errorMessage, source: 'system-settings' } }),
      );
  }, [errorMessage]);

  // Use local selectedBackend when the user has changed it so the select
  // doesn't snap back to the stale settings value before refetch.
  const activeBackend =
    selectedBackend ??
    (typeof settingsValues?.['secrets.provider'] === 'string'
      ? settingsValues['secrets.provider']
      : secretsState?.backend === 'env-only' || secretsState?.backend === 'file' || secretsState?.backend === 'keychain'
        ? secretsState.backend
        : 'keychain');

  const grouped = useMemo(() => {
    const groups = new Map<string, SecretStatusEntry[]>();
    for (const secret of secretsState?.secrets ?? []) {
      if (!groups.has(secret.extensionId)) groups.set(secret.extensionId, []);
      groups.get(secret.extensionId)!.push(secret);
    }
    return groups;
  }, [secretsState]);

  const saveSecret = async (secret: SecretStatusEntry) => {
    const value = drafts[secret.key]?.trim() ?? '';
    if (!value) {
      return;
    }
    setSavingKey(secret.key);
    setErrorMessage(null);
    setNotice(null);
    try {
      const next = await api.setSecret(secret.extensionId, secret.secretId, value);
      replaceData(next);
      setDrafts((current) => ({ ...current, [secret.key]: '' }));
      setNotice(`Saved ${secret.label}.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingKey(null);
    }
  };

  const saveBackend = async (provider: string) => {
    if (provider === 'env-only' && activeBackend !== 'env-only') {
      const confirmed = window.confirm(
        'Env-only storage cannot receive migrated secrets. Continue only if environment variables provide them.',
      );
      if (!confirmed) {
        setSelectedBackend(activeBackend);
        return;
      }
    }
    setSavingBackend(true);
    setErrorMessage(null);
    setNotice(null);
    try {
      await api.updateSettings({ 'secrets.provider': provider });
      setSelectedBackend(provider);
      setNotice('Secret storage location saved. Stored secrets were migrated when the selected location supports saving.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingBackend(false);
    }
  };

  const removeSecret = async (secret: SecretStatusEntry) => {
    setSavingKey(secret.key);
    setErrorMessage(null);
    setNotice(null);
    try {
      const next = await api.deleteSecret(secret.extensionId, secret.secretId);
      replaceData(next);
      setNotice(`Removed ${secret.label}.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingKey(null);
    }
  };

  if (loading && !secretsState) return <p className="ui-card-meta">Loading secrets...</p>;
  if (error && !secretsState) return <p className="text-[12px] text-danger">Failed to load secrets: {error}</p>;

  return (
    <div className="settings-page-section-stack">
      <SettingsGroup title="Secrets">
        <SettingsControlRow
          title="Where secrets are stored"
          description={
            activeBackend === 'keychain'
              ? 'Saved in macOS Keychain.'
              : activeBackend === 'env-only'
                ? 'Read from environment variables only; Neon Pilot cannot save new secrets.'
                : 'Saved in a local secrets file.'
          }
        >
          <Select
            id="settings-secret-backend"
            value={activeBackend}
            onChange={(event) => {
              void saveBackend(event.target.value);
            }}
            disabled={savingBackend}
          >
            <option value="keychain">macOS Keychain</option>
            <option value="file">Local file</option>
            <option value="env-only">Environment only</option>
          </Select>
        </SettingsControlRow>
      </SettingsGroup>

      {grouped.size === 0 ? (
        <SettingsGroup title="Extension secrets">
          <p className="settings-page-panel-message ui-card-meta">No installed extensions declare secrets.</p>
        </SettingsGroup>
      ) : (
        [...grouped.entries()].map(([extensionId, secrets]) => (
          <SettingsGroup key={extensionId} title={extensionId}>
            <>
              {secrets.map((secret) => (
                <SettingsControlRow
                  key={secret.key}
                  title={secret.label}
                  description={
                    <>
                      <SecretSourceLabel source={secret.source} />
                      {secret.env ? ` · Advanced name: ${secret.env}` : ''}
                    </>
                  }
                  actionsClassName="settings-page-secret-actions"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <TextInput
                      type="password"
                      value={drafts[secret.key] ?? ''}
                      placeholder={secret.configured ? 'Enter a new value to replace the stored secret' : 'Enter secret value'}
                      onChange={(event) => {
                        setDrafts((current) => ({ ...current, [secret.key]: event.target.value }));
                        setErrorMessage(null);
                        setNotice(null);
                      }}
                      onBlur={() => {
                        void saveSecret(secret);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                      className="min-w-0 flex-1 font-mono text-[13px]"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={!secret.writable || savingKey === secret.key}
                    />
                    {savingKey === secret.key ? <span className="ui-card-meta">Saving...</span> : null}
                    <ToolbarButton
                      type="button"
                      className="text-danger hover:text-danger"
                      disabled={!secret.writable || savingKey === secret.key || !secret.configured || secret.source === 'env'}
                      onClick={() => {
                        void removeSecret(secret);
                      }}
                    >
                      <span aria-hidden="true">-</span>
                      Remove
                    </ToolbarButton>
                  </div>
                  {!secret.writable ? (
                    <p className="ui-card-meta">The selected storage location is read-only. Set the environment variable instead.</p>
                  ) : null}
                </SettingsControlRow>
              ))}
            </>
          </SettingsGroup>
        ))
      )}

      {notice ? <p className="text-[12px] text-accent">{notice}</p> : null}
      {errorMessage ? <p className="text-[12px] text-danger">{errorMessage}</p> : null}
    </div>
  );
}

export function SettingsPage({
  sectionIds,
  context,
}: { sectionIds?: SettingsQuickLinkId[]; context?: ExtensionSurfaceProps['context'] } = {}) {
  const location = useLocation();
  const extensionRegistry = useExtensionRegistry();
  const {
    theme,
    themePreference,
    lightTheme,
    darkTheme,
    availableThemes,
    accent = 'cobalt',
    availableAccents = [],
    setThemePreference,
    setLightTheme,
    setDarkTheme,
    setAccent = () => {},
  } = useTheme();
  const {
    data: modelState,
    loading: modelsLoading,
    refreshing: modelsRefreshing,
    error: modelsError,
    refetch: refetchModels,
  } = useApi(api.models);
  const {
    data: modelProviderState,
    loading: modelProviderLoading,
    error: modelProviderError,
    replaceData: replaceModelProviderState,
  } = useApi(api.modelProviders);
  const {
    data: defaultCwdState,
    loading: defaultCwdLoading,
    error: defaultCwdLoadError,
    refetch: refetchDefaultCwd,
  } = useApi(api.defaultCwd);
  const {
    data: providerAuthState,
    loading: providerAuthLoading,
    error: providerAuthError,
    refetch: refetchProviderAuth,
  } = useApi(api.providerAuth);
  const [savingPreference, setSavingPreference] = useState<'model' | 'visionModel' | 'thinking' | 'serviceTier' | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [defaultCwdDraft, setDefaultCwdDraft] = useState('');
  const [savingDefaultCwd, setSavingDefaultCwd] = useState(false);
  const [defaultCwdSaveError, setDefaultCwdSaveError] = useState<string | null>(null);
  const [pathPickerTarget, setPathPickerTarget] = useState<'default-cwd' | null>(null);
  const [selectedModelProviderId, setSelectedModelProviderId] = useState('');
  const [providerEditorMode, setProviderEditorMode] = useState<'provider' | 'custom'>('custom');
  const [modelProviderPickerId, setModelProviderPickerId] = useState('');
  const [showAdvancedProviderFields, setShowAdvancedProviderFields] = useState(false);
  const [showProviderModelManagement, setShowProviderModelManagement] = useState(false);
  const [modelProviderDraft, setModelProviderDraft] = useState<ProviderEditorDraft>(() => createProviderEditorDraft(null));
  const [advancedProviderJson, setAdvancedProviderJson] = useState(() => formatProviderAdvancedJson(createProviderEditorDraft(null)));
  const [modelProviderAction, setModelProviderAction] = useState<'save' | 'delete' | null>(null);
  const [modelProviderMessage, setModelProviderMessage] = useState<string | null>(null);
  const [modelProviderEditorError, setModelProviderEditorError] = useState<string | null>(null);
  const [modelRefreshAction, setModelRefreshAction] = useState(false);
  const [modelRefreshMessage, setModelRefreshMessage] = useState<string | null>(null);
  const [modelRefreshError, setModelRefreshError] = useState<string | null>(null);
  const [providerTestAction, setProviderTestAction] = useState(false);
  const [providerTestResult, setProviderTestResult] = useState<ProviderConnectionTestResult | null>(null);
  const [providerTestError, setProviderTestError] = useState<string | null>(null);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelDraft, setModelDraft] = useState<ModelEditorDraft>(() => createModelEditorDraft(null));
  const [modelDraftAction, setModelDraftAction] = useState<'save' | 'delete' | null>(null);
  const [modelDraftMessage, setModelDraftMessage] = useState<string | null>(null);
  const [modelDraftError, setModelDraftError] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerCredentialAction, setProviderCredentialAction] = useState<'saveKey' | 'remove' | null>(null);
  const [providerCredentialError, setProviderCredentialError] = useState<string | null>(null);
  const [providerCredentialNotice, setProviderCredentialNotice] = useState<string | null>(null);
  const [oauthLoginState, setOauthLoginState] = useState<ProviderOAuthLoginState | null>(null);
  const [oauthAction, setOauthAction] = useState<'start' | 'submit' | 'cancel' | null>(null);
  const [oauthInputValue, setOauthInputValue] = useState('');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const oauthTerminalStateKeyRef = useRef<string | null>(null);
  const openedOAuthAuthUrlRef = useRef<string | null>(null);
  const [desktopEnvironment, setDesktopEnvironment] = useState<DesktopEnvironmentState | null>(null);
  const settingsScrollRef = useRef<HTMLDivElement | null>(null);

  const { settingsNavLinks, visibleSectionIds } = useSettingsNavigation(sectionIds);
  const isWindowedSettingsSurface = context?.shellPresentation === 'windowed';
  const initialQuickLinkId = settingsNavLinks[0]?.id ?? SETTINGS_QUICK_LINKS[0].id;
  const visibleTocLinks = useMemo(() => flattenSettingsQuickLinks(settingsNavLinks), [settingsNavLinks]);
  const routeQuickLinkId = readSettingsSectionIdFromContext(context, { pathname: location.pathname, hash: location.hash });
  const [activeQuickLinkId, setActiveQuickLinkId] = useState<SettingsQuickLinkId>(
    visibleTocLinks.some((item) => item.id === routeQuickLinkId) ? routeQuickLinkId : initialQuickLinkId,
  );
  const extensionLabels = useMemo(() => {
    return new Map(extensionRegistry.extensions.map((extension) => [extension.id, extension.name]));
  }, [extensionRegistry.extensions]);
  const effectiveActiveQuickLinkId = isWindowedSettingsSurface
    ? visibleTocLinks.some((item) => item.id === activeQuickLinkId)
      ? activeQuickLinkId
      : routeQuickLinkId
    : visibleTocLinks.some((item) => item.id === routeQuickLinkId)
      ? routeQuickLinkId
      : activeQuickLinkId;
  const activeRootSectionId = useMemo<SettingsQuickLinkId>(() => {
    for (const item of settingsNavLinks) {
      if (item.id === effectiveActiveQuickLinkId || item.children?.some((child) => child.id === effectiveActiveQuickLinkId)) {
        return item.id;
      }
    }
    return settingsNavLinks[0]?.id ?? SETTINGS_QUICK_LINKS[0].id;
  }, [effectiveActiveQuickLinkId, settingsNavLinks]);
  const activeExtensionSettingsLink = useMemo(() => {
    if (activeRootSectionId !== 'settings-extensions' || effectiveActiveQuickLinkId === 'settings-extensions') {
      return null;
    }
    return visibleTocLinks.find((item) => item.id === effectiveActiveQuickLinkId && item.extensionId) ?? null;
  }, [effectiveActiveQuickLinkId, activeRootSectionId, visibleTocLinks]);
  const renderedSectionIds = useMemo(
    () => visibleSectionIds ?? (routeQuickLinkId || isWindowedSettingsSurface ? new Set<SettingsQuickLinkId>([activeRootSectionId]) : null),
    [activeRootSectionId, isWindowedSettingsSurface, routeQuickLinkId, visibleSectionIds],
  );

  useEffect(() => {
    const rawSectionId = readSettingsSectionIdFromContext(context, { pathname: location.pathname, hash: location.hash });
    const sectionId = visibleTocLinks.some((item) => item.id === rawSectionId) ? rawSectionId : '';
    if (!sectionId) return;
    setActiveQuickLinkId(sectionId);
    return scheduleSettingsSectionScroll(settingsScrollRef.current, sectionId);
  }, [context, location.hash, location.pathname, visibleTocLinks]);

  useEffect(() => {
    let cancelled = false;

    readDesktopEnvironment()
      .then((environment) => {
        if (!cancelled) {
          setDesktopEnvironment(environment);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDesktopEnvironment(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (visibleTocLinks.some((item) => item.id === activeQuickLinkId)) {
      return;
    }

    const nextId = settingsNavLinks[0]?.id ?? SETTINGS_QUICK_LINKS[0].id;
    setActiveQuickLinkId(nextId);
  }, [activeQuickLinkId, settingsNavLinks, visibleTocLinks]);

  useEffect(() => {
    const container = settingsScrollRef.current;
    if (!sectionIds || !container || typeof window === 'undefined' || visibleTocLinks.length === 0) {
      return undefined;
    }

    const sections = visibleTocLinks
      .map((item) => {
        const section = container.querySelector<HTMLElement>(`#${item.id}`);
        return section ? { id: item.id, section } : null;
      })
      .filter((item): item is { id: SettingsQuickLinkId; section: HTMLElement } => item !== null);
    if (sections.length === 0) {
      return undefined;
    }

    if (typeof IntersectionObserver !== 'undefined') {
      const visibleIds = new Set<SettingsQuickLinkId>();
      const updateActiveQuickLink = () => {
        let nextId = sections[0].id;
        for (const item of sections) {
          if (visibleIds.has(item.id)) {
            nextId = item.id;
          }
        }

        setActiveQuickLinkId((current) => (current === nextId ? current : nextId));
      };

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const sectionId = entry.target.id as SettingsQuickLinkId;
            if (entry.isIntersecting) {
              visibleIds.add(sectionId);
            } else {
              visibleIds.delete(sectionId);
            }
          }

          updateActiveQuickLink();
        },
        {
          root: container,
          rootMargin: '-96px 0px -60% 0px',
          threshold: 0,
        },
      );

      for (const item of sections) {
        observer.observe(item.section);
      }

      return () => {
        observer.disconnect();
      };
    }

    let frame: number | null = null;
    const updateActiveQuickLink = () => {
      frame = null;
      const containerTop = container.getBoundingClientRect().top;
      let nextId = sections[0].id;

      for (const item of sections) {
        if (item.section.getBoundingClientRect().top - containerTop <= 96) {
          nextId = item.id;
        }
      }

      setActiveQuickLinkId((current) => (current === nextId ? current : nextId));
    };

    const scheduleUpdate = () => {
      if (frame !== null) {
        return;
      }
      frame = window.requestAnimationFrame(updateActiveQuickLink);
    };

    scheduleUpdate();
    container.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      container.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [visibleTocLinks]);

  const groupedModels = useMemo(() => groupModelsByProvider(modelState?.models ?? []), [modelState?.models]);

  const selectedModel = useMemo(() => {
    if (!modelState?.currentModel) {
      return null;
    }

    return resolveSettingsModelOption(modelState.models, modelState.currentModel);
  }, [modelState]);
  const selectedModelServiceTierOptions = useMemo(
    () => getModelSelectableServiceTierOptions(selectedModel, { includeDefaultOption: true, defaultLabel: 'Standard queue' }),
    [selectedModel],
  );
  const availableModelProviderIds = useMemo(
    () => listKnownModelProviderIds(modelProviderState, providerAuthState, modelState?.models),
    [modelProviderState, providerAuthState, modelState?.models],
  );
  const unconfiguredModelProviderIds = useMemo(() => {
    const configured = new Set((modelProviderState?.providers ?? []).map((provider) => provider.id));
    for (const provider of providerAuthState?.providers ?? []) {
      if (provider.authType !== 'none' || provider.hasStoredCredential) {
        configured.add(provider.id);
      }
    }
    return availableModelProviderIds.filter((providerId) => !configured.has(providerId));
  }, [availableModelProviderIds, modelProviderState?.providers, providerAuthState?.providers]);
  const configuredProviderSummaries = useMemo(() => {
    const summaries = new Map<string, { id: string; modelProvider: ModelProviderConfig | null; auth: ProviderAuthSummary | null }>();

    for (const provider of modelProviderState?.providers ?? []) {
      summaries.set(provider.id, { id: provider.id, modelProvider: provider, auth: null });
    }

    for (const auth of providerAuthState?.providers ?? []) {
      const isConfigured = auth.authType !== 'none' || auth.hasStoredCredential;
      if (!isConfigured) {
        continue;
      }

      const current = summaries.get(auth.id);
      summaries.set(auth.id, {
        id: auth.id,
        modelProvider: current?.modelProvider ?? null,
        auth,
      });
    }

    return [...summaries.values()].sort((left, right) => left.id.localeCompare(right.id));
  }, [modelProviderState?.providers, providerAuthState?.providers]);
  const providerAuthById = useMemo(() => {
    return new Map((providerAuthState?.providers ?? []).map((provider) => [provider.id, provider]));
  }, [providerAuthState?.providers]);

  const selectedModelProvider = useMemo(() => {
    if (!modelProviderState || !selectedModelProviderId || selectedModelProviderId === NEW_MODEL_PROVIDER_ID) {
      return null;
    }

    return modelProviderState.providers.find((provider) => provider.id === selectedModelProviderId) ?? null;
  }, [modelProviderState, selectedModelProviderId]);

  const editableModelProviderId = useMemo(() => {
    if (selectedModelProvider) {
      return selectedModelProvider.id;
    }

    if (selectedModelProviderId === NEW_MODEL_PROVIDER_ID) {
      return modelProviderDraft.id.trim();
    }

    return '';
  }, [modelProviderDraft.id, selectedModelProvider, selectedModelProviderId]);

  const builtInProviderModels = useMemo(
    () => (modelState?.models ?? []).filter((model) => model.provider === editableModelProviderId),
    [editableModelProviderId, modelState?.models],
  );

  const editingProviderModel = useMemo(() => {
    if (!selectedModelProvider || !editingModelId || editingModelId === NEW_MODEL_ID) {
      return null;
    }

    return selectedModelProvider.models.find((model) => model.id === editingModelId) ?? null;
  }, [editingModelId, selectedModelProvider]);

  useEffect(() => {
    setAdvancedProviderJson(formatProviderAdvancedJson(modelProviderDraft));
  }, [modelProviderDraft]);

  const selectedProvider = useMemo(() => {
    if (!providerAuthState || !selectedProviderId) {
      return null;
    }

    return providerAuthState.providers.find((provider) => provider.id === selectedProviderId) ?? null;
  }, [providerAuthState, selectedProviderId]);

  const modalProviderAuth = useMemo(() => {
    if (!providerAuthState || !editableModelProviderId) {
      return null;
    }

    return providerAuthState.providers.find((provider) => provider.id === editableModelProviderId) ?? null;
  }, [editableModelProviderId, providerAuthState]);
  const defaultCwdDirty = defaultCwdState ? defaultCwdDraft.trim() !== defaultCwdState.currentCwd : false;
  const pickingDefaultCwd = pathPickerTarget === 'default-cwd';

  useEffect(() => {
    if (defaultCwdState) {
      setDefaultCwdDraft(defaultCwdState.currentCwd);
    }
  }, [defaultCwdState?.currentCwd]);

  useEffect(() => {
    if (!modelProviderState || !selectedModelProviderId) {
      return;
    }

    if (selectedModelProviderId !== NEW_MODEL_PROVIDER_ID) {
      const selectedStillExists = modelProviderState.providers.some((provider) => provider.id === selectedModelProviderId);
      if (!selectedStillExists) {
        setSelectedModelProviderId('');
        setSelectedProviderId('');
        setEditingModelId(null);
        setModelDraft(createModelEditorDraft(null));
      }
    }
  }, [modelProviderState, selectedModelProviderId]);

  useEffect(() => {
    if (!providerAuthState || providerAuthState.providers.length === 0) {
      if (selectedProviderId) {
        setSelectedProviderId('');
      }
      return;
    }

    const selectedStillExists = providerAuthState.providers.some((provider) => provider.id === selectedProviderId);
    if (!selectedStillExists) {
      setSelectedProviderId(providerAuthState.providers[0]?.id ?? '');
    }
  }, [providerAuthState, selectedProviderId]);

  useEffect(() => {
    if (!modelProviderState || selectedModelProviderId !== NEW_MODEL_PROVIDER_ID || !selectedProviderId) {
      return;
    }

    const configuredProvider = modelProviderState.providers.find((provider) => provider.id === selectedProviderId) ?? null;
    if (!configuredProvider) {
      return;
    }

    setSelectedModelProviderId(configuredProvider.id);
    setSelectedProviderId(configuredProvider.id);
    setModelProviderDraft(createProviderEditorDraft(configuredProvider));
    setShowAdvancedProviderFields(false);
    setShowProviderModelManagement(false);
    setEditingModelId(null);
    setModelDraft(createModelEditorDraft(null));
    setModelProviderEditorError(null);
    setModelProviderMessage(null);
    setModelDraftError(null);
    setModelDraftMessage(null);
    setProviderTestResult(null);
    setProviderTestError(null);
    setProviderCredentialError(null);
    setProviderCredentialNotice(null);
    setProviderEditorMode('custom');
  }, [modelProviderState, selectedModelProviderId, selectedProviderId]);

  useEffect(() => {
    setProviderApiKey('');
    setProviderCredentialError(null);
    setProviderCredentialNotice(null);
    setOauthError(null);
    setOauthInputValue('');
    openedOAuthAuthUrlRef.current = null;

    if (oauthLoginState && oauthLoginState.provider !== selectedProviderId) {
      setOauthLoginState(null);
      setOauthAction(null);
    }
  }, [selectedProviderId]);

  useEffect(() => {
    if (!oauthLoginState?.id || oauthLoginState.status !== 'running') {
      return;
    }

    const loginId = oauthLoginState.id;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const desktopBridge = getDesktopBridge();
      if (desktopBridge && desktopEnvironment?.activeHostKind === 'local') {
        try {
          cleanup = await subscribeDesktopProviderOAuthLogin(loginId, setOauthLoginState);
          if (cancelled) {
            cleanup();
          }
          return;
        } catch {
          // Fall through to the desktop-aware EventSource bridge.
        }
      }

      const stream = createDesktopAwareEventSource(`/api/provider-auth/oauth/${encodeURIComponent(loginId)}/events`);
      stream.onmessage = (event) => {
        let payload: ProviderOAuthLoginStreamEvent;
        try {
          payload = JSON.parse(event.data) as ProviderOAuthLoginStreamEvent;
        } catch {
          return;
        }

        if (payload.type === 'snapshot') {
          setOauthLoginState(payload.data);
        }
      };
      cleanup = () => {
        stream.close();
      };
      if (cancelled) {
        cleanup();
      }
    })().catch(() => {
      // Ignore best-effort OAuth bridge setup failures here.
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [desktopEnvironment?.activeHostKind, oauthLoginState?.id, oauthLoginState?.status]);

  // Open auth URL in system browser when it becomes available during OAuth login.
  // Electron's shell.openExternal is not subject to popup-blocker timing, unlike window.open from this async effect.
  useEffect(() => {
    if (oauthLoginState?.status !== 'running' || !oauthLoginState.authUrl) {
      return;
    }
    const authUrl = oauthLoginState.authUrl;
    if (openedOAuthAuthUrlRef.current === authUrl) {
      return;
    }
    openedOAuthAuthUrlRef.current = authUrl;

    const desktopBridge = getDesktopBridge();
    if (desktopBridge) {
      void desktopBridge
        .openExternalUrl(authUrl)
        .then((result) => {
          if (!result.opened && result.error) {
            setOauthError(formatProviderOAuthError(result.error, 'open'));
          }
        })
        .catch((error: unknown) => {
          setOauthError(formatProviderOAuthError(error, 'open'));
        });
      return;
    }

    window.open(authUrl, '_blank');
  }, [oauthLoginState?.authUrl, oauthLoginState?.status]);

  useEffect(() => {
    if (!oauthLoginState?.id) {
      oauthTerminalStateKeyRef.current = null;
      return;
    }

    if (oauthLoginState.status === 'running') {
      oauthTerminalStateKeyRef.current = null;
      return;
    }

    const terminalKey = `${oauthLoginState.id}:${oauthLoginState.status}:${oauthLoginState.updatedAt}`;
    if (oauthTerminalStateKeyRef.current === terminalKey) {
      return;
    }

    oauthTerminalStateKeyRef.current = terminalKey;
    setOauthAction(null);

    if (oauthLoginState.status === 'completed') {
      setOauthError(null);
      setOauthInputValue('');
      setProviderCredentialNotice(`Logged in to ${oauthLoginState.providerName}.`);
      void Promise.all([refetchProviderAuth({ resetLoading: false }), refetchModels({ resetLoading: false })]);
      return;
    }

    if (oauthLoginState.status === 'failed') {
      setOauthError(formatProviderOAuthError(oauthLoginState.error || `OAuth login failed for ${oauthLoginState.provider}.`, 'failed'));
    }
  }, [oauthLoginState, refetchModels, refetchProviderAuth]);

  const selectedProviderLogin =
    oauthLoginState && selectedProvider && oauthLoginState.provider === selectedProvider.id ? oauthLoginState : null;
  const oauthPromptOptions = useMemo(
    () => (selectedProviderLogin?.prompt ? parseOAuthPromptOptions(selectedProviderLogin.prompt.message) : []),
    [selectedProviderLogin?.prompt],
  );

  async function handleModelPreferenceChange(
    input: { model?: string; visionModel?: string; thinkingLevel?: string; serviceTier?: string },
    field: 'model' | 'visionModel' | 'thinking' | 'serviceTier',
  ) {
    if (!modelState || savingPreference !== null) {
      return;
    }

    if (field === 'model' && (!input.model || input.model === modelState.currentModel)) {
      return;
    }

    if (field === 'visionModel' && input.visionModel === modelState.currentVisionModel) {
      return;
    }

    if (field === 'thinking' && input.thinkingLevel === modelState.currentThinkingLevel) {
      return;
    }

    if (field === 'serviceTier' && input.serviceTier === modelState.currentServiceTier) {
      return;
    }

    setModelError(null);
    setSavingPreference(field);

    try {
      await api.updateModelPreferences(input);
      await refetchModels({ resetLoading: false });
    } catch (error) {
      setModelError(formatModelPreferenceSaveError(error, field));
    } finally {
      setSavingPreference(null);
    }
  }

  async function handleRefreshModels() {
    if (modelRefreshAction) {
      return;
    }

    setModelRefreshAction(true);
    setModelRefreshMessage(null);
    setModelRefreshError(null);

    try {
      const state = await api.refreshModels();
      await refetchModels({ resetLoading: false });
      setModelRefreshMessage(`Refreshed ${state.models.length} models.`);
    } catch (error) {
      setModelRefreshError(error instanceof Error ? error.message : String(error));
    } finally {
      setModelRefreshAction(false);
    }
  }

  async function handleTestModelProvider() {
    const providerId = editableModelProviderId;
    if (!providerId || providerTestAction || selectedModelProviderId === NEW_MODEL_PROVIDER_ID) {
      if (selectedModelProviderId === NEW_MODEL_PROVIDER_ID) {
        setProviderTestError('Save the provider before testing it.');
      }
      return;
    }

    setProviderTestAction(true);
    setProviderTestResult(null);
    setProviderTestError(null);

    try {
      const result = await api.testModelProvider(providerId);
      setProviderTestResult(result);
      if (result.ok) {
        await refetchModels({ resetLoading: false });
      }
    } catch (error) {
      setProviderTestError(formatProviderEditorActionError(error, 'testProvider'));
    } finally {
      setProviderTestAction(false);
    }
  }

  async function handleDefaultCwdSave(nextCwd: string | null = defaultCwdDraft) {
    if (!defaultCwdState || savingDefaultCwd) {
      return;
    }

    const normalizedCwd = (nextCwd ?? '').trim();
    if (normalizedCwd === defaultCwdState.currentCwd) {
      return;
    }

    setDefaultCwdSaveError(null);
    setSavingDefaultCwd(true);

    try {
      const saved = await api.updateDefaultCwd(normalizedCwd || null);
      setDefaultCwdDraft(saved.currentCwd);
      await refetchDefaultCwd({ resetLoading: false });
    } catch (error) {
      setDefaultCwdSaveError(formatDefaultCwdSaveError(error));
    } finally {
      setSavingDefaultCwd(false);
    }
  }

  async function handleDefaultCwdPick() {
    if (!defaultCwdState || savingDefaultCwd || pickingDefaultCwd) {
      return;
    }

    setDefaultCwdSaveError(null);
    setPathPickerTarget('default-cwd');

    try {
      const result = await api.pickFolder({
        cwd: defaultCwdDraft.trim() || defaultCwdState.effectiveCwd,
        prompt: 'Choose default working directory',
      });
      if (result.cancelled || !result.path) {
        return;
      }

      setDefaultCwdDraft(result.path);
      await handleDefaultCwdSave(result.path);
    } catch (error) {
      setDefaultCwdSaveError(formatDefaultCwdSaveError(error));
    } finally {
      setPathPickerTarget((current) => (current === 'default-cwd' ? null : current));
    }
  }

  useEffect(() => {
    if (!defaultCwdState || !defaultCwdDirty || savingDefaultCwd || pickingDefaultCwd) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void handleDefaultCwdSave();
    }, 700);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [defaultCwdDirty, defaultCwdDraft, defaultCwdState, pickingDefaultCwd, savingDefaultCwd]);

  function startNewModelProvider(initialId = '', mode: 'provider' | 'custom' = initialId ? 'provider' : 'custom') {
    setSelectedModelProviderId(NEW_MODEL_PROVIDER_ID);
    setSelectedProviderId(mode === 'provider' ? initialId : '');
    setModelProviderDraft({
      ...createProviderEditorDraft(null),
      id: mode === 'provider' ? initialId : '',
    });
    setShowAdvancedProviderFields(false);
    setShowProviderModelManagement(false);
    setEditingModelId(null);
    setModelDraft(createModelEditorDraft(null));
    setModelProviderEditorError(null);
    setModelProviderMessage(null);
    setModelDraftError(null);
    setModelDraftMessage(null);
    setProviderTestResult(null);
    setProviderTestError(null);
    setProviderCredentialError(null);
    setProviderCredentialNotice(null);
    setProviderEditorMode(mode);
  }

  function selectModelProvider(providerId: string) {
    if (providerId === NEW_MODEL_PROVIDER_ID) {
      startNewModelProvider();
      return;
    }

    const provider = modelProviderState?.providers.find((candidate) => candidate.id === providerId) ?? null;
    setSelectedModelProviderId(providerId);
    setSelectedProviderId(providerId);
    setModelProviderDraft(createProviderEditorDraft(provider));
    setShowAdvancedProviderFields(false);
    setShowProviderModelManagement(false);
    setEditingModelId(null);
    setModelDraft(createModelEditorDraft(null));
    setModelProviderEditorError(null);
    setModelProviderMessage(null);
    setModelDraftError(null);
    setModelDraftMessage(null);
    setProviderTestResult(null);
    setProviderTestError(null);
    setProviderCredentialError(null);
    setProviderCredentialNotice(null);
    setProviderEditorMode('custom');
  }

  function closeProviderEditor() {
    if (modelProviderAction !== null || modelDraftAction !== null || providerCredentialAction !== null || oauthAction !== null) {
      return;
    }

    setSelectedModelProviderId('');
    setSelectedProviderId('');
    setShowAdvancedProviderFields(false);
    setShowProviderModelManagement(false);
    setEditingModelId(null);
    setModelDraft(createModelEditorDraft(null));
    setModelProviderEditorError(null);
    setModelProviderMessage(null);
    setModelDraftError(null);
    setModelDraftMessage(null);
    setProviderCredentialError(null);
    setProviderCredentialNotice(null);
  }

  function startEditingProviderModel(modelId: string) {
    if (modelId === NEW_MODEL_ID) {
      setEditingModelId(NEW_MODEL_ID);
      setModelDraft(createModelEditorDraft(null));
    } else {
      const model = selectedModelProvider?.models.find((candidate) => candidate.id === modelId) ?? null;
      setEditingModelId(modelId);
      setModelDraft(createModelEditorDraft(model));
    }

    setShowProviderModelManagement(true);

    setModelDraftError(null);
    setModelDraftMessage(null);
  }

  function startEditingBuiltInModel(modelId: string) {
    const builtInModel = builtInProviderModels.find((candidate) => candidate.id === modelId);
    if (!builtInModel) {
      return;
    }

    // Check if there's already a custom override for this built-in model
    const existingOverride = selectedModelProvider?.models.find((candidate) => candidate.id === modelId) ?? null;
    if (existingOverride) {
      startEditingProviderModel(modelId);
      return;
    }

    // Pre-fill the model editor with the built-in model's values so the user
    // can create a custom override with changes (e.g. a different context window).
    setEditingModelId(modelId);
    setModelDraft({
      ...createModelEditorDraft(null),
      id: builtInModel.id,
      name: builtInModel.name,
      contextWindow: String(builtInModel.context),
    });
    setModelDraftError(null);
    setModelDraftMessage(null);
    setShowProviderModelManagement(true);
  }

  function syncModelProviderSelection(nextState: ModelProviderState, providerId: string, nextModelId: string | null = null) {
    replaceModelProviderState(nextState);

    const provider = nextState.providers.find((candidate) => candidate.id === providerId) ?? null;
    if (!provider) {
      setSelectedModelProviderId(NEW_MODEL_PROVIDER_ID);
      setModelProviderDraft(createProviderEditorDraft(null));
      setShowAdvancedProviderFields(false);
      setShowProviderModelManagement(false);
      setEditingModelId(null);
      setModelDraft(createModelEditorDraft(null));
      return;
    }

    setSelectedModelProviderId(provider.id);
    setShowAdvancedProviderFields(false);
    setShowProviderModelManagement(Boolean(nextModelId));
    setModelProviderDraft(createProviderEditorDraft(provider));

    if (!nextModelId) {
      setShowProviderModelManagement(false);
      setEditingModelId(null);
      setModelDraft(createModelEditorDraft(null));
      return;
    }

    const model = provider.models.find((candidate) => candidate.id === nextModelId) ?? null;
    setEditingModelId(model ? model.id : null);
    setModelDraft(createModelEditorDraft(model));
  }

  async function handleSaveModelProvider() {
    const providerId = modelProviderDraft.id.trim();
    if (!providerId || modelProviderAction !== null) {
      if (!providerId) {
        setModelProviderEditorError('Provider id is required.');
      }
      return;
    }

    try {
      const providerDraft = applyProviderAdvancedJson(modelProviderDraft, advancedProviderJson);
      const headers = parseOptionalStringRecord(providerDraft.headersText, 'Provider headers');
      const compat = parseOptionalJsonObject(providerDraft.compatText, 'Provider compat');
      const modelOverrides = parseOptionalJsonObject(providerDraft.modelOverridesText, 'Provider model overrides');
      const existed = selectedModelProviderId !== NEW_MODEL_PROVIDER_ID && selectedModelProvider?.id === providerId;

      setModelProviderAction('save');
      setModelProviderEditorError(null);
      setModelProviderMessage(null);

      const state = await api.saveModelProvider(providerId, {
        baseUrl: providerDraft.baseUrl.trim() || undefined,
        api: providerDraft.api || undefined,
        apiKey: providerDraft.apiKey.trim() || undefined,
        authHeader: providerDraft.authHeader,
        headers,
        compat,
        modelOverrides,
      });

      syncModelProviderSelection(state, providerId);
      setSelectedProviderId(providerId);
      setModelProviderMessage(existed ? `Saved ${providerId}.` : `Created ${providerId}.`);
      await Promise.all([refetchModels({ resetLoading: false }), refetchProviderAuth({ resetLoading: false })]);
    } catch (error) {
      setModelProviderEditorError(formatProviderEditorActionError(error, 'saveProvider'));
    } finally {
      setModelProviderAction(null);
    }
  }

  async function handleDeleteModelProvider() {
    const providerId = selectedModelProvider?.id ?? modelProviderDraft.id.trim();
    if (!providerId || modelProviderAction !== null || selectedModelProviderId === NEW_MODEL_PROVIDER_ID) {
      return;
    }

    const confirmed = window.confirm(`Remove provider ${providerId} and all of its model definitions?`);
    if (!confirmed) {
      return;
    }

    setModelProviderAction('delete');
    setModelProviderEditorError(null);
    setModelProviderMessage(null);
    setModelDraftError(null);
    setModelDraftMessage(null);

    try {
      const state = await api.deleteModelProvider(providerId);
      replaceModelProviderState(state);
      const nextProvider = state.providers[0] ?? null;
      if (nextProvider) {
        setSelectedModelProviderId(nextProvider.id);
        setModelProviderDraft(createProviderEditorDraft(nextProvider));
      } else {
        setSelectedModelProviderId(NEW_MODEL_PROVIDER_ID);
        setModelProviderDraft(createProviderEditorDraft(null));
      }
      setEditingModelId(null);
      setModelDraft(createModelEditorDraft(null));
      setModelProviderMessage(`Removed ${providerId}.`);
      await Promise.all([refetchModels({ resetLoading: false }), refetchProviderAuth({ resetLoading: false })]);
    } catch (error) {
      setModelProviderEditorError(formatProviderEditorActionError(error, 'deleteProvider'));
    } finally {
      setModelProviderAction(null);
    }
  }

  async function handleSaveProviderModel() {
    if (modelDraftAction !== null) {
      return;
    }

    const providerId = editableModelProviderId;
    if (!providerId) {
      setModelDraftError('Pick or type a provider id first.');
      return;
    }

    const modelId = modelDraft.id.trim();
    if (!modelId) {
      setModelDraftError('Model id is required.');
      return;
    }

    try {
      const headers = parseOptionalStringRecord(modelDraft.headersText, 'Model headers');
      const compat = parseOptionalJsonObject(modelDraft.compatText, 'Model compat');
      const contextWindow = parseOptionalPositiveInteger(modelDraft.contextWindow, 'Context window');
      const maxTokens = parseOptionalPositiveInteger(modelDraft.maxTokens, 'Max tokens');
      const costInput = parseOptionalNonNegativeNumber(modelDraft.costInput, 'Input cost');
      const costOutput = parseOptionalNonNegativeNumber(modelDraft.costOutput, 'Output cost');
      const costCacheRead = parseOptionalNonNegativeNumber(modelDraft.costCacheRead, 'Cache read cost');
      const costCacheWrite = parseOptionalNonNegativeNumber(modelDraft.costCacheWrite, 'Cache write cost');
      const existed = editingProviderModel?.id === modelId;

      setModelDraftAction('save');
      setModelDraftError(null);
      setModelDraftMessage(null);

      const state = await api.saveModelProviderModel(providerId, {
        modelId,
        name: modelDraft.name.trim() || undefined,
        api: modelDraft.api || undefined,
        baseUrl: modelDraft.baseUrl.trim() || undefined,
        reasoning: modelDraft.reasoning,
        input: modelDraft.acceptsImages ? ['text', 'image'] : ['text'],
        contextWindow,
        maxTokens,
        headers,
        cost: {
          input: costInput ?? 0,
          output: costOutput ?? 0,
          cacheRead: costCacheRead ?? 0,
          cacheWrite: costCacheWrite ?? 0,
        },
        compat,
      });

      syncModelProviderSelection(state, providerId, modelId);
      setSelectedProviderId(providerId);
      setModelDraftMessage(existed ? `Saved ${modelId}.` : `Added ${modelId}.`);
      await Promise.all([refetchModels({ resetLoading: false }), refetchProviderAuth({ resetLoading: false })]);
    } catch (error) {
      setModelDraftError(formatProviderEditorActionError(error, 'saveModel'));
    } finally {
      setModelDraftAction(null);
    }
  }

  async function handleDeleteProviderModel(modelId: string) {
    if (!selectedModelProvider || modelDraftAction !== null) {
      return;
    }

    const confirmed = window.confirm(`Remove model ${modelId} from ${selectedModelProvider.id}?`);
    if (!confirmed) {
      return;
    }

    setModelDraftAction('delete');
    setModelDraftError(null);
    setModelDraftMessage(null);

    try {
      const state = await api.deleteModelProviderModel(selectedModelProvider.id, modelId);
      syncModelProviderSelection(state, selectedModelProvider.id);
      setShowProviderModelManagement(true);
      setModelDraftMessage(`Removed ${modelId}.`);
      await Promise.all([refetchModels({ resetLoading: false }), refetchProviderAuth({ resetLoading: false })]);
    } catch (error) {
      setModelDraftError(formatProviderEditorActionError(error, 'deleteModel'));
    } finally {
      setModelDraftAction(null);
    }
  }

  async function handleSaveProviderApiKey() {
    if (!modalProviderAuth || providerCredentialAction !== null || !canProviderUseApiKey(modalProviderAuth)) {
      return;
    }

    const apiKey = providerApiKey.trim();
    if (!apiKey) {
      setProviderCredentialError('API key is required.');
      return;
    }

    setProviderCredentialError(null);
    setProviderCredentialNotice(null);
    setOauthError(null);
    setProviderCredentialAction('saveKey');

    try {
      await api.setProviderApiKey(modalProviderAuth.id, apiKey);
      setProviderApiKey('');
      setOauthLoginState(null);
      setProviderCredentialNotice(`Saved API key for ${modalProviderAuth.id}.`);
      await Promise.all([refetchProviderAuth({ resetLoading: false }), refetchModels({ resetLoading: false })]);
    } catch (error) {
      setProviderCredentialError(formatProviderCredentialError(error, 'save'));
    } finally {
      setProviderCredentialAction(null);
    }
  }

  async function handleRemoveProviderCredential() {
    if (!modalProviderAuth || providerCredentialAction !== null) {
      return;
    }

    const confirmed = window.confirm(`Remove the stored credential for ${modalProviderAuth.id}?`);
    if (!confirmed) {
      return;
    }

    setProviderCredentialError(null);
    setProviderCredentialNotice(null);
    setOauthError(null);
    setProviderCredentialAction('remove');

    try {
      await api.removeProviderCredential(modalProviderAuth.id);
      setOauthLoginState(null);
      setProviderCredentialNotice(`Removed stored credential for ${modalProviderAuth.id}.`);
      await Promise.all([refetchProviderAuth({ resetLoading: false }), refetchModels({ resetLoading: false })]);
    } catch (error) {
      setProviderCredentialError(formatProviderCredentialError(error, 'remove'));
    } finally {
      setProviderCredentialAction(null);
    }
  }

  async function handleStartProviderOAuthLogin() {
    if (!modalProviderAuth || !modalProviderAuth.oauthSupported || oauthAction !== null) {
      return;
    }

    setProviderCredentialNotice(null);
    setProviderCredentialError(null);
    setOauthError(null);
    setOauthInputValue('');
    openedOAuthAuthUrlRef.current = null;
    setOauthAction('start');

    try {
      const login = await api.startProviderOAuthLogin(modalProviderAuth.id);
      setOauthLoginState(login);

      if (login.status === 'completed') {
        setProviderCredentialNotice(`Logged in to ${login.providerName}.`);
        await Promise.all([refetchProviderAuth({ resetLoading: false }), refetchModels({ resetLoading: false })]);
      }
    } catch (error) {
      setOauthError(formatProviderOAuthError(error, 'start'));
    } finally {
      setOauthAction(null);
    }
  }

  async function handleSubmitProviderOAuthInput() {
    if (!oauthLoginState || oauthLoginState.status !== 'running' || oauthAction !== null) {
      return;
    }

    if (oauthLoginState.prompt && !oauthLoginState.prompt.allowEmpty && oauthInputValue.trim().length === 0) {
      setOauthError('Input is required to continue this login flow.');
      return;
    }

    setOauthError(null);
    setOauthAction('submit');

    try {
      const login = await api.submitProviderOAuthLoginInput(oauthLoginState.id, oauthInputValue);
      setOauthLoginState(login);
      setOauthInputValue('');
    } catch (error) {
      setOauthError(formatProviderOAuthError(error, 'submit'));
    } finally {
      setOauthAction(null);
    }
  }

  async function handleCancelProviderOAuthLogin() {
    if (!oauthLoginState || oauthLoginState.status !== 'running' || oauthAction !== null) {
      return;
    }

    setOauthError(null);
    setOauthAction('cancel');

    try {
      const login = await api.cancelProviderOAuthLogin(oauthLoginState.id);
      setOauthLoginState(login);
      setProviderCredentialNotice(`Cancelled OAuth login for ${login.providerName}.`);
    } catch (error) {
      setOauthError(formatProviderOAuthError(error, 'cancel'));
    } finally {
      setOauthAction(null);
    }
  }

  async function handleOpenProviderOAuthUrl(url: string) {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      return;
    }

    const desktopBridge = getDesktopBridge();
    if (desktopBridge) {
      const result = await desktopBridge.openExternalUrl(normalizedUrl);
      if (!result.opened && result.error) {
        setOauthError(formatProviderOAuthError(result.error, 'open'));
      }
      return;
    }

    window.open(normalizedUrl, '_blank');
  }

  async function handleCopyProviderOAuthUrl(url: string) {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      return;
    }

    try {
      const desktopBridge = getDesktopBridge();
      if (desktopBridge) {
        const result = await desktopBridge.writeClipboardText(normalizedUrl);
        if (!result.ok) {
          throw new Error(result.error || 'Copy to clipboard failed.');
        }
      } else {
        if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') {
          throw new Error('Clipboard access is unavailable.');
        }
        await navigator.clipboard.writeText(normalizedUrl);
      }
      setOauthError(null);
      setProviderCredentialNotice('Copied OAuth login details.');
    } catch (error) {
      setOauthError(formatProviderOAuthError(error, 'copy'));
    }
  }

  const activeRootLink = settingsNavLinks.find((item) => item.id === activeRootSectionId) ?? settingsNavLinks[0] ?? null;
  const activeSectionTitle = settingsQuickLinkLabelText(activeExtensionSettingsLink?.label ?? activeRootLink?.label ?? 'Settings');

  function focusSettingsSection(item: SettingsQuickLink) {
    setActiveQuickLinkId(item.id);
    if (isWindowedSettingsSurface) {
      if (typeof settingsScrollRef.current?.scrollTo === 'function') {
        settingsScrollRef.current.scrollTo({ top: 0 });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('neon-pilot-desktop-navigate', { detail: { route: settingsQuickLinkRoute(item) } }));
      }
      return;
    }
    scheduleSettingsSectionScroll(settingsScrollRef.current, item.id);
  }

  const settingsSections = (
    <div className="settings-page-detail flex min-w-0 flex-col">
      <div className="settings-page-sections flex flex-col gap-6">
        <SettingsSection id="settings-appearance" label="Appearance" description="Theme, accent, and visual defaults.">
          <SettingsGroup title="Theme" className={SETTINGS_PANEL_COMPACT_CLASS} hideHeader>
            <SettingsControlRow
              title="Mode"
              description={availableThemes.find((availableTheme) => availableTheme.id === theme)?.label ?? theme}
            >
              <SegmentedControl
                ariaLabel="Theme mode selection"
                value={themePreference}
                onChange={setThemePreference}
                options={[
                  { value: 'system', label: 'Auto' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
            </SettingsControlRow>
            <SettingsControlRow title="Light default">
              <Select
                className="h-8 min-w-0 truncate bg-surface/70 pr-9 text-[12px] font-medium"
                value={lightTheme}
                onChange={(event) => setLightTheme(event.target.value)}
                aria-label="Light default theme"
              >
                {availableThemes
                  .filter((availableTheme) => availableTheme.appearance === 'light')
                  .map((availableTheme) => (
                    <option key={availableTheme.id} value={availableTheme.id}>
                      {availableTheme.label}
                    </option>
                  ))}
              </Select>
            </SettingsControlRow>
            <SettingsControlRow title="Dark default">
              <Select
                className="h-8 min-w-0 truncate bg-surface/70 pr-9 text-[12px] font-medium"
                value={darkTheme}
                onChange={(event) => setDarkTheme(event.target.value)}
                aria-label="Dark default theme"
              >
                {availableThemes
                  .filter((availableTheme) => availableTheme.appearance === 'dark')
                  .map((availableTheme) => (
                    <option key={availableTheme.id} value={availableTheme.id}>
                      {availableTheme.label}
                    </option>
                  ))}
              </Select>
            </SettingsControlRow>
            <SettingsControlRow title="Accent">
              <div className="flex w-full flex-wrap justify-end gap-2" role="radiogroup" aria-label="Accent color">
                {availableAccents.map((entry) => {
                  const isSelected = accent === entry.id;
                  const currentTokens = theme.includes('dark') ? entry.dark : entry.light;
                  return (
                    <SwatchOption
                      key={entry.id}
                      type="button"
                      checked={isSelected}
                      label={entry.label}
                      swatch={
                        <span
                          className="h-full w-full rounded-full"
                          style={{ backgroundColor: `rgb(${currentTokens.accent.replaceAll(' ', ', ')})` }}
                        />
                      }
                      title={entry.label}
                      onClick={() => setAccent(entry.id as ThemeAccent)}
                    />
                  );
                })}
              </div>
            </SettingsControlRow>
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection id="settings-conversation" label="Conversation" description="Model and transcript defaults for new conversations.">
          <div className="settings-page-section-stack">
            <SettingsGroup title="Model defaults">
              {modelsLoading && !modelState ? (
                <p className="ui-card-meta">Loading models...</p>
              ) : modelsError && !modelState ? (
                <p className="text-[12px] text-danger">Failed to load models: {modelsError}</p>
              ) : modelState ? (
                <>
                  <SettingsControlRow
                    title="Default model"
                    description={savingPreference === 'model' ? 'Saving...' : formatModelSummary(selectedModel, 'No model selected')}
                  >
                    <Select
                      id="settings-model"
                      value={modelState.currentModel}
                      onChange={(event) => {
                        void handleModelPreferenceChange({ model: event.target.value }, 'model');
                      }}
                      disabled={savingPreference !== null || modelState.models.length === 0}
                    >
                      {groupedModels.map(([provider, models]) => (
                        <optgroup key={provider} label={provider}>
                          {models.map((model) => (
                            <option key={`${model.provider}/${model.id}`} value={formatSettingsModelOptionValue(model, modelState.models)}>
                              {model.name} · {formatContextWindowLabel(model.context)} ctx
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </SettingsControlRow>

                  <SettingsControlRow
                    title="Thinking level"
                    description={savingPreference === 'thinking' ? 'Saving...' : formatThinkingLevelLabel(modelState.currentThinkingLevel)}
                  >
                    <Select
                      id="settings-thinking"
                      value={modelState.currentThinkingLevel}
                      onChange={(event) => {
                        void handleModelPreferenceChange({ thinkingLevel: event.target.value }, 'thinking');
                      }}
                      disabled={savingPreference !== null}
                    >
                      {THINKING_LEVEL_OPTIONS.map((option) => (
                        <option key={option.value || 'unset'} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </SettingsControlRow>

                  {selectedModelServiceTierOptions.length > 0 ? (
                    <SettingsControlRow
                      title="Service tier"
                      description={
                        savingPreference === 'serviceTier'
                          ? 'Saving...'
                          : `Default for ${selectedModel?.name ?? 'the selected model'}: ${
                              modelState.currentServiceTier ? formatServiceTierLabel(modelState.currentServiceTier) : 'Standard queue'
                            }`
                      }
                    >
                      <Select
                        id="settings-service-tier"
                        value={modelState.currentServiceTier}
                        onChange={(event) => {
                          void handleModelPreferenceChange({ serviceTier: event.target.value }, 'serviceTier');
                        }}
                        disabled={savingPreference !== null}
                      >
                        {selectedModelServiceTierOptions.map((option) => (
                          <option key={option.value || 'default'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </SettingsControlRow>
                  ) : null}
                </>
              ) : null}

              {modelError && <p className="text-[12px] text-danger">{modelError}</p>}
            </SettingsGroup>
            <ExtensionSettingsSection includeExtensionIds={['system-settings']} includeGroups={['Conversation']} separated={false} />
          </div>
        </SettingsSection>

        <SettingsSection id="settings-workspace" label="Workspace" description="Working directory defaults for tools and shell commands.">
          <div className="settings-page-section-stack">
            <SettingsGroup title="Working directory">
              {defaultCwdLoading && !defaultCwdState ? (
                <p className="ui-card-meta">Loading default working directory...</p>
              ) : defaultCwdLoadError && !defaultCwdState ? (
                <p className="text-[12px] text-danger">Failed to load default working directory: {defaultCwdLoadError}</p>
              ) : defaultCwdState ? (
                <form
                  className="contents"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleDefaultCwdSave();
                  }}
                >
                  <SettingsControlRow
                    title="Default project folder"
                    description={
                      savingDefaultCwd
                        ? 'Saving…'
                        : defaultCwdState.currentCwd
                          ? `New conversations and tool runs will start in ${defaultCwdState.effectiveCwd}`
                          : `No default chosen. New conversations and tool runs will start in ${defaultCwdState.effectiveCwd}`
                    }
                    actionsClassName="settings-page-cwd-actions"
                  >
                    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <TextInput
                        id="settings-default-cwd"
                        value={defaultCwdDraft}
                        onChange={(event) => {
                          setDefaultCwdDraft(event.target.value);
                          if (defaultCwdSaveError) {
                            setDefaultCwdSaveError(null);
                          }
                        }}
                        className="min-w-0 flex-1 font-mono text-[13px]"
                        placeholder="~/workingdir/repo"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={savingDefaultCwd || pickingDefaultCwd}
                      />
                      <ToolbarButton
                        type="button"
                        onClick={() => {
                          void handleDefaultCwdPick();
                        }}
                        disabled={savingDefaultCwd || pickingDefaultCwd}
                        className="shrink-0 text-accent"
                        title="Choose default working directory"
                        aria-label="Choose default working directory"
                      >
                        {pickingDefaultCwd ? 'Choosing...' : 'Choose...'}
                      </ToolbarButton>
                    </div>
                  </SettingsControlRow>
                  <SettingsControlRow
                    title="If you do not choose one"
                    description={
                      savingDefaultCwd
                        ? 'Saving…'
                        : defaultCwdDirty
                          ? 'Auto-save pending…'
                          : 'Neon Pilot uses the folder it was launched from. Choose a project folder above to make this predictable.'
                    }
                  >
                    <ToolbarButton
                      type="button"
                      onClick={() => {
                        void handleDefaultCwdSave('');
                      }}
                      disabled={savingDefaultCwd || pickingDefaultCwd || defaultCwdState.currentCwd.length === 0}
                    >
                      Clear default
                    </ToolbarButton>
                  </SettingsControlRow>
                </form>
              ) : null}

              {defaultCwdSaveError && <p className="text-[12px] text-danger">{defaultCwdSaveError}</p>}
            </SettingsGroup>
          </div>
        </SettingsSection>

        <SettingsSection id="settings-commands" label="Commands" description="Command palette actions and keyboard shortcuts.">
          <CommandsSettingsSection />
        </SettingsSection>

        <SettingsSection id="settings-security" label="Security" description="Secret storage and extension credentials.">
          <ExtensionSecretsSection />
        </SettingsSection>

        <SettingsSection
          id="settings-extensions"
          label={activeExtensionSettingsLink?.label ?? 'Extensions'}
          description="Installed extension preferences and integration setup."
        >
          {activeExtensionSettingsLink?.extensionId ? (
            <>
              <ExtensionSettingsSection includeExtensionIds={[activeExtensionSettingsLink.extensionId]} extensionLabels={extensionLabels} />
              <ExtensionSettingsComponentPanels
                registrations={extensionRegistry.settingsComponents}
                includeExtensionIds={[activeExtensionSettingsLink.extensionId]}
                shellPresentation={context?.shellPresentation}
              />
            </>
          ) : (
            <>
              <ExtensionSettingsSection excludeExtensionIds={['system-settings']} groupByExtension extensionLabels={extensionLabels} />
              <ExtensionSettingsComponentPanels
                registrations={extensionRegistry.settingsComponents}
                shellPresentation={context?.shellPresentation}
              />
              <ExtensionSettingsIndex items={settingsNavLinks} />
            </>
          )}
        </SettingsSection>

        <SettingsSection
          id="settings-providers"
          label="Providers"
          description="Connect model providers, save credentials, and add model overrides."
        >
          <div className="settings-page-section-stack">
            <SettingsGroup title="Model providers">
              <>
                {modelProviderLoading && !modelProviderState ? (
                  <p className="ui-card-meta">Loading provider definitions...</p>
                ) : modelProviderError && !modelProviderState ? (
                  <p className="text-[12px] text-danger">Failed to load provider definitions: {modelProviderError}</p>
                ) : modelProviderState ? (
                  <>
                    {providerAuthLoading && !providerAuthState && <p className="ui-card-meta">Loading provider credentials...</p>}
                    {providerAuthError && !providerAuthState && (
                      <p className="text-[12px] text-danger">Failed to load provider credentials: {providerAuthError}</p>
                    )}
                    <SettingsControlRow title="Choose provider" actionsClassName="settings-page-provider-add-actions">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                        <Select
                          id="settings-model-provider-picker"
                          value={modelProviderPickerId}
                          onChange={(event) => {
                            setModelProviderPickerId(event.target.value);
                          }}
                          className="h-9 py-1.5 text-[12px]"
                        >
                          <option value="">Choose provider...</option>
                          {unconfiguredModelProviderIds.map((providerId) => (
                            <option key={providerId} value={providerId}>
                              {formatProviderMenuLabel(providerId, providerAuthById.get(providerId), availableModelProviderIds)}
                            </option>
                          ))}
                          <option value={ADD_CUSTOM_PROVIDER_ID}>Add custom provider...</option>
                        </Select>
                        <ToolbarButton
                          type="button"
                          onClick={() => {
                            if (modelProviderPickerId === ADD_CUSTOM_PROVIDER_ID) {
                              startNewModelProvider('', 'custom');
                            } else {
                              startNewModelProvider(modelProviderPickerId, 'provider');
                            }
                          }}
                          disabled={!modelProviderPickerId}
                          className="h-9 shrink-0"
                        >
                          Continue
                        </ToolbarButton>
                      </div>
                    </SettingsControlRow>
                  </>
                ) : null}

                {selectedModelProviderId !== '' && (
                  <div className="settings-page-provider-editor space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-[15px] font-medium text-primary">
                          {providerEditorMode === 'custom'
                            ? selectedModelProvider
                              ? `Edit provider · ${selectedModelProvider.id}`
                              : 'Add custom provider'
                            : `Provider · ${editableModelProviderId}`}
                        </h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {modalProviderAuth && (
                          <Button
                            variant="action"
                            tone="danger"
                            type="button"
                            onClick={() => {
                              void handleRemoveProviderCredential();
                            }}
                            disabled={
                              providerCredentialAction !== null ||
                              oauthLoginState?.status === 'running' ||
                              !modalProviderAuth.hasStoredCredential
                            }
                            aria-label="Remove stored credential"
                            title="Remove stored credential"
                          >
                            {providerCredentialAction === 'remove' ? (
                              'Removing...'
                            ) : (
                              <>
                                <SettingsIcon name="trash" />
                                Delete
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="action"
                          type="button"
                          onClick={() => {
                            void handleTestModelProvider();
                          }}
                          disabled={
                            providerTestAction ||
                            selectedModelProviderId === NEW_MODEL_PROVIDER_ID ||
                            !editableModelProviderId ||
                            modelProviderAction !== null
                          }
                          title="Test provider connection"
                        >
                          {providerTestAction ? 'Testing...' : 'Test'}
                        </Button>
                        <IconButton
                          type="button"
                          onClick={closeProviderEditor}
                          disabled={
                            modelProviderAction !== null ||
                            modelDraftAction !== null ||
                            providerCredentialAction !== null ||
                            oauthAction !== null
                          }
                          aria-label="Close provider"
                          title="Close"
                        >
                          <SettingsIcon name="x" />
                        </IconButton>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-4">
                      {providerEditorMode === 'custom' && (
                        <div className="space-y-4 min-w-0">
                          <div className="space-y-1">
                            <h3 className="text-[15px] font-medium text-primary">
                              {selectedModelProviderId === NEW_MODEL_PROVIDER_ID
                                ? modelProviderDraft.id.trim()
                                  ? `New provider · ${modelProviderDraft.id.trim()}`
                                  : 'New provider'
                                : (selectedModelProvider?.id ?? 'Provider')}
                            </h3>
                            <p className="ui-card-meta max-w-3xl">
                              Use a known provider ID to load curated defaults. Save credentials here, then add or override models below.
                            </p>
                            {selectedModelProviderId === NEW_MODEL_PROVIDER_ID ? (
                              <div className="flex flex-wrap gap-2 text-[12px]">
                                {COMMON_PROVIDER_IDS.map((providerId) => (
                                  <TextButton
                                    key={providerId}
                                    onClick={() => {
                                      if (modelProviderAction !== null) {
                                        return;
                                      }
                                      setModelProviderDraft((current) => ({ ...current, id: providerId }));
                                    }}
                                    disabled={modelProviderAction !== null}
                                    tone="accent"
                                    className="underline decoration-dotted underline-offset-4"
                                  >
                                    {providerId}
                                  </TextButton>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <form
                            className="space-y-4"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void handleSaveModelProvider();
                            }}
                          >
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2 min-w-0">
                                <label className="ui-card-meta" htmlFor="settings-model-provider-id">
                                  Provider id
                                </label>
                                <TextInput
                                  id="settings-model-provider-id"
                                  value={modelProviderDraft.id}
                                  onChange={(event) => {
                                    setModelProviderDraft((current) => ({ ...current, id: event.target.value }));
                                  }}
                                  className="font-mono text-[13px]"
                                  placeholder="ollama"
                                  autoComplete="off"
                                  spellCheck={false}
                                  disabled={modelProviderAction !== null || selectedModelProviderId !== NEW_MODEL_PROVIDER_ID}
                                />
                              </div>

                              <div className="space-y-2 min-w-0">
                                <label className="ui-card-meta" htmlFor="settings-model-provider-api-key">
                                  Provider API key
                                </label>
                                <TextInput
                                  id="settings-model-provider-api-key"
                                  value={modelProviderDraft.apiKey}
                                  onChange={(event) => {
                                    setModelProviderDraft((current) => ({ ...current, apiKey: event.target.value }));
                                  }}
                                  className="font-mono text-[13px]"
                                  placeholder="ollama, ENV_VAR, or !command"
                                  autoComplete="off"
                                  spellCheck={false}
                                  disabled={modelProviderAction !== null}
                                />
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2 min-w-0">
                                <label className="ui-card-meta" htmlFor="settings-model-provider-base-url">
                                  Base URL
                                </label>
                                <TextInput
                                  id="settings-model-provider-base-url"
                                  value={modelProviderDraft.baseUrl}
                                  onChange={(event) => {
                                    setModelProviderDraft((current) => ({ ...current, baseUrl: event.target.value }));
                                  }}
                                  className="font-mono text-[13px]"
                                  placeholder="http://localhost:11434/v1"
                                  autoComplete="off"
                                  spellCheck={false}
                                  disabled={modelProviderAction !== null}
                                />
                              </div>

                              <div className="space-y-2 min-w-0">
                                <label className="ui-card-meta" htmlFor="settings-model-provider-api">
                                  API type
                                </label>
                                <Select
                                  id="settings-model-provider-api"
                                  value={modelProviderDraft.api}
                                  onChange={(event) => {
                                    setModelProviderDraft((current) => ({ ...current, api: event.target.value }));
                                  }}
                                  disabled={modelProviderAction !== null}
                                >
                                  <option value="">Use built-in or inherit</option>
                                  {MODEL_PROVIDER_API_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </div>

                            <Disclosure
                              open={showAdvancedProviderFields}
                              onToggle={(event) => {
                                setShowAdvancedProviderFields((event.currentTarget as HTMLDetailsElement).open);
                              }}
                              summary="Advanced JSON"
                            >
                              <div className="space-y-2 pt-2">
                                <p className="ui-card-meta max-w-3xl">
                                  Edit raw provider options only when a provider needs custom headers, compatibility flags, or model
                                  overrides. See provider options docs.
                                </p>
                                <Textarea
                                  className="min-h-[150px] font-mono text-[12px] leading-5"
                                  value={advancedProviderJson}
                                  onChange={(event) => {
                                    setAdvancedProviderJson(event.target.value);
                                  }}
                                  spellCheck={false}
                                  disabled={modelProviderAction !== null}
                                />
                                <label
                                  className="inline-flex items-center gap-3 text-[13px] text-primary"
                                  htmlFor="settings-model-provider-auth-header"
                                >
                                  <Checkbox
                                    id="settings-model-provider-auth-header"
                                    type="checkbox"
                                    checked={modelProviderDraft.authHeader}
                                    onChange={(event) => {
                                      setModelProviderDraft((current) => ({ ...current, authHeader: event.target.checked }));
                                    }}
                                    disabled={modelProviderAction !== null}
                                  />
                                  <span>Add Authorization: Bearer from the provider API key</span>
                                </label>
                              </div>
                            </Disclosure>

                            <div className="flex flex-wrap gap-2">
                              <ToolbarButton
                                type="submit"
                                disabled={modelProviderAction !== null || modelProviderDraft.id.trim().length === 0}
                              >
                                {modelProviderAction === 'save'
                                  ? 'Saving provider...'
                                  : selectedModelProviderId === NEW_MODEL_PROVIDER_ID
                                    ? 'Create provider'
                                    : 'Save provider'}
                              </ToolbarButton>
                              <ToolbarButton
                                type="button"
                                onClick={() => {
                                  void handleDeleteModelProvider();
                                }}
                                disabled={
                                  modelProviderAction !== null ||
                                  selectedModelProviderId === NEW_MODEL_PROVIDER_ID ||
                                  !selectedModelProvider
                                }
                              >
                                {modelProviderAction === 'delete' ? 'Removing...' : 'Remove provider'}
                              </ToolbarButton>
                            </div>

                            {modelProviderMessage && <p className="text-[12px] text-success">{modelProviderMessage}</p>}
                            {modelProviderEditorError && <p className="text-[12px] text-danger">{modelProviderEditorError}</p>}
                            {providerTestResult && (
                              <p
                                className={cx(
                                  'text-[12px]',
                                  providerTestResult.status === 'error'
                                    ? 'text-danger'
                                    : providerTestResult.status === 'warning'
                                      ? 'text-warning'
                                      : 'text-success',
                                )}
                              >
                                {providerTestResult.message}
                                {providerTestResult.sampleModels.length > 0
                                  ? ` Sample: ${providerTestResult.sampleModels.join(', ')}.`
                                  : ''}
                              </p>
                            )}
                            {providerTestError && <p className="text-[12px] text-danger">{providerTestError}</p>}
                          </form>
                        </div>
                      )}

                      {providerEditorMode !== 'custom' && providerTestResult && (
                        <p
                          className={cx(
                            'text-[12px]',
                            providerTestResult.status === 'error'
                              ? 'text-danger'
                              : providerTestResult.status === 'warning'
                                ? 'text-warning'
                                : 'text-success',
                          )}
                        >
                          {providerTestResult.message}
                          {providerTestResult.sampleModels.length > 0 ? ` Sample: ${providerTestResult.sampleModels.join(', ')}.` : ''}
                        </p>
                      )}
                      {providerEditorMode !== 'custom' && providerTestError && (
                        <p className="text-[12px] text-danger">{providerTestError}</p>
                      )}

                      <Disclosure
                        open={showProviderModelManagement}
                        onToggle={(event) => {
                          setShowProviderModelManagement((event.currentTarget as HTMLDetailsElement).open);
                        }}
                        className="order-2 min-w-0"
                        summary={<span className="text-[14px] font-medium text-primary">Models</span>}
                      >
                        <div className="space-y-3 pt-3">
                          <p className="ui-card-meta max-w-3xl">
                            These are the models Neon Pilot will show for this provider. Add a model only if it is missing or needs custom
                            settings.
                          </p>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                              <ToolbarButton
                                type="button"
                                onClick={() => {
                                  startEditingProviderModel(NEW_MODEL_ID);
                                }}
                                disabled={!editableModelProviderId || modelDraftAction !== null}
                              >
                                Add model
                              </ToolbarButton>
                              <ToolbarButton
                                type="button"
                                onClick={() => {
                                  void handleRefreshModels();
                                }}
                                disabled={modelsRefreshing || modelRefreshAction}
                              >
                                Find models from provider...
                              </ToolbarButton>
                            </div>
                          </div>
                          <p className="ui-card-meta max-w-3xl">
                            Most users do not need to manage this list. Built-in models are already usable. Finding models only helps
                            discover new IDs to add manually.
                          </p>
                          {modelRefreshMessage && <p className="text-[12px] text-success">{modelRefreshMessage}</p>}
                          {modelRefreshError && <p className="text-[12px] text-danger">{modelRefreshError}</p>}

                          {editableModelProviderId ? (
                            <>
                              <div className="space-y-1 border-t border-border-subtle pt-2">
                                {builtInProviderModels.map((model) => {
                                  const savedModel = selectedModelProvider?.models.find((candidate) => candidate.id === model.id);
                                  return (
                                    <div
                                      key={`${model.provider}/${model.id}`}
                                      className="group ui-list-row ui-list-row-hover justify-between px-2 py-2"
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate font-mono text-[12px] font-medium text-primary">{model.id}</span>
                                        <span className="ui-card-meta block truncate">
                                          {model.context.toLocaleString()} context ·{' '}
                                          {model.input.includes('image') ? 'text + images' : 'text'}
                                          {savedModel ? ' · custom settings saved' : ''}
                                        </span>
                                      </span>
                                      <div className="flex flex-wrap gap-2">
                                        {savedModel ? (
                                          <>
                                            <ToolbarButton type="button" onClick={() => startEditingProviderModel(model.id)}>
                                              Edit
                                            </ToolbarButton>
                                            <ToolbarButton type="button" onClick={() => void handleDeleteProviderModel(model.id)}>
                                              Reset
                                            </ToolbarButton>
                                          </>
                                        ) : (
                                          <ToolbarButton type="button" onClick={() => startEditingBuiltInModel(model.id)}>
                                            Customize
                                          </ToolbarButton>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {selectedModelProvider?.models
                                  .filter((model) => !builtInProviderModels.some((builtIn) => builtIn.id === model.id))
                                  .map((model) => (
                                    <div key={model.id} className="group ui-list-row ui-list-row-hover justify-between px-2 py-2">
                                      <span className="min-w-0">
                                        <span className="block truncate font-mono text-[12px] font-medium text-primary">{model.id}</span>
                                        <span className="ui-card-meta block truncate">
                                          {model.contextWindow?.toLocaleString() ?? 'Unknown'} context ·{' '}
                                          {model.input.includes('image') ? 'text + images' : 'text'} · manually added
                                        </span>
                                      </span>
                                      <div className="flex flex-wrap gap-2">
                                        <ToolbarButton type="button" onClick={() => startEditingProviderModel(model.id)}>
                                          Edit
                                        </ToolbarButton>
                                        <ToolbarButton
                                          type="button"
                                          className="text-danger hover:text-danger"
                                          onClick={() => void handleDeleteProviderModel(model.id)}
                                        >
                                          <span aria-hidden="true">-</span>
                                          Remove
                                        </ToolbarButton>
                                      </div>
                                    </div>
                                  ))}
                                {builtInProviderModels.length === 0 && (selectedModelProvider?.models.length ?? 0) === 0 ? (
                                  <p className="text-[12px] text-dim">No models configured for this provider.</p>
                                ) : null}
                              </div>

                              {modelDraftMessage && <p className="text-[12px] text-success">{modelDraftMessage}</p>}
                              {modelDraftError && <p className="text-[12px] text-danger">{modelDraftError}</p>}

                              {editingModelId !== null && (
                                <form
                                  className="space-y-3 border-t border-border-subtle pt-4"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    void handleSaveProviderModel();
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h4 className="text-[13px] font-medium text-primary">
                                        {editingModelId === NEW_MODEL_ID
                                          ? 'Add model'
                                          : editingProviderModel
                                            ? `Edit ${editingProviderModel.id}`
                                            : `Customize ${modelDraft.id}`}
                                      </h4>
                                      <p className="ui-card-meta">
                                        Enter the model ID exactly as the provider expects it. Optional details can be filled in later.
                                      </p>
                                    </div>
                                    <ToolbarButton
                                      type="button"
                                      onClick={() => {
                                        setEditingModelId(null);
                                        setModelDraft(createModelEditorDraft(null));
                                        setModelDraftError(null);
                                        setModelDraftMessage(null);
                                      }}
                                      disabled={modelDraftAction !== null}
                                    >
                                      Cancel
                                    </ToolbarButton>
                                  </div>
                                  {editingModelId === NEW_MODEL_ID ? (
                                    <div className="flex flex-wrap gap-2">
                                      <span className="ui-subtle-pill">Try provider lookup first</span>
                                      <span className="ui-subtle-pill">Or paste a model ID</span>
                                    </div>
                                  ) : null}
                                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
                                    <div className="space-y-1.5 min-w-0">
                                      <label className="ui-card-meta" htmlFor="settings-provider-model-id">
                                        Model ID
                                      </label>
                                      <TextInput
                                        id="settings-provider-model-id"
                                        value={modelDraft.id}
                                        onChange={(event) => setModelDraft((current) => ({ ...current, id: event.target.value }))}
                                        className="font-mono text-[13px]"
                                        placeholder="provider/new-model-preview"
                                        autoComplete="off"
                                        spellCheck={false}
                                        disabled={modelDraftAction !== null || editingModelId !== NEW_MODEL_ID}
                                        autoFocus={editingModelId === NEW_MODEL_ID}
                                      />
                                    </div>
                                    <div className="space-y-1.5 min-w-0">
                                      <label className="ui-card-meta" htmlFor="settings-provider-model-context">
                                        Context window
                                      </label>
                                      <TextInput
                                        id="settings-provider-model-context"
                                        value={modelDraft.contextWindow}
                                        onChange={(event) =>
                                          setModelDraft((current) => ({ ...current, contextWindow: event.target.value }))
                                        }
                                        className="font-mono text-[13px]"
                                        inputMode="numeric"
                                        placeholder="128000"
                                        autoComplete="off"
                                        spellCheck={false}
                                        disabled={modelDraftAction !== null}
                                      />
                                    </div>
                                    <ToolbarButton type="submit" disabled={modelDraftAction !== null || modelDraft.id.trim().length === 0}>
                                      {modelDraftAction === 'save' ? 'Saving...' : editingModelId === NEW_MODEL_ID ? 'Add' : 'Save'}
                                    </ToolbarButton>
                                  </div>
                                  <Disclosure summary="More model settings">
                                    <div className="grid gap-4 pt-3 md:grid-cols-2">
                                      <div className="space-y-1.5 min-w-0">
                                        <label className="ui-card-meta" htmlFor="settings-provider-model-name">
                                          Display name
                                        </label>
                                        <TextInput
                                          id="settings-provider-model-name"
                                          value={modelDraft.name}
                                          onChange={(event) => setModelDraft((current) => ({ ...current, name: event.target.value }))}
                                          placeholder="Optional"
                                          disabled={modelDraftAction !== null}
                                        />
                                      </div>
                                      <div className="space-y-1.5 min-w-0">
                                        <label className="ui-card-meta" htmlFor="settings-provider-model-max-tokens">
                                          Max tokens
                                        </label>
                                        <TextInput
                                          id="settings-provider-model-max-tokens"
                                          value={modelDraft.maxTokens}
                                          onChange={(event) => setModelDraft((current) => ({ ...current, maxTokens: event.target.value }))}
                                          className="font-mono text-[13px]"
                                          inputMode="numeric"
                                          disabled={modelDraftAction !== null}
                                        />
                                      </div>
                                      <label
                                        className="inline-flex items-center gap-3 text-[13px] text-primary"
                                        htmlFor="settings-provider-model-reasoning"
                                      >
                                        <Checkbox
                                          id="settings-provider-model-reasoning"
                                          type="checkbox"
                                          checked={modelDraft.reasoning}
                                          onChange={(event) =>
                                            setModelDraft((current) => ({ ...current, reasoning: event.target.checked }))
                                          }
                                          disabled={modelDraftAction !== null}
                                        />
                                        <span>Reasoning capable</span>
                                      </label>
                                      <label
                                        className="inline-flex items-center gap-3 text-[13px] text-primary"
                                        htmlFor="settings-provider-model-images"
                                      >
                                        <Checkbox
                                          id="settings-provider-model-images"
                                          type="checkbox"
                                          checked={modelDraft.acceptsImages}
                                          onChange={(event) =>
                                            setModelDraft((current) => ({ ...current, acceptsImages: event.target.checked }))
                                          }
                                          disabled={modelDraftAction !== null}
                                        />
                                        <span>Accept images</span>
                                      </label>
                                    </div>
                                  </Disclosure>
                                </form>
                              )}
                            </>
                          ) : (
                            <p className="ui-card-meta">Select a provider, or type a provider id above, to edit its models.</p>
                          )}
                        </div>
                      </Disclosure>

                      <div className="order-1 space-y-3 min-w-0">
                        <div>
                          <h3 className="text-[15px] font-medium text-primary">Credentials</h3>
                        </div>

                        {modalProviderAuth ? (
                          <div className="space-y-2.5">
                            <p className="text-[12px] text-secondary">{formatProviderAuthStatus(modalProviderAuth)}</p>

                            {canProviderUseApiKey(modalProviderAuth) ? (
                              <div className="space-y-2 max-w-2xl">
                                <label className="ui-card-meta" htmlFor="settings-provider-api-key-modal">
                                  API key
                                </label>
                                <div className="flex min-w-0 gap-2">
                                  <TextInput
                                    id="settings-provider-api-key-modal"
                                    type="password"
                                    value={providerApiKey}
                                    onChange={(event) => {
                                      setProviderApiKey(event.target.value);
                                    }}
                                    placeholder="sk-... or op://Private/API key/password"
                                    autoComplete="off"
                                    spellCheck={false}
                                    disabled={providerCredentialAction !== null || oauthLoginState?.status === 'running'}
                                  />
                                  <IconButton
                                    type="button"
                                    onClick={() => {
                                      void handleSaveProviderApiKey();
                                    }}
                                    disabled={
                                      providerCredentialAction !== null ||
                                      oauthLoginState?.status === 'running' ||
                                      providerApiKey.trim().length === 0
                                    }
                                    aria-label="Save API key"
                                    title="Save API key"
                                  >
                                    {providerCredentialAction === 'saveKey' ? '...' : <SettingsIcon name="check" />}
                                  </IconButton>
                                </div>
                              </div>
                            ) : null}

                            <div className="flex flex-wrap gap-2">
                              {modalProviderAuth.oauthSupported && (
                                <ToolbarButton
                                  type="button"
                                  onClick={() => {
                                    void handleStartProviderOAuthLogin();
                                  }}
                                  disabled={
                                    providerCredentialAction !== null || oauthAction !== null || selectedProviderLogin?.status === 'running'
                                  }
                                  className="inline-flex items-center gap-2"
                                  aria-label={`Start OAuth login (${modalProviderAuth.id})`}
                                  title={`Start OAuth login (${modalProviderAuth.id})`}
                                >
                                  {oauthAction === 'start' ? (
                                    'Starting...'
                                  ) : (
                                    <>
                                      <SettingsIcon name="external" />
                                      OAuth Login
                                    </>
                                  )}
                                </ToolbarButton>
                              )}
                            </div>

                            {selectedProviderLogin?.status === 'running' && (
                              <div className="space-y-2 border-t border-border-subtle pt-3">
                                <p className="text-[12px] text-secondary">
                                  {selectedProviderLogin.deviceCode
                                    ? 'OAuth login started. Copy the device code below, then open the verification page and paste it there.'
                                    : 'OAuth login started.'}
                                  {!selectedProviderLogin.deviceCode && selectedProviderLogin.authUrl ? (
                                    <>
                                      {' '}
                                      <a
                                        href={selectedProviderLogin.authUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={selectedProviderLogin.authUrl}
                                        className="underline text-interactive hover:text-interactive-hover"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          window.open(selectedProviderLogin.authUrl, '_blank');
                                        }}
                                      >
                                        Open authorization page
                                      </a>
                                      .
                                    </>
                                  ) : (
                                    ''
                                  )}
                                </p>
                                {selectedProviderLogin.progress.length > 0 && (
                                  <p className="text-[12px] text-secondary">Waiting for authorization...</p>
                                )}
                                {selectedProviderLogin.deviceCode && (
                                  <div className="space-y-3 border-t border-border-subtle pt-3">
                                    <div className="space-y-1.5">
                                      <p className="text-[12px] font-medium text-primary">1. Copy this device code</p>
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p
                                          id="settings-provider-oauth-device-code"
                                          className="select-all font-mono text-[30px] font-semibold leading-tight tracking-wide text-primary"
                                        >
                                          {selectedProviderLogin.deviceCode.userCode}
                                        </p>
                                        <ToolbarButton
                                          type="button"
                                          onClick={() => {
                                            void handleCopyProviderOAuthUrl(selectedProviderLogin.deviceCode?.userCode ?? '');
                                          }}
                                          disabled={oauthAction !== null}
                                        >
                                          Copy code
                                        </ToolbarButton>
                                      </div>
                                    </div>
                                    <div className="space-y-1.5">
                                      <p className="text-[12px] font-medium text-primary">
                                        2. Open the verification page and paste the code
                                      </p>
                                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                        <a
                                          href={selectedProviderLogin.deviceCode.verificationUri}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={selectedProviderLogin.deviceCode.verificationUri}
                                          className="min-w-0 truncate text-[12px] text-interactive underline hover:text-interactive-hover"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            void handleOpenProviderOAuthUrl(selectedProviderLogin.deviceCode?.verificationUri ?? '');
                                          }}
                                        >
                                          {selectedProviderLogin.deviceCode.verificationUri}
                                        </a>
                                        <ToolbarButton
                                          type="button"
                                          onClick={() => {
                                            void handleOpenProviderOAuthUrl(selectedProviderLogin.deviceCode?.verificationUri ?? '');
                                          }}
                                          disabled={oauthAction !== null}
                                        >
                                          Open page
                                        </ToolbarButton>
                                      </div>
                                      {typeof selectedProviderLogin.deviceCode.expiresInSeconds === 'number' && (
                                        <p className="text-[12px] text-secondary">
                                          Code expires in {selectedProviderLogin.deviceCode.expiresInSeconds} seconds.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {!selectedProviderLogin.deviceCode && selectedProviderLogin.authUrl && (
                                  <div className="ui-flat-panel space-y-2 p-2.5">
                                    <label className="ui-card-meta" htmlFor="settings-provider-oauth-url">
                                      OAuth login URL
                                    </label>
                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                                      <TextInput
                                        id="settings-provider-oauth-url"
                                        value={selectedProviderLogin.authUrl}
                                        readOnly
                                        spellCheck={false}
                                        onFocus={(event) => {
                                          event.currentTarget.select();
                                        }}
                                      />
                                      <div className="flex shrink-0 gap-2">
                                        <ToolbarButton
                                          type="button"
                                          onClick={() => {
                                            void handleOpenProviderOAuthUrl(selectedProviderLogin.authUrl);
                                          }}
                                          disabled={oauthAction !== null}
                                        >
                                          Open
                                        </ToolbarButton>
                                        <ToolbarButton
                                          type="button"
                                          onClick={() => {
                                            void handleCopyProviderOAuthUrl(selectedProviderLogin.authUrl);
                                          }}
                                          disabled={oauthAction !== null}
                                        >
                                          <span aria-hidden="true">⧉</span>
                                          Copy
                                        </ToolbarButton>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {selectedProviderLogin.prompt && (
                                  <div className="space-y-2">
                                    <p className="ui-card-meta">Login method</p>
                                    <p className="text-[12px] leading-5 text-secondary">{selectedProviderLogin.prompt.message}</p>
                                    {oauthPromptOptions.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {oauthPromptOptions.map((option) => (
                                          <ToolbarButton
                                            key={option.id}
                                            type="button"
                                            onClick={() => {
                                              setOauthError(null);
                                              setOauthAction('submit');
                                              api
                                                .submitProviderOAuthLoginInput(selectedProviderLogin.id, option.id)
                                                .then((login) => {
                                                  setOauthLoginState(login);
                                                  setOauthInputValue('');
                                                })
                                                .catch((error: unknown) => {
                                                  setOauthError(formatProviderOAuthError(error, 'submit'));
                                                })
                                                .finally(() => {
                                                  setOauthAction(null);
                                                });
                                            }}
                                            disabled={oauthAction !== null}
                                            className="capitalize"
                                          >
                                            {oauthAction === 'submit' ? 'Submitting...' : option.label}
                                          </ToolbarButton>
                                        ))}
                                      </div>
                                    ) : (
                                      <form
                                        className="flex flex-col gap-2 sm:flex-row sm:items-end"
                                        onSubmit={(event) => {
                                          event.preventDefault();
                                          void handleSubmitProviderOAuthInput();
                                        }}
                                      >
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                          <label className="ui-card-meta" htmlFor="settings-provider-oauth-input">
                                            Authorization code
                                          </label>
                                          <TextInput
                                            id="settings-provider-oauth-input"
                                            value={oauthInputValue}
                                            onChange={(event) => {
                                              setOauthInputValue(event.target.value);
                                            }}
                                            placeholder={selectedProviderLogin.prompt.placeholder || 'Enter code...'}
                                            autoComplete="off"
                                            disabled={oauthAction !== null}
                                          />
                                        </div>
                                        <ToolbarButton
                                          type="submit"
                                          disabled={
                                            oauthAction !== null ||
                                            (!selectedProviderLogin.prompt.allowEmpty && oauthInputValue.trim().length === 0)
                                          }
                                        >
                                          {oauthAction === 'submit' ? 'Submitting...' : 'Submit'}
                                        </ToolbarButton>
                                      </form>
                                    )}
                                  </div>
                                )}
                                <ToolbarButton
                                  type="button"
                                  onClick={() => {
                                    void handleCancelProviderOAuthLogin();
                                  }}
                                  disabled={oauthAction !== null}
                                >
                                  {oauthAction === 'cancel' ? 'Cancelling...' : 'Cancel OAuth login'}
                                </ToolbarButton>
                              </div>
                            )}
                          </div>
                        ) : editableModelProviderId ? (
                          <p className="ui-card-meta">Save or select the provider before managing stored credentials.</p>
                        ) : (
                          <p className="ui-card-meta">Choose or create a provider first.</p>
                        )}

                        {providerCredentialNotice && <p className="text-[12px] text-success">{providerCredentialNotice}</p>}
                        {providerCredentialError && <p className="text-[12px] text-danger">{providerCredentialError}</p>}
                        {oauthError && <p className="text-[12px] text-danger">{oauthError}</p>}
                        {selectedProviderLogin?.status === 'failed' && selectedProviderLogin.error && (
                          <p className="text-[12px] text-danger">{formatProviderOAuthError(selectedProviderLogin.error, 'failed')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {modelProviderState && (
                  <div className="space-y-2">
                    <h3 className="settings-page-subsection-title">Configured providers</h3>
                    {configuredProviderSummaries.length > 0 ? (
                      <div className="settings-page-provider-list">
                        {configuredProviderSummaries.map((provider) => {
                          const selected = provider.id === selectedModelProviderId || provider.id === selectedProviderId;
                          const providerLabel = formatProviderMenuLabel(
                            provider.id,
                            provider.auth,
                            configuredProviderSummaries.map((summary) => summary.id),
                          );
                          return (
                            <RowButton
                              key={provider.id}
                              onClick={() => {
                                if (provider.modelProvider) {
                                  selectModelProvider(provider.id);
                                } else {
                                  startNewModelProvider(provider.id, 'provider');
                                }
                              }}
                              selected={selected}
                              className={cx(
                                'settings-page-provider-row group flex w-full items-center justify-between gap-4',
                                selected && 'settings-page-provider-row-selected',
                              )}
                              aria-pressed={selected}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-medium text-primary">{providerLabel}</span>
                                <span className="ui-card-meta block truncate">
                                  {provider.modelProvider
                                    ? `Advanced name: ${provider.id} · ${formatModelProviderSummary(provider.modelProvider)}`
                                    : `Advanced name: ${provider.id} · ${formatProviderAuthStatus(provider.auth)}`}
                                </span>
                              </span>
                              {provider.modelProvider?.baseUrl && (
                                <span className="ui-card-meta hidden max-w-[320px] truncate text-right xl:block">
                                  {provider.modelProvider.baseUrl}
                                </span>
                              )}
                            </RowButton>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="settings-page-provider-list">
                        <div className="settings-page-provider-empty-row flex items-center justify-between gap-4">
                          <span className="text-[12px] text-secondary">No configured providers</span>
                          <span className="text-[12px] text-dim">Use Add provider</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            </SettingsGroup>
          </div>
        </SettingsSection>

        <SettingsSection id="settings-desktop" label="Desktop" description="Desktop app behavior and diagnostics.">
          <DesktopConnectionsSettingsPanel />
          <DesktopKeyboardShortcutsSettingsSection />
          <TelemetryLogsSettingsPanel />
        </SettingsSection>
      </div>
    </div>
  );

  const settingsContent = isWindowedSettingsSurface ? (
    <WindowedPageShell layout="two-column" className="settings-page-windowed">
      <WindowedPageRail title="Settings sections" accent="settings" showHeader={false} className="settings-page-windowed-nav">
        <WindowedList>
          {settingsNavLinks.flatMap((item) => {
            const rootItem = (
              <WindowedListItem
                key={item.id}
                title={settingsQuickLinkLabelText(item.label)}
                active={item.id === effectiveActiveQuickLinkId}
                accent="settings"
                onSelect={() => focusSettingsSection(item)}
              />
            );
            const showChildren =
              item.children &&
              item.children.length > 0 &&
              (item.id === activeRootSectionId || item.children.some((child) => child.id === effectiveActiveQuickLinkId));
            if (!showChildren) return [rootItem];
            return [
              rootItem,
              ...item.children.map((child) => (
                <WindowedListItem
                  key={child.id}
                  title={settingsQuickLinkLabelText(child.label)}
                  active={child.id === effectiveActiveQuickLinkId}
                  accent="extensions"
                  depth={1}
                  onSelect={() => focusSettingsSection(child)}
                />
              )),
            ];
          })}
        </WindowedList>
      </WindowedPageRail>
      <WindowedPageMain title={activeSectionTitle}>
        <div ref={settingsScrollRef} className="settings-page-windowed-scroll h-full min-h-0 overflow-y-auto">
          {settingsSections}
        </div>
      </WindowedPageMain>
    </WindowedPageShell>
  ) : (
    <div ref={settingsScrollRef} className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="settings-page-shell" contentClassName="settings-page-main">
        {settingsSections}
      </AppPageLayout>
    </div>
  );

  return (
    <VisibleSettingsSectionsContext.Provider value={renderedSectionIds}>
      <HideSettingsSectionHeadingsContext.Provider value={isWindowedSettingsSurface}>
        {settingsContent}
      </HideSettingsSectionHeadingsContext.Provider>
    </VisibleSettingsSectionsContext.Provider>
  );
}
