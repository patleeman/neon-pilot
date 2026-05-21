import { registerAppTelemetryRoutes } from './appTelemetry.js';
import { registerCompanionProxyRoutes } from './companionProxy.js';
import type { RegisterServerRoutesInput } from './context.js';
import { registerConversationRoutes } from './conversations.js';
import { registerConversationStateRoutes } from './conversationState.js';
import { registerExecutionRoutes } from './executions.js';
import { registerExtensionRoutes } from './extensions.js';
import { registerFilePickerRoutes } from './filePicker.js';
import { registerGatewayRoutes } from './gateways.js';
import { registerLiveSessionRoutes } from './liveSessions.js';
import { registerMemoryNotesRoutes } from './memoryNotes.js';
import { registerModelRoutes } from './models.js';
import { registerRunAppRoutes } from './runsApp.js';
import { registerSecretRoutes } from './secrets.js';
import { registerSettingsRoutes } from './settings.js';
import { registerSystemRoutes } from './system.js';
import { registerToolsRoutes } from './tools.js';
import { registerVaultEditorRoutes } from './vaultEditor.js';
import { registerWorkspaceExplorerRoutes } from './workspaceExplorer.js';

export function registerServerRoutes({ app, context }: RegisterServerRoutesInput): void {
  registerAppTelemetryRoutes(app);

  registerCompanionProxyRoutes(app);

  registerSettingsRoutes(app, context);

  registerSecretRoutes(app, context);

  registerGatewayRoutes(app, context);

  registerExtensionRoutes(app, context);

  registerModelRoutes(app, context);

  registerToolsRoutes(app, context);

  registerSystemRoutes(app, context);

  registerConversationRoutes(app, context);

  registerConversationStateRoutes(app, context);

  registerLiveSessionRoutes(app, context);

  registerExecutionRoutes(app);

  registerRunAppRoutes(app, context);

  registerMemoryNotesRoutes(app, context);

  registerFilePickerRoutes(app, context);
  registerWorkspaceExplorerRoutes(app, context);

  registerVaultEditorRoutes(app);
}
