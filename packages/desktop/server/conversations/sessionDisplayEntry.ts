export type SessionDisplayRawLine =
  | {
      type: 'message';
      id: string;
      parentId: string | null;
      timestamp: string | number;
      message: DisplayMessageEntryLike['message'];
    }
  | {
      type: 'custom_message';
      id: string;
      parentId: string | null;
      timestamp: string | number;
      content: unknown;
      details?: unknown;
      customType: string;
      display?: boolean;
    }
  | {
      type: 'compaction';
      id: string;
      parentId: string | null;
      timestamp: string | number;
      summary: string;
      tokensBefore: number;
      details?: unknown;
    }
  | {
      type: 'branch_summary';
      id: string;
      parentId: string | null;
      timestamp: string | number;
      summary: string;
      fromId: string;
    };

export interface DisplayMessageEntryLike {
  id: string;
  parentId?: string | null;
  timestamp: string | number;
  message: {
    role: string;
    content?: unknown;
    details?: unknown;
    summary?: string;
    tokensBefore?: number;
    fromId?: string;
    customType?: string;
    display?: boolean;
  };
}

export function buildDisplayMessageEntryFromRawLine(line: SessionDisplayRawLine): DisplayMessageEntryLike {
  if (line.type === 'message') {
    return {
      id: line.id,
      parentId: line.parentId,
      timestamp: line.timestamp,
      message: line.message,
    };
  }

  if (line.type === 'custom_message') {
    return {
      id: line.id,
      parentId: line.parentId,
      timestamp: line.timestamp,
      message: {
        role: 'custom',
        content: line.content,
        details: line.details,
        customType: line.customType,
        display: line.display,
      },
    };
  }

  if (line.type === 'compaction') {
    return {
      id: line.id,
      parentId: line.parentId,
      timestamp: line.timestamp,
      message: {
        role: 'compactionSummary',
        summary: line.summary,
        tokensBefore: line.tokensBefore,
        details: line.details,
      },
    };
  }

  return {
    id: line.id,
    parentId: line.parentId,
    timestamp: line.timestamp,
    message: {
      role: 'branchSummary',
      summary: line.summary,
      fromId: line.fromId,
    },
  };
}
