// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoutinesContextRail, RoutinesPage, RoutinesSidebar } from './RoutinesPage.js';
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

function propsWithContext(
  pa: never,
  context: Partial<{ search: string; hash: string; surfaceId: string; shellPresentation: 'stable' | 'windowed' }> = {},
) {
  return {
    pa,
    context: {
      extensionId: 'system-routines',
      surfaceId: context.surfaceId ?? 'page',
      shellPresentation: context.shellPresentation,
      pathname: '/routines',
      route: '/routines',
      search: context.search ?? '',
      hash: context.hash ?? '',
    },
    surface: {
      id: context.surfaceId ?? 'page',
      title: 'Routines',
      location: context.surfaceId === 'routines-sidebar' ? 'sidebar' : context.surfaceId === 'routines-context-rail' ? 'rightRail' : 'main',
      component: 'RoutinesPage',
    },
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

  it('keeps the initial routines loading state silent', async () => {
    let resolveState: (value: typeof baseState) => void = () => {};
    const statePromise = new Promise<typeof baseState>((resolve) => {
      resolveState = resolve;
    });
    const pa = {
      extension: {
        invoke: vi.fn(async (action: string) => {
          if (action === 'listSkills') return { skills: [] };
          return statePromise;
        }),
      },
      models: vi.fn(async () => []),
      ui: {
        toast: vi.fn(),
        confirm: vi.fn(async () => true),
        subscribeInvalidations: vi.fn(() => ({ unsubscribe: vi.fn() })),
      },
    } as never;

    render(<RoutinesPage {...props(pa)} />);

    expect(screen.queryByText(/Loading routines/i)).toBeNull();
    expect(screen.getByRole('status', { name: 'Loading routines' })).toBeTruthy();

    await act(async () => {
      resolveState(cloneState());
      await statePromise;
    });
    expect(await screen.findByText('When Checkpoint runs')).toBeTruthy();
  });

  it('keeps the routines sidebar loading state silent', async () => {
    let resolveState: (value: typeof baseState) => void = () => {};
    const statePromise = new Promise<typeof baseState>((resolve) => {
      resolveState = resolve;
    });
    const pa = {
      extension: {
        invoke: vi.fn(async () => statePromise),
      },
    } as never;

    render(<RoutinesSidebar {...propsWithContext(pa, { surfaceId: 'routines-sidebar' })} />);

    expect(screen.queryByText(/Loading routines/i)).toBeNull();
    expect(screen.getByRole('status', { name: 'Loading routines' })).toBeTruthy();

    await act(async () => {
      resolveState(cloneState());
      await statePromise;
    });
    expect(await screen.findByRole('tree', { name: 'Routines' })).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('renders the timeline with inline route lanes', async () => {
    const { pa } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    expect(await screen.findByText('When Checkpoint runs')).toBeTruthy();
    expect(screen.getAllByText('Review code changes').length).toBeGreaterThan(0);
    expect(screen.getByText('Add routine ▾')).toBeTruthy();
    expect(screen.getByText('If this returns pass')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders a native windowed routines surface when hosted by the windowed shell', async () => {
    const { pa } = createPa();
    const { container } = render(<RoutinesPage {...propsWithContext(pa, { shellPresentation: 'windowed' })} />);

    expect((await screen.findAllByText('Review code changes')).length).toBeGreaterThan(1);
    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
    expect(container.querySelector('.wos-page-rail')).toBeNull();
    expect(container.querySelector('.wos-page-inspector')).toBeNull();
    expect(container.querySelector('.ui-app-page-intro')).toBeNull();
    expect(container.querySelector('.wos-page-main__header .wos-page-eyebrow')).toBeNull();
    expect(
      screen.queryByText('Put setup checks in Before, follow-up work in After, or choose a path when the event needs a decision.'),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose path' })).toBeTruthy();
    expect(screen.getByText('Events')).toBeTruthy();
    expect(screen.getAllByText('Before').length).toBeGreaterThan(1);
    expect(screen.getAllByText('After').length).toBeGreaterThan(1);
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.queryByText('Selected')).toBeNull();
    expect(screen.getByRole('button', { name: 'Runs' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Review code changes' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Review code changes' })).toBeTruthy();
    expect(container.querySelector('.wos-dialog-stack')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Close Review code changes'));
    fireEvent.click(screen.getByRole('button', { name: 'Runs' }));
    expect(screen.getByRole('dialog', { name: 'Routine runs' })).toBeTruthy();
    expect(screen.getByText('Run history appears here after routines execute.')).toBeTruthy();
    expect(screen.queryByText('Routine context')).toBeNull();
  });

  it('uses shared windowed empty-state chrome for empty routine lanes', async () => {
    const { pa, state } = createPa();
    state.routines = state.routines.map((routine) => ({ ...routine, position: 'after' }));
    const { container } = render(<RoutinesPage {...propsWithContext(pa, { shellPresentation: 'windowed' })} />);

    expect(await screen.findByText('No routines before this event.')).toBeTruthy();
    expect(screen.getAllByText('Review code changes').length).toBeGreaterThan(1);
    expect(container.querySelectorAll('.wos-empty-state')).toHaveLength(1);
    expect(container.querySelector('.wos-routine-empty')).toBeNull();
    expect(container.querySelector('.wos-routine-error')).toBeNull();
  });

  it('uses windowed loading chrome before routines are available', async () => {
    let resolveState: (value: typeof baseState) => void = () => {};
    const statePromise = new Promise<typeof baseState>((resolve) => {
      resolveState = resolve;
    });
    const pa = {
      extension: {
        invoke: vi.fn(async (action: string) => {
          if (action === 'listSkills') return { skills: [] };
          return statePromise;
        }),
      },
      models: vi.fn(async () => []),
      ui: {
        toast: vi.fn(),
        confirm: vi.fn(async () => true),
        subscribeInvalidations: vi.fn(() => ({ unsubscribe: vi.fn() })),
      },
    } as never;

    const { container } = render(<RoutinesPage {...propsWithContext(pa, { shellPresentation: 'windowed' })} />);

    expect(screen.getByRole('status', { name: 'Loading routines' })).toBeTruthy();
    expect(container.querySelector('.wos-state-block')).toBeTruthy();
    expect(container.querySelector('.ui-error-state')).toBeNull();

    await act(async () => {
      resolveState(cloneState());
      await statePromise;
    });
  });

  it('uses windowed error chrome when routines fail to load', async () => {
    const pa = {
      extension: {
        invoke: vi.fn(async (action: string) => {
          if (action === 'listSkills') return { skills: [] };
          throw new Error('Routines unavailable');
        }),
      },
      models: vi.fn(async () => []),
      ui: {
        toast: vi.fn(),
        confirm: vi.fn(async () => true),
        subscribeInvalidations: vi.fn(() => ({ unsubscribe: vi.fn() })),
      },
    } as never;

    const { container } = render(<RoutinesPage {...propsWithContext(pa, { shellPresentation: 'windowed' })} />);

    expect(await screen.findByText('Routines unavailable')).toBeTruthy();
    expect(container.querySelector('.wos-state-block[data-tone="danger"]')).toBeTruthy();
    expect(container.querySelector('.ui-error-state')).toBeNull();
    expect(container.querySelector('.ui-empty-state')).toBeNull();
  });

  it('opens the add menu for the New Routine command route', async () => {
    const { pa } = createPa();
    render(<RoutinesPage {...propsWithContext(pa, { search: '?action=new' })} />);
    await screen.findByText('When Checkpoint runs');

    expect(screen.getByText('Run one prompt before or after this event.')).toBeTruthy();
    expect(screen.getByText('Assess the event and choose a path.')).toBeTruthy();
  });

  it('closes transient menus from outside click and Escape', async () => {
    const { pa } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('When Checkpoint runs');

    fireEvent.click(screen.getByText('Add routine ▾'));
    expect(screen.getByText('Run one prompt before or after this event.')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByText('Run one prompt before or after this event.')).toBeNull());

    fireEvent.click(screen.getByText('Add routine ▾'));
    expect(screen.getAllByText('Choose path').length).toBeGreaterThan(0);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Assess the event and choose a path.')).toBeNull());
  });

  it('asks before discarding an unsaved draft when the selected event changes', async () => {
    const { pa } = createPa();
    const confirm = vi.mocked((pa as { ui: { confirm: ReturnType<typeof vi.fn> } }).ui.confirm);
    confirm.mockResolvedValueOnce(false);
    const { rerender } = render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('When Checkpoint runs');

    fireEvent.click(screen.getByText('Add routine ▾'));
    fireEvent.click(screen.getAllByText('Run prompt')[0]);
    rerender(<RoutinesPage {...propsWithContext(pa, { hash: '#background.command' })} />);

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Discard unsaved routine') })),
    );
    expect(screen.getByText('When Checkpoint runs')).toBeTruthy();
  });

  it('renders the routines sidebar as navigation without a persistent search box', async () => {
    const { pa } = createPa();
    render(<RoutinesSidebar {...propsWithContext(pa, { surfaceId: 'routines-sidebar' })} />);

    expect(await screen.findByRole('tree', { name: 'Routines' })).toBeTruthy();
    expect(screen.getByText('Checkpoint')).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add routine event' }));
    expect(screen.getByRole('button', { name: 'Done adding routine event' })).toBeTruthy();
  });

  it('keeps the context rail aligned when a checkpoint example is added locally', async () => {
    const { pa, state } = createPa();
    state.routines = [];
    state.hooks = state.hooks.map((hook) => ({ ...hook, summary: 'No routines' }));

    render(
      <>
        <RoutinesSidebar {...propsWithContext(pa, { surfaceId: 'routines-sidebar' })} />
        <RoutinesPage {...props(pa)} />
        <RoutinesContextRail {...propsWithContext(pa, { surfaceId: 'routines-context-rail' })} />
      </>,
    );

    await screen.findByText('How Routines work');
    expect(screen.getByText('No event selected')).toBeTruthy();

    fireEvent.click(screen.getAllByText('Create')[0]);

    expect(await screen.findByText('When Checkpoint runs')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('No event selected')).toBeNull());
    await waitFor(() => expect(screen.queryByText('No routines yet. Add an event to start.')).toBeNull());
    expect(screen.getAllByText('Checkpoint').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Before').length).toBeGreaterThan(0);
  });

  it('edits paths inline and collapses the form after save', async () => {
    const { pa, invoke } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('When Checkpoint runs');

    editReviewRoutine();
    fireEvent.click(screen.getByText('Add path'));
    expect(screen.getByDisplayValue('new_path')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('new_path'), { target: { value: 'needs_qa' } });
    fireEvent.change(screen.getByDisplayValue('Describe this path'), { target: { value: 'Run QA' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('saveRoutine', expect.objectContaining({ name: 'Review code changes' })));
    await waitFor(() => expect(screen.queryByDisplayValue('needs_qa')).toBeNull());
    expect(screen.getByText('needs_qa')).toBeTruthy();
    expect(screen.getByText('Run QA')).toBeTruthy();
  });

  it('keeps choose-path routines from saving after every path is removed', async () => {
    const { pa, invoke } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('When Checkpoint runs');

    editReviewRoutine();
    fireEvent.click(screen.getByText('Remove'));
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Choose-path routines need at least one path.')).toBeTruthy();
    expect(invoke).not.toHaveBeenCalledWith('saveRoutine', expect.anything());
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('shows a next-routine selector for branch paths', async () => {
    const { pa } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('When Checkpoint runs');

    fireEvent.click(screen.getByText('Add routine ▾'));
    fireEvent.click(screen.getAllByText('Run prompt')[0]);
    fireEvent.change(screen.getByDisplayValue('New prompt'), { target: { value: 'Linked follow-up routine' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.queryByDisplayValue('Linked follow-up routine')).toBeNull());

    editReviewRoutine();
    const effectSelect = screen.getAllByDisplayValue('Continue').at(-1);
    expect(effectSelect).toBeTruthy();
    fireEvent.change(effectSelect as HTMLElement, { target: { value: 'branch' } });

    expect(await screen.findByText('Then run')).toBeTruthy();
    expect(screen.getByText('Linked follow-up routine (before)')).toBeTruthy();
  });

  it('keeps row actions quiet and removes duplicate move menu actions', async () => {
    const { pa } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('When Checkpoint runs');

    expect(screen.queryByText('Move to After')).toBeNull();
    expect(screen.queryByLabelText('More actions for Review code changes')).toBeNull();
    expect(screen.getByLabelText('Delete Review code changes')).toBeTruthy();
  });

  it('inserts a skill reference and deletes a temporary routine', async () => {
    const { pa, invoke } = createPa();
    render(<RoutinesPage {...props(pa)} />);
    await screen.findByText('When Checkpoint runs');

    fireEvent.click(screen.getByText('Add routine ▾'));
    fireEvent.click(screen.getAllByText('Run prompt')[0]);
    fireEvent.change(screen.getByDisplayValue('New prompt'), { target: { value: 'Temporary instruction' } });
    const instructionBox = screen.getByRole('textbox', { name: /instruction/i });
    fireEvent.change(instructionBox, { target: { value: 'Use /skill:' } });
    fireEvent.click(await screen.findByText('/skill:autoreview'));
    expect(screen.getByDisplayValue('Use /skill:autoreview')).toBeTruthy();
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('saveRoutine', expect.objectContaining({ name: 'Temporary instruction' })));

    await screen.findByText('Temporary instruction');
    fireEvent.click(screen.getByLabelText('Delete Temporary instruction'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('deleteRoutine', expect.objectContaining({ routineId: expect.any(String) })));
  });

  it('refreshes run history when routines are invalidated', async () => {
    const { pa, state, emitInvalidation } = createPa();
    render(<RoutinesContextRail {...propsWithContext(pa, { surfaceId: 'routines-context-rail' })} />);
    await screen.findByText('Routine context');

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

    render(<RoutinesContextRail {...propsWithContext(pa, { surfaceId: 'routines-context-rail' })} />);

    expect(await screen.findByText(/Routine model call failed \(429\): The usage limit has been reached/)).toBeTruthy();
    expect(screen.queryByText(/X-Codex/)).toBeNull();
    expect(screen.queryByText(/headers/)).toBeNull();
  });
});
