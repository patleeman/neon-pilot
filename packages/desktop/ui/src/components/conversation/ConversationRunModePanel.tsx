import { type FormEvent, useState } from 'react';

import { Button, Select, TextInput } from '../ui';

interface MissionTask {
  id: string;
  description: string;
  status: string;
}

export function ConversationRunModePanel({
  mode,
  mission,
  loop,
  draftLoop,
  onDraftMissionChange,
  onAddMissionTask,
}: {
  mode: 'mission' | 'loop' | 'nudge' | 'manual';
  running?: boolean;
  mission?: { goal: string; tasks: MissionTask[] };
  loop?: { prompt: string; maxIterations: number; iterationsUsed: number; delay: string };
  draftLoop?: { prompt: string; maxIterations: number; delay: string };
  onDraftMissionChange?: (change: { goal: string }) => void;
  onAddMissionTask?: (description: string) => void;
}) {
  const [taskInput, setTaskInput] = useState('');
  const activeLoop = loop ?? (draftLoop ? { ...draftLoop, iterationsUsed: 0 } : null);

  if (mode === 'mission') {
    const tasks = mission?.tasks ?? [];
    const submitTask = (event: FormEvent) => {
      event.preventDefault();
      const trimmed = taskInput.trim();
      if (!trimmed) return;
      onAddMissionTask?.(trimmed);
      setTaskInput('');
    };
    return (
      <section aria-label="Run mode" className="space-y-2">
        <span>Tasks</span>
        <TextInput
          aria-label="Mission goal"
          defaultValue={mission?.goal ?? ''}
          onBlur={(event) => onDraftMissionChange?.({ goal: event.currentTarget.value })}
        />
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>{task.description}</li>
          ))}
        </ul>
        <form onSubmit={submitTask}>
          <TextInput aria-label="Add mission task" value={taskInput} onChange={(event) => setTaskInput(event.currentTarget.value)} />
          <Button type="submit" variant="action" disabled={!taskInput.trim()} title="Add mission task">
            <span aria-hidden="true">+</span>
            Add
          </Button>
        </form>
      </section>
    );
  }

  if (mode === 'loop' && activeLoop) {
    return (
      <section aria-label="Run mode" className="space-y-2">
        <span>Run</span>
        <label>
          Prompt to repeat each iteration
          <TextInput aria-label="Loop prompt" defaultValue={activeLoop.prompt} />
        </label>
        <TextInput aria-label="Loop max iterations" defaultValue={activeLoop.maxIterations} />
        <Select aria-label="Loop delay" value={activeLoop.delay} onChange={() => undefined}>
          <option value={activeLoop.delay}>{activeLoop.delay}</option>
        </Select>
      </section>
    );
  }

  return null;
}
