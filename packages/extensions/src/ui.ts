export type { ExtensionSurfaceProps } from './index.js';

export type HostComponent = (...args: never[]) => unknown;
export type DesktopKnowledgeEntryContextMenuAction = unknown;
export type ExtensionChatViewLayout = 'default' | 'compact';
export type ActivityTreeDropPosition = 'before' | 'after';

export type ActivityTreeItemStatus = 'idle' | 'running' | 'queued' | 'failed' | 'done';

export interface ActivityTreeItem {
  id: string;
  kind: 'conversation' | 'execution' | 'run' | 'terminal' | 'artifact' | 'checkpoint' | 'group';
  parentId?: string;
  title: string;
  subtitle?: string;
  status: ActivityTreeItemStatus;
  route?: string;
  accentColor?: string;
  backgroundColor?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtensionChatImage {
  alt: string;
  src?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  caption?: string;
  deferred?: boolean;
}

export type ExtensionChatMessageBlock =
  | { type: 'user'; id?: string; ts: string; text: string; images?: ExtensionChatImage[] }
  | { type: 'text'; id?: string; ts: string; text: string; streaming?: boolean }
  | { type: 'context'; id?: string; ts: string; text: string; customType?: string }
  | { type: 'thinking'; id?: string; ts: string; text: string }
  | {
      type: 'image';
      id?: string;
      ts: string;
      alt: string;
      src?: string;
      mimeType?: string;
      width?: number;
      height?: number;
      caption?: string;
    }
  | { type: 'error'; id?: string; ts: string; tool?: string; message: string };

export interface ExtensionChatModelInfo {
  id: string;
  provider?: string;
  name?: string;
  label?: string;
  [key: string]: unknown;
}

export interface ExtensionChatTokenUsage {
  input: number;
  output: number;
  total: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ExtensionChatContextUsage {
  usedTokens?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface ChatViewProps {
  messages: ExtensionChatMessageBlock[];
  conversationId?: string | null;
  messageIndexOffset?: number;
  scrollContainerRef?: unknown;
  focusMessageIndex?: number | null;
  isStreaming?: boolean;
  isCompacting?: boolean;
  pendingStatusLabel?: string | null;
  performanceMode?: 'default' | 'aggressive';
  layout?: ExtensionChatViewLayout;
  onForkMessage?: (messageIndex: number) => Promise<void> | void;
  onRewindMessage?: (messageIndex: number) => Promise<void> | void;
  onEditUserMessage?: (messageIndex: number, text: string) => Promise<void> | void;
  onReplyToSelection?: (selection: { text: string; messageIndex: number; blockId?: string; action?: unknown }) => Promise<void> | void;
  selectionActions?: unknown[];
  onHydrateMessage?: (blockId: string) => Promise<void> | void;
  hydratingMessageBlockIds?: ReadonlySet<string>;
  onFocusComposerRequest?: () => void;
  bottomPaddingPx?: number;
  systemPrompt?: string | null;
  remoteControlled?: boolean;
  remoteControlStatus?: string | null;
}

export interface ChatRailComposerProps {
  conversationId: string | null;
  workspaceCwd: string | null;
  isStreaming: boolean;
  models: ExtensionChatModelInfo[];
  currentModel: string;
  currentThinkingLevel: string;
  tokens: ExtensionChatTokenUsage | null;
  contextUsage: ExtensionChatContextUsage | null;
  onSubmit: (text: string, behavior?: 'steer' | 'followUp', images?: unknown[], attachmentRefs?: unknown[]) => void;
  onAbortStream: () => void;
  onSelectModel: (modelId: string) => void;
  onSelectThinkingLevel: (thinkingLevel: string) => void;
  composerMeta?: unknown;
  composerPlaceholder?: string;
  externalDraft?: { id: string; text: string } | null;
}

export interface ExtensionChatContextMessage {
  customType: string;
  content: string;
}

export interface ExtensionChatRailProps {
  conversationId: string | null;
  workspaceCwd?: string | null;
  tailBlocks?: number;
  className?: string;
  emptyState?: unknown;
  externalDraft?: { id: string; text: string } | null;
  getContextMessages?: (text: string) => ExtensionChatContextMessage[] | Promise<ExtensionChatContextMessage[]>;
  onError?: (message: string) => void;
  onModelChange?: (modelId: string) => void;
  onTurnComplete?: () => void | Promise<void>;
}

export declare const AppPageEmptyState: HostComponent;
export declare const AppPageIntro: HostComponent;
export declare const AppPageLayout: HostComponent;
export declare const AppPageSection: HostComponent;
export declare const AppPageToc: HostComponent;
export declare const Button: HostComponent;
export declare const ButtonLink: HostComponent;
export declare const BrowsePathButton: HostComponent;
export declare const CheckButton: HostComponent;
export declare const ChatBubbleIcon: HostComponent;
export declare const ChoiceRow: HostComponent;
export declare const DataTable: HostComponent;
export declare const DataTableBody: HostComponent;
export declare const DataTableCell: HostComponent;
export declare const DataTableHead: HostComponent;
export declare const DataTableHeaderCell: HostComponent;
export declare const DataTableRow: HostComponent;
export declare const Disclosure: HostComponent;
export declare const Dialog: HostComponent;
export declare const DialogBody: HostComponent;
export declare const DialogFooter: HostComponent;
export declare const DialogHeader: HostComponent;
export declare const CheckpointInlineDiff: (...args: never[]) => unknown;
export declare const ChatRailComposer: (props: ChatRailComposerProps) => unknown;
export declare const ExtensionChatRail: (props: ExtensionChatRailProps) => unknown;
export declare const ChatView: (props: ChatViewProps) => unknown;
export declare const ActivityTreeView: (props: {
  items: readonly ActivityTreeItem[];
  activeItemId?: string | null;
  className?: string;
  style?: unknown;
  canDragItem?: (item: ActivityTreeItem) => boolean;
  canDropItem?: (
    draggedItem: ActivityTreeItem,
    targetItem: ActivityTreeItem,
    position: ActivityTreeDropPosition,
    event: unknown,
  ) => boolean;
  collapsedGroupItemIds?: ReadonlySet<string>;
  onToggleGroupItem?: (item: ActivityTreeItem) => void;
  inlineActions?: Array<{ id: string; title: string; icon?: string }>;
  onInlineAction?: (actionId: string, item: ActivityTreeItem) => void;
  onArchiveItem?: (item: ActivityTreeItem) => void;
  onCreateChildItem?: (item: ActivityTreeItem) => void;
  onOpenItem?: (item: ActivityTreeItem) => void;
  onDragStartItem?: (item: ActivityTreeItem, event: unknown) => void;
  onDropItem?: (draggedItem: ActivityTreeItem, targetItem: ActivityTreeItem, position: ActivityTreeDropPosition, event: unknown) => void;
  onDragEndItem?: () => void;
  renderContextMenu?: (item: ActivityTreeItem, context: unknown) => unknown;
}) => unknown;
export declare const DiffActionButton: (...args: never[]) => unknown;
export declare const GitDiffIcon: HostComponent;
export declare const ContextMenuWrapper: HostComponent;
export declare const CodeBlock: HostComponent;
export declare const EmptyState: HostComponent;
export declare const ErrorState: HostComponent;
export declare const Field: HostComponent;
export declare const FieldError: HostComponent;
export declare const FieldHint: HostComponent;
export declare const FieldLabel: HostComponent;
export declare const FilterToolbar: HostComponent;
export declare const FolderIcon: HostComponent;
export declare const FolderPlusIcon: HostComponent;
export declare const IconButton: HostComponent;
export declare const IconLink: HostComponent;
export declare const KeyValueItem: HostComponent;
export declare const KeyValueList: HostComponent;
export declare const LoadingState: HostComponent;
export declare const MenuGroupLabel: HostComponent;
export declare const MenuItem: HostComponent;
export declare const MenuSeparator: HostComponent;
export declare const MenuShell: HostComponent;
export declare const PositionedMenu: HostComponent;
export declare const Notice: HostComponent;
export declare const PanelHeader: HostComponent;
export declare const Pill: HostComponent;
export declare const ProgressBar: HostComponent;
export declare const ResourceListItem: HostComponent;
export declare const SearchInput: HostComponent;
export declare const SectionLabel: HostComponent;
export declare const SegmentedControl: HostComponent;
export declare const Select: HostComponent;
export declare const SettingToggleRow: HostComponent;
export declare const SettingsSection: HostComponent;
export declare const Stat: HostComponent;
export declare const StatGrid: HostComponent;
export declare const SurfacePanel: (...args: never[]) => unknown;
export declare const SupportingText: HostComponent;
export declare const Switch: HostComponent;
export declare const TabButton: HostComponent;
export declare const TabList: HostComponent;
export declare const Textarea: HostComponent;
export declare const TaskListItem: HostComponent;
export declare const TextInput: HostComponent;
export declare const Tooltip: HostComponent;
export declare const ToolbarButton: HostComponent;
export interface ExtensionSettingsPanelRegistration {
  extensionId: string;
  id: string;
  component: string;
  sectionId: string;
  label: string;
  description?: string;
  order?: number;
  frontendEntry?: string;
}
export declare const SettingsPanelHost: HostComponent;
export declare const KNOWLEDGE_OPEN_FILE_IDS_STORAGE_KEY: string;
export declare const KNOWLEDGE_TREE_EXPANDED_FOLDERS_STORAGE_KEY: string;
export declare function addOpenFileId(...args: never[]): unknown;
export declare function buildApiPath(...args: never[]): string;
export declare function createDesktopAwareEventSource(...args: never[]): unknown;
export declare function canDropAllPaths(...args: never[]): unknown;
export declare function collapseExpandedFolderIds(...args: never[]): unknown;
export declare function cx(...values: Array<unknown>): string;
export declare const Keycap: HostComponent;
export declare function getDesktopBridge(...args: never[]): unknown;
export declare function getTopLevelDraggedPaths(...args: never[]): unknown;
export declare function lazyRouteWithRecovery(...args: never[]): unknown;
export declare function normalizeOpenFileIds(...args: never[]): unknown;
export declare function readStoredExpandedFolderIds(...args: never[]): unknown;
export declare function readStoredOpenFileIds(...args: never[]): unknown;
export declare function readStoredRecentlyClosedFileIds(...args: never[]): unknown;
export declare function recordRecentlyClosedFileId(...args: never[]): unknown;
export declare function removeOpenFileId(...args: never[]): unknown;
export declare function renameExpandedFolderIds(...args: never[]): unknown;
export declare function renameOpenFileIds(...args: never[]): unknown;
export declare function shouldUseNativeAppContextMenus(...args: never[]): unknown;
export declare function useApi(...args: never[]): unknown;
export declare function useFileTreeModel(...args: never[]): unknown;
export declare function useInvalidateOnTopics(...args: never[]): unknown;
export declare function writeStoredExpandedFolderIds(...args: never[]): unknown;
export declare function writeStoredOpenFileIds(...args: never[]): unknown;
export declare function writeStoredRecentlyClosedFileIds(...args: never[]): unknown;
