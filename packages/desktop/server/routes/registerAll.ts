import { registerActivityEntriesRoutes } from './activity.js';
import { registerAppTelemetryRoutes } from './appTelemetry.js';
import type { RegisterServerRoutesInput } from './context.js';
import { registerConversationActivityRoutes } from './conversationActivity.js';
import { registerConversationRoutes } from './conversations.js';
import { registerConversationStateRoutes } from './conversationState.js';
import { registerDocumentsRoutes } from './documents.js';
import { registerExecutionRoutes } from './executions.js';
import { registerExtensionRoutes } from './extensions.js';
import { registerFilePickerRoutes } from './filePicker.js';
import { registerGlobalActivityRoutes } from './globalActivity.js';
import { registerInboxRoutes } from './inbox.js';
import { registerLiveSessionRoutes } from './liveSessions.js';
import { registerModelRoutes } from './models.js';
import { registerRunAppRoutes } from './runsApp.js';
import { registerSecretRoutes } from './secrets.js';
import { registerSettingsRoutes } from './settings.js';
import { registerSetupReadinessRoutes } from './setupReadiness.js';
import { registerSystemRoutes } from './system.js';
import { registerToolsRoutes } from './tools.js';
import { registerWorkspaceExplorerRoutes } from './workspaceExplorer.js';

export function registerServerRoutes({ app, context }: RegisterServerRoutesInput): void {
  registerAppTelemetryRoutes(app);

  registerDocumentsRoutes(app, context);

  registerSettingsRoutes(app, context);

  registerSecretRoutes(app, context);

  registerExtensionRoutes(app, context);

  registerSetupReadinessRoutes(app, context);

  registerModelRoutes(app, context);

  registerToolsRoutes(app, context);

  registerSystemRoutes(app, context);

  registerConversationRoutes(app, context);

  registerConversationActivityRoutes(app, context);

  registerConversationStateRoutes(app, context);

  registerLiveSessionRoutes(app, context);

  registerExecutionRoutes(app, context);

  registerGlobalActivityRoutes(app, context);

  registerActivityEntriesRoutes(app, context);

  registerInboxRoutes(app, context);

  registerRunAppRoutes(app, context);

  registerFilePickerRoutes(app, context);
  registerWorkspaceExplorerRoutes(app, context);
}
