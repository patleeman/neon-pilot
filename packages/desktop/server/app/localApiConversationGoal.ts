export interface DesktopConversationGoalInput {
  conversationId: string;
  objective?: string;
}

export interface DesktopConversationGoalState {
  objective: string;
  status: 'active' | 'complete';
  tasks: Array<{ id: string; description: string; status: string }>;
  stopReason: string | null;
  updatedAt: string;
  noProgressTurns: number;
}

export function validateDesktopConversationGoalInput(input: DesktopConversationGoalInput): string {
  const conversationId = input.conversationId.trim();
  if (!conversationId) throw new Error('conversationId required');
  if (Object.prototype.hasOwnProperty.call(input, 'objective') && typeof input.objective !== 'string') {
    throw new Error('objective must be a string');
  }
  return conversationId;
}

export function buildDesktopConversationGoalState(input: { objective?: string; now?: Date }): DesktopConversationGoalState {
  const hasObjective = Object.prototype.hasOwnProperty.call(input, 'objective');
  const trimmedObjective = typeof input.objective === 'string' ? input.objective.trim() : '';
  const updatedAt = (input.now ?? new Date()).toISOString();

  if (hasObjective && trimmedObjective.length > 0) {
    return {
      objective: trimmedObjective,
      status: 'active',
      tasks: [],
      stopReason: null,
      updatedAt,
      noProgressTurns: 0,
    };
  }

  return {
    objective: '',
    status: 'complete',
    tasks: [],
    stopReason: 'cleared',
    updatedAt,
    noProgressTurns: 0,
  };
}
