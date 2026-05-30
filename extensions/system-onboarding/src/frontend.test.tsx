// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingBootstrap } from './frontend';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('OnboardingBootstrap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates to the onboarding conversation with client-side routing', async () => {
    const invoke = vi.fn().mockResolvedValue({ conversationId: 'conv-1', shouldOpen: true });
    const pa = {
      extension: {
        invoke,
      },
    } as never;

    render(
      <MemoryRouter initialEntries={['/']}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByTestId('location').textContent).toBe('/conversations/conv-1');
    expect(invoke).toHaveBeenCalledWith('ensure', { source: 'frontend' });
  });

  it('does not invoke onboarding from non-landing pages', async () => {
    const invoke = vi.fn().mockResolvedValue({ conversationId: 'conv-1', shouldOpen: true });
    const pa = {
      extension: {
        invoke,
      },
    } as never;

    render(
      <MemoryRouter initialEntries={['/knowledge']}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe('/knowledge');
  });

  it('does not invoke onboarding from settings', async () => {
    const invoke = vi.fn().mockResolvedValue({ created: false, skipped: 'completed' });
    const pa = {
      extension: {
        invoke,
      },
    } as never;

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe('/settings');
  });

  it('does not invoke onboarding from the draft route after it was already consumed', async () => {
    const invoke = vi.fn().mockResolvedValue({
      created: false,
      conversationId: 'conv-1',
      skipped: 'completed',
      shouldOpen: false,
    });
    const pa = {
      extension: {
        invoke,
      },
    } as never;

    render(
      <MemoryRouter initialEntries={['/conversations/new']}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe('/conversations/new');
  });

  it('does not invoke onboarding over an empty draft composer', async () => {
    const invoke = vi.fn().mockResolvedValue({ conversationId: 'conv-1', shouldOpen: true });
    const pa = {
      extension: {
        invoke,
      },
    } as never;

    render(
      <MemoryRouter initialEntries={['/conversations/new']}>
        <OnboardingBootstrap pa={pa} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe('/conversations/new');
  });
});
