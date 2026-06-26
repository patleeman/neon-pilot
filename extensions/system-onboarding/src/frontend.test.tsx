// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingBootstrap } from './frontend';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function createPa({
  ensureResult,
  updateResult,
  commandHandled = true,
}: {
  ensureResult: unknown;
  updateResult?: unknown;
  commandHandled?: boolean;
}) {
  const invoke = vi.fn((action: string, input: unknown) => {
    if (action === 'ensure') return Promise.resolve(ensureResult);
    if (action === 'update') {
      const body = input as { status?: string; stepIndex?: number };
      return Promise.resolve(
        updateResult ?? {
          state: {
            status: body.status,
            stepIndex: body.stepIndex ?? 0,
            updatedAt: '2026-06-25T00:00:00.000Z',
          },
          shouldStart: false,
        },
      );
    }
    return Promise.reject(new Error(`Unexpected action ${action}`));
  });
  const execute = vi.fn().mockResolvedValue(commandHandled);
  return {
    pa: {
      extension: { invoke },
      commands: { execute },
    } as never,
    invoke,
    execute,
  };
}

async function advanceEnsureTimer() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(900);
  });
}

async function clickButton(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
    await Promise.resolve();
  });
}

describe('OnboardingBootstrap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the guided tour from the new conversation route', async () => {
    const { pa, invoke } = createPa({
      ensureResult: {
        state: { status: 'unseen', stepIndex: 0, updatedAt: '2026-06-25T00:00:00.000Z' },
        shouldStart: true,
      },
    });

    render(
      <MemoryRouter initialEntries={['/conversations/new']}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await advanceEnsureTimer();

    expect(screen.getByTestId('onboarding-tour')).toBeTruthy();
    expect(screen.getByText('Choose your AI provider')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/settings/providers');
    expect(invoke).toHaveBeenCalledWith('ensure', { source: 'frontend' });
    expect(invoke).toHaveBeenCalledWith('update', { status: 'active', stepIndex: 0 });
  });

  it('does not auto-start from unrelated routes', async () => {
    const { pa, invoke } = createPa({
      ensureResult: {
        state: { status: 'unseen', stepIndex: 0, updatedAt: '2026-06-25T00:00:00.000Z' },
        shouldStart: true,
      },
    });

    render(
      <MemoryRouter initialEntries={['/extensions']}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await advanceEnsureTimer();

    expect(invoke).toHaveBeenCalledWith('ensure', { source: 'frontend' });
    expect(invoke).not.toHaveBeenCalledWith('update', expect.anything());
    expect(screen.queryByTestId('onboarding-tour')).toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/extensions');
  });

  it('does not auto-start when a seeded chat suppresses onboarding', async () => {
    const { pa, invoke } = createPa({
      ensureResult: {
        state: { status: 'unseen', stepIndex: 0, updatedAt: '2026-06-25T00:00:00.000Z' },
        shouldStart: true,
      },
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/conversations/new', state: { suppressOnboardingAutoStart: true } }]}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await advanceEnsureTimer();

    expect(invoke).toHaveBeenCalledWith('ensure', { source: 'frontend' });
    expect(invoke).not.toHaveBeenCalledWith('update', expect.anything());
    expect(screen.queryByTestId('onboarding-tour')).toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/conversations/new');
  });

  it('moves through real app routes with next and back', async () => {
    const { pa, invoke } = createPa({
      ensureResult: {
        state: { status: 'active', stepIndex: 0, updatedAt: '2026-06-25T00:00:00.000Z' },
        shouldStart: false,
      },
    });

    render(
      <MemoryRouter initialEntries={['/settings/providers']}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await advanceEnsureTimer();
    await clickButton('Next');

    expect(screen.getByTestId('location').textContent).toBe('/extensions');
    expect(screen.getByText('Features live in Extensions')).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith('update', { status: 'active', stepIndex: 1 });

    await clickButton('Back');

    expect(screen.getByTestId('location').textContent).toBe('/settings/providers');
    expect(invoke).toHaveBeenCalledWith('update', { status: 'active', stepIndex: 0 });
  });

  it('points the extension-building step at the Extensions page action', async () => {
    const { pa } = createPa({
      ensureResult: {
        state: { status: 'active', stepIndex: 2, updatedAt: '2026-06-25T00:00:00.000Z' },
        shouldStart: false,
      },
    });

    render(
      <MemoryRouter initialEntries={['/extensions']}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
        <button type="button" data-onboarding-target="build-extension">
          Build with agent
        </button>
      </MemoryRouter>,
    );

    await advanceEnsureTimer();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByTestId('location').textContent).toBe('/extensions');
    expect(screen.getByText('Ask for the app you want')).toBeTruthy();
    expect(screen.getByText(/The agent will ask what you want/)).toBeTruthy();
    expect(document.querySelector('.np-onboarding-highlight')).toBeTruthy();
  });

  it('persists skipped tours and hides the overlay', async () => {
    const { pa, invoke } = createPa({
      ensureResult: {
        state: { status: 'active', stepIndex: 1, updatedAt: '2026-06-25T00:00:00.000Z' },
        shouldStart: false,
      },
    });

    render(
      <MemoryRouter initialEntries={['/extensions']}>
        <OnboardingBootstrap pa={pa} />
      </MemoryRouter>,
    );

    await advanceEnsureTimer();
    await clickButton('Skip tour');

    expect(screen.queryByTestId('onboarding-tour')).toBeNull();
    expect(invoke).toHaveBeenCalledWith('update', { status: 'skipped', stepIndex: 1 });
  });

  it('finishes by drafting a first-message prompt in a new conversation', async () => {
    const { pa, invoke, execute } = createPa({
      ensureResult: {
        state: { status: 'active', stepIndex: 4, updatedAt: '2026-06-25T00:00:00.000Z' },
        shouldStart: false,
      },
    });
    const appendedTexts: string[] = [];
    const appendListener = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail?.text === 'string') {
        appendedTexts.push(event.detail.text);
      }
    };
    window.addEventListener('neon-pilot:composer-append-text', appendListener);

    render(
      <MemoryRouter initialEntries={['/conversations/new']}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
        <textarea aria-label="Composer" />
      </MemoryRouter>,
    );

    await advanceEnsureTimer();
    await clickButton('Draft first message');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.queryByTestId('onboarding-tour')).toBeNull();
    expect(invoke).toHaveBeenCalledWith('update', { status: 'completed', stepIndex: 4 });
    expect(execute).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe('/conversations/new');
    expect(appendedTexts.join('\n')).toContain("Hi, I'm new to Neon Pilot");
    expect(appendedTexts.join('\n')).toContain('what I can do here');
    window.removeEventListener('neon-pilot:composer-append-text', appendListener);
  });
});
