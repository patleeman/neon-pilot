import { describe, expect, it } from 'vitest';

import * as browserApi from './browser.js';
import * as backendApi from './index.js';
import * as mcpApi from './mcp.js';

describe('backend api mcp/browser/index exports', () => {
  it('reexports workbench browser host accessors', () => {
    expect(browserApi.getWorkbenchBrowserToolHost).toBeTypeOf('function');
  });

  it('reexports MCP catalog/config/auth/tool helpers', () => {
    expect(mcpApi).toEqual(
      expect.objectContaining({
        authenticateMcpServer: expect.any(Function),
        buildMergedMcpConfigDocument: expect.any(Function),
        callMcpTool: expect.any(Function),
        clearMcpServerAuth: expect.any(Function),
        grepMcpTools: expect.any(Function),
        inspectMcpServer: expect.any(Function),
        inspectMcpTool: expect.any(Function),
        listMcpCatalog: expect.any(Function),
        readBundledSkillMcpManifests: expect.any(Function),
        readMcpConfigDocument: expect.any(Function),
        writeExplicitMcpConfigDocument: expect.any(Function),
      }),
    );
  });

  it('keeps the aggregate backend api barrel populated with core extension capabilities', () => {
    expect(backendApi).toEqual(
      expect.objectContaining({
        getWorkbenchBrowserToolHost: expect.any(Function),
        listMcpCatalog: expect.any(Function),
        listDurableRuns: expect.any(Function),
        buildLiveSessionResourceOptionsForRuntime: expect.any(Function),
        publishAppEvent: expect.any(Function),
        listMemoryDocs: expect.any(Function),
        saveConversationArtifact: expect.any(Function),
      }),
    );
  });
});
