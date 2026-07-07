/**
 * Runtime state management
 *
 * Provides path resolution and bootstrap validation for mutable
 * runtime state (auth, sessions, cache) outside managed repo files.
 */

// Path resolution
export {
  type DesktopRootLayout,
  type DesktopRootOptions,
  ensureDesktopRootDir,
  getDefaultDesktopRoot,
  getDesktopRootDir,
  getRuntimeAuthFilePath,
  getRuntimeModelsFilePath,
  getRuntimeSessionsIndexFilePath,
  getSkillsRegistryFilePath,
  resolveDesktopAppDataDir,
  resolveDesktopRootLayout,
} from './desktop-root.js';
export {
  getConfigRoot,
  getDefaultConfigRoot,
  getDefaultKnowledgeRoot,
  getDefaultLocalRuntimeConfigDir,
  getDefaultRuntimeConfigRoot,
  getDefaultStateRoot,
  getDurableAgentFilePath,
  getDurableConversationAttentionDir,
  getDurableMemoryDir,
  getDurableModelsDir,
  getDurableNodesDir,
  getDurableNotesDir,
  getDurablePiAgentDir,
  getDurableProjectsDir,
  getDurableRuntimeConfigRoot,
  getDurableRuntimeScopeDir,
  getDurableRuntimeScopeModelsFilePath,
  getDurableRuntimeScopeSettingsFilePath,
  getDurableSessionsDir,
  getDurableSettingsDir,
  getDurableSkillsDir,
  getDurableTasksDir,
  getKnowledgeRoot,
  getLocalRuntimeConfigDir,
  getPiAgentRuntimeDir,
  getPiAgentStateDir,
  getRuntimeConfigRoot,
  getStateRoot,
  getSyncRoot,
  isPathInRepo,
  resolveNeutralChatCwd,
  resolveStatePaths,
  type RuntimeStatePaths,
  validateStatePathsOutsideRepo,
} from './paths.js';

// Bootstrap validation
export { type BootstrapError, type BootstrapResult, bootstrapState, bootstrapStateOrThrow, canBootstrap } from './bootstrap.js';

// Pi agent runtime directory
export { preparePiAgentDir, type PreparePiAgentDirOptions, type PreparePiAgentDirResult } from './agent-dir.js';
