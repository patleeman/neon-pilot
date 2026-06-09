import type { DragEvent } from 'react';

export type ActivityTreeDropPosition = 'before' | 'after';

export function getActivityTreeDropPosition(event: DragEvent<HTMLElement>): ActivityTreeDropPosition {
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
}
