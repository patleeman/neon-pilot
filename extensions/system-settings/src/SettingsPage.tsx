import {
  api,
  AppPageIntro,
  AppPageLayout,
  AppPageToc,
  type AppTelemetryLogBundleExport,
  type AppTelemetryLogDiagnostics,
  Checkbox,
  type ColorTheme,
  createDesktopAwareEventSource,
  createModelEditorDraft,
  createProviderEditorDraft,
  Button,
  cx,
  type DesktopAppPreferencesState,
  type DesktopEnvironmentState,
  Disclosure,
  EXTENSION_REGISTRY_CHANGED_EVENT,
  type ExtensionKeybindingRegistration,
  formatContextWindowLabel,
  formatThinkingLevelLabel,
  getDesktopBridge,
  groupModelsByProvider,
  IconButton,
  isDesktopShell,
  KeyboardShortcutCaptureInput,
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
  type ProviderEditorDraft,
  type ProviderOAuthLoginState,
  type ProviderOAuthLoginStreamEvent,
  readDesktopEnvironment,
  RowButton,
  type SecretsState,
  type SecretStatusEntry,
  SearchInput,
  SegmentedControl,
  Select,
  SettingsField,
  SettingsPanel,
  SettingsPanelHost,
  subscribeDesktopProviderOAuthLogin,
  SwatchOption,
  type TelemetryDbMaintenanceResult,
  TextButton,
  Textarea,
  TextInput,
  type ThemeAccent,
  type ThemePreference,
  THINKING_LEVEL_OPTIONS,
  ToolbarButton,
  UnifiedSettingsEntry,
  useApi,
  useExtensionRegistry,
  useTheme,
  formatKeyboardShortcutLabel,
} from '@neon-pilot/extensions/settings';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

const SETTINGS_QUICK_LINKS = [
  { id: 'settings-appearance', label: 'Appearance', summary: 'Theme, accent, and visual defaults' },
  { id: 'settings-providers', label: 'Providers', summary: 'Models, overrides, and credentials' },
  { id: 'settings-conversation', label: 'Conversation', summary: 'Model and behavior defaults' },
  { id: 'settings-workspace', label: 'Workspace', summary: 'Default cwd and local context' },
  { id: 'settings-commands', label: 'Commands', summary: 'Command palette actions and keyboard shortcuts' },
  { id: 'settings-security', label: 'Security', summary: 'Secret storage and extension credentials' },
  { id: 'settings-extensions', label: 'Extensions', summary: 'Preferences declared by installed extensions' },
  { id: 'settings-desktop', label: 'Desktop', summary: 'App behavior, remotes, and keyboard shortcuts' },
] as const satisfies readonly { id: string; label: string; summary: string }[];

type SettingsQuickLink = { id: string; label: string; summary: string };
type SettingsQuickLinkId = string;
const VisibleSettingsSectionsContext = createContext<ReadonlySet<SettingsQuickLinkId> | null>(null);
type ModelOption = ModelState['models'][number];
type SettingsIconName = 'check' | 'edit' | 'external' | 'key' | 'plus' | 'refresh' | 'trash' | 'x';

interface CliInstallStatus {
  target: string;
  binDir: string;
  linkPath: string;
  globallyInstalled: boolean;
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

const DESKTOP_KEYBOARD_SHORTCUT_LABELS: Record<DesktopKeyboardShortcutId, { label: string; description: string }> = {
  showApp: { label: 'Show Neon Pilot', description: 'Bring the desktop window forward.' },
  newConversation: { label: 'New conversation', description: 'Start a fresh chat.' },
  closeTab: { label: 'Close tab', description: 'Close the active conversation tab.' },
  reopenClosedTab: { label: 'Reopen closed tab', description: 'Restore the most recently closed conversation tab.' },
  previousConversation: { label: 'Previous conversation', description: 'Move to the previous open conversation.' },
  nextConversation: { label: 'Next conversation', description: 'Move to the next open conversation.' },
  togglePinned: { label: 'Toggle pinned', description: 'Pin or unpin the active conversation.' },
  archiveRestoreConversation: { label: 'Archive / restore', description: 'Archive or restore the active conversation.' },
  renameConversation: { label: 'Rename conversation', description: 'Rename the active conversation.' },
  focusComposer: { label: 'Focus composer', description: 'Move focus to the message composer.' },
  editWorkingDirectory: { label: 'Edit working directory', description: 'Open the working-directory editor.' },
  findOnPage: { label: 'Find on page', description: 'Search text in the current page.' },
  settings: { label: 'Settings', description: 'Open this settings page.' },
  quit: { label: 'Quit', description: 'Quit the desktop app.' },
  conversationMode: { label: 'Hide workbench', description: 'Show the normal chat layout.' },
  workbenchMode: { label: 'Show workbench', description: 'Show the chat and workbench layout.' },
  toggleSidebar: { label: 'Toggle left sidebar', description: 'Collapse or restore the conversation sidebar.' },
  toggleRightRail: { label: 'Toggle workbench', description: 'Collapse or restore the workbench panel.' },
};

const DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS: DesktopAppPreferencesState['keyboardShortcuts'] = {
  showApp: 'CommandOrControl+Shift+A',
  newConversation: 'CommandOrControl+N',
  closeTab: 'CommandOrControl+W',
  reopenClosedTab: 'Command+Shift+N',
  previousConversation: 'CommandOrControl+[',
  nextConversation: 'CommandOrControl+]',
  togglePinned: 'CommandOrControl+Alt+P',
  archiveRestoreConversation: 'CommandOrControl+Alt+A',
  renameConversation: 'CommandOrControl+Alt+R',
  focusComposer: 'CommandOrControl+L',
  editWorkingDirectory: 'CommandOrControl+Shift+L',
  findOnPage: 'CommandOrControl+F',
  settings: 'CommandOrControl+,',
  quit: 'CommandOrControl+Q',
  conversationMode: 'F1',
  workbenchMode: 'F2',
  toggleSidebar: 'CommandOrControl+/',
  toggleRightRail: 'CommandOrControl+\\',
};

const DESKTOP_KEYBOARD_SHORTCUT_IDS = Object.keys(DESKTOP_KEYBOARD_SHORTCUT_LABELS) as DesktopKeyboardShortcutId[];

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

interface CommandSettingsEntry {
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

function normalizeShortcutForConflict(shortcut: string): string {
  return shortcut
    .trim()
    .toLowerCase()
    .replace(/commandorcontrol|cmdorctrl|cmd|command/g, 'mod')
    .replace(/control/g, 'ctrl');
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
function formatModelProviderSummary(provider: ModelProviderConfig): string {
  if (provider.models.length === 0) {
    return 'Provider override only';
  }

  return `${provider.models.length} ${provider.models.length === 1 ? 'model' : 'models'}`;
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

function formatProviderAuthStatus(provider: ProviderAuthSummary | null): string {
  if (!provider) {
    return 'No provider selected.';
  }

  switch (provider.authType) {
    case 'api_key':
      return provider.hasStoredCredential ? 'Stored API key in secure provider secrets.' : 'API key is available at runtime.';
    case 'oauth':
      return provider.hasStoredCredential
        ? 'Logged in with OAuth credentials saved in auth.json.'
        : 'OAuth credentials are available at runtime.';
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

function ThemeDefaultSelect({
  label,
  value,
  themes,
  onChange,
}: {
  label: string;
  value: string;
  themes: ColorTheme[];
  onChange: (theme: string) => void;
}) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-secondary">
      <span>{label}</span>
      <span className="relative block">
        <Select
          className="h-9 min-w-0 truncate bg-surface/70 pr-9 text-[12px] font-medium"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </Select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim"
        >
          <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      </span>
    </label>
  );
}

function SettingsSection({
  id,
  label,
  description,
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
  if (visibleSections && !visibleSections.has(id)) {
    return null;
  }

  const sectionOrder = SETTINGS_QUICK_LINKS.findIndex((item) => item.id === id);

  return (
    <section
      id={id}
      style={{ order: sectionOrder === -1 ? 1000 : sectionOrder }}
      className={cx('scroll-mt-24 space-y-8 border-t border-border-subtle pt-10 first:border-t-0 first:pt-0', className)}
    >
      <div className="max-w-2xl space-y-2">
        <h2 className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-primary">{label}</h2>
        {description ? <p className="text-[14px] leading-6 text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function formatDesktopUpdateSummary(state: DesktopAppPreferencesState | null): string {
  if (!state || !state.available) {
    return 'Desktop app settings are unavailable in this window.';
  }

  const update = state.update;
  if (!update.supported) {
    return 'Update checks are only available in packaged desktop builds.';
  }

  switch (update.status) {
    case 'checking':
      return 'Checking for updates…';
    case 'downloading':
      return update.availableVersion ? `Downloading Neon Pilot ${update.availableVersion}…` : 'Downloading the latest Neon Pilot build…';
    case 'ready':
      return update.downloadedVersion
        ? state.autoInstallUpdates
          ? `Neon Pilot ${update.downloadedVersion} is ready and will install automatically.`
          : `Neon Pilot ${update.downloadedVersion} is ready. Quit the app to finish installing it.`
        : `Current version: ${update.currentVersion}.`;
    case 'installing':
      return update.downloadedVersion ? `Installing Neon Pilot ${update.downloadedVersion}…` : 'Installing the downloaded update…';
    case 'error':
      return update.lastError ? `Update error: ${update.lastError}` : 'The last update action failed.';
    case 'idle':
    default:
      return `Current version: ${update.currentVersion}.`;
  }
}

function formatStartOnSystemStartSummary(state: DesktopAppPreferencesState | null): string {
  if (!state || !state.available) {
    return 'Desktop app settings are unavailable in this window.';
  }

  if (!state.supportsStartOnSystemStart) {
    return 'Start on system start is only available in packaged desktop builds.';
  }

  return state.startOnSystemStart
    ? 'Neon Pilot will launch in the background when you sign in to this Mac.'
    : 'Neon Pilot only starts when you open it manually.';
}

export function DesktopKeyboardShortcutsSettingsSection() {
  const [preferencesState, setPreferencesState] = useState<DesktopAppPreferencesState | null>(null);
  const [draft, setDraft] = useState<DesktopAppPreferencesState['keyboardShortcuts']>(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS);
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
      owner: keybinding.extensionId.replace(/^system-/, ''),
      label: keybinding.title,
      description: keybinding.scope === 'surface' ? 'Surface shortcut' : 'Extension shortcut',
      shortcuts: keybinding.enabled ? keybinding.keys : [],
      editable: true,
      conflictScope: keybinding.scope === 'surface' ? (`surface:${keybinding.extensionId}` as const) : ('global' as const),
      extensionId: keybinding.extensionId,
      keybindingId: keybinding.surfaceId,
      enabled: keybinding.enabled,
      defaultShortcuts: keybinding.defaultKeys,
    }));
    return [...coreItems, ...extensionItems];
  }, [draft, extensionKeybindings]);

  const duplicateShortcut = useMemo(() => {
    const seen = new Map<string, ShortcutListItem>();
    for (const item of shortcutItems) {
      for (const shortcut of item.shortcuts) {
        const normalized = `${item.conflictScope}:${normalizeShortcutForConflict(shortcut)}`;
        const previous = seen.get(normalized);
        if (previous) return { shortcut, first: previous, second: item };
        seen.set(normalized, item);
      }
    }
    return null;
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

  async function saveKeyboardShortcuts(nextShortcuts = draft) {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setError('Desktop bridge unavailable. Restart the desktop app and try again.');
      return;
    }

    // Pre-save duplicate check: reject before calling the API so a conflict
    // isn't persisted before the next render can surface the warning.
    const shortcutValues = Object.values(nextShortcuts).filter((s): s is string => typeof s === 'string' && s.length > 0);
    const seenShortcuts = new Set<string>();
    for (const value of shortcutValues) {
      if (seenShortcuts.has(value)) {
        setError(`Duplicate shortcut: ${value} is already assigned.`);
        return;
      }
      seenShortcuts.add(value);
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
    <SettingsPanel title="Keyboard shortcuts" description="Every desktop menu shortcut is configurable and auto-saves immediately.">
      {loading ? <p className="ui-card-meta">Loading keyboard shortcuts…</p> : null}
      {!loading && !preferencesState ? <p className="ui-card-meta">Keyboard shortcuts are available in the desktop app.</p> : null}
      {preferencesState ? (
        <div className="space-y-4">
          <div className="divide-y divide-border-subtle/70">
            {shortcutItems.map((item) => {
              const editableId = item.extensionId ? null : item.editable ? (item.id as DesktopKeyboardShortcutId) : null;
              const shortcutValue = item.extensionId
                ? (item.shortcuts[0] ?? item.defaultShortcuts?.[0] ?? '')
                : editableId
                  ? draft[editableId]
                  : '';
              return (
                <div key={item.id} className="grid gap-3 py-3 first:pt-0 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center">
                  <span className="min-w-0 space-y-1">
                    <span className="block text-[13px] font-medium text-primary">{item.label}</span>
                    <span className="block text-[12px] leading-5 text-secondary">
                      {item.owner}
                      {item.description ? ` · ${item.description}` : ''}
                    </span>
                  </span>
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
                            void saveKeyboardShortcuts(nextDraft);
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
                </div>
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
            <span className="ui-card-meta">{saving ? 'Saving…' : dirty ? 'Unsaved change pending…' : 'Auto-saved'}</span>
            <ToolbarButton
              type="button"
              onClick={() => {
                setDraft(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS);
                void saveKeyboardShortcuts(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS);
              }}
              disabled={saving || duplicateShortcut !== null}
            >
              Reset to defaults
            </ToolbarButton>
          </div>
        </div>
      ) : null}
    </SettingsPanel>
  );
}

export function CommandsSettingsSection() {
  const [commands, setCommands] = useState<CommandSettingsEntry[]>([]);
  const [keybindings, setKeybindings] = useState<CommandKeybindingSettingsEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCommands, nextKeybindings] = await Promise.all([api.extensionCommands(), api.extensionKeybindings()]);
      setCommands(nextCommands as CommandSettingsEntry[]);
      setKeybindings(nextKeybindings as CommandKeybindingSettingsEntry[]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<CommandWithKeybindings[]>(() => {
    return commands.map((command) => {
      const matches = keybindings.filter((keybinding) => keybindingMatchesCommandSetting(keybinding, command));
      return { ...command, keybindings: matches.length ? matches : [emptyKeybindingForCommand(command)] };
    });
  }, [commands, keybindings]);

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
    if (!keys.length) {
      setError('Shortcut cannot be blank. Disable the keybinding instead.');
      return;
    }
    const id = keybindingSettingId(keybinding);
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await api.updateExtensionKeybinding(keybinding.extensionId, keybinding.surfaceId, {
        title: keybinding.title,
        command: keybinding.command,
        args: keybinding.args,
        scope: keybinding.scope,
        packageType: keybinding.packageType,
        keys,
        enabled: true,
      });
      await load();
      setDrafts((current) => ({ ...current, [id]: keys.join(', ') }));
      setNotice('Saved shortcut.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
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
        title: keybinding.title,
        command: keybinding.command,
        args: keybinding.args,
        scope: keybinding.scope,
        packageType: keybinding.packageType,
        enabled: !keybinding.enabled,
      });
      await load();
      setNotice(keybinding.enabled ? 'Disabled shortcut.' : 'Enabled shortcut.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands…" />
      {loading ? <p className="ui-card-meta">Loading commands…</p> : null}
      <div className="divide-y divide-border-subtle/70">
        {visibleRows.map((command) => (
          <div key={commandDisplayId(command)} className="grid gap-3 py-3 first:pt-0 sm:grid-cols-[minmax(0,1fr)_22rem] sm:items-start">
            <div className="min-w-0 space-y-1">
              <div className="text-[13px] font-medium text-primary">{command.title ?? commandDisplayId(command)}</div>
              <div className="font-mono text-[11px] text-dim">{commandDisplayId(command)}</div>
              <div className="text-[12px] text-secondary">
                {command.category ?? 'Command'} · {command.extensionId ?? 'host'}
              </div>
            </div>
            <div className="space-y-2">
              {command.keybindings.map((keybinding) => {
                const id = keybindingSettingId(keybinding);
                const value = drafts[id] ?? keybinding.keys.join(', ');
                const busy = busyId === id;
                return (
                  <div key={id} className="relative">
                    <KeyboardShortcutCaptureInput
                      id={`settings-command-keybinding-${id}`}
                      value={keybinding.enabled ? value : ''}
                      placeholder={keybinding.enabled ? 'Click to record shortcut' : 'Shortcut disabled'}
                      disabled={busy}
                      reservedHint="Some shortcuts (Cmd+Q, Cmd+W, Cmd+N) are reserved by the app and cannot be captured here. Use the desktop app menu to change them."
                      onChange={(shortcut) => {
                        setDrafts((current) => ({ ...current, [id]: shortcut }));
                        void saveKeybinding(keybinding, shortcut);
                      }}
                    />
                    <IconButton
                      compact
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[15px]"
                      disabled={busy}
                      aria-label={keybinding.enabled ? `Clear shortcut for ${keybinding.title}` : `Enable shortcut for ${keybinding.title}`}
                      title={keybinding.enabled ? 'Clear shortcut' : 'Enable shortcut'}
                      onClick={() => void toggleKeybinding(keybinding)}
                    >
                      {keybinding.enabled ? '×' : '+'}
                    </IconButton>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!loading && visibleRows.length === 0 ? <p className="ui-card-meta">No commands match that search.</p> : null}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {notice ? <p className="text-[12px] text-success">{notice}</p> : null}
    </div>
  );
}

function commandDisplayId(command: CommandSettingsEntry): string {
  const id = command.id ?? command.surfaceId ?? 'unknown';
  return command.extensionId ? `${command.extensionId}.${id}` : id;
}

function keybindingSettingId(keybinding: Pick<CommandKeybindingSettingsEntry, 'extensionId' | 'surfaceId'>): string {
  return `${keybinding.extensionId}:${keybinding.surfaceId}`;
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

function emptyKeybindingForCommand(command: CommandSettingsEntry): CommandKeybindingSettingsEntry {
  const commandId = commandDisplayId(command);
  return {
    extensionId: command.extensionId ?? 'host',
    surfaceId: `command:${commandId}`,
    packageType: command.extensionId ? (command.packageType ?? 'user') : 'system',
    title: command.title ?? commandId,
    keys: [],
    command: commandId,
    args: command.args,
    scope: 'global',
    defaultKeys: [],
    enabled: true,
  };
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
    const bridge = getDesktopBridge() as { openPath?: (targetPath: string) => Promise<{ ok?: boolean; error?: string }> } | null;
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
        `Pruned ${result.appTelemetry.deletedRows} app telemetry rows and ${traceDeleted} trace rows, then vacuumed ${result.appTelemetry.dbPath}.`,
      );
    } catch (nextError) {
      setNotice(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setAction(null);
    }
  }, []);

  return (
    <SettingsPanel
      title="Telemetry logs"
      description="Local diagnostics and troubleshooting exports."
      actions={
        <>
          <ToolbarButton type="button" onClick={openLogFolder} disabled={!data?.logDir || action !== null}>
            {action === 'open' ? 'Opening…' : 'Open log folder'}
          </ToolbarButton>
          <ToolbarButton type="button" onClick={exportLogs} disabled={action !== null}>
            {action === 'export' ? 'Exporting…' : 'Export diagnostics bundle'}
          </ToolbarButton>
          <ToolbarButton type="button" onClick={maintainTelemetryDb} disabled={action !== null}>
            {action === 'maintain' ? 'Cleaning…' : 'Clean up telemetry index'}
          </ToolbarButton>
        </>
      }
    >
      {loading ? <p className="ui-card-meta">Loading telemetry log details…</p> : null}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {data ? (
        <div className="space-y-3">
          <div className="grid gap-2 text-[13px] text-secondary sm:grid-cols-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-dim">Files</div>
              <div className="text-primary">{data.fileCount}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-dim">Size</div>
              <div className="text-primary">{formatTelemetryLogBytes(data.sizeBytes)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-dim">Location</div>
              <div className="truncate font-mono text-[12px] text-primary" title={data.logDir}>
                {data.logDir}
              </div>
            </div>
          </div>
          {data.files.length > 0 ? (
            <div className="space-y-1.5">
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
            <p className="ui-card-meta">No telemetry log files yet.</p>
          )}
        </div>
      ) : null}
      {notice ? <p className="ui-card-meta break-words">{notice}</p> : null}
    </SettingsPanel>
  );
}

function SettingsTableOfContents({
  items,
  activeId,
  onNavigate,
}: {
  items: readonly SettingsQuickLink[];
  activeId: SettingsQuickLinkId;
  onNavigate: (sectionId: SettingsQuickLinkId) => void;
}) {
  return <AppPageToc items={items} activeId={activeId} onNavigate={onNavigate} ariaLabel="Settings sections" />;
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
    <SettingsPanel
      title="Command line"
      description="Global shell launcher for Neon Pilot administration."
      actions={
        <>
          <ToolbarButton type="button" onClick={() => void refresh()} disabled={action !== null}>
            {action === 'refresh' ? 'Refreshing...' : 'Refresh'}
          </ToolbarButton>
          {status?.globallyInstalled ? (
            <ToolbarButton type="button" onClick={() => void runCliAction('uninstall')} disabled={action !== null}>
              {action === 'uninstall' ? 'Removing...' : 'Uninstall'}
            </ToolbarButton>
          ) : (
            <ToolbarButton type="button" className="text-accent" onClick={() => void runCliAction('install')} disabled={action !== null}>
              {action === 'install' ? 'Installing...' : 'Install'}
            </ToolbarButton>
          )}
        </>
      }
    >
      {status ? (
        <div className="space-y-2 text-[13px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={status.globallyInstalled ? 'text-success' : 'text-secondary'}>
              {status.globallyInstalled ? 'Installed' : 'Not installed'}
            </span>
            <code className="break-all text-secondary">{status.linkPath}</code>
          </div>
          <p className="ui-card-meta break-all">Target: {status.target}</p>
        </div>
      ) : (
        <p className="ui-card-meta">Loading CLI status...</p>
      )}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
    </SettingsPanel>
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
    <div className="space-y-0">
      <SettingsPanel title="App behavior" description="Control how the menu bar app starts and how downloaded updates install.">
        {!getDesktopBridge() && isDesktopShell() ? (
          <p className="text-[12px] text-danger">Desktop bridge unavailable. Restart the desktop app and try again.</p>
        ) : null}
        {appPreferencesState ? (
          <div className="space-y-4">
            <label className="inline-flex items-center gap-3 text-[14px] text-primary" htmlFor="desktop-auto-install-updates">
              <Checkbox
                id="desktop-auto-install-updates"
                type="checkbox"
                checked={appPreferencesState.autoInstallUpdates}
                onChange={(event) => {
                  void handleUpdateAppPreferences({ autoInstallUpdates: event.target.checked });
                }}
                disabled={action !== null || !appPreferencesState.update.supported}
              />
              <span>Install downloaded updates automatically</span>
            </label>
            <p className="ui-card-meta break-words">{formatDesktopUpdateSummary(appPreferencesState)}</p>

            <div className="space-y-2">
              <label className="block text-[12px] font-medium text-secondary" htmlFor="desktop-update-path">
                Update path
              </label>
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
              <p className="ui-card-meta break-words">
                Stable follows production releases. Test allows release candidates and pre-release builds for early validation.
              </p>
            </div>

            <label className="inline-flex items-center gap-3 text-[14px] text-primary" htmlFor="desktop-start-on-system-start">
              <Checkbox
                id="desktop-start-on-system-start"
                type="checkbox"
                checked={appPreferencesState.startOnSystemStart}
                onChange={(event) => {
                  void handleUpdateAppPreferences({ startOnSystemStart: event.target.checked });
                }}
                disabled={action !== null || !appPreferencesState.supportsStartOnSystemStart}
              />
              <span>Start Neon Pilot when you sign in</span>
            </label>
            <p className="ui-card-meta break-words">{formatStartOnSystemStartSummary(appPreferencesState)}</p>
          </div>
        ) : (
          <p className="ui-card-meta">Loading desktop app settings…</p>
        )}
        {appPreferencesError ? <p className="text-[12px] text-danger">{appPreferencesError}</p> : null}
      </SettingsPanel>
      <NeonPilotCliSettingsPanel />
    </div>
  );
}

function formatInjectedExtensionDescription(entries: UnifiedSettingsEntry[]): ReactNode {
  const extensionIds = [...new Set(entries.map((entry) => entry.extensionId).filter(Boolean))];
  if (extensionIds.length === 0) return null;

  return (
    <>
      Injected by{' '}
      {extensionIds.map((extensionId, index) => (
        <span key={extensionId}>
          {index > 0 ? ', ' : null}
          <span className="font-mono text-primary">{extensionId}</span>
        </span>
      ))}
      .
    </>
  );
}

function ExtensionSettingsSection({
  includeExtensionIds,
  excludeExtensionIds,
  includeGroups,
  separated = true,
}: {
  includeExtensionIds?: readonly string[];
  excludeExtensionIds?: readonly string[];
  includeGroups?: readonly string[];
  separated?: boolean;
} = {}) {
  const { data: values, loading, error } = useApi<Record<string, unknown>>(api.settings as never);
  const { data: schema, loading: schemaLoading, error: schemaError } = useApi<UnifiedSettingsEntry[]>(api.settingsSchema as never);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [savedValues, setSavedValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    if (saveError)
      window.dispatchEvent(
        new CustomEvent('neon-pilot-notification', { detail: { type: 'error', message: saveError, source: 'system-settings' } }),
      );
  }, [saveError]);

  const editedKeys = useRef(new Set<string>());

  // Track explicit user edits so the values-refetch merge below preserves
  // only keys the user has touched, not every key that happens to differ.
  const markEdited = useCallback((key: string) => {
    editedKeys.current.add(key);
  }, []);

  useEffect(() => {
    if (values) {
      setSavedValues(values);
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

  useEffect(() => {
    if (!values || !draft) return;
    if (getSettingsChanges(draft, savedValues).length === 0) {
      setSaveError(null);
    }
  }, [draft, savedValues, values]);

  const pendingChanges = useMemo(() => {
    if (!draft) return {};
    return Object.fromEntries(getSettingsChanges(draft, savedValues));
  }, [draft, savedValues]);
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  const saveChanges = useCallback(async () => {
    if (!hasPendingChanges) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateSettings(pendingChanges);
      editedKeys.current.clear();
      setSavedValues((prev) => ({ ...prev, ...pendingChanges }));
      window.dispatchEvent(new CustomEvent(EXTENSION_REGISTRY_CHANGED_EVENT));
      setSaveNotice('Saved.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [hasPendingChanges, pendingChanges]);

  const resetChanges = useCallback(() => {
    editedKeys.current.clear();
    setDraft(savedValues);
    setSaveNotice(null);
    setSaveError(null);
  }, [savedValues]);

  const grouped = useMemo(() => {
    if (!schema) return new Map<string, UnifiedSettingsEntry[]>();
    const includedExtensionIds = includeExtensionIds ? new Set(includeExtensionIds) : null;
    const excludedExtensionIds = excludeExtensionIds ? new Set(excludeExtensionIds) : null;
    const includedGroups = includeGroups ? new Set(includeGroups) : null;
    const groups = new Map<string, UnifiedSettingsEntry[]>();
    for (const entry of schema) {
      if (entry.key === 'secrets.provider') continue;
      const group = entry.group || 'General';
      if (includedExtensionIds && !includedExtensionIds.has(entry.extensionId)) continue;
      if (excludedExtensionIds?.has(entry.extensionId)) continue;
      if (includedGroups && !includedGroups.has(group)) continue;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(entry);
    }
    for (const [, entries] of groups) {
      entries.sort((a, b) => a.order - b.order);
    }
    return groups;
  }, [excludeExtensionIds, includeExtensionIds, includeGroups, schema]);

  if (loading || schemaLoading) return null;
  if (error || schemaError) return null;
  if (grouped.size === 0) return null;

  return (
    <div className={separated ? 'space-y-0 border-t border-border-subtle/70 pt-6' : 'space-y-0'}>
      {[...grouped.entries()].map(([group, entries]) => (
        <SettingsPanel key={group} title={group} description={formatInjectedExtensionDescription(entries)}>
          {entries.map((entry) => (
            <SettingsField
              key={entry.key}
              entry={entry}
              value={draft[entry.key]}
              onChange={(key, val) => {
                markEdited(key);
                setDraft((prev) => ({ ...prev, [key]: val }));
                setSaveNotice(null);
                setSaveError(null);
              }}
            />
          ))}
          <div className="flex items-center gap-2 pt-2">
            <ToolbarButton
              type="button"
              className="text-accent"
              disabled={!hasPendingChanges || saving}
              onClick={saveChanges}
            >
              {saving ? 'Saving…' : 'Save'}
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={!hasPendingChanges || saving}
              onClick={resetChanges}
            >
              Reset
            </ToolbarButton>
            {hasPendingChanges ? <p className="ui-card-meta">Unsaved changes.</p> : null}
          </div>
          {saveNotice && !hasPendingChanges ? <p className="text-[12px] text-accent">{saveNotice}</p> : null}
          {saveError ? <p className="text-[12px] text-danger">{saveError}</p> : null}
        </SettingsPanel>
      ))}
    </div>
  );
}

function ExtensionSettingsComponentPanels({
  registrations,
}: {
  registrations: ReturnType<typeof useExtensionRegistry>['settingsComponents'];
}) {
  if (registrations.length === 0) return null;
  return (
    <div className="space-y-0 border-t border-border-subtle/70 pt-6">
      {registrations.map((registration) => (
        <SettingsPanel key={`${registration.extensionId}:${registration.id}`} title={registration.label} description={registration.description}>
          <SettingsPanelHost registration={registration} />
        </SettingsPanel>
      ))}
    </div>
  );
}

function getSettingsChanges(draft: Record<string, unknown>, values: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(draft).filter(([key, val]) => val !== values[key]);
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
      setErrorMessage('Enter a secret value before saving.');
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
      setNotice('Secret storage backend saved. Stored secrets were migrated when the target backend supports persistence.');
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

  if (loading && !secretsState) return <p className="ui-card-meta">Loading secrets…</p>;
  if (error && !secretsState) return <p className="text-[12px] text-danger">Failed to load secrets: {error}</p>;

  return (
    <div className="space-y-0">
      <SettingsPanel
        title="Secret storage"
        description="Secrets are stored separately from settings and are never returned to the UI after save."
      >
        <div className="space-y-3">
          <label className="ui-card-meta" htmlFor="settings-secret-backend">
            Backend
          </label>
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
          <p className="ui-card-meta">
            {activeBackend === 'keychain'
              ? 'Recommended on macOS. Secrets are stored in the system Keychain.'
              : activeBackend === 'env-only'
                ? 'Read-only. Secrets must come from declared environment variables.'
                : 'Development/headless fallback. Secrets are stored in a local file outside settings.json.'}
          </p>
        </div>
      </SettingsPanel>

      {grouped.size === 0 ? (
        <SettingsPanel title="Extension secrets">
          <p className="ui-card-meta">No installed extensions declare secrets.</p>
        </SettingsPanel>
      ) : (
        [...grouped.entries()].map(([extensionId, secrets]) => (
          <SettingsPanel key={extensionId} title={extensionId}>
            <div className="space-y-4">
              {secrets.map((secret) => (
                <div key={secret.key} className="space-y-2 border-b border-border-subtle/60 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-primary">{secret.label}</p>
                      {secret.description ? <p className="ui-card-meta">{secret.description}</p> : null}
                      {secret.env ? <p className="ui-card-meta">Environment fallback: {secret.env}</p> : null}
                    </div>
                    <p className="ui-card-meta">
                      <SecretSourceLabel source={secret.source} />
                    </p>
                  </div>
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
                      className="min-w-0 flex-1 font-mono text-[13px]"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={!secret.writable || savingKey === secret.key}
                    />
                    <ToolbarButton
                      type="button"
                      disabled={!secret.writable || savingKey === secret.key || !(drafts[secret.key] ?? '').trim()}
                      onClick={() => {
                        void saveSecret(secret);
                      }}
                    >
                      {savingKey === secret.key ? 'Saving…' : secret.configured ? 'Replace' : 'Save'}
                    </ToolbarButton>
                    <ToolbarButton
                      type="button"
                      disabled={!secret.writable || savingKey === secret.key || !secret.configured || secret.source === 'env'}
                      onClick={() => {
                        void removeSecret(secret);
                      }}
                    >
                      Remove
                    </ToolbarButton>
                  </div>
                  {!secret.writable ? (
                    <p className="ui-card-meta">The active backend is read-only. Set the environment variable instead.</p>
                  ) : null}
                </div>
              ))}
            </div>
          </SettingsPanel>
        ))
      )}

      {notice ? <p className="text-[12px] text-accent">{notice}</p> : null}
      {errorMessage ? <p className="text-[12px] text-danger">{errorMessage}</p> : null}
    </div>
  );
}

export function SettingsPage({ sectionIds }: { sectionIds?: SettingsQuickLinkId[] } = {}) {
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
  const [modelProviderAction, setModelProviderAction] = useState<'save' | 'delete' | null>(null);
  const [modelProviderMessage, setModelProviderMessage] = useState<string | null>(null);
  const [modelProviderEditorError, setModelProviderEditorError] = useState<string | null>(null);
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
  const [activeQuickLinkId, setActiveQuickLinkId] = useState<SettingsQuickLinkId>(SETTINGS_QUICK_LINKS[0].id);

  const visibleSectionIds = useMemo(() => (sectionIds ? new Set(sectionIds) : null), [sectionIds]);
  const visibleQuickLinks = useMemo<readonly SettingsQuickLink[]>(() => {
    const shellFiltered =
      desktopEnvironment?.isElectron || isDesktopShell()
        ? SETTINGS_QUICK_LINKS
        : SETTINGS_QUICK_LINKS.filter((item) => item.id !== 'settings-desktop');
    return visibleSectionIds ? shellFiltered.filter((item) => visibleSectionIds.has(item.id)) : shellFiltered;
  }, [desktopEnvironment?.isElectron, visibleSectionIds]);

  useEffect(() => {
    const rawSectionId = decodeURIComponent(location.hash.replace(/^#/, ''));
    const extensionComponentIds = new Set(extensionRegistry.settingsComponents.map((component) => component.sectionId));
    const sectionId = extensionComponentIds.has(rawSectionId) ? 'settings-extensions' : rawSectionId;
    if (!sectionId || !visibleQuickLinks.some((item) => item.id === sectionId)) return;
    const frame = window.requestAnimationFrame(() => navigateToSection(sectionId));
    return () => window.cancelAnimationFrame(frame);
  }, [extensionRegistry.settingsComponents, location.hash, visibleQuickLinks]);

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
    if (visibleQuickLinks.some((item) => item.id === activeQuickLinkId)) {
      return;
    }

    const nextId = visibleQuickLinks[0]?.id ?? SETTINGS_QUICK_LINKS[0].id;
    setActiveQuickLinkId(nextId);
  }, [activeQuickLinkId, visibleQuickLinks]);

  useEffect(() => {
    const container = settingsScrollRef.current;
    if (!container || typeof window === 'undefined' || visibleQuickLinks.length === 0) {
      return undefined;
    }

    const sections = visibleQuickLinks
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
  }, [visibleQuickLinks]);

  const groupedModels = useMemo(() => groupModelsByProvider(modelState?.models ?? []), [modelState?.models]);

  const selectedModel = useMemo(() => {
    if (!modelState?.currentModel) {
      return null;
    }

    return resolveSettingsModelOption(modelState.models, modelState.currentModel);
  }, [modelState]);
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

  const isEditingBuiltInOverride = useMemo(
    () =>
      editingModelId !== null &&
      editingModelId !== NEW_MODEL_ID &&
      editingProviderModel === null &&
      builtInProviderModels.some((model) => model.id === editingModelId),
    [editingModelId, editingProviderModel, builtInProviderModels],
  );
  const providerModelCount = selectedModelProvider?.models.length ?? 0;

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
      void desktopBridge.openExternalUrl(authUrl);
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
      setOauthError(oauthLoginState.error || `OAuth login failed for ${oauthLoginState.provider}.`);
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
      setModelError(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingPreference(null);
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
      setDefaultCwdSaveError(error instanceof Error ? error.message : String(error));
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
      setDefaultCwdSaveError(error instanceof Error ? error.message : String(error));
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
      const headers = parseOptionalStringRecord(modelProviderDraft.headersText, 'Provider headers');
      const compat = parseOptionalJsonObject(modelProviderDraft.compatText, 'Provider compat');
      const modelOverrides = parseOptionalJsonObject(modelProviderDraft.modelOverridesText, 'Provider model overrides');
      const existed = selectedModelProviderId !== NEW_MODEL_PROVIDER_ID && selectedModelProvider?.id === providerId;

      setModelProviderAction('save');
      setModelProviderEditorError(null);
      setModelProviderMessage(null);

      const state = await api.saveModelProvider(providerId, {
        baseUrl: modelProviderDraft.baseUrl.trim() || undefined,
        api: modelProviderDraft.api || undefined,
        apiKey: modelProviderDraft.apiKey.trim() || undefined,
        authHeader: modelProviderDraft.authHeader,
        headers,
        compat,
        modelOverrides,
      });

      syncModelProviderSelection(state, providerId);
      setSelectedProviderId(providerId);
      setModelProviderMessage(existed ? `Saved ${providerId}.` : `Created ${providerId}.`);
      await Promise.all([refetchModels({ resetLoading: false }), refetchProviderAuth({ resetLoading: false })]);
    } catch (error) {
      setModelProviderEditorError(error instanceof Error ? error.message : String(error));
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
      setModelProviderEditorError(error instanceof Error ? error.message : String(error));
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
      setModelDraftError(error instanceof Error ? error.message : String(error));
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
      setModelDraftMessage(`Removed ${modelId}.`);
      await Promise.all([refetchModels({ resetLoading: false }), refetchProviderAuth({ resetLoading: false })]);
    } catch (error) {
      setModelDraftError(error instanceof Error ? error.message : String(error));
    } finally {
      setModelDraftAction(null);
    }
  }

  async function handleSaveProviderApiKey() {
    if (!selectedProvider || providerCredentialAction !== null || !canProviderUseApiKey(selectedProvider)) {
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
      await api.setProviderApiKey(selectedProvider.id, apiKey);
      setProviderApiKey('');
      setOauthLoginState(null);
      setProviderCredentialNotice(`Saved API key for ${selectedProvider.id}.`);
      await Promise.all([refetchProviderAuth({ resetLoading: false }), refetchModels({ resetLoading: false })]);
    } catch (error) {
      setProviderCredentialError(error instanceof Error ? error.message : String(error));
    } finally {
      setProviderCredentialAction(null);
    }
  }

  async function handleRemoveProviderCredential() {
    if (!selectedProvider || providerCredentialAction !== null) {
      return;
    }

    const confirmed = window.confirm(`Remove the stored credential for ${selectedProvider.id} from auth.json?`);
    if (!confirmed) {
      return;
    }

    setProviderCredentialError(null);
    setProviderCredentialNotice(null);
    setOauthError(null);
    setProviderCredentialAction('remove');

    try {
      await api.removeProviderCredential(selectedProvider.id);
      setOauthLoginState(null);
      setProviderCredentialNotice(`Removed stored credential for ${selectedProvider.id}.`);
      await Promise.all([refetchProviderAuth({ resetLoading: false }), refetchModels({ resetLoading: false })]);
    } catch (error) {
      setProviderCredentialError(error instanceof Error ? error.message : String(error));
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
      setOauthError(error instanceof Error ? error.message : String(error));
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
      setOauthError(error instanceof Error ? error.message : String(error));
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
      setOauthError(error instanceof Error ? error.message : String(error));
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
        setOauthError(result.error);
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
      setOauthError(error instanceof Error ? error.message : String(error));
    }
  }

  function navigateToSection(sectionId: SettingsQuickLinkId) {
    setActiveQuickLinkId(sectionId);
    const section = settingsScrollRef.current?.querySelector<HTMLElement>(`#${sectionId}`);
    section?.scrollIntoView({ block: 'start' });
  }

  return (
    <VisibleSettingsSectionsContext.Provider value={visibleSectionIds}>
      <div ref={settingsScrollRef} className="h-full overflow-y-auto">
        <AppPageLayout
          asideLayout="centered"
          contentClassName="flex flex-col gap-10"
          aside={
            visibleQuickLinks.length > 1 ? (
              <SettingsTableOfContents items={visibleQuickLinks} activeId={activeQuickLinkId} onNavigate={navigateToSection} />
            ) : undefined
          }
        >
          <AppPageIntro title="Settings" summary="Appearance, conversation defaults, workspace, skills, providers, and desktop behavior." />

          <div className="flex flex-col gap-12">
            <SettingsSection id="settings-appearance" label="Appearance" description="Theme, accent, and visual defaults.">
              <SettingsPanel title="Theme" description="Choose Auto to follow the OS.">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
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
                    <span className="ui-card-meta">
                      Current theme: {availableThemes.find((availableTheme) => availableTheme.id === theme)?.label ?? theme}
                      {themePreference === 'system' ? ' (auto)' : ''}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ThemeDefaultSelect
                      label="Light default"
                      value={lightTheme}
                      themes={availableThemes.filter((availableTheme) => availableTheme.appearance === 'light')}
                      onChange={setLightTheme}
                    />
                    <ThemeDefaultSelect
                      label="Dark default"
                      value={darkTheme}
                      themes={availableThemes.filter((availableTheme) => availableTheme.appearance === 'dark')}
                      onChange={setDarkTheme}
                    />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="ui-card-meta font-medium text-primary">Accent color</p>
                      <p className="ui-card-meta">Signal color for active navigation, focus rings, and primary actions.</p>
                    </div>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent color">
                      {availableAccents.map((entry) => {
                        const isSelected = accent === entry.id;
                        const currentTokens = theme.includes('dark') ? entry.dark : entry.light;
                        return (
                          <SwatchOption
                            key={entry.id}
                            checked={isSelected}
                            label={entry.label}
                            swatch={
                              <span
                                className="h-full w-full"
                                style={{ backgroundColor: `rgb(${currentTokens.accent.replaceAll(' ', ', ')})` }}
                              />
                            }
                            onClick={() => setAccent(entry.id as ThemeAccent)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </SettingsPanel>
            </SettingsSection>

            <SettingsSection id="settings-conversation" label="Conversation" description="Model and behavior defaults for new chats.">
              <div className="space-y-0">
                <SettingsPanel title="Default model" description="Used for new chats and runs unless a model is picked explicitly.">
                  {modelsLoading && !modelState ? (
                    <p className="ui-card-meta">Loading models…</p>
                  ) : modelsError && !modelState ? (
                    <p className="text-[12px] text-danger">Failed to load models: {modelsError}</p>
                  ) : modelState ? (
                    <>
                      <label className="ui-card-meta" htmlFor="settings-model">
                        Model
                      </label>
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
                      <p className="ui-card-meta">
                        {savingPreference === 'model' ? 'Saving default model...' : formatModelSummary(selectedModel, 'No model selected.')}
                      </p>

                      <label className="ui-card-meta pt-1" htmlFor="settings-thinking">
                        Thinking level
                      </label>
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
                      <p className="ui-card-meta">
                        {savingPreference === 'thinking'
                          ? 'Saving thinking level…'
                          : `Current thinking level: ${formatThinkingLevelLabel(modelState.currentThinkingLevel)}`}
                      </p>
                    </>
                  ) : null}

                  {modelError && <p className="text-[12px] text-danger">{modelError}</p>}
                </SettingsPanel>
                <ExtensionSettingsSection includeExtensionIds={['system-settings']} includeGroups={['Conversation']} separated={false} />
              </div>
            </SettingsSection>

            <SettingsSection id="settings-workspace" label="Workspace" description="Default working directory and local context paths.">
              <div className="space-y-0">
                <SettingsPanel title="Working directory" description="Fallback cwd for new chats and web actions.">
                  {defaultCwdLoading && !defaultCwdState ? (
                    <p className="ui-card-meta">Loading default working directory…</p>
                  ) : defaultCwdLoadError && !defaultCwdState ? (
                    <p className="text-[12px] text-danger">Failed to load default working directory: {defaultCwdLoadError}</p>
                  ) : defaultCwdState ? (
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleDefaultCwdSave();
                      }}
                    >
                      <label className="ui-card-meta" htmlFor="settings-default-cwd">
                        Path
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                          {pickingDefaultCwd ? 'Choosing…' : 'Choose…'}
                        </ToolbarButton>
                      </div>
                      <p className="ui-card-meta break-all">
                        {savingDefaultCwd
                          ? 'Saving default working directory…'
                          : defaultCwdState.currentCwd
                            ? `Default cwd · ${defaultCwdState.effectiveCwd}`
                            : `Process cwd · ${defaultCwdState.effectiveCwd}`}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="ui-card-meta">
                          {savingDefaultCwd ? 'Saving…' : defaultCwdDirty ? 'Auto-save pending…' : 'Auto-saved'}
                        </span>
                        <ToolbarButton
                          type="button"
                          onClick={() => {
                            void handleDefaultCwdSave('');
                          }}
                          disabled={savingDefaultCwd || pickingDefaultCwd || defaultCwdState.currentCwd.length === 0}
                        >
                          Use process cwd
                        </ToolbarButton>
                      </div>
                      <p className="ui-card-meta">
                        Absolute, <span className="font-mono text-[11px]">~/…</span>, or relative. Leave blank to use the runtime process
                        cwd.
                      </p>
                    </form>
                  ) : null}

                  {defaultCwdSaveError && <p className="text-[12px] text-danger">{defaultCwdSaveError}</p>}
                </SettingsPanel>
              </div>
            </SettingsSection>

            <SettingsSection id="settings-commands" label="Commands" description="Command palette actions and keyboard shortcuts.">
              <CommandsSettingsSection />
            </SettingsSection>

            <SettingsSection id="settings-security" label="Security" description="Secret storage and extension credentials.">
              <ExtensionSecretsSection />
            </SettingsSection>

            <SettingsSection id="settings-extensions" label="Extensions" description="Preferences declared by installed extensions.">
              <ExtensionSettingsSection excludeExtensionIds={['system-settings']} />
              <ExtensionSettingsComponentPanels registrations={extensionRegistry.settingsComponents} />
            </SettingsSection>

            <SettingsSection
              id="settings-providers"
              label="Providers"
              description="Provider definitions, model overrides, and credential management."
            >
              <div className="space-y-0">
                <SettingsPanel title="Provider & model definitions">
                  <div className="space-y-5">
                    <div className="space-y-3 min-w-0">
                      <h3 className="text-[13px] font-medium text-primary">Providers</h3>

                      {modelProviderLoading && !modelProviderState ? (
                        <p className="ui-card-meta">Loading provider definitions…</p>
                      ) : modelProviderError && !modelProviderState ? (
                        <p className="text-[12px] text-danger">Failed to load provider definitions: {modelProviderError}</p>
                      ) : modelProviderState ? (
                        <>
                          {providerAuthLoading && !providerAuthState && <p className="ui-card-meta">Loading provider credentials…</p>}
                          {providerAuthError && !providerAuthState && (
                            <p className="text-[12px] text-danger">Failed to load provider credentials: {providerAuthError}</p>
                          )}
                          <div className="space-y-4">
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <h4 className="text-[13px] font-medium text-primary">Add provider</h4>
                              </div>
                              <div className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center">
                                <Select
                                  id="settings-model-provider-picker"
                                  value={modelProviderPickerId}
                                  onChange={(event) => {
                                    setModelProviderPickerId(event.target.value);
                                  }}
                                  className="h-9 py-1.5 text-[12px]"
                                >
                                  <option value="">Choose provider…</option>
                                  {unconfiguredModelProviderIds.map((providerId) => (
                                    <option key={providerId} value={providerId}>
                                      {providerId}
                                    </option>
                                  ))}
                                  <option value={ADD_CUSTOM_PROVIDER_ID}>Add custom provider…</option>
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
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>

                    {selectedModelProviderId !== '' && (
                      <div className="space-y-5 rounded-lg border border-border-subtle bg-surface/50 p-4">
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
                                  'Removing…'
                                ) : (
                                  <>
                                    <SettingsIcon name="trash" />
                                    Delete
                                  </>
                                )}
                              </Button>
                            )}
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
                                  Start with a known provider ID to auto-load defaults. Save a key here or in Credentials to enable secure
                                  auth.
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

                                <Disclosure
                                  open={showAdvancedProviderFields}
                                  onToggle={(event) => {
                                    setShowAdvancedProviderFields((event.currentTarget as HTMLDetailsElement).open);
                                  }}
                                  summary="Advanced provider options"
                                >
                                  <div className="space-y-4 pt-2">
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
                                          API
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

                                    <label
                                      className="inline-flex items-center gap-3 text-[14px] text-primary"
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
                                      <span>
                                        Add <span className="font-mono text-[11px]">Authorization: Bearer</span> from the provider API key
                                      </span>
                                    </label>

                                    <div className="grid gap-4 xl:grid-cols-2">
                                      <div className="space-y-2 min-w-0">
                                        <label className="ui-card-meta" htmlFor="settings-model-provider-headers">
                                          Headers (JSON)
                                        </label>
                                        <Textarea
                                          id="settings-model-provider-headers"
                                          value={modelProviderDraft.headersText}
                                          onChange={(event) => {
                                            setModelProviderDraft((current) => ({ ...current, headersText: event.target.value }));
                                          }}
                                          className="min-h-[88px] font-mono text-[11px] leading-5"
                                          placeholder={'{\n  "x-app": "neon-pilot"\n}'}
                                          spellCheck={false}
                                          disabled={modelProviderAction !== null}
                                        />
                                      </div>

                                      <div className="space-y-2 min-w-0">
                                        <label className="ui-card-meta" htmlFor="settings-model-provider-compat">
                                          Compat (JSON)
                                        </label>
                                        <Textarea
                                          id="settings-model-provider-compat"
                                          value={modelProviderDraft.compatText}
                                          onChange={(event) => {
                                            setModelProviderDraft((current) => ({ ...current, compatText: event.target.value }));
                                          }}
                                          className="min-h-[88px] font-mono text-[11px] leading-5"
                                          placeholder={'{\n  "supportsDeveloperRole": false\n}'}
                                          spellCheck={false}
                                          disabled={modelProviderAction !== null}
                                        />
                                      </div>

                                      <div className="space-y-2 min-w-0 xl:col-span-2">
                                        <label className="ui-card-meta" htmlFor="settings-model-provider-overrides">
                                          Model overrides (JSON)
                                        </label>
                                        <Textarea
                                          id="settings-model-provider-overrides"
                                          value={modelProviderDraft.modelOverridesText}
                                          onChange={(event) => {
                                            setModelProviderDraft((current) => ({ ...current, modelOverridesText: event.target.value }));
                                          }}
                                          className="min-h-[88px] font-mono text-[11px] leading-5"
                                          placeholder={'{\n  "claude-sonnet-4-6": {\n    "name": "Claude Sonnet 4.6 (Proxy)"\n  }\n}'}
                                          spellCheck={false}
                                          disabled={modelProviderAction !== null}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </Disclosure>

                                <p className="ui-card-meta max-w-3xl">
                                  Provider API keys here use <span className="font-mono text-[11px]">models.json</span> value resolution.
                                  Leave the field blank if you prefer <span className="font-mono text-[11px]">auth.json</span>, OAuth, or
                                  environment-only auth.
                                </p>

                                <div className="flex flex-wrap gap-2">
                                  <ToolbarButton
                                    type="submit"
                                    disabled={modelProviderAction !== null || modelProviderDraft.id.trim().length === 0}
                                  >
                                    {modelProviderAction === 'save'
                                      ? 'Saving provider…'
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
                                    {modelProviderAction === 'delete' ? 'Removing…' : 'Remove provider'}
                                  </ToolbarButton>
                                </div>

                                {modelProviderMessage && <p className="text-[12px] text-success">{modelProviderMessage}</p>}
                                {modelProviderEditorError && <p className="text-[12px] text-danger">{modelProviderEditorError}</p>}
                              </form>
                            </div>
                          )}

                          <Disclosure
                            open={showProviderModelManagement}
                            onToggle={(event) => {
                              setShowProviderModelManagement((event.currentTarget as HTMLDetailsElement).open);
                            }}
                            className="order-2 min-w-0"
                            summary={<span className="text-[14px] font-medium text-primary">Advanced config</span>}
                          >
                            <div className="space-y-2 pt-3">
                              <p className="ui-card-meta">
                                {providerModelCount > 0
                                  ? `${providerModelCount} model ${providerModelCount === 1 ? 'row' : 'rows'} loaded from defaults.`
                                  : selectedModelProviderId === NEW_MODEL_PROVIDER_ID
                                    ? 'Save this provider to auto-load model defaults for this provider ID, when available.'
                                    : 'No model rows yet for this provider.'}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <IconButton
                                  type="button"
                                  onClick={() => {
                                    startEditingProviderModel(NEW_MODEL_ID);
                                  }}
                                  disabled={!editableModelProviderId || modelDraftAction !== null}
                                  aria-label="Add model"
                                  title="Add model"
                                >
                                  <SettingsIcon name="plus" />
                                </IconButton>
                                <IconButton
                                  type="button"
                                  onClick={() => {
                                    void refetchModels({ resetLoading: false });
                                  }}
                                  disabled={modelsRefreshing}
                                  aria-label="Refresh models"
                                  title={modelsRefreshing ? 'Refreshing models' : 'Refresh models'}
                                >
                                  <SettingsIcon name="refresh" />
                                </IconButton>
                              </div>

                              {editableModelProviderId ? (
                                <>
                                  {builtInProviderModels.length > 0 && (
                                    <div className="space-y-1.5">
                                      <h4 className="text-[12px] font-medium text-secondary">Models</h4>
                                      <div className="space-y-1">
                                        {builtInProviderModels.map((model) => {
                                          const hasOverride = selectedModelProvider?.models.some((candidate) => candidate.id === model.id);
                                          return (
                                            <RowButton
                                              key={`${model.provider}/${model.id}`}
                                              onClick={() => {
                                                startEditingBuiltInModel(model.id);
                                              }}
                                              disabled={modelDraftAction !== null}
                                              selected={editingModelId === model.id && !editingProviderModel}
                                              className={cx(
                                                'group w-full justify-between px-2 py-1',
                                                editingModelId !== model.id || editingProviderModel ? 'ui-list-row-hover' : null,
                                              )}
                                              aria-pressed={editingModelId === model.id && !editingProviderModel}
                                            >
                                              <span className="truncate text-[12px] font-medium text-primary">{model.id}</span>
                                              <span className="shrink-0 text-dim" aria-hidden="true">
                                                <SettingsIcon name={hasOverride ? 'check' : 'plus'} />
                                              </span>
                                            </RowButton>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  <div className="space-y-1.5">
                                    <h4 className="text-[12px] font-medium text-secondary">Additional models</h4>
                                    {selectedModelProvider && selectedModelProvider.models.length > 0 ? (
                                      <div className="space-y-1">
                                        {selectedModelProvider.models.map((model) => (
                                          <div key={model.id} className="group ui-list-row ui-list-row-hover justify-between px-2 py-1">
                                            <span className="min-w-0 truncate text-[12px] font-medium text-primary">{model.id}</span>
                                            <div className="flex flex-wrap gap-2">
                                              <IconButton
                                                type="button"
                                                onClick={() => {
                                                  startEditingProviderModel(model.id);
                                                }}
                                                aria-label={`Edit ${model.id}`}
                                                title="Edit"
                                              >
                                                <SettingsIcon name="edit" />
                                              </IconButton>
                                              <IconButton
                                                type="button"
                                                onClick={() => {
                                                  void handleDeleteProviderModel(model.id);
                                                }}
                                                disabled={modelDraftAction !== null}
                                                aria-label={`Remove ${model.id}`}
                                                title="Remove"
                                              >
                                                {modelDraftAction === 'delete' && editingModelId === model.id ? (
                                                  '…'
                                                ) : (
                                                  <SettingsIcon name="trash" />
                                                )}
                                              </IconButton>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[12px] text-dim">None yet.</p>
                                    )}
                                  </div>

                                  {modelDraftMessage && <p className="text-[12px] text-success">{modelDraftMessage}</p>}
                                  {modelDraftError && <p className="text-[12px] text-danger">{modelDraftError}</p>}

                                  {editingModelId === NEW_MODEL_ID && (
                                    <form
                                      className="flex flex-col gap-2 border-t border-border-subtle pt-3 sm:flex-row sm:items-end"
                                      onSubmit={(event) => {
                                        event.preventDefault();
                                        void handleSaveProviderModel();
                                      }}
                                    >
                                      <div className="min-w-0 flex-1 space-y-1.5">
                                        <label className="ui-card-meta" htmlFor="settings-provider-model-id">
                                          Model id
                                        </label>
                                        <TextInput
                                          id="settings-provider-model-id"
                                          value={modelDraft.id}
                                          onChange={(event) => {
                                            setModelDraft((current) => ({ ...current, id: event.target.value }));
                                          }}
                                          className="font-mono text-[13px]"
                                          placeholder="gpt-5.6"
                                          autoComplete="off"
                                          spellCheck={false}
                                          disabled={modelDraftAction !== null}
                                          autoFocus
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <ToolbarButton
                                          type="submit"
                                          disabled={modelDraftAction !== null || modelDraft.id.trim().length === 0}
                                        >
                                          {modelDraftAction === 'save' ? 'Adding…' : 'Add model'}
                                        </ToolbarButton>
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
                                    </form>
                                  )}

                                  {(editingProviderModel || isEditingBuiltInOverride) && (
                                    <form
                                      className="space-y-3 border-t border-border-subtle pt-4"
                                      onSubmit={(event) => {
                                        event.preventDefault();
                                        void handleSaveProviderModel();
                                      }}
                                    >
                                      <div className="space-y-1">
                                        <h4 className="text-[13px] font-medium text-primary">
                                          {editingProviderModel ? `Edit ${editingProviderModel.id}` : `Override ${modelDraft.id}`}
                                        </h4>
                                      </div>

                                      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                        <div className="space-y-2 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-id">
                                            Model id
                                          </label>
                                          <TextInput
                                            id="settings-provider-model-id"
                                            value={modelDraft.id}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, id: event.target.value }));
                                            }}
                                            className="font-mono text-[13px]"
                                            placeholder="llama3.1:8b"
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={modelDraftAction !== null || editingModelId !== NEW_MODEL_ID}
                                          />
                                        </div>

                                        <div className="space-y-2 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-name">
                                            Name
                                          </label>
                                          <TextInput
                                            id="settings-provider-model-name"
                                            value={modelDraft.name}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, name: event.target.value }));
                                            }}
                                            placeholder="Llama 3.1 8B"
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={modelDraftAction !== null}
                                          />
                                        </div>

                                        <div className="space-y-2 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-api">
                                            API
                                          </label>
                                          <Select
                                            id="settings-provider-model-api"
                                            value={modelDraft.api}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, api: event.target.value }));
                                            }}
                                            disabled={modelDraftAction !== null}
                                          >
                                            <option value="">Inherit provider API</option>
                                            {MODEL_PROVIDER_API_OPTIONS.map((option) => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </Select>
                                        </div>

                                        <div className="space-y-2 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-base-url">
                                            Base URL override
                                          </label>
                                          <TextInput
                                            id="settings-provider-model-base-url"
                                            value={modelDraft.baseUrl}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, baseUrl: event.target.value }));
                                            }}
                                            className="font-mono text-[13px]"
                                            placeholder="https://proxy.example.com/v1"
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={modelDraftAction !== null}
                                          />
                                        </div>

                                        <div className="space-y-1.5 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-context">
                                            Context window
                                          </label>
                                          <TextInput
                                            id="settings-provider-model-context"
                                            value={modelDraft.contextWindow}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, contextWindow: event.target.value }));
                                            }}
                                            className="px-2.5 py-1.5 font-mono text-[12px]"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            spellCheck={false}
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
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, maxTokens: event.target.value }));
                                            }}
                                            className="px-2.5 py-1.5 font-mono text-[12px]"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={modelDraftAction !== null}
                                          />
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap gap-4">
                                        <label
                                          className="inline-flex items-center gap-3 text-[14px] text-primary"
                                          htmlFor="settings-provider-model-reasoning"
                                        >
                                          <Checkbox
                                            id="settings-provider-model-reasoning"
                                            type="checkbox"
                                            checked={modelDraft.reasoning}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, reasoning: event.target.checked }));
                                            }}
                                            disabled={modelDraftAction !== null}
                                          />
                                          <span>Reasoning capable</span>
                                        </label>

                                        <label
                                          className="inline-flex items-center gap-3 text-[14px] text-primary"
                                          htmlFor="settings-provider-model-images"
                                        >
                                          <Checkbox
                                            id="settings-provider-model-images"
                                            type="checkbox"
                                            checked={modelDraft.acceptsImages}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, acceptsImages: event.target.checked }));
                                            }}
                                            disabled={modelDraftAction !== null}
                                          />
                                          <span>Accept images</span>
                                        </label>
                                      </div>

                                      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                                        <div className="space-y-1.5 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-cost-input">
                                            Input cost / 1M
                                          </label>
                                          <TextInput
                                            id="settings-provider-model-cost-input"
                                            value={modelDraft.costInput}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, costInput: event.target.value }));
                                            }}
                                            className="px-2.5 py-1.5 font-mono text-[12px]"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={modelDraftAction !== null}
                                          />
                                        </div>

                                        <div className="space-y-1.5 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-cost-output">
                                            Output cost / 1M
                                          </label>
                                          <TextInput
                                            id="settings-provider-model-cost-output"
                                            value={modelDraft.costOutput}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, costOutput: event.target.value }));
                                            }}
                                            className="px-2.5 py-1.5 font-mono text-[12px]"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={modelDraftAction !== null}
                                          />
                                        </div>

                                        <div className="space-y-1.5 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-cost-cache-read">
                                            Cache read / 1M
                                          </label>
                                          <TextInput
                                            id="settings-provider-model-cost-cache-read"
                                            value={modelDraft.costCacheRead}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, costCacheRead: event.target.value }));
                                            }}
                                            className="px-2.5 py-1.5 font-mono text-[12px]"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={modelDraftAction !== null}
                                          />
                                        </div>

                                        <div className="space-y-1.5 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-cost-cache-write">
                                            Cache write / 1M
                                          </label>
                                          <TextInput
                                            id="settings-provider-model-cost-cache-write"
                                            value={modelDraft.costCacheWrite}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, costCacheWrite: event.target.value }));
                                            }}
                                            className="px-2.5 py-1.5 font-mono text-[12px]"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={modelDraftAction !== null}
                                          />
                                        </div>
                                      </div>

                                      <div className="grid gap-4 lg:grid-cols-2">
                                        <div className="space-y-2 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-headers">
                                            Headers (JSON)
                                          </label>
                                          <Textarea
                                            id="settings-provider-model-headers"
                                            value={modelDraft.headersText}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, headersText: event.target.value }));
                                            }}
                                            className="min-h-[88px] font-mono text-[11px] leading-5"
                                            placeholder={'{\n  "x-provider-key": "HEADER_VALUE"\n}'}
                                            spellCheck={false}
                                            disabled={modelDraftAction !== null}
                                          />
                                        </div>

                                        <div className="space-y-2 min-w-0">
                                          <label className="ui-card-meta" htmlFor="settings-provider-model-compat">
                                            Compat (JSON)
                                          </label>
                                          <Textarea
                                            id="settings-provider-model-compat"
                                            value={modelDraft.compatText}
                                            onChange={(event) => {
                                              setModelDraft((current) => ({ ...current, compatText: event.target.value }));
                                            }}
                                            className="min-h-[88px] font-mono text-[11px] leading-5"
                                            placeholder={'{\n  "supportsReasoningEffort": false\n}'}
                                            spellCheck={false}
                                            disabled={modelDraftAction !== null}
                                          />
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        <ToolbarButton
                                          type="submit"
                                          disabled={modelDraftAction !== null || modelDraft.id.trim().length === 0}
                                        >
                                          {modelDraftAction === 'save' ? 'Saving model…' : 'Save model'}
                                        </ToolbarButton>
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
                                        placeholder="sk-… or op://Private/API key/password"
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
                                        {providerCredentialAction === 'saveKey' ? '…' : <SettingsIcon name="check" />}
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
                                        providerCredentialAction !== null ||
                                        oauthAction !== null ||
                                        selectedProviderLogin?.status === 'running'
                                      }
                                      className="inline-flex items-center gap-2"
                                      aria-label={`Start OAuth login (${modalProviderAuth.id})`}
                                      title={`Start OAuth login (${modalProviderAuth.id})`}
                                    >
                                      {oauthAction === 'start' ? (
                                        'Starting…'
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
                                      OAuth login started.
                                      {selectedProviderLogin.authUrl ? (
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
                                      <p className="text-[12px] text-secondary">Waiting for authorization…</p>
                                    )}
                                    {selectedProviderLogin.deviceCode && (
                                      <div className="space-y-2 border-t border-border-subtle pt-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div>
                                            <p className="ui-card-meta">Device code</p>
                                            <p
                                              id="settings-provider-oauth-device-code"
                                              className="select-all font-mono text-[26px] font-semibold leading-tight text-primary"
                                            >
                                              {selectedProviderLogin.deviceCode.userCode}
                                            </p>
                                          </div>
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
                                        <p className="text-[12px] text-secondary">
                                          Enter this code at{' '}
                                          <a
                                            href={selectedProviderLogin.deviceCode.verificationUri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={selectedProviderLogin.deviceCode.verificationUri}
                                            className="underline text-interactive hover:text-interactive-hover"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              void handleOpenProviderOAuthUrl(selectedProviderLogin.deviceCode?.verificationUri ?? '');
                                            }}
                                          >
                                            {selectedProviderLogin.deviceCode.verificationUri}
                                          </a>
                                          {typeof selectedProviderLogin.deviceCode.expiresInSeconds === 'number'
                                            ? ` before it expires in ${selectedProviderLogin.deviceCode.expiresInSeconds} seconds.`
                                            : '.'}
                                        </p>
                                      </div>
                                    )}
                                    {selectedProviderLogin.authUrl && (
                                      <div className="space-y-2 rounded-md border border-border-subtle bg-elevated/50 p-2.5">
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
                                              Copy
                                            </ToolbarButton>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {selectedProviderLogin.prompt && (
                                      <div className="space-y-2">
                                        <p className="ui-card-meta">Login method</p>
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
                                                      setOauthError(error instanceof Error ? error.message : String(error));
                                                    })
                                                    .finally(() => {
                                                      setOauthAction(null);
                                                    });
                                                }}
                                                disabled={oauthAction !== null}
                                                className="capitalize"
                                              >
                                                {oauthAction === 'submit' ? 'Submitting…' : option.label}
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
                                                placeholder={selectedProviderLogin.prompt.placeholder || 'Enter code…'}
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
                                              {oauthAction === 'submit' ? 'Submitting…' : 'Submit'}
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
                                      {oauthAction === 'cancel' ? 'Cancelling…' : 'Cancel OAuth login'}
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
                              <p className="text-[12px] text-danger">OAuth login failed: {selectedProviderLogin.error}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {modelProviderState && (
                      <div className="space-y-2">
                        <p className="ui-card-meta">Configured providers</p>
                        {configuredProviderSummaries.length > 0 ? (
                          <div className="space-y-2">
                            {configuredProviderSummaries.map((provider) => {
                              const selected = provider.id === selectedModelProviderId || provider.id === selectedProviderId;
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
                                    'group flex w-full items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface/70 px-3 py-3',
                                    selected ? 'border-border-default bg-elevated' : 'hover:border-border-default hover:bg-surface',
                                  )}
                                  aria-pressed={selected}
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-[13px] font-medium text-primary">{provider.id}</span>
                                    <span className="ui-card-meta block truncate">
                                      {provider.modelProvider
                                        ? formatModelProviderSummary(provider.modelProvider)
                                        : formatProviderAuthStatus(provider.auth)}
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
                          <p className="ui-card-meta">No custom providers or overrides yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                </SettingsPanel>
              </div>
            </SettingsSection>

            <SettingsSection id="settings-desktop" label="Desktop" description="Desktop app behavior and telemetry.">
              <DesktopConnectionsSettingsPanel />
              <TelemetryLogsSettingsPanel />
            </SettingsSection>

          </div>
        </AppPageLayout>
      </div>
    </VisibleSettingsSectionsContext.Provider>
  );
}
