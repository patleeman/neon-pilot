import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes document probe attachment operations through the document probe store', async () => {
    const documents = await import('./documents.js');
    resolver.callServerModuleExport.mockResolvedValue([]);

    await documents.clearDocumentProbeAttachmentCacheForTests();
    await documents.getDocumentProbeAttachments('session-1');
    await documents.getDocumentProbeAttachmentsById('session-1', ['doc_123456789abc']);
    await documents.getDocumentProbeAttachmentsByIdFromAnySession(['doc_123456789abc']);
    await documents.rememberDocumentProbeAttachments('session-1', []);
    await documents.extractDocumentText({ documentId: 'doc_123456789abc' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      1,
      '../../extensions/documentProbeAttachmentStore.js',
      'clearDocumentProbeAttachmentCacheForTests',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      2,
      '../../extensions/documentProbeAttachmentStore.js',
      'getDocumentProbeAttachments',
      'session-1',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      3,
      '../../extensions/documentProbeAttachmentStore.js',
      'getDocumentProbeAttachmentsById',
      'session-1',
      ['doc_123456789abc'],
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      4,
      '../../extensions/documentProbeAttachmentStore.js',
      'getDocumentProbeAttachmentsByIdFromAnySession',
      ['doc_123456789abc'],
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      5,
      '../../extensions/documentProbeAttachmentStore.js',
      'rememberDocumentProbeAttachments',
      'session-1',
      [],
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      6,
      '../../extensions/documentProbeAttachmentStore.js',
      'extractDocumentText',
      { documentId: 'doc_123456789abc' },
    );
  });
});
