import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  cancelAttentionEvent: vi.fn(),
  createReadyAttentionEvent: vi.fn(),
  getSessionAttentionEvents: vi.fn(),
  loadAttentionEventsState: vi.fn(),
  parseDeferredResumeDelayMs: vi.fn(),
  readSessionConversationId: vi.fn(),
  saveAttentionEventsState: vi.fn(),
  scheduleAttentionEvent: vi.fn(),
}));
const humanDate = vi.hoisted(() => ({ parseFutureHumanDateTime: vi.fn() }));

vi.mock('@neon-pilot/core', () => core);
vi.mock('./humanDateTime.js', () => humanDate);

import {
  cancelAttentionEventForSessionFile,
  enqueueAttentionEventForSessionFile,
  listAttentionEventsForSessionFile,
} from './attentionEvents.js';

describe('attentionEvents', () => {
  const now = new Date('2026-05-22T12:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    core.loadAttentionEventsState.mockReturnValue({ events: {} });
    core.parseDeferredResumeDelayMs.mockReturnValue(60_000);
    core.readSessionConversationId.mockReturnValue('conv-from-session');
    core.createReadyAttentionEvent.mockImplementation((_state, record) => ({ ...record, status: 'ready' }));
    core.scheduleAttentionEvent.mockImplementation((_state, record) => ({ ...record, status: 'scheduled' }));
    core.cancelAttentionEvent.mockImplementation((_state, { id }) => ({ id, status: 'cancelled', sessionFile: '/session.json' }));
    humanDate.parseFutureHumanDateTime.mockReturnValue({ dueAt: '2026-05-23T12:00:00.000Z' });
  });

  it('lists attention events for a session from persisted state', () => {
    const state = { events: { event: { id: 'event' } } };
    core.loadAttentionEventsState.mockReturnValue(state);
    core.getSessionAttentionEvents.mockReturnValue([{ id: 'event' }]);

    expect(listAttentionEventsForSessionFile('/session.json')).toEqual([{ id: 'event' }]);
    expect(core.getSessionAttentionEvents).toHaveBeenCalledWith(state, '/session.json');
  });

  it('creates ready attention events immediately by default with trimmed fields and fallback conversation id', () => {
    const record = enqueueAttentionEventForSessionFile({ sessionFile: '/session.json', title: ' Title ', prompt: ' Continue ', now });

    expect(record).toMatchObject({
      id: 'attention_1779451200000_4fzzzxjy',
      sessionFile: '/session.json',
      conversationId: 'conv-from-session',
      title: 'Title',
      prompt: 'Continue',
      dueAt: now.toISOString(),
      readyAt: now.toISOString(),
      createdAt: now.toISOString(),
      attempts: 0,
      source: { kind: 'extension' },
      status: 'ready',
    });
    expect(core.createReadyAttentionEvent).toHaveBeenCalled();
    expect(core.saveAttentionEventsState).toHaveBeenCalledWith({ events: {} });
  });

  it('schedules future attention events from delay or natural at expressions', () => {
    const delayed = enqueueAttentionEventForSessionFile({
      sessionFile: '/session.json',
      conversationId: ' explicit ',
      prompt: 'Later',
      delay: '1m',
      now,
    });
    expect(delayed).toMatchObject({ conversationId: 'explicit', dueAt: '2026-05-22T12:01:00.000Z', status: 'scheduled' });
    expect(core.parseDeferredResumeDelayMs).toHaveBeenCalledWith('1m');

    const at = enqueueAttentionEventForSessionFile({ sessionFile: '/session.json', prompt: 'Tomorrow', at: 'tomorrow noon', now });
    expect(at).toMatchObject({ dueAt: '2026-05-23T12:00:00.000Z', status: 'scheduled' });
    expect(humanDate.parseFutureHumanDateTime).toHaveBeenCalledWith('tomorrow noon', { now });
  });

  it('rejects ambiguous and invalid schedule inputs', () => {
    expect(() =>
      enqueueAttentionEventForSessionFile({ sessionFile: '/session.json', prompt: 'Bad', delay: '1m', at: 'tomorrow', now }),
    ).toThrow('Specify only one of delay or at.');
    core.parseDeferredResumeDelayMs.mockReturnValueOnce(undefined);
    expect(() => enqueueAttentionEventForSessionFile({ sessionFile: '/session.json', prompt: 'Bad', delay: 'soon', now })).toThrow(
      'Invalid delay. Use forms like 30s, 10m, 10 minutes, 2h, or 1d.',
    );
  });

  it('cancels only events belonging to the requested session file', () => {
    const state = { events: { event: { id: 'event', sessionFile: '/session.json' }, other: { id: 'other', sessionFile: '/other.json' } } };
    core.loadAttentionEventsState.mockReturnValue(state);

    expect(cancelAttentionEventForSessionFile({ sessionFile: '/session.json', id: 'event' })).toEqual({
      id: 'event',
      status: 'cancelled',
      sessionFile: '/session.json',
    });
    expect(core.cancelAttentionEvent).toHaveBeenCalledWith(state, { id: 'event' });
    expect(core.saveAttentionEventsState).toHaveBeenCalledWith(state);
    expect(() => cancelAttentionEventForSessionFile({ sessionFile: '/session.json', id: 'other' })).toThrow(
      'No attention event found for this conversation: other',
    );
  });
});
