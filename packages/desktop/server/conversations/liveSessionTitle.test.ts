import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({ resolveLiveSessionFile: vi.fn() }));
const sessions = vi.hoisted(() => ({ readSessionMetaByFile: vi.fn() }));

vi.mock('./liveSessionPersistence.js', () => persistence);
vi.mock('./sessions.js', () => sessions);

import {
  buildFallbackTitleFromContent,
  getSessionMessages,
  isPlaceholderConversationTitle,
  resolveStableSessionTitle,
} from './liveSessionTitle.js';

describe('liveSessionTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistence.resolveLiveSessionFile.mockReturnValue(null);
    sessions.readSessionMetaByFile.mockReturnValue(null);
  });

  it('builds fallback titles from text and valid image content', () => {
    expect(buildFallbackTitleFromContent('hello\nworld')).toBe('hello world');
    expect(buildFallbackTitleFromContent([{ type: 'text', text: '  typed title  ' }])).toBe('typed title');
    expect(buildFallbackTitleFromContent([{ type: 'image', mimeType: 'image/png', data: Buffer.from('x').toString('base64') }])).toBe(
      '(image attachment)',
    );
    expect(
      buildFallbackTitleFromContent([
        { type: 'image', mimeType: 'image/png', data: Buffer.from('x').toString('base64') },
        { type: 'image', mimeType: 'image/jpeg', data: Buffer.from('y').toString('base64') },
        { type: 'image', mimeType: 'text/plain', data: Buffer.from('z').toString('base64') },
      ]),
    ).toBe('(2 image attachments)');
    expect(buildFallbackTitleFromContent([{ type: 'image', mimeType: 'image/png', data: 'bad!' }])).toBe('');
  });

  it('detects placeholder titles', () => {
    expect(isPlaceholderConversationTitle(undefined)).toBe(true);
    expect(isPlaceholderConversationTitle('')).toBe(true);
    expect(isPlaceholderConversationTitle(' New Conversation ')).toBe(true);
    expect(isPlaceholderConversationTitle('(new conversation)')).toBe(true);
    expect(isPlaceholderConversationTitle('Planning')).toBe(false);
  });

  it('reads messages from current or legacy agent state', () => {
    expect(getSessionMessages({ state: { messages: [{ role: 'user', content: 'state' }] } } as never)).toEqual([
      { role: 'user', content: 'state' },
    ]);
    expect(getSessionMessages({ agent: { state: { messages: [{ role: 'user', content: 'agent' }] } } } as never)).toEqual([
      { role: 'user', content: 'agent' },
    ]);
    expect(getSessionMessages({} as never)).toEqual([]);
  });

  it('prefers live session names, then persisted non-placeholder titles, then first user content', () => {
    expect(resolveStableSessionTitle({ sessionManager: { getSessionName: () => ' Live Title ' } } as never)).toBe('Live Title');
    expect(resolveStableSessionTitle({ sessionName: ' Session Name ' } as never)).toBe('Session Name');

    persistence.resolveLiveSessionFile.mockReturnValue('/session.json');
    sessions.readSessionMetaByFile.mockReturnValue({ title: ' Persisted Title ' });
    expect(resolveStableSessionTitle({ state: { messages: [{ role: 'user', content: 'fallback' }] } } as never)).toBe('Persisted Title');

    sessions.readSessionMetaByFile.mockReturnValue({ title: 'New Conversation' });
    expect(
      resolveStableSessionTitle({
        state: {
          messages: [
            { role: 'assistant', content: 'skip' },
            { role: 'user', content: 'Fallback text' },
          ],
        },
      } as never),
    ).toBe('Fallback text');
  });
});
