import { describe, expect, it } from 'vitest';

import * as artifacts from './artifacts.js';
import * as audio from './audio.js';
import * as browser from './browser.js';
import * as checkpoints from './checkpoints.js';
import * as documents from './documents.js';
import * as images from './images.js';
import * as mcp from './mcp.js';
import * as videos from './videos.js';

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

  it('exposes browser, multimedia attachment, and MCP helpers', () => {
    expect(browser.getWorkbenchBrowserToolHost).toBeTypeOf('function');
    expect(images.rememberImageProbeAttachments).toBeTypeOf('function');
    expect(images.getImageProbeAttachments).toBeTypeOf('function');
    expect(images.getImageProbeAttachmentsById).toBeTypeOf('function');
    expect(images.getImageProbeAttachmentsByIdFromAnySession).toBeTypeOf('function');
    expect(images.clearImageProbeAttachmentCacheForTests).toBeTypeOf('function');
    expect(videos.rememberVideoProbeAttachments).toBeTypeOf('function');
    expect(videos.sampleVideoFrames).toBeTypeOf('function');
    expect(videos.transcribeVideo).toBeTypeOf('function');
    expect(audio.rememberAudioProbeAttachments).toBeTypeOf('function');
    expect(audio.transcribeAudioAttachment).toBeTypeOf('function');
    expect(documents.rememberDocumentProbeAttachments).toBeTypeOf('function');
    expect(documents.extractDocumentText).toBeTypeOf('function');
    expect(mcp.callMcpTool).toBeTypeOf('function');
    expect(mcp.inspectMcpServer).toBeTypeOf('function');
    expect(mcp.readMcpConfigDocument).toBeTypeOf('function');
    expect(mcp.writeExplicitMcpConfigDocument).toBeTypeOf('function');
  });
});
