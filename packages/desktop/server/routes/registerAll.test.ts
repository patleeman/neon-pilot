import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeModules = vi.hoisted(() => ({
  registerActivityEntriesRoutes: vi.fn(),
  registerAppTelemetryRoutes: vi.fn(),
  registerConversationRoutes: vi.fn(),
  registerDocumentsRoutes: vi.fn(),
  registerConversationActivityRoutes: vi.fn(),
  registerConversationStateRoutes: vi.fn(),
  registerExecutionRoutes: vi.fn(),
  registerExtensionRoutes: vi.fn(),
  registerFilePickerRoutes: vi.fn(),
  registerGlobalActivityRoutes: vi.fn(),
  registerInboxRoutes: vi.fn(),
  registerLiveSessionRoutes: vi.fn(),
  registerModelRoutes: vi.fn(),
  registerRunAppRoutes: vi.fn(),
  registerSecretRoutes: vi.fn(),
  registerSettingsRoutes: vi.fn(),
  registerSetupReadinessRoutes: vi.fn(),
  registerSystemRoutes: vi.fn(),
  registerToolsRoutes: vi.fn(),
  registerWorkspaceExplorerRoutes: vi.fn(),
}));

vi.mock('./activity.js', () => ({ registerActivityEntriesRoutes: routeModules.registerActivityEntriesRoutes }));
vi.mock('./appTelemetry.js', () => ({ registerAppTelemetryRoutes: routeModules.registerAppTelemetryRoutes }));
vi.mock('./conversations.js', () => ({ registerConversationRoutes: routeModules.registerConversationRoutes }));
vi.mock('./conversationActivity.js', () => ({ registerConversationActivityRoutes: routeModules.registerConversationActivityRoutes }));
vi.mock('./documents.js', () => ({ registerDocumentsRoutes: routeModules.registerDocumentsRoutes }));
vi.mock('./conversationState.js', () => ({ registerConversationStateRoutes: routeModules.registerConversationStateRoutes }));
vi.mock('./executions.js', () => ({ registerExecutionRoutes: routeModules.registerExecutionRoutes }));
vi.mock('./extensions.js', () => ({ registerExtensionRoutes: routeModules.registerExtensionRoutes }));
vi.mock('./filePicker.js', () => ({ registerFilePickerRoutes: routeModules.registerFilePickerRoutes }));
vi.mock('./globalActivity.js', () => ({ registerGlobalActivityRoutes: routeModules.registerGlobalActivityRoutes }));
vi.mock('./inbox.js', () => ({ registerInboxRoutes: routeModules.registerInboxRoutes }));
vi.mock('./liveSessions.js', () => ({ registerLiveSessionRoutes: routeModules.registerLiveSessionRoutes }));
vi.mock('./models.js', () => ({ registerModelRoutes: routeModules.registerModelRoutes }));
vi.mock('./runsApp.js', () => ({ registerRunAppRoutes: routeModules.registerRunAppRoutes }));
vi.mock('./secrets.js', () => ({ registerSecretRoutes: routeModules.registerSecretRoutes }));
vi.mock('./settings.js', () => ({ registerSettingsRoutes: routeModules.registerSettingsRoutes }));
vi.mock('./setupReadiness.js', () => ({ registerSetupReadinessRoutes: routeModules.registerSetupReadinessRoutes }));
vi.mock('./system.js', () => ({ registerSystemRoutes: routeModules.registerSystemRoutes }));
vi.mock('./tools.js', () => ({ registerToolsRoutes: routeModules.registerToolsRoutes }));
vi.mock('./workspaceExplorer.js', () => ({ registerWorkspaceExplorerRoutes: routeModules.registerWorkspaceExplorerRoutes }));

import { registerServerRoutes } from './registerAll.js';

describe('registerServerRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers all server route groups with the expected app/context arguments and order', () => {
    const app = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
    const context = { getRuntimeScope: vi.fn() };

    registerServerRoutes({ app: app as never, context: context as never });

    expect(routeModules.registerAppTelemetryRoutes).toHaveBeenCalledWith(app);
    expect(routeModules.registerDocumentsRoutes).toHaveBeenCalledWith(app, context);
    expect(routeModules.registerExecutionRoutes).toHaveBeenCalledWith(app);
    expect(routeModules.registerGlobalActivityRoutes).toHaveBeenCalledWith(app, context);
    expect(routeModules.registerInboxRoutes).toHaveBeenCalledWith(app, context);
    expect(routeModules.registerActivityEntriesRoutes).toHaveBeenCalledWith(app, context);

    for (const register of [
      routeModules.registerDocumentsRoutes,
      routeModules.registerSettingsRoutes,
      routeModules.registerSecretRoutes,
      routeModules.registerExtensionRoutes,
      routeModules.registerSetupReadinessRoutes,
      routeModules.registerModelRoutes,
      routeModules.registerToolsRoutes,
      routeModules.registerSystemRoutes,
      routeModules.registerConversationRoutes,
      routeModules.registerConversationActivityRoutes,
      routeModules.registerConversationStateRoutes,
      routeModules.registerLiveSessionRoutes,
      routeModules.registerRunAppRoutes,
      routeModules.registerFilePickerRoutes,
      routeModules.registerWorkspaceExplorerRoutes,
      routeModules.registerInboxRoutes,
      routeModules.registerActivityEntriesRoutes,
    ]) {
      expect(register).toHaveBeenCalledWith(app, context);
    }

    const invocationOrder = [
      routeModules.registerAppTelemetryRoutes,
      routeModules.registerDocumentsRoutes,
      routeModules.registerSettingsRoutes,
      routeModules.registerSecretRoutes,
      routeModules.registerExtensionRoutes,
      routeModules.registerSetupReadinessRoutes,
      routeModules.registerModelRoutes,
      routeModules.registerToolsRoutes,
      routeModules.registerSystemRoutes,
      routeModules.registerConversationRoutes,
      routeModules.registerConversationActivityRoutes,
      routeModules.registerConversationStateRoutes,
      routeModules.registerLiveSessionRoutes,
      routeModules.registerExecutionRoutes,
      routeModules.registerGlobalActivityRoutes,
      routeModules.registerActivityEntriesRoutes,
      routeModules.registerInboxRoutes,
      routeModules.registerRunAppRoutes,
      routeModules.registerFilePickerRoutes,
      routeModules.registerWorkspaceExplorerRoutes,
    ].map((register) => register.mock.invocationCallOrder[0]);
    expect(invocationOrder).toEqual([...invocationOrder].sort((a, b) => a - b));
  });
});
