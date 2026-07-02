// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  boundsForRestoredDragStart,
  boundsForSnapTarget,
  constrainWindowBounds,
  isWindowedShellChild,
  readDesktopShellPresentation,
  resolveSnapTarget,
} from './windowedShell';

describe('windowedShell', () => {
  it('recognizes child route rendering mode', () => {
    expect(isWindowedShellChild('?windowed-child=1')).toBe(true);
    expect(isWindowedShellChild('?windowed-child=0')).toBe(false);
  });

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
    expect(resolveSnapTarget({ x: 600, y: 1 }, desktop)).toBe('maximize');
    expect(resolveSnapTarget({ x: 1, y: 400 }, desktop)).toBe('left');
    expect(resolveSnapTarget({ x: 1199, y: 400 }, desktop)).toBe('right');
    expect(resolveSnapTarget({ x: 600, y: 799 }, desktop)).toBe('bottom');
    expect(resolveSnapTarget({ x: 600, y: 400 }, desktop)).toBeNull();
  });

  it('maps snap targets to desktop bounds', () => {
    const desktop = { width: 1200, height: 800 };
    expect(boundsForSnapTarget('left', desktop)).toEqual({ x: 0, y: 0, width: 600, height: 800 });
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

  it('keeps child frames on the stable shell even when the parent preference is windowed', () => {
    localStorage.setItem('pa:desktop-shell-presentation', 'windowed');
    window.history.replaceState(null, '', '/conversations/new?windowed-child=1');
    expect(readDesktopShellPresentation()).toBe('stable');
  });
});
