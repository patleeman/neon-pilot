import { describe, expect, it } from 'vitest';

import * as artifacts from './artifacts.js';
import * as browser from './browser.js';
import * as checkpoints from './checkpoints.js';
import * as images from './images.js';
import * as mcp from './mcp.js';

describe('backendApi re-export modules', () => {
  it('exposes conversation artifact helpers', () => {
    expect(artifacts.saveConversationArtifact).toBeTypeOf('function');
    expect(artifacts.getConversationArtifact).toBeTypeOf('function');
    expect(artifacts.listConversationArtifacts).toBeTypeOf('function');
    expect(artifacts.deleteConversationArtifact).toBeTypeOf('function');
  });

  it('exposes checkpoint helpers from core', () => {
    expect(checkpoints.saveConversationCommitCheckpoint).toBeTypeOf('function');
    expect(checkpoints.getConversationCommitCheckpoint).toBeTypeOf('function');
    expect(checkpoints.listConversationCommitCheckpoints).toBeTypeOf('function');
  });

  it('exposes browser, image attachment, and MCP helpers', () => {
    expect(browser.getWorkbenchBrowserToolHost).toBeTypeOf('function');
    expect(images.rememberImageProbeAttachments).toBeTypeOf('function');
    expect(images.getImageProbeAttachments).toBeTypeOf('function');
    expect(images.getImageProbeAttachmentsById).toBeTypeOf('function');
    expect(images.clearImageProbeAttachmentCacheForTests).toBeTypeOf('function');
    expect(mcp.callMcpTool).toBeTypeOf('function');
    expect(mcp.inspectMcpServer).toBeTypeOf('function');
    expect(mcp.readMcpConfigDocument).toBeTypeOf('function');
  });
});
