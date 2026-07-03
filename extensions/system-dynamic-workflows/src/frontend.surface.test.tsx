// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowsPage, WorkflowsSidebar } from './frontend.js';

const workflowState = {
  workflows: [
    {
      id: 'run-1',
      name: 'Live workflow',
      status: 'running',
      cwd: '/tmp/work',
      activePhase: 'review',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:01:00.000Z',
      agents: { total: 2, running: 1, completed: 1, failed: 0, cancelled: 0 },
    },
  ],
  templates: [
    {
      id: 'template-1',
      name: 'Review fanout',
      description: 'Review files in parallel.',
      script: 'await workflow.phase("review");\nreturn workflow.finish({ summary: "done" });',
      args: { files: [] },
      cwd: '',
      model: '',
      agentDefaults: { allowedTools: ['read'] },
    },
  ],
  saved: [],
};

function createPa(state = workflowState) {
  return {
    extension: {
      invoke: vi.fn(async (action: string, input: unknown) => {
        if (action === 'listWorkflows') return { workflows: state.workflows };
        if (action === 'listWorkflowTemplates') return { templates: state.templates };
        if (action === 'listSavedWorkflows') return { workflows: state.saved };
        if (action === 'getWorkflow') {
          return {
            workflow: state.workflows.find((workflow) => workflow.id === (input as { workflowId: string }).workflowId),
            script: 'return workflow.finish({ summary: "done" });',
            args: {},
            nodes: [],
            events: [],
          };
        }
        return {};
      }),
    },
    commands: { execute: vi.fn(async () => true) },
  } as never;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function props(
  pa: never,
  context: Partial<{ hash: string; search: string; surfaceId: string; shellPresentation: 'stable' | 'windowed' }> = {},
) {
  return {
    pa,
    context: {
      extensionId: 'system-dynamic-workflows',
      surfaceId: context.surfaceId ?? 'page',
      pathname: '/workflows',
      route: '/workflows',
      search: context.search ?? '',
      hash: context.hash ?? '',
      shellPresentation: context.shellPresentation,
    },
    surface: {
      id: context.surfaceId ?? 'page',
      title: 'Workflows',
      location: context.surfaceId === 'workflows-sidebar' ? 'sidebar' : 'main',
      component: context.surfaceId === 'workflows-sidebar' ? 'WorkflowsSidebar' : 'WorkflowsPage',
    },
    params: {},
  } as never;
}

describe('Dynamic Workflows surfaces', () => {
  it('keeps sidebar loading chrome visually quiet', () => {
    const list = deferred<{ workflows: unknown[] }>();
    const pa = {
      extension: {
        invoke: vi.fn(async (action: string) => {
          if (action === 'listWorkflows') return list.promise;
          return {};
        }),
      },
      commands: { execute: vi.fn(async () => true) },
    } as never;

    render(<WorkflowsSidebar {...props(pa, { surfaceId: 'workflows-sidebar' })} />);

    expect(screen.getByRole('status', { name: 'Loading workflows' })).toBeTruthy();
    expect(screen.queryByText('Loading workflows...')).toBeNull();
  });

  it('renders workflow library in the route-owned sidebar', async () => {
    const pa = createPa();
    render(<WorkflowsSidebar {...props(pa, { surfaceId: 'workflows-sidebar', hash: '#run:run-1' })} />);

    expect(await screen.findByText('Live workflow')).toBeTruthy();
    expect(screen.getByText('Review fanout')).toBeTruthy();
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('renders selected workflow detail as the main route content without the library column', async () => {
    const pa = createPa();
    render(<WorkflowsPage {...props(pa, { hash: '#run:run-1' })} />);

    expect(await screen.findByText('Live workflow')).toBeTruthy();
    expect(screen.getByText(/Active phase: review/)).toBeTruthy();
    expect(screen.queryByText('Workflow Library')).toBeNull();
    expect(screen.queryByText('No active or completed runs')).toBeNull();
  });

  it('opens the saved workflow editor from the route action in the main surface', async () => {
    const pa = createPa();
    render(<WorkflowsPage {...props(pa, { search: '?action=new' })} />);

    const editor = await screen.findByText('New saved workflow');
    expect(editor).toBeTruthy();
    expect(within(document.body).getByRole('textbox', { name: 'Name' })).toBeTruthy();
  });

  it('renders a native windowed workflows surface in desktop mode', async () => {
    const pa = createPa();
    const { container } = render(<WorkflowsPage {...props(pa, { hash: '#run:run-1', shellPresentation: 'windowed' })} />);

    expect(await screen.findAllByText('Live workflow')).toHaveLength(2);
    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
    expect(container.querySelector('.wos-page-rail')).toBeNull();
    expect(container.querySelector('.wos-page-inspector')).toBeNull();
    expect(container.querySelector('.wos-page-main__header .wos-page-eyebrow')).toBeNull();
    expect(screen.queryByText('Workflow context')).toBeNull();
    expect(screen.queryByText('Create, run, and inspect coordinated background agent workflows.')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Runs' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Library' })).toBeTruthy();
    expect(container.querySelector('.wos-list-item[data-accent="workflows"]')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.queryByText('Selection')).toBeNull();
    expect(screen.queryByText('Selected')).toBeNull();
    expect(screen.queryByText('Actions')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Live workflow' })).toBeTruthy();
    expect(container.querySelector('.wos-dialog__titlebar[data-accent="workflows"]')).toBeTruthy();
    expect(container.querySelector('.wos-dialog-stack')).not.toBeNull();
    expect(screen.getByText(/1\/2 complete, 1 running/)).toBeTruthy();
  });

  it('uses scoped windowed form controls in the workflow editor dialog', async () => {
    const pa = createPa();
    const { container } = render(<WorkflowsPage {...props(pa, { shellPresentation: 'windowed' })} />);

    expect(await screen.findAllByText('Live workflow')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'New saved workflow' }));

    const editor = await screen.findByRole('dialog', { name: 'New saved workflow' });
    expect(within(editor).getByRole('textbox', { name: 'Name' }).className).toContain('wos-input');
    expect(within(editor).getByRole('textbox', { name: 'Description' }).className).toContain('wos-input');
    expect(within(editor).getByRole('textbox', { name: 'Workflow input JSON' }).className).toContain('wos-textarea');
    expect(within(editor).getByRole('switch', { name: 'Enable read' })).toBeTruthy();
    expect(container.querySelector('.wos-field')).toBeTruthy();
    expect(container.querySelector('.ui-field')).toBeNull();
  });

  it('uses shared windowed empty-state chrome for empty workflow lists', async () => {
    const pa = createPa({ workflows: [], templates: [], saved: [] });
    const { container } = render(<WorkflowsPage {...props(pa, { shellPresentation: 'windowed' })} />);

    expect(await screen.findByText('No workflow runs yet.')).toBeTruthy();
    expect(screen.getByText('No workflow templates yet.')).toBeTruthy();
    expect(container.querySelectorAll('.wos-empty-state')).toHaveLength(2);
    expect(container.querySelector('.wos-windowed-empty')).toBeNull();
    expect(container.querySelector('.wos-windowed-error')).toBeNull();
  });

  it('uses shared windowed state-block chrome when workflows fail to load', async () => {
    const pa = {
      extension: {
        invoke: vi.fn(async (action: string) => {
          if (action === 'listWorkflows') throw new Error('Workflows could not be loaded.');
          return {};
        }),
      },
      commands: { execute: vi.fn(async () => true) },
    } as never;
    const { container } = render(<WorkflowsPage {...props(pa, { shellPresentation: 'windowed' })} />);

    expect(await screen.findByText('Workflows could not be loaded.')).toBeTruthy();
    expect(screen.getByText('Workflows could not be loaded.').closest('.wos-state-block')?.getAttribute('data-tone')).toBe('danger');
    expect(screen.queryByText('No workflow runs yet.')).toBeNull();
    expect(screen.queryByText('No workflow templates yet.')).toBeNull();
    expect(container.querySelector('.wos-empty-state')).toBeNull();
    expect(container.querySelector('.ui-empty-state')).toBeNull();
    expect(container.querySelector('.ui-error-state')).toBeNull();
  });
});
