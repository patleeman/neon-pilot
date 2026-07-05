// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  StartMenu,
  Taskbar,
  WindowedDataRow,
  WindowedDialog,
  WindowedListItem,
  WindowedMenuPanel,
  WindowedNumberStepper,
} from './windowedOs';

function rect(input: { left: number; top: number; width: number; height: number }): DOMRect {
  return {
    left: input.left,
    top: input.top,
    width: input.width,
    height: input.height,
    right: input.left + input.width,
    bottom: input.top + input.height,
    x: input.left,
    y: input.top,
    toJSON: () => input,
  } as DOMRect;
}

function setElementRect(element: Element, nextRect: DOMRect): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => nextRect,
  });
}

describe('WindowedDialog interactions', () => {
  it('ports attached modeless subwindows to the desktop layer', () => {
    render(
      <div className="windowed-os-shell">
        <main className="wos-desktop" />
        <div className="wos-window__body">
          <WindowedDialog
            title="Automation details"
            accent="automations"
            parentWindowId="route:system-automations:nav"
            parentWindowTitle="Automations"
            onClose={() => undefined}
          >
            Details
          </WindowedDialog>
        </div>
      </div>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Automation details' });
    const layer = dialog.parentElement;
    expect(layer?.classList.contains('wos-dialog-layer')).toBe(true);
    expect(layer?.parentElement?.classList.contains('wos-desktop')).toBe(true);
  });

  it('lets modeless subwindows drag by their titlebar', () => {
    render(
      <WindowedDialog title="Gateway activity" accent="gateways" onClose={() => undefined}>
        Activity
      </WindowedDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Gateway activity' });
    fireEvent.mouseDown(screen.getByText('Gateway activity'), { button: 0, clientX: 120, clientY: 80 });
    fireEvent.mouseMove(window, { clientX: 168, clientY: 116 });

    expect(dialog.getAttribute('data-dragging')).toBe('true');
    expect(dialog.getAttribute('style')).toContain('translate(48px, 36px)');

    fireEvent.mouseUp(window);
    expect(dialog.getAttribute('data-dragging')).toBeNull();
  });

  it('keeps modeless subwindows recoverable when dragged past the desktop edges', () => {
    render(
      <WindowedDialog title="Automation details" accent="automations" onClose={() => undefined}>
        Details
      </WindowedDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Automation details' });
    const layer = dialog.parentElement;
    const titlebar = screen.getByText('Automation details').closest('header');
    if (!layer || !titlebar) throw new Error('Missing dialog geometry elements.');

    setElementRect(layer, rect({ left: 0, top: 0, width: 600, height: 420 }));
    setElementRect(dialog, rect({ left: 120, top: 64, width: 320, height: 220 }));
    setElementRect(titlebar, rect({ left: 120, top: 64, width: 320, height: 44 }));

    fireEvent.mouseDown(titlebar, { button: 0, clientX: 160, clientY: 84 });
    fireEvent.mouseMove(window, { clientX: -700, clientY: -600 });

    expect(dialog.getAttribute('style')).toContain('translate(-344px, -90px)');

    fireEvent.mouseMove(window, { clientX: 900, clientY: 720 });

    expect(dialog.getAttribute('style')).toContain('translate(384px, 322px)');

    fireEvent.mouseUp(window);
  });

  it('keeps modal subwindows fixed for blocking flows', () => {
    render(
      <WindowedDialog title="Confirm install" accent="apps" modal onClose={() => undefined}>
        Install app
      </WindowedDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Confirm install' });
    fireEvent.mouseDown(screen.getByText('Confirm install'), { button: 0, clientX: 120, clientY: 80 });
    fireEvent.mouseMove(window, { clientX: 168, clientY: 116 });

    expect(dialog.getAttribute('data-dragging')).toBeNull();
    expect(dialog.getAttribute('style')).toBeNull();
  });

  it('focuses newly opened subwindows and closes them with Escape', () => {
    const onClose = vi.fn();
    render(
      <WindowedDialog title="Telegram access" accent="gateways" onClose={onClose}>
        <button type="button">Approve user</button>
      </WindowedDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Telegram access' });

    expect(document.activeElement).toBe(dialog);

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Escape handling inside the active subwindow', () => {
    const onClose = vi.fn();
    const onParentEscape = vi.fn();
    render(
      <div onKeyDown={onParentEscape}>
        <WindowedDialog title="Automation details" accent="automations" onClose={onClose}>
          <button type="button">Edit</button>
        </WindowedDialog>
      </div>,
    );

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Automation details' }), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onParentEscape).not.toHaveBeenCalled();
  });
});

describe('WindowedDataRow interactions', () => {
  it('selects the row by click and keyboard without treating itself as a nested control', () => {
    const onSelect = vi.fn();

    render(<WindowedDataRow name="system-browser" meta="Browser app" selected accent="apps" onSelect={onSelect} />);

    const row = screen.getByRole('button', { name: /system-browser/i });
    expect(row.getAttribute('data-selected')).toBe('true');
    expect(row.getAttribute('data-selectable')).toBe('true');
    expect(row.getAttribute('data-accent')).toBe('apps');

    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });

    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it('does not select the row when nested controls handle the interaction', () => {
    const onSelect = vi.fn();
    const onAction = vi.fn();

    render(
      <WindowedDataRow
        name="agent-browser"
        meta="Browser automation surface"
        onSelect={onSelect}
        action={
          <button type="button" onClick={onAction}>
            Details
          </button>
        }
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('WindowedNumberStepper interactions', () => {
  it('increments, decrements, and clamps bounded numeric values', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <WindowedNumberStepper aria-label="Sample rate" value={20} onChange={onChange} min={0} max={100} unit="%" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /increase sample rate/i }));
    expect(onChange).toHaveBeenLastCalledWith(21);

    rerender(<WindowedNumberStepper aria-label="Sample rate" value={0} onChange={onChange} min={0} max={100} unit="%" />);
    fireEvent.click(screen.getByRole('button', { name: /decrease sample rate/i }));
    expect(onChange).toHaveBeenLastCalledWith(0);

    fireEvent.change(screen.getByRole('spinbutton', { name: /sample rate/i }), { target: { value: '125' } });
    expect(onChange).toHaveBeenLastCalledWith(100);
  });

  it('honors custom step sizes for threshold controls', () => {
    const onChange = vi.fn();
    render(<WindowedNumberStepper aria-label="Minimum prompt" value={280} onChange={onChange} min={0} max={2000} step={10} unit="chars" />);

    fireEvent.click(screen.getByRole('button', { name: /increase minimum prompt/i }));

    expect(onChange).toHaveBeenCalledWith(290);
  });
});

describe('WindowedListItem interactions', () => {
  it('keeps selectable navigation rows keyboard-operable', () => {
    const onSelect = vi.fn();
    render(<WindowedListItem title="Providers" active accent="settings" onSelect={onSelect} />);

    const row = screen.getByRole('button', { name: /providers/i });
    expect(row.getAttribute('data-selectable')).toBe('true');

    fireEvent.click(row);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not expose informational rows as focusable controls', () => {
    render(<WindowedListItem title="CHANGELOG.md" meta="Modified" detail="Release notes" accent="chat" />);

    expect(screen.queryByRole('button', { name: /changelog/i })).toBeNull();
    expect(screen.getByText('CHANGELOG.md').closest('.wos-list-item')?.tagName).toBe('DIV');
  });
});

describe('StartMenu interactions', () => {
  it('filters apps by canonical aliases and ids', () => {
    render(
      <StartMenu
        open
        items={[
          { id: 'chat', title: 'Chat', accent: 'chat', aliases: ['conversation'], onSelect: () => undefined },
          {
            id: 'settings',
            title: 'Settings',
            accent: 'settings',
            aliases: ['preferences', 'providers'],
            onSelect: () => undefined,
          },
        ]}
        onClose={() => undefined}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: /search apps/i }), { target: { value: 'preferences' } });

    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chat' })).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: /search apps/i }), { target: { value: 'set' } });

    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('launches apps on primary press without double-selecting on click', () => {
    const onSelect = vi.fn();

    render(<StartMenu open items={[{ id: 'settings', title: 'Settings', accent: 'settings', onSelect }]} onClose={() => undefined} />);

    const settings = screen.getByRole('button', { name: 'Settings' });
    fireEvent.mouseDown(settings, { button: 0 });
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.click(settings);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('Taskbar interactions', () => {
  it('marks focused taskbar windows with their app accent', () => {
    render(
      <Taskbar
        startOpen={false}
        onToggleStart={() => undefined}
        groups={[{ id: 'chat', title: 'Chat', focused: true, count: 2, accent: 'chat', onSelect: () => undefined }]}
        items={[
          { id: 'settings', title: 'Settings', focused: false, accent: 'settings', onSelect: () => undefined },
          { id: 'browser', title: 'Browser', focused: true, accent: 'gateways', meta: 'New conversation', onSelect: () => undefined },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Chat (2 windows)' }).getAttribute('data-focused')).toBe('true');
    expect(screen.getByRole('button', { name: 'Chat (2 windows)' }).getAttribute('data-accent')).toBe('chat');
    expect(screen.getByRole('button', { name: 'Chat (2 windows)' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Chat (2 windows)' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('data-focused')).toBe('false');
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('data-accent')).toBe('settings');
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-pressed')).toBeNull();
    expect(screen.getByRole('button', { name: 'Browser' }).getAttribute('data-focused')).toBe('true');
    expect(screen.getByRole('button', { name: 'Browser' }).getAttribute('data-accent')).toBe('gateways');
    expect(screen.getByRole('button', { name: 'Browser' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Browser' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Browser' }).getAttribute('title')).toBe('Browser attached to New conversation');
    expect(screen.getByText('New conversation').getAttribute('aria-hidden')).toBe('true');
  });

  it('scrolls the focused taskbar window into view', () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      render(
        <Taskbar
          startOpen={false}
          onToggleStart={() => undefined}
          items={[
            { id: 'settings', title: 'Settings', focused: false, accent: 'settings', onSelect: () => undefined },
            { id: 'automations', title: 'Automations', focused: true, accent: 'automations', onSelect: () => undefined },
          ]}
        />,
      );
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });

  it('renders menu item status chips for window state', () => {
    render(
      <WindowedMenuPanel
        ariaLabel="Open chat windows"
        items={[
          { id: 'planning', label: 'Planning thread', status: 'Focused', onSelect: () => undefined },
          { id: 'draft', label: 'New conversation', status: 'Minimized', onSelect: () => undefined },
        ]}
      />,
    );

    const menu = screen.getByRole('menu', { name: 'Open chat windows' });
    expect(screen.getByRole('menuitem', { name: /Planning thread Focused/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /New conversation Minimized/i })).toBeTruthy();
    expect(menu.querySelectorAll('.wos-menu-panel__status')).toHaveLength(2);
  });

  it('activates grouped windows while exposing their menu', () => {
    const onSelect = vi.fn();

    render(
      <Taskbar
        startOpen={false}
        onToggleStart={() => undefined}
        groups={[
          {
            id: 'chat',
            title: 'Chat',
            count: 2,
            accent: 'chat',
            onSelect,
            menu: <div role="menu" aria-label="Open chat windows" />,
          },
        ]}
        items={[]}
      />,
    );

    const groupButton = screen.getByRole('button', { name: 'Chat (2 windows)' });
    expect(groupButton.getAttribute('aria-haspopup')).toBe('menu');

    fireEvent.click(groupButton);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu', { name: 'Open chat windows' })).toBeTruthy();
  });

  it('renders trailing desktop controls outside the open-window nav', () => {
    render(
      <Taskbar
        startOpen={false}
        onToggleStart={() => undefined}
        items={[{ id: 'chat', title: 'New conversation', accent: 'chat', onSelect: () => undefined }]}
        trailing={<button type="button">Caffeinate</button>}
      />,
    );

    const openWindows = screen.getByRole('navigation', { name: 'Open windows' });
    const controls = screen.getByLabelText('Desktop controls');

    expect(within(openWindows).queryByRole('button', { name: 'Caffeinate' })).toBeNull();
    expect(within(controls).getByRole('button', { name: 'Caffeinate' })).toBeTruthy();
  });
});
