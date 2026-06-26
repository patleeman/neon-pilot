// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoutinesPage } from './RoutinesPage.js';
import type { Routine, RoutineRunRecord } from './types.js';

const baseState = {
  hooks: [
    {
      id: 'checkpoint',
      title: 'Checkpoint',
      group: 'Tools',
      description: 'Routines that run around checkpointing.',
      ownerExtensionId: 'system-diffs',
      variables: [],
      summary: 'Review code changes',
    },
  ],
  routines: [
    {
      id: 'r1',
      hookId: 'checkpoint',
      position: 'before',
      type: 'decision',
      name: 'Review code changes',
      instruction: 'Use /skill:autoreview',
      enabled: true,
      order: 0,
      failureBehavior: 'block',
      outcomes: [{ id: 'pass', label: 'Pass', target: 'Continue checkpoint', behavior: 'continue' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ] satisfies Routine[],
  runs: [],
};

function cloneState() {
  return JSON.parse(JSON.stringify(baseState)) as typeof baseState;
}

function cloneStateFrom(state: typeof baseState) {
  return JSON.parse(JSON.stringify(state)) as typeof baseState;
}

function createPa() {
  const state = cloneState();
  let invalidationHandler: ((event: { topics: string[] }) => void) | null = null;
  const invoke = vi.fn(async (action: string, input: unknown) => {
    if (action === 'listSkills') return { skills: [{ id: 'autoreview', name: 'Autoreview' }] };
    if (action === 'saveRoutine') {
      const routine = input as Routine;
      const index = state.routines.findIndex((item) => item.id === routine.id);
      if (index >= 0) state.routines[index] = routine;
      else state.routines.push(routine);
      return cloneStateFrom(state);
    }
    if (action === 'deleteRoutine') {
      const routineId = (input as { routineId: string }).routineId;
      state.routines = state.routines.filter((routine) => routine.id !== routineId);
      return cloneStateFrom(state);
    }
    if (action === 'moveRoutine') {
      const { routineId, position } = input as { routineId: string; position: 'before' | 'after' };
      state.routines = state.routines.map((routine) => (routine.id === routineId ? { ...routine, position } : routine));
      return cloneStateFrom(state);
    }
    return cloneStateFrom(state);
  });
  return {
    pa: {
      extension: { invoke },
      models: vi.fn(async () => [
        { id: 'gpt-5.4', provider: 'openai-codex', name: 'GPT-5.4' },
        { id: 'deepseek-v4-flash', provider: 'ds4', name: 'DeepSeek V4 Flash' },
      ]),
      ui: {
        toast: vi.fn(),
        confirm: vi.fn(async () => true),
        subscribeInvalidations: vi.fn((handler: (event: { topics: string[] }) => void) => {
          invalidationHandler = handler;
          return {
            unsubscribe: vi.fn(() => {
              if (invalidationHandler === handler) invalidationHandler = null;
            }),
          };
        }),
      },
    } as never,
    invoke,
    state,
    emitInvalidation: (topics: string[]) => invalidationHandler?.({ topics }),
  };
}

function props(pa: never) {
  return {
    pa,
    context: { extensionId: 'system-routines', surfaceId: 'page', pathname: '/routines', route: '/routines', search: '', hash: '' },
    surface: { id: 'page', title: 'Routines', location: 'main', component: 'RoutinesPage' },
    params: {},
  } as never;
}

function editReviewRoutine() {
  fireEvent.click(screen.getAllByText('Edit')[0]);
}

describe('RoutinesPage', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the timeline with inline route lanes', async () => {
    const { pa } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    expect(await screen.findByText('Checkpoint timeline')).toBeTruthy();
    expect(screen.getAllByText('Review code changes').length).toBeGreaterThan(0);
    expect(screen.getByText('Add routine ▾')).toBeTruthy();
    expect(screen.getByText('If judge returns pass')).toBeTruthy();
  });

  it('edits paths inline and collapses the form after save', async () => {
    const { pa, invoke } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('Checkpoint timeline');

    editReviewRoutine();
    fireEvent.click(screen.getByText('Add route'));
    expect(screen.getByDisplayValue('new_path')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('new_path'), { target: { value: 'needs_qa' } });
    fireEvent.change(screen.getByDisplayValue('Describe this path'), { target: { value: 'Run QA' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('saveRoutine', expect.objectContaining({ name: 'Review code changes' })));
    await waitFor(() => expect(screen.queryByDisplayValue('needs_qa')).toBeNull());
    expect(screen.getByText('needs_qa')).toBeTruthy();
    expect(screen.getByText('Run QA')).toBeTruthy();
  });

  it('shows a next-routine selector for branch paths', async () => {
    const { pa } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('Checkpoint timeline');

    fireEvent.click(screen.getByText('Add routine ▾'));
    fireEvent.click(screen.getAllByText('Instruction')[0]);
    fireEvent.change(screen.getByDisplayValue('New instruction'), { target: { value: 'Linked follow-up routine' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.queryByDisplayValue('Linked follow-up routine')).toBeNull());

    editReviewRoutine();
    const effectSelect = screen.getAllByDisplayValue('Continue').at(-1);
    expect(effectSelect).toBeTruthy();
    fireEvent.change(effectSelect as HTMLElement, { target: { value: 'branch' } });

    expect(await screen.findByText('Then run')).toBeTruthy();
    expect(screen.getByText('Linked follow-up routine (before)')).toBeTruthy();
  });

  it('opens routine actions from the larger dots menu', async () => {
    const { pa, invoke } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('Checkpoint timeline');

    fireEvent.click(screen.getByLabelText('More actions for Review code changes'));
    expect(screen.getByText('Move to After')).toBeTruthy();
    expect(screen.queryByText('Edit routine')).toBeNull();
    fireEvent.click(screen.getByText('Move to After'));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('moveRoutine', expect.objectContaining({ routineId: 'r1', position: 'after' })),
    );
  });

  it('inserts a skill reference and deletes a temporary routine', async () => {
    const { pa, invoke } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('Checkpoint timeline');

    fireEvent.click(screen.getByText('Add routine ▾'));
    fireEvent.click(screen.getAllByText('Instruction')[0]);
    fireEvent.change(screen.getByDisplayValue('New instruction'), { target: { value: 'Temporary instruction' } });
    const instructionBox = screen.getByRole('textbox', { name: /instruction/i });
    fireEvent.change(instructionBox, { target: { value: 'Use /skill:' } });
    fireEvent.click(await screen.findByText('/skill:autoreview'));
    expect(screen.getByDisplayValue('Use /skill:autoreview')).toBeTruthy();
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('saveRoutine', expect.objectContaining({ name: 'Temporary instruction' })));

    await screen.findByText('Temporary instruction');
    fireEvent.click(screen.getByLabelText('More actions for Temporary instruction'));
    fireEvent.click(screen.getByText('Delete routine'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('deleteRoutine', expect.objectContaining({ routineId: expect.any(String) })));
  });

  it('refreshes run history when routines are invalidated', async () => {
    const { pa, state, emitInvalidation } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('Checkpoint timeline');

    fireEvent.click(screen.getByText('Runs'));
    expect(screen.getByText('No routine runs yet.')).toBeTruthy();

    state.runs.unshift({
      id: 'run-qa',
      hookId: 'checkpoint',
      position: 'before',
      status: 'blocked',
      startedAt: '2026-01-01T00:01:00.000Z',
      completedAt: '2026-01-01T00:01:00.000Z',
      context: {},
      steps: [
        {
          routineId: 'r1',
          routineName: 'Review code changes',
          status: 'blocked',
          message: 'Blocked by QA',
          skillRefs: [],
        },
      ],
    } satisfies RoutineRunRecord);

    await act(async () => {
      emitInvalidation(['routines']);
      await Promise.resolve();
    });

    expect(await screen.findByText(/Review code changes: blocked/)).toBeTruthy();
    expect(screen.getByText(/Blocked by QA/)).toBeTruthy();
  });

  it('sanitizes persisted structured provider errors in run history', async () => {
    const { pa, state } = createPa();
    state.runs.unshift({
      id: 'run-raw-error',
      hookId: 'checkpoint',
      position: 'before',
      status: 'warned',
      startedAt: '2026-01-01T00:01:00.000Z',
      completedAt: '2026-01-01T00:01:00.000Z',
      context: {},
      steps: [
        {
          routineId: 'r1',
          routineName: 'Review code changes',
          status: 'warned',
          message:
            'Codex error: {"type":"error","error":{"type":"usage_limit_reached","message":"The usage limit has been reached"},"status_code":429,"headers":{"X-Codex-Active-Limit":"codex_bengalfox"}}',
          skillRefs: [],
        },
      ],
    } satisfies RoutineRunRecord);

    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('Checkpoint timeline');
    fireEvent.click(screen.getByText('Runs'));

    expect(await screen.findByText(/Routine model call failed \(429\): The usage limit has been reached/)).toBeTruthy();
    expect(screen.queryByText(/X-Codex/)).toBeNull();
    expect(screen.queryByText(/headers/)).toBeNull();
  });

  it('polls run history while the Runs view is open', async () => {
    const { pa, state } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('Checkpoint timeline');

    vi.useFakeTimers();
    fireEvent.click(screen.getByText('Runs'));
    expect(screen.getByText('No routine runs yet.')).toBeTruthy();

    state.runs.unshift({
      id: 'run-polled',
      hookId: 'checkpoint',
      position: 'before',
      status: 'warned',
      startedAt: '2026-01-01T00:02:00.000Z',
      completedAt: '2026-01-01T00:02:00.000Z',
      context: {},
      steps: [
        {
          routineId: 'r1',
          routineName: 'Review code changes',
          status: 'warned',
          message: 'Polled run',
          skillRefs: [],
        },
      ],
    } satisfies RoutineRunRecord);

    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });
    vi.useRealTimers();

    expect(await screen.findByText(/Review code changes: warned/)).toBeTruthy();
    expect(screen.getByText(/Polled run/)).toBeTruthy();
  });
});
