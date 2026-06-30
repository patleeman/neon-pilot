import type {
  ConversationCheckpointToolDetails,
  ConversationRoutineActivityRun,
  ConversationRoutineActivityStep,
  MessageBlock,
} from '../shared/types';

const CONVERSATION_CHECKPOINT_QUERY_PARAM = 'checkpoint';
const CONVERSATION_CHECKPOINT_FILE_QUERY_PARAM = 'checkpointFile';

interface ConversationCheckpointPresentation {
  action: 'save' | 'get';
  conversationId?: string;
  checkpointId: string;
  commitSha: string;
  shortSha: string;
  title: string;
  subject: string;
  fileCount?: number;
  linesAdded?: number;
  linesDeleted?: number;
  updatedAt?: string;
  routineHooks: ConversationRoutineActivityRun[];
}

function isCheckpointAction(value: unknown): value is ConversationCheckpointPresentation['action'] {
  return value === 'save' || value === 'get';
}

function normalizeToolDetails(value: unknown): ConversationCheckpointToolDetails | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const root = value as Record<string, unknown>;
  const candidate = (
    root.result && typeof root.result === 'object' && !Array.isArray(root.result) ? root.result : value
  ) as Partial<ConversationCheckpointToolDetails>;
  if (!(candidate.action === 'save' || candidate.action === 'get' || candidate.action === 'list')) {
    return null;
  }

  return candidate as ConversationCheckpointToolDetails;
}

function isRoutineActivityStatus(value: unknown): value is ConversationRoutineActivityStep['status'] {
  return value === 'passed' || value === 'warned' || value === 'blocked' || value === 'failed' || value === 'skipped';
}

function normalizeRoutineActivityStep(value: unknown): ConversationRoutineActivityStep | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const routineId = typeof source.routineId === 'string' ? source.routineId.trim() : '';
  const routineName = typeof source.routineName === 'string' ? source.routineName.trim() : '';
  if (!routineId || !routineName || !isRoutineActivityStatus(source.status)) return null;

  const skillRefs = Array.isArray(source.skillRefs)
    ? source.skillRefs.filter((skillRef): skillRef is string => typeof skillRef === 'string' && skillRef.trim().length > 0)
    : undefined;

  return {
    routineId,
    routineName,
    status: source.status,
    ...(typeof source.outcome === 'string' && source.outcome.trim().length > 0 ? { outcome: source.outcome.trim() } : {}),
    ...(typeof source.message === 'string' && source.message.trim().length > 0 ? { message: source.message.trim() } : {}),
    ...(skillRefs && skillRefs.length > 0 ? { skillRefs } : {}),
    ...(typeof source.model === 'string' && source.model.trim().length > 0 ? { model: source.model.trim() } : {}),
    ...(typeof source.provider === 'string' && source.provider.trim().length > 0 ? { provider: source.provider.trim() } : {}),
    ...(typeof source.fallbackUsed === 'boolean' ? { fallbackUsed: source.fallbackUsed } : {}),
  };
}

function normalizeRoutineActivityRun(value: unknown): ConversationRoutineActivityRun | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  const hookId = typeof source.hookId === 'string' ? source.hookId.trim() : '';
  const position = source.position === 'before' || source.position === 'after' ? source.position : null;
  const steps = Array.isArray(source.steps)
    ? source.steps.map(normalizeRoutineActivityStep).filter((step): step is ConversationRoutineActivityStep => Boolean(step))
    : [];
  if (!id || !hookId || !position || !isRoutineActivityStatus(source.status) || steps.length === 0) return null;

  return {
    id,
    hookId,
    position,
    status: source.status,
    ...(typeof source.message === 'string' && source.message.trim().length > 0 ? { message: source.message.trim() } : {}),
    ...(typeof source.startedAt === 'string' && source.startedAt.trim().length > 0 ? { startedAt: source.startedAt.trim() } : {}),
    ...(typeof source.completedAt === 'string' && source.completedAt.trim().length > 0 ? { completedAt: source.completedAt.trim() } : {}),
    steps,
  };
}

function normalizeRoutineActivityRuns(value: unknown): ConversationRoutineActivityRun[] {
  return Array.isArray(value)
    ? value.map(normalizeRoutineActivityRun).filter((run): run is ConversationRoutineActivityRun => Boolean(run))
    : [];
}

function parseSavedCheckpointOutput(output: unknown): Partial<ConversationCheckpointPresentation> | null {
  if (typeof output !== 'string') return null;

  const match = /^Saved checkpoint\s+([a-f0-9]{7,40})\s+(.+?)\s+\((\d+) files?, \+(\d+) -(\d+)\)\.?/im.exec(output.trim());
  if (!match) return null;

  const [, shortSha, subject, fileCount, linesAdded, linesDeleted] = match;
  return {
    action: 'save',
    checkpointId: shortSha,
    commitSha: shortSha,
    shortSha,
    title: subject,
    subject,
    fileCount: Number(fileCount),
    linesAdded: Number(linesAdded),
    linesDeleted: Number(linesDeleted),
  };
}

function parseLoadedCheckpointOutput(output: unknown): Partial<ConversationCheckpointPresentation> | null {
  if (typeof output !== 'string') return null;

  const [firstLine] = output.trim().split('\n');
  const match = /^([a-f0-9]{7,40})\s+(.+)$/.exec(firstLine ?? '');
  if (!match) return null;

  const [, shortSha, subject] = match;
  const filesMatch = /\nFiles:\s+(\d+)\s+\(\+(\d+)\s+-(\d+)\)/i.exec(output);
  return {
    action: 'get',
    checkpointId: shortSha,
    commitSha: shortSha,
    shortSha,
    title: subject,
    subject,
    fileCount: filesMatch ? Number(filesMatch[1]) : undefined,
    linesAdded: filesMatch ? Number(filesMatch[2]) : undefined,
    linesDeleted: filesMatch ? Number(filesMatch[3]) : undefined,
  };
}

function readCheckpointInputSubject(message: unknown): string | null {
  if (typeof message !== 'string') return null;
  const [subject] = message.trim().split('\n');
  return subject?.trim() || null;
}

function readCheckpointInputFileCount(paths: unknown): number | undefined {
  if (!Array.isArray(paths)) return undefined;
  const fileCount = paths.filter((path) => typeof path === 'string' && path.trim().length > 0).length;
  return fileCount > 0 ? fileCount : undefined;
}

export function getConversationCheckpointIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(CONVERSATION_CHECKPOINT_QUERY_PARAM)?.trim();
  return value ? value : null;
}

export function setConversationCheckpointIdInSearch(search: string, checkpointId: string | null): string {
  const params = new URLSearchParams(search);
  if (checkpointId?.trim()) {
    params.set(CONVERSATION_CHECKPOINT_QUERY_PARAM, checkpointId.trim());
  } else {
    params.delete(CONVERSATION_CHECKPOINT_QUERY_PARAM);
    params.delete(CONVERSATION_CHECKPOINT_FILE_QUERY_PARAM);
  }

  const next = params.toString();
  return next.length > 0 ? `?${next}` : '';
}

export function readCheckpointPresentation(block: Extract<MessageBlock, { type: 'tool_use' }>): ConversationCheckpointPresentation | null {
  if (block.tool !== 'checkpoint') {
    return null;
  }

  const details = normalizeToolDetails(block.details);
  const input = block.input as {
    action?: unknown;
    checkpointId?: unknown;
    message?: unknown;
    paths?: unknown;
  };

  const outputPresentation = parseSavedCheckpointOutput(block.output) ?? parseLoadedCheckpointOutput(block.output);
  const inputSubject = readCheckpointInputSubject(input.message);
  const inputFileCount = readCheckpointInputFileCount(input.paths);
  const action = details?.action ?? (isCheckpointAction(input.action) ? input.action : undefined) ?? outputPresentation?.action;
  const checkpointId =
    typeof details?.checkpointId === 'string' && details.checkpointId.trim().length > 0
      ? details.checkpointId.trim()
      : typeof input.checkpointId === 'string' && input.checkpointId.trim().length > 0
        ? input.checkpointId.trim()
        : (outputPresentation?.checkpointId ?? null);
  const commitSha =
    typeof details?.commitSha === 'string' && details.commitSha.trim().length > 0
      ? details.commitSha.trim()
      : (outputPresentation?.commitSha ?? checkpointId);
  const shortSha =
    typeof details?.shortSha === 'string' && details.shortSha.trim().length > 0
      ? details.shortSha.trim()
      : (outputPresentation?.shortSha ?? commitSha?.slice(0, 7) ?? null);
  const title =
    typeof details?.title === 'string' && details.title.trim().length > 0
      ? details.title.trim()
      : typeof details?.subject === 'string' && details.subject.trim().length > 0
        ? details.subject.trim()
        : (outputPresentation?.title ?? inputSubject ?? shortSha);
  const subject =
    typeof details?.subject === 'string' && details.subject.trim().length > 0
      ? details.subject.trim()
      : (outputPresentation?.subject ?? inputSubject ?? title);

  if (!action || !checkpointId || !commitSha || !shortSha || !title || !subject) {
    return null;
  }

  return {
    action,
    conversationId:
      typeof details?.conversationId === 'string' && details.conversationId.trim().length > 0 ? details.conversationId.trim() : undefined,
    checkpointId,
    commitSha,
    shortSha,
    title,
    subject,
    fileCount: typeof details?.fileCount === 'number' ? details.fileCount : (outputPresentation?.fileCount ?? inputFileCount),
    linesAdded: typeof details?.linesAdded === 'number' ? details.linesAdded : outputPresentation?.linesAdded,
    linesDeleted: typeof details?.linesDeleted === 'number' ? details.linesDeleted : outputPresentation?.linesDeleted,
    updatedAt: typeof details?.updatedAt === 'string' ? details.updatedAt : undefined,
    routineHooks: normalizeRoutineActivityRuns(details?.routineHooks),
  };
}
