/**
 * Runtime state management
 *
 * Provides path resolution and bootstrap validation for mutable
 * runtime state (auth, sessions, cache) outside managed repo files.
 */

// Path resolution
export {
  getConfigRoot,
  getDefaultConfigRoot,
  getDefaultKnowledgeRoot,
  getDefaultLocalProfileDir,
  getDefaultLocalRuntimeConfigDir,
  getDefaultProfilesRoot,
  getDefaultRuntimeConfigRoot,
  getDefaultStateRoot,
  getDefaultVaultRoot,
  getDurableAgentFilePath,
  getDurableConversationAttentionDir,
  getDurableMemoryDir,
  getDurableModelsDir,
  getDurableNodesDir,
  getDurableNotesDir,
  getDurablePiAgentDir,
  getDurableProfileDir,
  getDurableProfileModelsFilePath,
  getDurableProfilesDir,
  getDurableProfileSettingsFilePath,
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
  getLocalProfileDir,
  getLocalRuntimeConfigDir,
  getPiAgentRuntimeDir,
  getPiAgentStateDir,
  getProfilesRoot,
  getRuntimeConfigRoot,
  getStateRoot,
  getSyncRoot,
  getVaultRoot,
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
