export { buildApiPath } from '../client/apiBase';
export { ActivityTreeView, type ActivityTreeDropPosition } from '../activity/ActivityTreeView';
export type { ActivityTreeItem } from '../activity/activityTree';
export { ChatRailComposer, type ChatRailComposerProps } from '../components/chat/ChatRailComposer';
export { ChatView, type ChatViewProps } from '../components/chat/ChatView';
export type { ChatViewLayout } from '../components/chat/chatViewTypes';
export { CheckpointInlineDiff } from '../components/chat/CheckpointInlineDiff';
export { DiffActionButton, GitDiffIcon } from '../components/chat/DiffActionButton';
export { ExtensionChatRail, type ExtensionChatContextMessage, type ExtensionChatRailProps } from './ExtensionChatRail';
export { ContextMenuWrapper } from '../components/shared/ContextMenuWrapper';
export { canDropAllPaths, getTopLevelDraggedPaths, useFileTreeModel } from '../components/shared/useFileTreeModel';
export {
  AppPageEmptyState,
  AppPageIntro,
  AppPageLayout,
  AppPageSection,
  AppPageToc,
  Button,
  ButtonLink,
  CheckButton,
  CodeBlock,
  cx,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DashboardGrid,
  DashboardGridCell,
  type DashboardGridColumns,
  type DashboardGridDivide,
  Disclosure,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  EmptyState,
  ErrorState,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  FilterToolbar,
  IconButton,
  type IconButtonShape,
  IconLink,
  InlineCode,
  KeyValueItem,
  KeyValueList,
  LoadingState,
  MetricTile,
  type MetricTone,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuShell,
  Notice,
  PanelHeader,
  Pill,
  PositionedMenu,
  ProgressBar,
  ProgressRow,
  ResourceListItem,
  SearchInput,
  SectionLabel,
  type SectionLabelTone,
  SegmentedControl,
  Select,
  SettingToggleRow,
  SettingsSection,
  Spinner,
  Stat,
  StatGrid,
  StatusDot,
  SurfacePanel,
  SupportingText,
  Switch,
  TabButton,
  TabList,
  TextButton,
  Textarea,
  TextInput,
  TextPromptDialog,
  type TextPromptDialogProps,
  Tooltip,
  ToolbarButton,
} from '../components/ui';
export { Keycap } from '../components/ui';
export { type DesktopKnowledgeEntryContextMenuAction, getDesktopBridge, shouldUseNativeAppContextMenus } from '../desktop/desktopBridge';
export { createDesktopAwareEventSource } from '../desktop/desktopEventSource';
export { streamExtensionRouteSse } from './extensionRouteStream';
export { useApi } from '../hooks/useApi';
export { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
export {
  addOpenFileId,
  KNOWLEDGE_OPEN_FILE_IDS_STORAGE_KEY,
  normalizeOpenFileIds,
  readStoredOpenFileIds,
  removeOpenFileId,
  renameOpenFileIds,
  writeStoredOpenFileIds,
} from '../local/knowledgeOpenFiles';
export {
  readStoredRecentlyClosedFileIds,
  recordRecentlyClosedFileId,
  writeStoredRecentlyClosedFileIds,
} from '../local/knowledgeRecentlyClosedFiles';
export {
  collapseExpandedFolderIds,
  KNOWLEDGE_TREE_EXPANDED_FOLDERS_STORAGE_KEY,
  readStoredExpandedFolderIds,
  renameExpandedFolderIds,
  writeStoredExpandedFolderIds,
} from '../local/knowledgeTreeState';
export { lazyRouteWithRecovery } from '../navigation/lazyRouteRecovery';
export { type ExtensionSettingsPanelRegistration, SettingsPanelHost } from './SettingsPanelHost';
export type { ExtensionSurfaceProps } from './types';
