// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import {
  boundsForRestoredDragStart,
  boundsForSnapTarget,
  constrainWindowBounds,
  readWindowedOsTheme,
  resolveSnapTarget,
  resolveWindowedOsTheme,
  resolveWindowedOsThemePhase,
  resolveWindowedOsThemePhaseInfo,
  WINDOWED_OS_THEME_CHANGED_EVENT,
  WINDOWED_OS_THEME_STORAGE_KEY,
  writeWindowedOsTheme,
} from './windowedShell';

describe('windowedShell', () => {
  it('lets windows move partly off all four desktop edges while keeping a recoverable strip visible', () => {
    const desktop = { width: 1000, height: 700 };
    expect(constrainWindowBounds({ x: -700, y: -500, width: 720, height: 420 }, desktop)).toEqual({
      x: -624,
      y: -386,
      width: 720,
      height: 420,
    });
    expect(constrainWindowBounds({ x: 980, y: 690, width: 720, height: 420 }, desktop)).toEqual({
      x: 904,
      y: 666,
      width: 720,
      height: 420,
    });
  });

  it('resolves edge and corner snap targets', () => {
    const desktop = { width: 1200, height: 800 };
    expect(resolveSnapTarget({ x: 2, y: 2 }, desktop)).toBe('top-left');
    expect(resolveSnapTarget({ x: 1198, y: 2 }, desktop)).toBe('top-right');
    expect(resolveSnapTarget({ x: 2, y: 798 }, desktop)).toBe('bottom-left');
    expect(resolveSnapTarget({ x: 1198, y: 798 }, desktop)).toBe('bottom-right');
    expect(resolveSnapTarget({ x: 600, y: 1 }, desktop)).toBe('top');
    expect(resolveSnapTarget({ x: 1, y: 400 }, desktop)).toBe('left');
    expect(resolveSnapTarget({ x: 1199, y: 400 }, desktop)).toBe('right');
    expect(resolveSnapTarget({ x: 600, y: 799 }, desktop)).toBe('bottom');
    expect(resolveSnapTarget({ x: 600, y: 400 }, desktop)).toBeNull();
  });

  it('maps snap targets to desktop bounds', () => {
    const desktop = { width: 1200, height: 800 };
    expect(boundsForSnapTarget('left', desktop)).toEqual({ x: 0, y: 0, width: 600, height: 800 });
    expect(boundsForSnapTarget('top', desktop)).toEqual({ x: 0, y: 0, width: 1200, height: 200 });
    expect(boundsForSnapTarget('top-right', desktop)).toEqual({ x: 600, y: 0, width: 600, height: 400 });
    expect(boundsForSnapTarget('bottom', desktop)).toEqual({ x: 0, y: 400, width: 1200, height: 400 });
  });

  it('restores snapped windows under the cursor before dragging', () => {
    const desktop = { width: 1200, height: 800 };
    expect(
      boundsForRestoredDragStart(
        { x: 0, y: 0, width: 1200, height: 800 },
        { x: 180, y: 120, width: 640, height: 420 },
        { x: 600, y: 18 },
        desktop,
      ),
    ).toEqual({ x: 280, y: 0, width: 640, height: 420 });
  });

  it('defaults the isolated windowed OS theme to light', () => {
    expect(readWindowedOsTheme()).toBe('light');
  });

  it('persists and broadcasts windowed OS theme changes', () => {
    const listener = vi.fn();
    window.addEventListener(WINDOWED_OS_THEME_CHANGED_EVENT, listener);

    writeWindowedOsTheme('dark');

    expect(localStorage.getItem(WINDOWED_OS_THEME_STORAGE_KEY)).toBe('dark');
    expect(readWindowedOsTheme()).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0]?.[0] as CustomEvent<{ theme: string }>).detail.theme).toBe('dark');

    writeWindowedOsTheme('auto');

    expect(localStorage.getItem(WINDOWED_OS_THEME_STORAGE_KEY)).toBe('auto');
    expect(readWindowedOsTheme()).toBe('auto');
    expect(listener).toHaveBeenCalledTimes(2);
    expect((listener.mock.calls[1]?.[0] as CustomEvent<{ theme: string }>).detail.theme).toBe('auto');

    window.removeEventListener(WINDOWED_OS_THEME_CHANGED_EVENT, listener);
  });

  it('resolves automatic windowed OS theme phases from local time', () => {
    expect(resolveWindowedOsThemePhase(new Date(2026, 6, 3, 2))).toBe('deep-night');
    expect(resolveWindowedOsThemePhase(new Date(2026, 6, 3, 6))).toBe('dawn');
    expect(resolveWindowedOsThemePhase(new Date(2026, 6, 3, 9))).toBe('morning');
    expect(resolveWindowedOsThemePhase(new Date(2026, 6, 3, 12))).toBe('bright-noon');
    expect(resolveWindowedOsThemePhase(new Date(2026, 6, 3, 16))).toBe('afternoon');
    expect(resolveWindowedOsThemePhase(new Date(2026, 6, 3, 19))).toBe('dusk');
    expect(resolveWindowedOsThemePhase(new Date(2026, 6, 3, 22))).toBe('night');

    expect(resolveWindowedOsTheme('light', new Date(2026, 6, 3, 22))).toBe('light');
    expect(resolveWindowedOsTheme('dark', new Date(2026, 6, 3, 12))).toBe('dark');
    expect(resolveWindowedOsTheme('auto', new Date(2026, 6, 3, 12))).toBe('light');
    expect(resolveWindowedOsTheme('auto', new Date(2026, 6, 3, 22))).toBe('dark');
  });

  it('reports automatic theme phase progress and the next phase boundary', () => {
    expect(resolveWindowedOsThemePhaseInfo(new Date(2026, 6, 3, 4, 59, 30))).toMatchObject({
      phase: 'deep-night',
      resolvedTheme: 'dark',
      nextPhase: 'dawn',
      msUntilNextPhase: 30_000,
    });
    expect(resolveWindowedOsThemePhaseInfo(new Date(2026, 6, 3, 5))).toMatchObject({
      phase: 'dawn',
      resolvedTheme: 'light',
      nextPhase: 'morning',
      progress: 0,
      msUntilNextPhase: 7_200_000,
    });
    expect(resolveWindowedOsThemePhaseInfo(new Date(2026, 6, 3, 6)).progress).toBeCloseTo(0.5);
    expect(resolveWindowedOsThemePhaseInfo(new Date(2026, 6, 3, 23, 30))).toMatchObject({
      phase: 'night',
      resolvedTheme: 'dark',
      nextPhase: 'deep-night',
      msUntilNextPhase: 1_800_000,
    });
  });
});
