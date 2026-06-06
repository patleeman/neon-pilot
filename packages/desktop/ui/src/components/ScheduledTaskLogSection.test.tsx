// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { ScheduledTaskLogSection } from './ScheduledTaskLogSection';

vi.mock('../client/api', () => ({
  api: {
    taskLog: vi.fn(),
  },
}));

describe('ScheduledTaskLogSection', () => {
  it('loads and renders the last run log in shared runtime chrome', async () => {
    vi.mocked(api.taskLog).mockResolvedValue({
      path: '/tmp/neon-pilot/tasks/task-1.log',
      log: 'hello from task',
    });

    render(<ScheduledTaskLogSection taskId="task-1" />);

    fireEvent.click(screen.getByRole('button', { name: /last run log/i }));

    await waitFor(() => expect(api.taskLog).toHaveBeenCalledWith('task-1'));
    expect(await screen.findByText('task-1.log')).toBeTruthy();
    expect(screen.getByText('hello from task')).toBeTruthy();
  });
});
