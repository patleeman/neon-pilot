export type MemoryReflectionCandidateKind = 'preference' | 'project' | 'skill';
export type MemoryReflectionTarget = 'system' | 'scope' | 'skill';
export type MemoryReflectionRejectReason = 'duplicate' | 'sensitive' | 'transient' | 'not_durable';

export interface MemoryReflectionExistingMemory {
  system?: string;
  scopes?: Array<{ name: string; content: string }>;
  skills?: Array<{ name: string; description: string; content?: string }>;
}

export interface MemoryReflectionSource {
  title?: string;
  cwd?: string;
  displaySummary?: string;
  outcome?: string;
  promptSummary?: string;
  searchText?: string;
  keyTerms?: string[];
  filesTouched?: string[];
  existingMemory?: MemoryReflectionExistingMemory;
}

export interface MemoryReflectionCandidate {
  id: string;
  kind: MemoryReflectionCandidateKind;
  target: MemoryReflectionTarget;
  targetPath: string;
  statement: string;
  evidence: string;
  confidence: number;
}

export interface MemoryReflectionReject {
  reason: MemoryReflectionRejectReason;
  evidence: string;
}

export interface MemoryReflectionResult {
  candidates: MemoryReflectionCandidate[];
  rejects: MemoryReflectionReject[];
}

const SENSITIVE_PATTERN =
  /\b(api[-_\s]?key|access[-_\s]?token|auth[-_\s]?token|password|passwd|secret|private[-_\s]?key|credential|bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{8,})\b/i;
const TRANSIENT_PATTERN =
  /\b(today|tomorrow|yesterday|for now|temporar(?:y|ily)|just this once|for this task|for this session|use branch|this branch|meeting|deadline|right now)\b/i;
const PREFERENCE_PATTERN =
  /\b(?:user|patrick|i|we)\s+(?:strongly\s+)?(?:prefers?|likes?|wants?|asked(?:\s+for)?|does not want|doesn't want|dislikes?|hates?|avoids?)\b/i;
const PROJECT_PATTERN =
  /\b(?:this repo|in this repo|repository|repo|project|codebase|extension|package|runtime|desktop|neon pilot|uses?|requires?|must|cannot|should|preserve)\b/i;
const SKILL_PATTERN =
  /\b(?:repeated workflow|workflow|skill-worthy|skill candidate|when .* use|before shipping|release process|checklist)\b/i;
const DURABLE_PATTERN =
  /\b(?:always|prefer|preference|stable|durable|remember|must|cannot|uses?|requires?|workflow|before shipping|style|rule)\b/i;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[^a-z0-9@/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function candidateId(statement: string, target: MemoryReflectionTarget): string {
  let hash = 0;
  for (const char of `${target}:${statement}`) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `${target}-${hash.toString(36)}`;
}

function sentenceFragments(input: MemoryReflectionSource): string[] {
  const parts = [input.displaySummary, input.promptSummary, input.searchText].filter((item): item is string =>
    Boolean(item && item.trim()),
  );
  return parts
    .join('\n')
    .split(/(?:\n+|(?<=[.!?])\s+)/)
    .map((fragment) => fragment.replace(/^[-*]\s+/, '').trim())
    .filter((fragment) => fragment.length >= 12);
}

function existingMemoryText(existingMemory?: MemoryReflectionExistingMemory): string {
  const scopeText = existingMemory?.scopes?.map((scope) => `${scope.name}\n${scope.content}`).join('\n') ?? '';
  const skillText = existingMemory?.skills?.map((skill) => `${skill.name}\n${skill.description}\n${skill.content ?? ''}`).join('\n') ?? '';
  return normalizeText([existingMemory?.system ?? '', scopeText, skillText].join('\n'));
}

function targetPathFor(target: MemoryReflectionTarget): string {
  if (target === 'system') return 'system.md';
  if (target === 'skill') return 'skills/<candidate>/SKILL.md';
  return 'scopes/<active>/memory.md';
}

function classifyFragment(fragment: string, cwd?: string): Pick<MemoryReflectionCandidate, 'kind' | 'target' | 'confidence'> | null {
  if (SKILL_PATTERN.test(fragment)) {
    return { kind: 'skill', target: 'skill', confidence: 0.74 };
  }
  if (PREFERENCE_PATTERN.test(fragment)) {
    return { kind: 'preference', target: 'system', confidence: 0.82 };
  }
  if ((cwd || /\bthis repo|in this repo|project|codebase\b/i.test(fragment)) && PROJECT_PATTERN.test(fragment)) {
    return { kind: 'project', target: 'scope', confidence: 0.78 };
  }
  if (DURABLE_PATTERN.test(fragment) && !TRANSIENT_PATTERN.test(fragment)) {
    return { kind: 'project', target: cwd ? 'scope' : 'system', confidence: 0.58 };
  }
  return null;
}

function cleanedStatement(fragment: string): string {
  return fragment
    .replace(/^(?:the user said(?: that)?|the user says:|summary:)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '');
}

function shouldReject(fragment: string, normalizedExistingMemory: string): MemoryReflectionReject | null {
  if (SENSITIVE_PATTERN.test(fragment)) {
    return { reason: 'sensitive', evidence: fragment };
  }
  if (TRANSIENT_PATTERN.test(fragment)) {
    return { reason: 'transient', evidence: fragment };
  }
  const normalized = normalizeText(cleanedStatement(fragment));
  if (normalized.length >= 16 && normalizedExistingMemory.includes(normalized)) {
    return { reason: 'duplicate', evidence: fragment };
  }
  if (
    !DURABLE_PATTERN.test(fragment) &&
    !PREFERENCE_PATTERN.test(fragment) &&
    !PROJECT_PATTERN.test(fragment) &&
    !SKILL_PATTERN.test(fragment)
  ) {
    return { reason: 'not_durable', evidence: fragment };
  }
  return null;
}

export function extractMemoryReflection(input: MemoryReflectionSource): MemoryReflectionResult {
  const normalizedExistingMemory = existingMemoryText(input.existingMemory);
  const seenStatements = new Set<string>();
  const candidates: MemoryReflectionCandidate[] = [];
  const rejects: MemoryReflectionReject[] = [];

  for (const fragment of sentenceFragments(input)) {
    const reject = shouldReject(fragment, normalizedExistingMemory);
    if (reject) {
      rejects.push(reject);
      continue;
    }

    const classification = classifyFragment(fragment, input.cwd);
    if (!classification) {
      rejects.push({ reason: 'not_durable', evidence: fragment });
      continue;
    }

    const statement = cleanedStatement(fragment);
    const normalized = normalizeText(statement);
    if (!normalized || seenStatements.has(normalized)) {
      rejects.push({ reason: 'duplicate', evidence: fragment });
      continue;
    }
    seenStatements.add(normalized);
    candidates.push({
      id: candidateId(statement, classification.target),
      kind: classification.kind,
      target: classification.target,
      targetPath: targetPathFor(classification.target),
      statement,
      evidence: fragment,
      confidence: classification.confidence,
    });
  }

  return { candidates, rejects };
}
